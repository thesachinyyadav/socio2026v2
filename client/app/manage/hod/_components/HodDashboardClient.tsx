"use client";

import { useMemo, useState } from "react";
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
}

type ModalState = {
  requestId: string;
  eventName: string;
  note: string;
  errorMessage: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const NOTE_MIN_CHARS = 1;

function decisionMessage(action: HodApprovalAction): string {
  if (action === "approve") {
    return "Approval recorded";
  }

  return "Request returned for revision";
}

export default function HodDashboardClient({
  departmentName,
  initialQueue,
  initialMetrics,
  dashboardTitle = "HOD Approval Dashboard",
  approvalApiBasePath = "/api/manage/hod",
}: HodDashboardClientProps) {
  const router = useRouter();

  const [queue, setQueue] = useState<HodApprovalQueueItem[]>(initialQueue);
  const [metrics, setMetrics] = useState<HodDashboardMetrics>(initialMetrics);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const headerSubtitle = useMemo(
    () => `Department Scope: ${departmentName || "My Department"}`,
    [departmentName]
  );

  const applySuccessfulAction = (requestId: string) => {
    setQueue((previous) => previous.filter((row) => row.id !== requestId));
    setMetrics((previous) => ({
      ...previous,
      pendingL1Approvals: Math.max(previous.pendingL1Approvals - 1, 0),
    }));
  };

  const submitAction = async (params: {
    requestId: string;
    action: HodApprovalAction;
    note?: string;
  }) => {
    const { requestId, action, note } = params;
    setActiveRequestId(requestId);

    try {
      const response = await fetch(
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
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update approval request.");
      }

      applySuccessfulAction(requestId);
      setModalState(null);
      toast.success(decisionMessage(action));
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update approval request.";

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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending L1 Approvals</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.pendingL1Approvals}</p>
        </div>
      </div>

      <HodApprovalTable
        rows={queue}
        activeRequestId={activeRequestId}
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
