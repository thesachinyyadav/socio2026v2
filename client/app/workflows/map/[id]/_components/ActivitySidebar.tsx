"use client";

import {
  Check,
  Circle,
  Download,
  LoaderCircle,
  NotebookText,
  UserRound,
  CalendarClock,
  Shield,
} from "lucide-react";

import type { WorkflowMapNodeData } from "./WorkflowNode";

export type TimelineStatus = "done" | "in_progress" | "pending";

export interface WorkflowTimelineItem {
  id: string;
  timestamp: string;
  title: string;
  subtext: string;
  status: TimelineStatus;
}

function TimelineStatusIcon({ status }: { status: TimelineStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-slate-700">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

export default function ActivitySidebar({
  selectedNode,
  timelineItems,
  workflowId,
}: {
  selectedNode: WorkflowMapNodeData | null;
  timelineItems: WorkflowTimelineItem[];
  workflowId: string;
}) {
  return (
    <aside className="h-full min-h-[540px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Node Details</h2>
          <p className="mt-1 text-xs text-slate-500">Workflow ID: {workflowId}</p>
        </div>

        <div className="border-b border-slate-200 px-5 py-4">
          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{selectedNode.nodeName}</h3>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  Active State
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  <span>Role: {selectedNode.roleTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  <span>Approver: {selectedNode.approverName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  <span>{selectedNode.timestamp}</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
                <p className="mt-1 text-sm italic text-slate-700">{selectedNode.notes}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
              Select a node to view details.
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <NotebookText className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Activity Timeline</h3>
          </div>

          <ol className="relative space-y-4">
            {timelineItems.map((item, index) => (
              <li key={item.id} className="relative pl-8">
                {index !== timelineItems.length - 1 ? (
                  <span
                    className="absolute left-[9px] top-6 h-[calc(100%+0.75rem)] w-px bg-slate-300"
                    aria-hidden="true"
                  />
                ) : null}

                <span className="absolute left-0 top-0.5">
                  <TimelineStatusIcon status={item.status} />
                </span>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">{item.timestamp}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.subtext}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Report
          </button>
        </div>
      </div>
    </aside>
  );
}
