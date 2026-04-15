"use client";

import { Clock3, MessageSquareText, UserRound, X } from "lucide-react";

import { ApprovalStatusBadge } from "@/app/manage/_components/approvalWorkflowVisuals";
import type { WorkflowNodeData } from "@/lib/hooks/useEventApprovalWorkflow";

function normalize(value: unknown): string {
  return String(value || "").trim();
}

export default function NodeDetailsPanel({
  isOpen,
  node,
  onClose,
}: {
  isOpen: boolean;
  node: WorkflowNodeData | null;
  onClose: () => void;
}) {
  return (
    <aside
      className={`absolute right-0 top-0 z-30 h-full w-full max-w-[24rem] border-l border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Node Details
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{node?.title || "Select a node"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
            aria-label="Close node details"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</p>
            <div className="mt-2 flex items-center gap-3">
              {node ? <ApprovalStatusBadge status={node.status} /> : null}
              <p className="text-sm font-medium text-slate-700">{node?.description || "Select a node to inspect details."}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Approver Details
            </p>

            {node?.approverName || node?.approverEmail ? (
              <div className="mt-3 flex items-center gap-3">
                {normalize(node.approverAvatarUrl) ? (
                  <img
                    src={node.approverAvatarUrl as string}
                    alt={node.approverName || node.approverEmail || "Approver"}
                    className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500">
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{node.approverName || "Approver"}</p>
                  <p className="text-xs text-slate-500">{node.approverEmail || "Email unavailable"}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No approver action has been recorded yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Timestamp</p>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <Clock3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>{node?.timestamp || "No timestamp available yet."}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Review Notes</p>
            {node?.reviewNote ? (
              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-700">
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  Returned/Rejected Note
                </div>
                <p className="leading-relaxed">{node.reviewNote}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No review note was required for this status.</p>
            )}
          </section>

          {node?.stepCode ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workflow Reference</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-700">{node.stepCode}</p>
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
