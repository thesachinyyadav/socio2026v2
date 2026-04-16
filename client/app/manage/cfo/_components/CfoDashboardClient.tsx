"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ApprovalDecisionModal from "../../hod/_components/ApprovalDecisionModal";
import CfoApprovalTable from "./CfoApprovalTable";
import { CfoApprovalAction, CfoApprovalQueueItem, CfoDashboardMetrics } from "../types";

interface CfoDashboardClientProps {
  campusName: string;
  initialQueue: CfoApprovalQueueItem[];
  initialMetrics: CfoDashboardMetrics;
}

type ModalState = {
  requestId: string;
  eventName: string;
  action: "reject" | "return";
  note: string;
  errorMessage: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const NOTE_MIN_CHARS = 20;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function decisionMessage(action: CfoApprovalAction): string {
  if (action === "approve") {
    return "Approved and forwarded to Finance for approval";
  }

  if (action === "return") {
    return "Request returned for revision";
  }

  return "Request rejected";
}

function getProgressWidthClass(percent: number): string {
  if (percent >= 100) return "w-full";
  if (percent >= 90) return "w-11/12";
  if (percent >= 80) return "w-10/12";
  if (percent >= 70) return "w-9/12";
  if (percent >= 60) return "w-8/12";
  if (percent >= 50) return "w-6/12";
  if (percent >= 40) return "w-5/12";
  if (percent >= 30) return "w-4/12";
  if (percent >= 20) return "w-3/12";
  if (percent >= 10) return "w-2/12";
  if (percent > 0) return "w-1/12";
  return "w-0";
}

export default function CfoDashboardClient({
  campusName,
  initialQueue,
  initialMetrics,
}: CfoDashboardClientProps) {
  const router = useRouter();

  const [queue, setQueue] = useState<CfoApprovalQueueItem[]>(initialQueue);
  const [metrics, setMetrics] = useState<CfoDashboardMetrics>(initialMetrics);
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const schoolOptions = useMemo(
    () =>
      Array.from(new Set(queue.map((item) => item.schoolName)))
        .filter((name) => name.trim().length > 0)
        .sort((left, right) => left.localeCompare(right)),
    [queue]
  );

  const departmentOptions = useMemo(() => {
    const scopedRows =
      selectedSchool === "all"
        ? queue
        : queue.filter((item) => item.schoolName === selectedSchool);

    return Array.from(new Set(scopedRows.map((item) => item.departmentName)))
      .filter((name) => name.trim().length > 0)
      .sort((left, right) => left.localeCompare(right));
  }, [queue, selectedSchool]);

  useEffect(() => {
    if (selectedDepartment === "all") {
      return;
    }

    if (!departmentOptions.includes(selectedDepartment)) {
      setSelectedDepartment("all");
    }
  }, [departmentOptions, selectedDepartment]);

  const filteredQueue = useMemo(() => {
    const schoolFiltered =
      selectedSchool === "all"
        ? queue
        : queue.filter((item) => item.schoolName === selectedSchool);

    if (selectedDepartment === "all") {
      return schoolFiltered;
    }

    return schoolFiltered.filter((item) => item.departmentName === selectedDepartment);
  }, [queue, selectedSchool, selectedDepartment]);

  const applySuccessfulAction = (requestId: string, action: CfoApprovalAction) => {
    const actedRow = queue.find((row) => row.id === requestId) || null;

    if (actedRow) {
      setMetrics((previous) => ({
        ...previous,
        highValuePendingRequests: Math.max(previous.highValuePendingRequests - 1, 0),
        highValuePendingBudget: Math.max(previous.highValuePendingBudget - actedRow.totalBudget, 0),
        campusApprovedBudgetYtd:
          action === "approve"
            ? previous.campusApprovedBudgetYtd + actedRow.totalBudget
            : previous.campusApprovedBudgetYtd,
      }));
    }

    setQueue((previous) => previous.filter((row) => row.id !== requestId));
  };

  const submitAction = async (params: {
    requestId: string;
    action: CfoApprovalAction;
    note?: string;
  }) => {
    const { requestId, action, note } = params;
    setActiveRequestId(requestId);

    try {
      const response = await fetchWithTimeout(
        `/api/manage/cfo/approval-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            note: note?.trim() || null,
          }),
        },
        20000
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update approval request.");
      }

      applySuccessfulAction(requestId, action);
      setModalState(null);
      toast.success(decisionMessage(action));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Approval service timeout. Please try again."
            : error.message
          : "Unable to update approval request.";

      if (modalState && modalState.requestId === requestId) {
        setModalState((previous) =>
          previous ? { ...previous, errorMessage: message } : previous
        );
      } else {
        toast.error(message);
      }
    } finally {
      setActiveRequestId(null);
    }
  };

  const openDecisionModal = (requestId: string, action: "reject" | "return") => {
    const row = queue.find((item) => item.id === requestId);
    if (!row) {
      return;
    }

    setModalState({
      requestId,
      eventName: row.eventName,
      action,
      note: "",
      errorMessage: null,
    });
  };

  const approvalRatio =
    metrics.campusRequestedBudgetYtd > 0
      ? Math.min(
          100,
          Math.round((metrics.campusApprovedBudgetYtd / metrics.campusRequestedBudgetYtd) * 100)
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">CFO / Campus Director Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Campus Scope: {campusName || "My Campus"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Campus Budget Requested vs Approved YTD
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Requested</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {currencyFormatter.format(metrics.campusRequestedBudgetYtd || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Approved</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {currencyFormatter.format(metrics.campusApprovedBudgetYtd || 0)}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
            <div
              className={`h-2 rounded-full bg-emerald-500 ${getProgressWidthClass(approvalRatio)}`}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">{approvalRatio}% approved</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            High-Value Pending Requests
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {metrics.highValuePendingRequests}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Pending Budget: {currencyFormatter.format(metrics.highValuePendingBudget || 0)}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Threshold applied: &gt; {currencyFormatter.format(metrics.l2Threshold || 0)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pending L3 Queue</h2>
            <p className="mt-1 text-sm text-slate-600">
              Includes dean-approved requests pending CFO budget review.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[30rem]">
            <div>
              <label
                htmlFor="cfo-school-filter"
                className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Filter by School
              </label>
              <select
                id="cfo-school-filter"
                value={selectedSchool}
                onChange={(event) => setSelectedSchool(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500"
              >
                <option value="all">All Schools</option>
                {schoolOptions.map((schoolName) => (
                  <option key={schoolName} value={schoolName}>
                    {schoolName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="cfo-department-filter"
                className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Filter by Department
              </label>
              <select
                id="cfo-department-filter"
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500"
              >
                <option value="all">All Departments</option>
                {departmentOptions.map((departmentName) => (
                  <option key={departmentName} value={departmentName}>
                    {departmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <CfoApprovalTable
        rows={filteredQueue}
        activeRequestId={activeRequestId}
        onApprove={(requestId) => {
          void submitAction({ requestId, action: "approve" });
        }}
        onReject={(requestId) => {
          openDecisionModal(requestId, "reject");
        }}
        onReturn={(requestId) => {
          openDecisionModal(requestId, "return");
        }}
      />

      <ApprovalDecisionModal
        isOpen={Boolean(modalState)}
        mode={modalState?.action || "reject"}
        eventName={modalState?.eventName || ""}
        note={modalState?.note || ""}
        minCharacters={NOTE_MIN_CHARS}
        isSubmitting={Boolean(
          activeRequestId && modalState && activeRequestId === modalState.requestId
        )}
        errorMessage={modalState?.errorMessage || null}
        onNoteChange={(nextValue) => {
          setModalState((previous) =>
            previous ? { ...previous, note: nextValue, errorMessage: null } : previous
          );
        }}
        onClose={() => {
          if (!activeRequestId) {
            setModalState(null);
          }
        }}
        onSubmit={() => {
          if (!modalState) {
            return;
          }

          const trimmedNote = modalState.note.trim();
          if (trimmedNote.length < NOTE_MIN_CHARS) {
            setModalState((previous) =>
              previous
                ? {
                    ...previous,
                    errorMessage: `Please enter at least ${NOTE_MIN_CHARS} characters.`,
                  }
                : previous
            );
            return;
          }

          void submitAction({
            requestId: modalState.requestId,
            action: modalState.action,
            note: trimmedNote,
          });
        }}
      />
    </div>
  );
}
