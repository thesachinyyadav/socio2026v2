"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ApprovalDecisionModal from "./ApprovalDecisionModal";
import HodApprovalTable from "./HodApprovalTable";
import { HodApprovalAction, HodApprovalQueueItem, HodDashboardMetrics } from "../types";

interface HodDashboardClientProps {
  departmentName: string;
  initialQueue: HodApprovalQueueItem[];
  initialMetrics: HodDashboardMetrics;
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

  return decisionMessages?.return || "Request returned for revision";
}

export default function HodDashboardClient({
  departmentName,
  initialQueue,
  initialMetrics,
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
  const completionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const headerSubtitle = useMemo(
    () => `Department Scope: ${departmentName || "My Department"}`,
    [departmentName]
  );

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

  const openDecisionModal = (requestId: string) => {
    const row = queue.find((item) => item.id === requestId);
    if (!row) {
      return;
    }

    setModalState({
      requestId,
      eventName: row.eventName,
      note: "",
      errorMessage: null,
    });
  };

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
          openDecisionModal(requestId);
        }}
      />

      <ApprovalDecisionModal
        isOpen={Boolean(modalState)}
        mode="return"
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
              previous
                ? {
                    ...previous,
                    errorMessage: "Revision description is required.",
                  }
                : previous
            );
            return;
          }

          void submitAction({
            requestId: modalState.requestId,
            action: "return",
            note: trimmedNote,
          });
        }}
      />
    </div>
  );
}
