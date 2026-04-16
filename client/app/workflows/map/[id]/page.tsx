"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
  ReactFlow,
} from "reactflow";
import {
  FileText,
  LayoutDashboard,
  Map,
  Settings,
  Workflow,
} from "lucide-react";

import "reactflow/dist/style.css";

import ActivitySidebar, {
  WorkflowTimelineItem,
} from "./_components/ActivitySidebar";
import WorkflowNode, {
  WorkflowMapNodeData,
} from "./_components/WorkflowNode";

const nodeTypes = {
  workflowNode: WorkflowNode,
};

function normalizeWorkflowId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim() || "EVT-2026-001";
  }

  return String(value || "").trim() || "EVT-2026-001";
}

export default function WorkflowMapPage() {
  const params = useParams<{ id: string }>();
  const workflowId = normalizeWorkflowId(params?.id);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("dean");

  const baseNodes = useMemo<Node<WorkflowMapNodeData>[]>(
    () => [
      {
        id: "submission",
        type: "workflowNode",
        position: { x: 40, y: 170 },
        data: {
          nodeName: "Coordinator Submission",
          roleTitle: "Coordinator",
          approverName: "Aarav Menon",
          approverInitials: "AM",
          approvalDate: "16 Apr 2026",
          timestamp: "16 Apr 2026, 09:10 AM",
          notes: "Submission package finalized with event scope and budget summary.",
          status: "approved",
        },
      },
      {
        id: "hod",
        type: "workflowNode",
        position: { x: 320, y: 170 },
        data: {
          nodeName: "HOD Approval",
          roleTitle: "HOD",
          approverName: "Dr. Vikram Rao",
          approverInitials: "VR",
          approvalDate: "16 Apr 2026",
          timestamp: "16 Apr 2026, 09:42 AM",
          notes: "Department-level compliance verified and approved.",
          status: "approved",
        },
      },
      {
        id: "dean",
        type: "workflowNode",
        position: { x: 600, y: 170 },
        data: {
          nodeName: "Dean Approval",
          roleTitle: "Dean",
          approverName: "Sarah Chen",
          approverInitials: "SC",
          approvalDate: "16 Apr 2026",
          timestamp: "16 Apr 2026, 10:15 AM",
          notes: "Approved with recommendation to align vendor communication timeline.",
          status: "approved",
        },
      },
      {
        id: "cfo",
        type: "workflowNode",
        position: { x: 880, y: 170 },
        data: {
          nodeName: "CFO Review",
          roleTitle: "CFO",
          approverName: "Neha Kapoor",
          approverInitials: "NK",
          approvalDate: "In Review",
          timestamp: "16 Apr 2026, 11:08 AM",
          notes: "Finance verification in progress for budget allocation and vendor advances.",
          status: "in_progress",
        },
      },
      {
        id: "accounts",
        type: "workflowNode",
        position: { x: 1160, y: 170 },
        data: {
          nodeName: "Accounts Approval",
          roleTitle: "Accounts",
          approverName: "Priya Sharma",
          approverInitials: "PS",
          approvalDate: "Waiting",
          timestamp: "Pending CFO decision",
          notes: "Will open once CFO signs off the budget and handoff packet.",
          status: "pending",
        },
      },
      {
        id: "logistics",
        type: "workflowNode",
        position: { x: 1440, y: 170 },
        data: {
          nodeName: "Logistics Activation",
          roleTitle: "Services",
          approverName: "Ops Queues",
          approverInitials: "SQ",
          approvalDate: "Queued",
          timestamp: "Awaiting Accounts approval",
          notes: "IT, Venue, Catering, and Stalls requests will begin after Accounts approval.",
          status: "pending",
        },
      },
    ],
    []
  );

  const flowNodes = useMemo(
    () =>
      baseNodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [baseNodes, selectedNodeId]
  );

  const blueArrow = {
    type: MarkerType.ArrowClosed,
    color: "#2563eb",
    width: 20,
    height: 20,
  } as const;

  const flowEdges = useMemo<Edge[]>(
    () => [
      {
        id: "e-submission-hod",
        source: "submission",
        target: "hod",
        type: "smoothstep",
        markerEnd: blueArrow,
        style: { stroke: "#2563eb", strokeWidth: 3.2 },
      },
      {
        id: "e-hod-dean",
        source: "hod",
        target: "dean",
        type: "smoothstep",
        markerEnd: blueArrow,
        style: { stroke: "#2563eb", strokeWidth: 3.2 },
      },
      {
        id: "e-dean-cfo",
        source: "dean",
        target: "cfo",
        type: "smoothstep",
        markerEnd: blueArrow,
        style: { stroke: "#2563eb", strokeWidth: 3.2 },
      },
      {
        id: "e-cfo-accounts",
        source: "cfo",
        target: "accounts",
        type: "smoothstep",
        markerEnd: blueArrow,
        animated: true,
        style: { stroke: "#2563eb", strokeWidth: 3, strokeDasharray: "5 5" },
      },
      {
        id: "e-accounts-logistics",
        source: "accounts",
        target: "logistics",
        type: "smoothstep",
        markerEnd: blueArrow,
        animated: true,
        style: { stroke: "#2563eb", strokeWidth: 3, strokeDasharray: "5 5" },
      },
    ],
    []
  );

  const selectedNode = useMemo(
    () => flowNodes.find((node) => node.id === selectedNodeId)?.data || null,
    [flowNodes, selectedNodeId]
  );

  const timelineItems = useMemo<WorkflowTimelineItem[]>(
    () => [
      {
        id: "t1",
        status: "done",
        timestamp: "16 Apr 2026, 09:10 AM",
        title: "Request Submitted by Aarav Menon",
        subtext: "Workflow initiated with event and budget metadata.",
      },
      {
        id: "t2",
        status: "done",
        timestamp: "16 Apr 2026, 09:42 AM",
        title: "HOD Approved by Dr. Vikram Rao",
        subtext: "Department scope and policy checks completed.",
      },
      {
        id: "t3",
        status: "done",
        timestamp: "16 Apr 2026, 10:15 AM",
        title: "Dean Approved by Sarah Chen",
        subtext: "Academic approval granted with timeline note.",
      },
      {
        id: "t4",
        status: "in_progress",
        timestamp: "16 Apr 2026, 11:08 AM",
        title: "CFO Review In Progress",
        subtext: "Finance review is currently active on this request.",
      },
      {
        id: "t5",
        status: "pending",
        timestamp: "Pending",
        title: "Accounts Decision Pending",
        subtext: "Will proceed after CFO signs off.",
      },
      {
        id: "t6",
        status: "pending",
        timestamp: "Pending",
        title: "Logistics Services Pending",
        subtext: "L5 service approvals will start after Accounts approval.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 md:px-5 md:py-6">
      <div className="mx-auto w-full max-w-[1860px]">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_350px]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Approval Workflow Map</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">Tracking request {workflowId}</p>
            </div>

            <nav className="space-y-1">
              <Link
                href="/manage"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </Link>

              <Link
                href={`/workflows/map/${encodeURIComponent(workflowId)}`}
                className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
              >
                <Map className="h-4 w-4" aria-hidden="true" />
                Approval Maps
              </Link>

              <Link
                href="/manage"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                My Requests
              </Link>

              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
            </nav>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h1 className="text-lg font-semibold text-slate-900">Event Approval Workflow</h1>
              <p className="text-sm text-slate-600">Interactive horizontal map for approval stages and handoffs.</p>
            </div>

            <div className="h-[72vh] min-h-[560px] bg-white">
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
                minZoom={0.45}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1.3}
                  color="#cbd5e1"
                />
                <Controls position="bottom-left" />
              </ReactFlow>
            </div>
          </section>

          <ActivitySidebar
            selectedNode={selectedNode}
            timelineItems={timelineItems}
            workflowId={workflowId}
          />
        </div>
      </div>
    </div>
  );
}
