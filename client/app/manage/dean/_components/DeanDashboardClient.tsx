"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ApprovalDecisionModal from "../../hod/_components/ApprovalDecisionModal";
import DeanApprovalTable from "./DeanApprovalTable";
import {
  ApprovalHistoryItem,
  DeanApprovalAction,
  DeanApprovalQueueItem,
  DeanDashboardMetrics,
  DeanDepartmentBudgetKpi,
} from "../types";
import { usePersistedDecisions } from "../../_shared/usePersistedDecisions";

type DashboardTab = "pending" | "approved" | "rejected" | "returned";

interface DeanDashboardClientProps {
  schoolName: string;
  l1Threshold: number;
  initialQueue: DeanApprovalQueueItem[];
  initialMetrics: DeanDashboardMetrics;
  initialDepartmentKpis: DeanDepartmentBudgetKpi[];
  initialHistory: ApprovalHistoryItem[];
}

type ModalState = {
  requestId: string;
  eventName: string;
  note: string;
  errorMessage: string | null;
  mode: "return" | "decline";
};

type CompletedActionMap = Record<string, DeanApprovalAction>;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const NOTE_MIN_CHARS = 1;
const ROW_COMPLETION_DISPLAY_MS = 1600;

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

function decisionMessage(action: DeanApprovalAction): string {
  if (action === "approve") {
    return "Approval recorded";
  }

  if (action === "decline") {
    return "Request declined";
  }

  return "Request returned for revision";
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

function formatDecidedAt(isoString: string): string {
  return new Date(isoString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeanDashboardClient({
  schoolName,
  l1Threshold,
  initialQueue,
  initialMetrics,
  initialDepartmentKpis,
  initialHistory,
}: DeanDashboardClientProps) {
  const router = useRouter();

  const [queue, setQueue] = useState<DeanApprovalQueueItem[]>(initialQueue);
  const [metrics, setMetrics] = useState<DeanDashboardMetrics>(initialMetrics);
  const [departmentKpis, setDepartmentKpis] = useState<DeanDepartmentBudgetKpi[]>(
    initialDepartmentKpis
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [completedActions, setCompletedActions] = useState<CompletedActionMap>({});
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("pending");
  const completionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { saveDecision } =
    usePersistedDecisions<DeanApprovalAction>("socio_decisions_dean");

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(queue.map((item) => item.departmentName)))
        .filter((name) => name.trim().length > 0)
        .sort((left, right) => left.localeCompare(right)),
    [queue]
  );

  const filteredQueue = useMemo(() => {
    if (selectedDepartment === "all") {
      return queue;
    }

    return queue.filter((item) => item.departmentName === selectedDepartment);
  }, [queue, selectedDepartment]);

  const approvedHistory = useMemo(() => initialHistory.filter((h) => h.decision === "approved"), [initialHistory]);
  const rejectedHistory = useMemo(() => initialHistory.filter((h) => h.decision === "rejected"), [initialHistory]);
  const returnedHistory = useMemo(() => initialHistory.filter((h) => h.decision === "returned_for_revision"), [initialHistory]);

  useEffect(() => {
    return () => {
      Object.values(completionTimers.current).forEach((timerId) => clearTimeout(timerId));
      completionTimers.current = {};
    };
  }, []);

  const clearCompletionTimer = (requestId: string) => {
    const existing = completionTimers.current[requestId];
    if (existing) {
      clearTimeout(existing);
      delete completionTimers.current[requestId];
    }
  };

  const applySuccessfulAction = (requestId: string, action: DeanApprovalAction) => {
    const actedRow = queue.find((row) => row.id === requestId) || null;

    if (actedRow) {
      saveDecision({
        requestId,
        eventName: actedRow.eventName,
        entityType: actedRow.entityType,
        action,
        decidedAt: new Date().toISOString(),
      });
    }

    setCompletedActions((previous) => ({
      ...previous,
      [requestId]: action,
    }));

    if (actedRow) {
      setMetrics((previous) => ({
        pendingL2Approvals: Math.max(previous.pendingL2Approvals - 1, 0),
        pendingBudgetTotal: Math.max(previous.pendingBudgetTotal - actedRow.totalBudget, 0),
      }));

      if (action === "approve") {
        setDepartmentKpis((previous) =>
          previous.map((row) =>
            row.departmentName === actedRow.departmentName
              ? {
                  ...row,
                  approvedBudget: row.approvedBudget + actedRow.totalBudget,
                }
              : row
          )
        );
      }
    }

    clearCompletionTimer(requestId);
    completionTimers.current[requestId] = setTimeout(() => {
      setQueue((previous) => previous.filter((row) => row.id !== requestId));
      setCompletedActions((previous) => {
        if (!previous[requestId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[requestId];
        return next;
      });
      delete completionTimers.current[requestId];
    }, ROW_COMPLETION_DISPLAY_MS);
  };

  const submitAction = async (params: {
    requestId: string;
    action: DeanApprovalAction;
    note?: string;
  }) => {
    const { requestId, action, note } = params;
    setActiveRequestId(requestId);

    try {
      const response = await fetchWithTimeout(
        `/api/manage/dean/approval-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: action === "decline" ? "reject" : action,
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

  const openDecisionModal = (requestId: string, mode: "return" | "decline" = "return") => {
    const row = queue.find((item) => item.id === requestId);
    if (!row) {
      return;
    }

    setModalState({
      requestId,
      eventName: row.eventName,
      note: "",
      errorMessage: null,
      mode,
    });
  };

  const historyTabs = [
    { key: "pending" as const, label: "Pending", count: queue.length },
    { key: "approved" as const, label: "Approved", count: approvedHistory.length },
    { key: "rejected" as const, label: "Rejected", count: rejectedHistory.length },
    { key: "returned" as const, label: "Returned for Revision", count: returnedHistory.length },
  ];

  const activeHistoryRows =
    activeTab === "approved"
      ? approvedHistory
      : activeTab === "rejected"
        ? rejectedHistory
        : activeTab === "returned"
          ? returnedHistory
          : [];

  function decisionBadge(decision: ApprovalHistoryItem["decision"]) {
    if (decision === "approved") return { label: "Approved", className: "bg-emerald-100 text-emerald-800" };
    if (decision === "rejected") return { label: "Rejected", className: "bg-rose-100 text-rose-800" };
    return { label: "Returned for Revision", className: "bg-amber-100 text-amber-800" };
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Dean Approval Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">School Scope: {schoolName || "My School"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending L2 Approvals
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.pendingL2Approvals}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending Budget Total
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {currencyFormatter.format(metrics.pendingBudgetTotal || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            L1 Threshold Applied
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {currencyFormatter.format(l1Threshold || 0)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {historyTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[#154CB3] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {activeTab === "pending" && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pending L2 Queue</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Includes event and fest requests routed to your school scope.
                </p>
              </div>

              <div className="w-full sm:w-72">
                <label
                  htmlFor="dean-department-filter"
                  className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  Filter by Department
                </label>
                <select
                  id="dean-department-filter"
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

          <DeanApprovalTable
            rows={filteredQueue}
            completedActions={completedActions}
            activeRequestId={activeRequestId}
            onApprove={(requestId) => {
              void submitAction({ requestId, action: "approve" });
            }}
            onReturn={(requestId) => {
              openDecisionModal(requestId, "return");
            }}
            onDecline={(requestId) => {
              openDecisionModal(requestId, "decline");
            }}
          />

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Budget Requested vs Approved by Department
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Comparison uses dean approval outcomes in your school scope.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {departmentKpis.map((kpi) => {
                const ratio =
                  kpi.requestedBudget > 0
                    ? Math.min(100, Math.round((kpi.approvedBudget / kpi.requestedBudget) * 100))
                    : 0;

                return (
                  <article
                    key={kpi.departmentName}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {kpi.departmentName}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      Requested: {currencyFormatter.format(kpi.requestedBudget || 0)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      Approved: {currencyFormatter.format(kpi.approvedBudget || 0)}
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full bg-emerald-500 ${getProgressWidthClass(ratio)}`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{ratio}% approved</p>
                  </article>
                );
              })}
              {departmentKpis.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                  No department-level KPI data available yet.
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {activeTab !== "pending" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {activeHistoryRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No {activeTab === "approved" ? "approved" : activeTab === "rejected" ? "rejected" : "returned"} requests recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Event / Fest</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Note</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Decided At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeHistoryRows.map((item) => {
                    const badge = decisionBadge(item.decision);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{item.eventName}</p>
                          <p className="text-xs text-slate-500 capitalize">{item.entityType}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.departmentName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                          {item.comment || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {formatDecidedAt(item.decidedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ApprovalDecisionModal
        isOpen={Boolean(modalState)}
        mode={modalState?.mode === "decline" ? "reject" : "return"}
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
              previous ? { ...previous, errorMessage: "A note is required." } : previous
            );
            return;
          }

          void submitAction({
            requestId: modalState.requestId,
            action: modalState.mode === "decline" ? "decline" : "return",
            note: trimmedNote,
          });
        }}
      />
    </div>
  );
}
