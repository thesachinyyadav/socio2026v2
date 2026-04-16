"use client";

import { Check, Clock3, LoaderCircle, X } from "lucide-react";
import { NodeProps } from "reactflow";

export type WorkflowMapNodeStatus = "approved" | "in_progress" | "pending" | "rejected";

export interface WorkflowMapNodeData {
  nodeName: string;
  roleTitle: string;
  approverName: string;
  approverInitials: string;
  approvalDate: string;
  timestamp: string;
  notes: string;
  status: WorkflowMapNodeStatus;
}

function StatusIndicator({ status }: { status: WorkflowMapNodeStatus }) {
  if (status === "approved") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <Check className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
        <X className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-400 text-white shadow-sm">
      <Clock3 className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export default function WorkflowNode({ data, selected }: NodeProps<WorkflowMapNodeData>) {
  return (
    <div
      className={`relative w-[238px] rounded-lg bg-white px-4 py-3 shadow-sm transition-all ${
        selected ? "border-2 border-blue-600" : "border border-slate-200"
      }`}
    >
      <div className="absolute right-3 top-3">
        <StatusIndicator status={data.status} />
      </div>

      <p className="pr-10 text-sm font-semibold text-slate-900">{data.roleTitle}</p>

      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
          {data.approverInitials}
        </span>

        <div>
          <p className="text-sm font-medium text-slate-800">{data.approverName}</p>
          <p className="text-xs text-slate-500">{data.approvalDate}</p>
        </div>
      </div>

      {selected ? (
        <p className="mt-3 text-xs font-medium text-blue-700">Active selection</p>
      ) : null}
    </div>
  );
}
