"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  Node,
  NodeProps,
  ReactFlow,
} from "reactflow";
import { RefreshCcw, Workflow, X } from "lucide-react";

import "reactflow/dist/style.css";

import NodeDetailsPanel from "@/app/manage/_components/NodeDetailsPanel";
import {
  ApprovalStatusIcon,
  getStatusVisualConfig,
} from "@/app/manage/_components/approvalWorkflowVisuals";
import {
  useEventApprovalWorkflow,
  WorkflowNodeData,
} from "@/lib/hooks/useEventApprovalWorkflow";

function nodeColor(node: Node<WorkflowNodeData>): string {
  const status = node.data?.status;

  if (status === "approved") {
    return "#10b981";
  }

  if (status === "pending") {
    return "#f59e0b";
  }

  if (status === "rejected") {
    return "#ef4444";
  }

  return "#94a3b8";
}

function ApprovalFlowNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  const visual = getStatusVisualConfig(data.status);

  return (
    <div
      className={`w-[228px] rounded-2xl px-4 py-3 shadow-lg transition-all ${visual.nodeClassName} ${
        selected ? "ring-2 ring-[#154cb3]/40" : "ring-1 ring-transparent"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          {data.kind === "service" ? "Logistics" : "Approval"}
        </p>
        <ApprovalStatusIcon status={data.status} animatePending className="h-4.5 w-4.5" />
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{data.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{data.description}</p>
      <p className={`mt-2 text-[11px] ${visual.helperTextClassName}`}>
        {data.timestamp ? `Updated ${data.timestamp}` : "Timestamp pending"}
      </p>
    </div>
  );
}

const nodeTypes = {
  approvalNode: ApprovalFlowNode,
};

export default function ApprovalMindmapModal({
  open,
  onClose,
  eventId,
  eventTitle,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle?: string;
}) {
  const { nodes, edges, isLoading, error, refresh } = useEventApprovalWorkflow(eventId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const stillExists = nodes.some((node) => node.id === selectedNodeId);
    if (!stillExists) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId)?.data || null,
    [nodes, selectedNodeId]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-slate-50 via-white to-slate-100 shadow-[0_40px_120px_-20px_rgba(2,6,23,0.45)]">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#154cb3]">
              Event Approval Mindmap
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">
              {eventTitle || "Workflow Overview"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              aria-label="Close workflow mindmap"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(21,76,179,0.09),_transparent_58%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.08),_transparent_55%)]" />

          {isLoading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-700 shadow-lg backdrop-blur">
                Loading workflow graph...
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute left-4 top-4 z-20 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-md">
              {error}
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1.15 }}
            minZoom={0.3}
            maxZoom={1.4}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            className="relative z-10"
          >
            <Background gap={26} size={1.2} color="#cbd5e1" />
            <MiniMap
              zoomable
              pannable
              nodeColor={nodeColor}
              className="!border !border-slate-200 !bg-white/90"
              maskColor="rgba(15,23,42,0.08)"
            />
            <Controls className="!border !border-slate-200 !bg-white" />
          </ReactFlow>

          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-md backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Workflow className="h-4 w-4 text-[#154cb3]" aria-hidden="true" />
              Click a node to inspect approver details and review notes
            </div>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-0 z-30">
            <div className="pointer-events-auto h-full">
              <NodeDetailsPanel
                isOpen={Boolean(selectedNode)}
                node={selectedNode}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
