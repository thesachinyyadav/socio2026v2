"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ApprovalDecisionModal from "./ApprovalDecisionModal";
import HodApprovalTable from "./HodApprovalTable";
import { ApprovalHistoryItem, HodApprovalAction, HodApprovalQueueItem, HodDashboardMetrics } from "../types";
import { usePersistedDecisions } from "../../_shared/usePersistedDecisions";

type DashboardTab = "pending" | "approved" | "rejected" | "returned";

interface HodDashboardClientProps {
  departmentName: string;
  initialQueue: HodApprovalQueueItem[];
  initialMetrics: HodDashboardMetrics;
  initialHistory: ApprovalHistoryItem[];
  dashboardTitle?: string;
  approvalApiBasePath?: string;
  pendingMetricLabel?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  eventDetailBasePath?: string;
  decisionMessages?: {
    approve?: string;
    return?: string;
  };
}

type ModalState = {
  requestId: string;
  eventName: string;
  note: string;
  errorMessage: string | null;
  mode: "return" | "decline";
};

type CompletedActionMap = Record<string, HodApprovalAction>;

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

function decisionMessage(
  action: HodApprovalAction,
  decisionMessages?: {
    approve?: string;
    return?: string;
  }
): string {
  if (action === "approve") {
    return decisionMessages?.approve || "Approval recorded";
  }

  if (action === "decline") {
    return "Request declined";
  }

  return decisionMessages?.return || "Request returned for revision";
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

export default function HodDashboardClient({
  departmentName,
  initialQueue,
  initialMetrics,
  initialHistory = [],
  dashboardTitle = "HOD Approval Dashboard",
  approvalApiBasePath = "/api/manage/hod",
  pendingMetricLabel = "Pending L1 Approvals",
  emptyStateTitle,
  emptyStateDescription,
  eventDetailBasePath,
  decisionMessages,
}: HodDashboardClientProps) {
  const router = useRouter();

  const [queue, setQueue] = useState<HodApprovalQueueItem[]>(initialQueue);
  const [metrics, setMetrics] = useState<HodDashboardMetrics>(initialMetrics);
  const [completedActions, setCompletedActions] = useState<CompletedActionMap>({});
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("pending");
  const completionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { saveDecision } =
    usePersistedDecisions<HodApprovalAction>("socio_decisions_hod");

  const headerSubtitle = useMemo(
    () => `Department Scope: ${departmentName || "My Department"}`,
    [departmentName]
  );

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

  const applySuccessfulAction = (requestId: string, action: HodApprovalAction) => {
    const row = queue.find((r) => r.id === requestId);

    if (row) {
      saveDecision({
        requestId,
        eventName: row.eventName,
        entityType: row.entityType,
        action,
        decidedAt: new Date().toISOString(),
      });
    }

    setCompletedActions((previous) => ({
      ...previous,
      [requestId]: action,
    }));

    setMetrics((previous) => ({
      ...previous,
      pendingL1Approvals: Math.max(previous.pendingL1Approvals - 1, 0),
    }));

    clearCompletionTimer(requestId);
    completionTimers.current[requestId] = setTimeout(() => {
      setQueue((previous) => previous.filter((r) => r.id !== requestId));
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
    action: HodApprovalAction;
    note?: string;
  }) => {
    const { requestId, action, note } = params;
    setActiveRequestId(requestId);

    try {
      const response = await fetchWithTimeout(
        `${approvalApiBasePath}/approval-requests/${encodeURIComponent(requestId)}`,
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
      toast.success(decisionMessage(action, decisionMessages));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Approval service timeout. Please try again."
            : error.message
          : "Unable to update approval request.";

      if (modalState && modalState.requestId === requestId) {
        setModalState((previous) => (previous ? { ...previous, errorMessage: message } : previous));
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
        <h1 className="text-2xl font-bold text-slate-900">{dashboardTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">{headerSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dept Budget Used YTD</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {currencyFormatter.format(metrics.deptBudgetUsedYtd || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{pendingMetricLabel}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.pendingL1Approvals}</p>
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
        <HodApprovalTable
          rows={queue}
          completedActions={completedActions}
          activeRequestId={activeRequestId}
          emptyStateTitle={emptyStateTitle}
          emptyStateDescription={emptyStateDescription}
          eventDetailBasePath={eventDetailBasePath}
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
        isSubmitting={Boolean(activeRequestId && modalState && activeRequestId === modalState.requestId)}
        errorMessage={modalState?.errorMessage || null}
        onNoteChange={(nextValue) => {
          setModalState((previous) => (previous ? { ...previous, note: nextValue, errorMessage: null } : previous));
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
