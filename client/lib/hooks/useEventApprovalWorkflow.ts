"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";

import { supabase } from "@/lib/supabaseClient";
import {
  ApprovalVisualStatus,
  getStatusLabel,
} from "@/app/manage/_components/approvalWorkflowVisuals";

const STEM_NODE_ORDER = ["submission", "hod", "dean", "cfo", "accounts"] as const;
type StemNodeKey = (typeof STEM_NODE_ORDER)[number];

type ServiceNodeKey = "it" | "catering" | "venue";

const STEM_POSITIONS: Record<StemNodeKey, { x: number; y: number }> = {
  submission: { x: 0, y: 0 },
  hod: { x: 0, y: 170 },
  dean: { x: 0, y: 340 },
  cfo: { x: 0, y: 510 },
  accounts: { x: 0, y: 680 },
};

const SERVICE_POSITIONS: Record<ServiceNodeKey, { x: number; y: number }> = {
  it: { x: -300, y: 900 },
  catering: { x: 0, y: 900 },
  venue: { x: 300, y: 900 },
};

const STEM_TITLES: Record<StemNodeKey, string> = {
  submission: "Event Submission",
  hod: "HOD Approval",
  dean: "Dean Approval",
  cfo: "CFO Approval",
  accounts: "Accounts Approval",
};

const STEM_ROLE_CODES: Record<StemNodeKey, string> = {
  submission: "SUBMISSION",
  hod: "L1_HOD",
  dean: "L2_DEAN",
  cfo: "L3_CFO",
  accounts: "L4_ACCOUNTS",
};

const SERVICE_TITLES: Record<ServiceNodeKey, string> = {
  it: "IT Logistics",
  catering: "Catering Logistics",
  venue: "Venue Logistics",
};

const SERVICE_ROLE_CODES: Record<ServiceNodeKey, string> = {
  it: "SERVICE_IT",
  catering: "SERVICE_CATERING",
  venue: "SERVICE_VENUE",
};

type ApprovalRequestRow = {
  id: string;
  request_id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  event_id?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  latest_comment?: string | null;
  is_budget_related?: boolean | null;
  approval_level?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApprovalStepRow = {
  id: string;
  approval_request_id?: string | null;
  step_code?: string | null;
  role_code?: string | null;
  sequence_order?: number | null;
  status?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApprovalDecisionRow = {
  id: string;
  approval_request_id?: string | null;
  approval_step_id?: string | null;
  decided_by_user_id?: string | null;
  decided_by_email?: string | null;
  role_code?: string | null;
  decision?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

type ServiceRequestRow = {
  id: string;
  service_request_id?: string | null;
  approval_request_id?: string | null;
  event_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  service_type?: string | null;
  service_role_code?: string | null;
  status?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ServiceDecisionRow = {
  id: string;
  service_request_id?: string | null;
  decided_by_user_id?: string | null;
  decided_by_email?: string | null;
  role_code?: string | null;
  decision?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

type UserRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
};

type EventWorkflowRow = {
  event_id: string;
  approval_request_id?: string | null;
  workflow_status?: string | null;
  workflow_phase?: string | null;
};

type WorkflowSnapshot = {
  eventRow: EventWorkflowRow | null;
  approvalRequest: ApprovalRequestRow | null;
  approvalSteps: ApprovalStepRow[];
  approvalDecisions: ApprovalDecisionRow[];
  serviceRequests: ServiceRequestRow[];
  serviceDecisions: ServiceDecisionRow[];
  usersById: Record<string, UserRow>;
  usersByEmail: Record<string, UserRow>;
};

export type WorkflowNodeData = {
  nodeKey: StemNodeKey | ServiceNodeKey;
  kind: "stem" | "service";
  title: string;
  roleCode: string;
  status: ApprovalVisualStatus;
  statusLabel: string;
  description: string;
  approverName: string | null;
  approverEmail: string | null;
  approverAvatarUrl: string | null;
  timestamp: string | null;
  reviewNote: string | null;
  stepCode: string | null;
  requestId: string | null;
};

export type WorkflowGraphNode = Node<WorkflowNodeData>;

export type QuickApprovalSummaryItem = {
  id: "L1_HOD" | "L2_DEAN";
  label: string;
  status: ApprovalVisualStatus;
  statusLabel: string;
  timestamp: string | null;
  note: string | null;
};

export type EventApprovalWorkflowResult = {
  nodes: WorkflowGraphNode[];
  edges: Edge[];
  quickSummary: QuickApprovalSummaryItem[];
  isLoading: boolean;
  error: string | null;
  requestId: string | null;
  refresh: () => Promise<void>;
};

function normalizeToken(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeLower(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function readableTimestamp(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripRevisionPrefix(value?: string | null): string | null {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const prefix = "RETURN_FOR_REVISION:";
  if (text.toUpperCase().startsWith(prefix)) {
    const withoutPrefix = text.slice(prefix.length).trim();
    return withoutPrefix || null;
  }

  return text;
}

function isDecisionApproved(decision: ApprovalDecisionRow | null): boolean {
  return normalizeToken(decision?.decision) === "APPROVED";
}

function isDecisionRejected(decision: ApprovalDecisionRow | null): boolean {
  const token = normalizeToken(decision?.decision);
  if (token === "REJECTED") {
    return true;
  }

  const comment = normalizeToken(decision?.comment);
  return comment.startsWith("RETURN_FOR_REVISION");
}

function isStepApproved(step: ApprovalStepRow | null): boolean {
  return normalizeToken(step?.status) === "APPROVED";
}

function isStepRejected(step: ApprovalStepRow | null): boolean {
  return normalizeToken(step?.status) === "REJECTED";
}

function isStepPending(step: ApprovalStepRow | null): boolean {
  const token = normalizeToken(step?.status);
  return token === "PENDING" || token === "UNDER_REVIEW";
}

function isStepBlocked(step: ApprovalStepRow | null): boolean {
  const token = normalizeToken(step?.status);
  return token === "WAITING" || token === "QUEUED" || token === "NOT_STARTED";
}

function isRequestRejected(request: ApprovalRequestRow | null): boolean {
  const token = normalizeToken(request?.status);
  return token === "REJECTED" || token === "RETURNED";
}

function hasApprovedWorkflowStatus(workflowStatus: string | null | undefined): boolean {
  const token = normalizeLower(workflowStatus);
  return (
    token.includes("fully_approved") ||
    token.includes("auto_approved") ||
    token.includes("organiser_approved") ||
    token.includes("live") ||
    token.includes("approved")
  );
}

function getFallbackStemStatuses(workflowStatus: string | null | undefined): Record<StemNodeKey, ApprovalVisualStatus> {
  const token = normalizeLower(workflowStatus);
  const fallback: Record<StemNodeKey, ApprovalVisualStatus> = {
    submission: "approved",
    hod: "blocked",
    dean: "blocked",
    cfo: "blocked",
    accounts: "blocked",
  };

  if (token.includes("pending_hod") || token.includes("pending_level_1")) {
    fallback.hod = "pending";
    return fallback;
  }

  if (token.includes("pending_dean") || token.includes("pending_level_2")) {
    fallback.hod = "approved";
    fallback.dean = "pending";
    return fallback;
  }

  if (token.includes("pending_cfo") || token.includes("pending_level_3")) {
    fallback.hod = "approved";
    fallback.dean = "approved";
    fallback.cfo = "pending";
    return fallback;
  }

  if (token.includes("pending_accounts") || token.includes("pending_level_4")) {
    fallback.hod = "approved";
    fallback.dean = "approved";
    fallback.cfo = "approved";
    fallback.accounts = "pending";
    return fallback;
  }

  if (token.includes("rejected") || token.includes("return")) {
    fallback.hod = "rejected";
    return fallback;
  }

  if (hasApprovedWorkflowStatus(workflowStatus)) {
    fallback.hod = "approved";
    fallback.dean = "approved";
    fallback.cfo = "approved";
    fallback.accounts = "approved";
  }

  return fallback;
}

function toRoleSignature(step: ApprovalStepRow | null): string {
  const stepCode = normalizeToken(step?.step_code);
  const roleCode = normalizeToken(step?.role_code);
  return `${stepCode} ${roleCode}`.trim();
}

function matchesStemStep(nodeKey: StemNodeKey, step: ApprovalStepRow): boolean {
  const signature = toRoleSignature(step);

  if (nodeKey === "hod") {
    return signature.includes("HOD") || signature.includes("L1_HOD");
  }

  if (nodeKey === "dean") {
    return signature.includes("DEAN") || signature.includes("L2_DEAN");
  }

  if (nodeKey === "cfo") {
    return signature.includes("CFO") || signature.includes("L3_CFO");
  }

  if (nodeKey === "accounts") {
    return signature.includes("ACCOUNTS") || signature.includes("L4_ACCOUNTS") || signature.includes("ACCOUNT");
  }

  return false;
}

function mapUsersById(rows: UserRow[]): Record<string, UserRow> {
  return rows.reduce<Record<string, UserRow>>((acc, row) => {
    const id = String(row?.id || "").trim();
    if (id) {
      acc[id] = row;
    }
    return acc;
  }, {});
}

function mapUsersByEmail(rows: UserRow[]): Record<string, UserRow> {
  return rows.reduce<Record<string, UserRow>>((acc, row) => {
    const email = normalizeLower(row?.email);
    if (email) {
      acc[email] = row;
    }
    return acc;
  }, {});
}

function inferServiceNodeKey(request: ServiceRequestRow): ServiceNodeKey | null {
  const serviceType = normalizeLower(request.service_type);
  const roleCode = normalizeToken(request.service_role_code);

  if (serviceType === "it" || roleCode === "SERVICE_IT") {
    return "it";
  }

  if (serviceType === "catering" || roleCode === "SERVICE_CATERING") {
    return "catering";
  }

  if (serviceType === "venue" || roleCode === "SERVICE_VENUE") {
    return "venue";
  }

  return null;
}

function deriveStemNodeStatus(input: {
  nodeKey: StemNodeKey;
  step: ApprovalStepRow | null;
  decision: ApprovalDecisionRow | null;
  request: ApprovalRequestRow | null;
  previousStemApproved: boolean;
  fallbackStatus: ApprovalVisualStatus;
  isBudgetRelated: boolean;
}): ApprovalVisualStatus {
  const {
    nodeKey,
    step,
    decision,
    request,
    previousStemApproved,
    fallbackStatus,
    isBudgetRelated,
  } = input;

  if (nodeKey === "submission") {
    return "approved";
  }

  if ((nodeKey === "cfo" || nodeKey === "accounts") && !isBudgetRelated && !step) {
    return "blocked";
  }

  if (isDecisionRejected(decision) || isStepRejected(step)) {
    return "rejected";
  }

  if (isDecisionApproved(decision) || isStepApproved(step)) {
    return "approved";
  }

  if (!previousStemApproved) {
    return "blocked";
  }

  if (isStepPending(step)) {
    return "pending";
  }

  if (isStepBlocked(step)) {
    return "blocked";
  }

  if (step) {
    const token = normalizeToken(step.status);
    if (!token) {
      return "pending";
    }
  }

  if (isRequestRejected(request)) {
    return "rejected";
  }

  return fallbackStatus;
}

function deriveServiceStatus(input: {
  request: ServiceRequestRow;
  decision: ServiceDecisionRow | null;
  accountsApproved: boolean;
}): ApprovalVisualStatus {
  const statusToken = normalizeToken(input.request.status);
  const decisionToken = normalizeToken(input.decision?.decision);
  const noteToken = normalizeToken(input.decision?.comment);

  if (decisionToken === "REJECTED" || statusToken.includes("REJECT") || noteToken.startsWith("RETURN_FOR_REVISION")) {
    return "rejected";
  }

  if (decisionToken === "APPROVED" || statusToken.includes("APPROVED")) {
    return "approved";
  }

  if (statusToken.includes("PENDING") || statusToken.includes("QUEUED") || statusToken.includes("UNDER_REVIEW")) {
    return input.accountsApproved ? "pending" : "blocked";
  }

  return input.accountsApproved ? "pending" : "blocked";
}

function toApproverContext(input: {
  userId?: string | null;
  email?: string | null;
  usersById: Record<string, UserRow>;
  usersByEmail: Record<string, UserRow>;
}): { name: string | null; email: string | null; avatarUrl: string | null } {
  const userId = String(input.userId || "").trim();
  const email = normalizeLower(input.email);

  const byId = userId ? input.usersById[userId] : null;
  const byEmail = email ? input.usersByEmail[email] : null;
  const user = byId || byEmail || null;

  const resolvedName = String(user?.name || "").trim();
  const resolvedEmail = email || normalizeLower(user?.email);

  return {
    name: resolvedName || (resolvedEmail ? resolvedEmail.split("@")[0] : null),
    email: resolvedEmail || null,
    avatarUrl: String(user?.avatar_url || "").trim() || null,
  };
}

async function loadUsersLookup(input: {
  approvalDecisions: ApprovalDecisionRow[];
  serviceDecisions: ServiceDecisionRow[];
}) {
  const userIds = new Set<string>();
  const emails = new Set<string>();

  for (const row of [...input.approvalDecisions, ...input.serviceDecisions]) {
    const userId = String(row.decided_by_user_id || "").trim();
    const email = normalizeLower(row.decided_by_email);

    if (userId) {
      userIds.add(userId);
    }

    if (email) {
      emails.add(email);
    }
  }

  const usersById: Record<string, UserRow> = {};
  const usersByEmail: Record<string, UserRow> = {};

  if (userIds.size > 0) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,name,avatar_url")
      .in("id", Array.from(userIds));

    if (!error && Array.isArray(data)) {
      Object.assign(usersById, mapUsersById(data as UserRow[]));
      Object.assign(usersByEmail, mapUsersByEmail(data as UserRow[]));
    }
  }

  if (emails.size > 0) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,name,avatar_url")
      .in("email", Array.from(emails));

    if (!error && Array.isArray(data)) {
      Object.assign(usersById, mapUsersById(data as UserRow[]));
      Object.assign(usersByEmail, mapUsersByEmail(data as UserRow[]));
    }
  }

  return {
    usersById,
    usersByEmail,
  };
}

function buildGraph(snapshot: WorkflowSnapshot) {
  const approvalRequest = snapshot.approvalRequest;
  const workflowStatus = snapshot.eventRow?.workflow_status || null;

  const approvalSteps = [...snapshot.approvalSteps].sort((a, b) => {
    const seqA = Number(a.sequence_order || 0);
    const seqB = Number(b.sequence_order || 0);
    if (seqA !== seqB) {
      return seqA - seqB;
    }

    const updatedA = new Date(String(a.updated_at || a.created_at || 0)).getTime();
    const updatedB = new Date(String(b.updated_at || b.created_at || 0)).getTime();
    return updatedB - updatedA;
  });

  const latestDecisionByStepId = new Map<string, ApprovalDecisionRow>();
  for (const decision of snapshot.approvalDecisions) {
    const stepId = String(decision.approval_step_id || "").trim();
    if (!stepId || latestDecisionByStepId.has(stepId)) {
      continue;
    }

    latestDecisionByStepId.set(stepId, decision);
  }

  const fallbackStemStatuses = getFallbackStemStatuses(workflowStatus);

  const stemNodes: WorkflowGraphNode[] = [];
  let previousApproved = true;
  const isBudgetRelated =
    approvalRequest?.is_budget_related === true ||
    normalizeLower(workflowStatus).includes("cfo") ||
    normalizeLower(workflowStatus).includes("accounts");

  for (const nodeKey of STEM_NODE_ORDER) {
    const step =
      nodeKey === "submission"
        ? null
        : approvalSteps.find((candidate) => matchesStemStep(nodeKey, candidate)) || null;
    const decision = step ? latestDecisionByStepId.get(step.id) || null : null;

    const status = deriveStemNodeStatus({
      nodeKey,
      step,
      decision,
      request: approvalRequest,
      previousStemApproved: previousApproved,
      fallbackStatus: fallbackStemStatuses[nodeKey],
      isBudgetRelated,
    });

    const approver = toApproverContext({
      userId: decision?.decided_by_user_id || null,
      email: decision?.decided_by_email || null,
      usersById: snapshot.usersById,
      usersByEmail: snapshot.usersByEmail,
    });

    const timestamp = readableTimestamp(
      decision?.created_at || step?.decided_at || step?.updated_at || approvalRequest?.updated_at || null
    );

    const reviewNote = stripRevisionPrefix(decision?.comment || (status === "rejected" ? approvalRequest?.latest_comment : null));

    let description = "Awaiting update.";
    if (status === "approved") {
      description = approver.name
        ? `Approved by ${approver.name}`
        : "Approved";
    } else if (status === "pending") {
      description = "Review in progress.";
    } else if (status === "rejected") {
      description = reviewNote || "Returned for revision.";
    } else {
      description = "Future gate. Waiting on previous approvals.";
    }

    stemNodes.push({
      id: nodeKey,
      type: "approvalNode",
      position: STEM_POSITIONS[nodeKey],
      data: {
        nodeKey,
        kind: "stem",
        title: STEM_TITLES[nodeKey],
        roleCode: STEM_ROLE_CODES[nodeKey],
        status,
        statusLabel: getStatusLabel(status),
        description,
        approverName: approver.name,
        approverEmail: approver.email,
        approverAvatarUrl: approver.avatarUrl,
        timestamp,
        reviewNote,
        stepCode: String(step?.step_code || "").trim() || null,
        requestId: approvalRequest?.id || null,
      },
      draggable: false,
      selectable: true,
      connectable: false,
    });

    previousApproved = previousApproved && status === "approved";
  }

  const serviceRequestsByKey = new Map<ServiceNodeKey, ServiceRequestRow>();
  const sortedServiceRequests = [...snapshot.serviceRequests].sort((a, b) => {
    const timeA = new Date(String(a.updated_at || a.created_at || 0)).getTime();
    const timeB = new Date(String(b.updated_at || b.created_at || 0)).getTime();
    return timeB - timeA;
  });

  for (const request of sortedServiceRequests) {
    const serviceKey = inferServiceNodeKey(request);
    if (!serviceKey || serviceRequestsByKey.has(serviceKey)) {
      continue;
    }

    serviceRequestsByKey.set(serviceKey, request);
  }

  const latestServiceDecisionByRequestId = new Map<string, ServiceDecisionRow>();
  for (const decision of snapshot.serviceDecisions) {
    const requestId = String(decision.service_request_id || "").trim();
    if (!requestId || latestServiceDecisionByRequestId.has(requestId)) {
      continue;
    }

    latestServiceDecisionByRequestId.set(requestId, decision);
  }

  const accountsNode = stemNodes.find((node) => node.id === "accounts") || null;
  const accountsApproved = accountsNode?.data.status === "approved";

  const serviceNodes: WorkflowGraphNode[] = [];
  (Object.keys(SERVICE_POSITIONS) as ServiceNodeKey[]).forEach((serviceKey) => {
    const serviceRequest = serviceRequestsByKey.get(serviceKey);
    if (!serviceRequest) {
      return;
    }

    const decision = latestServiceDecisionByRequestId.get(serviceRequest.id) || null;
    const status = deriveServiceStatus({
      request: serviceRequest,
      decision,
      accountsApproved,
    });

    const approver = toApproverContext({
      userId: decision?.decided_by_user_id || null,
      email: decision?.decided_by_email || null,
      usersById: snapshot.usersById,
      usersByEmail: snapshot.usersByEmail,
    });

    const timestamp = readableTimestamp(
      decision?.created_at || serviceRequest.decided_at || serviceRequest.updated_at || serviceRequest.created_at || null
    );

    const reviewNote = stripRevisionPrefix(decision?.comment || null);
    let description = "Awaiting logistics handling.";

    if (status === "approved") {
      description = approver.name
        ? `Approved by ${approver.name}`
        : "Approved by service desk.";
    } else if (status === "pending") {
      description = "Request queued with service team.";
    } else if (status === "rejected") {
      description = reviewNote || "Returned for logistics revision.";
    } else {
      description = "Will start after Accounts clearance.";
    }

    serviceNodes.push({
      id: `service-${serviceKey}`,
      type: "approvalNode",
      position: SERVICE_POSITIONS[serviceKey],
      data: {
        nodeKey: serviceKey,
        kind: "service",
        title: SERVICE_TITLES[serviceKey],
        roleCode: SERVICE_ROLE_CODES[serviceKey],
        status,
        statusLabel: getStatusLabel(status),
        description,
        approverName: approver.name,
        approverEmail: approver.email,
        approverAvatarUrl: approver.avatarUrl,
        timestamp,
        reviewNote,
        stepCode: String(serviceRequest.service_request_id || "").trim() || null,
        requestId: String(serviceRequest.id || "").trim() || null,
      },
      draggable: false,
      selectable: true,
      connectable: false,
    });
  });

  const edges: Edge[] = [
    {
      id: "edge-submission-hod",
      source: "submission",
      target: "hod",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "edge-hod-dean",
      source: "hod",
      target: "dean",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "edge-dean-cfo",
      source: "dean",
      target: "cfo",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "edge-cfo-accounts",
      source: "cfo",
      target: "accounts",
      type: "smoothstep",
      animated: true,
    },
    ...serviceNodes.map((node) => ({
      id: `edge-accounts-${node.id}`,
      source: "accounts",
      target: node.id,
      type: "smoothstep" as const,
      animated: true,
    })),
  ];

  const nodes: WorkflowGraphNode[] = [...stemNodes, ...serviceNodes];

  const quickSummary: QuickApprovalSummaryItem[] = [
    {
      id: "L1_HOD",
      label: "HOD Approval",
      status: stemNodes.find((node) => node.id === "hod")?.data.status || "blocked",
      statusLabel: getStatusLabel(stemNodes.find((node) => node.id === "hod")?.data.status || "blocked"),
      timestamp: stemNodes.find((node) => node.id === "hod")?.data.timestamp || null,
      note: stemNodes.find((node) => node.id === "hod")?.data.reviewNote || null,
    },
    {
      id: "L2_DEAN",
      label: "Dean Approval",
      status: stemNodes.find((node) => node.id === "dean")?.data.status || "blocked",
      statusLabel: getStatusLabel(stemNodes.find((node) => node.id === "dean")?.data.status || "blocked"),
      timestamp: stemNodes.find((node) => node.id === "dean")?.data.timestamp || null,
      note: stemNodes.find((node) => node.id === "dean")?.data.reviewNote || null,
    },
  ];

  return {
    nodes,
    edges,
    quickSummary,
  };
}

export function useEventApprovalWorkflow(eventId: string): EventApprovalWorkflowResult {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>({
    eventRow: null,
    approvalRequest: null,
    approvalSteps: [],
    approvalDecisions: [],
    serviceRequests: [],
    serviceDecisions: [],
    usersById: {},
    usersByEmail: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const refreshDebounceRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const normalizedEventId = String(eventId || "").trim();
    if (!normalizedEventId) {
      setError("Missing event id for workflow tracker.");
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { data: eventRowData, error: eventRowError } = await supabase
        .from("events")
        .select("event_id,approval_request_id,workflow_status,workflow_phase")
        .eq("event_id", normalizedEventId)
        .maybeSingle();

      if (eventRowError) {
        throw new Error(eventRowError.message || "Unable to fetch event workflow state.");
      }

      const eventRow = (eventRowData as EventWorkflowRow | null) || null;
      let approvalRequest: ApprovalRequestRow | null = null;
      const approvalRequestId = String(eventRow?.approval_request_id || "").trim();

      if (approvalRequestId) {
        const { data, error: requestError } = await supabase
          .from("approval_requests")
          .select(
            "id,request_id,entity_type,entity_ref,event_id,status,submitted_at,decided_at,latest_comment,is_budget_related,approval_level,created_at,updated_at"
          )
          .eq("id", approvalRequestId)
          .maybeSingle();

        if (requestError) {
          throw new Error(requestError.message || "Unable to fetch approval request details.");
        }

        approvalRequest = (data as ApprovalRequestRow | null) || null;
      }

      if (!approvalRequest) {
        const { data, error: requestError } = await supabase
          .from("approval_requests")
          .select(
            "id,request_id,entity_type,entity_ref,event_id,status,submitted_at,decided_at,latest_comment,is_budget_related,approval_level,created_at,updated_at"
          )
          .eq("entity_ref", normalizedEventId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (requestError) {
          throw new Error(requestError.message || "Unable to fetch fallback approval request details.");
        }

        approvalRequest = Array.isArray(data) && data.length > 0 ? (data[0] as ApprovalRequestRow) : null;
      }

      const approvalSteps: ApprovalStepRow[] = [];
      const approvalDecisions: ApprovalDecisionRow[] = [];

      if (approvalRequest?.id) {
        const { data: stepData, error: stepError } = await supabase
          .from("approval_steps")
          .select("id,approval_request_id,step_code,role_code,sequence_order,status,decided_at,created_at,updated_at")
          .eq("approval_request_id", approvalRequest.id)
          .order("sequence_order", { ascending: true });

        if (stepError) {
          throw new Error(stepError.message || "Unable to fetch approval steps.");
        }

        approvalSteps.push(...((stepData as ApprovalStepRow[] | null) || []));

        const { data: decisionData, error: decisionError } = await supabase
          .from("approval_decisions")
          .select(
            "id,approval_request_id,approval_step_id,decided_by_user_id,decided_by_email,role_code,decision,comment,created_at"
          )
          .eq("approval_request_id", approvalRequest.id)
          .order("created_at", { ascending: false });

        if (decisionError) {
          throw new Error(decisionError.message || "Unable to fetch approval decisions.");
        }

        approvalDecisions.push(...((decisionData as ApprovalDecisionRow[] | null) || []));
      }

      let serviceRequests: ServiceRequestRow[] = [];
      const serviceRequestsQuery = await supabase
        .from("service_requests")
        .select(
          "id,service_request_id,approval_request_id,event_id,entity_type,entity_id,service_type,service_role_code,status,decided_at,created_at,updated_at"
        )
        .or(`event_id.eq.${normalizedEventId},and(entity_type.eq.event,entity_id.eq.${normalizedEventId})`)
        .order("updated_at", { ascending: false });

      if (serviceRequestsQuery.error) {
        throw new Error(serviceRequestsQuery.error.message || "Unable to fetch service requests.");
      }

      serviceRequests = (serviceRequestsQuery.data as ServiceRequestRow[] | null) || [];

      let serviceDecisions: ServiceDecisionRow[] = [];
      const serviceRequestIds = serviceRequests.map((item) => String(item.id || "").trim()).filter(Boolean);

      if (serviceRequestIds.length > 0) {
        const { data: serviceDecisionData, error: serviceDecisionError } = await supabase
          .from("service_decisions")
          .select(
            "id,service_request_id,decided_by_user_id,decided_by_email,role_code,decision,comment,created_at"
          )
          .in("service_request_id", serviceRequestIds)
          .order("created_at", { ascending: false });

        if (serviceDecisionError) {
          throw new Error(serviceDecisionError.message || "Unable to fetch service decisions.");
        }

        serviceDecisions = (serviceDecisionData as ServiceDecisionRow[] | null) || [];
      }

      const usersLookup = await loadUsersLookup({
        approvalDecisions,
        serviceDecisions,
      });

      requestIdRef.current = approvalRequest?.id || null;

      setSnapshot({
        eventRow,
        approvalRequest,
        approvalSteps,
        approvalDecisions,
        serviceRequests,
        serviceDecisions,
        usersById: usersLookup.usersById,
        usersByEmail: usersLookup.usersByEmail,
      });
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Unexpected error while loading approval workflow.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshDebounceRef.current !== null) {
      window.clearTimeout(refreshDebounceRef.current);
    }

    refreshDebounceRef.current = window.setTimeout(() => {
      void refresh();
    }, 220);
  }, [refresh]);

  useEffect(() => {
    void refresh();

    return () => {
      if (refreshDebounceRef.current !== null) {
        window.clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [refresh]);

  useEffect(() => {
    const normalizedEventId = String(eventId || "").trim();
    if (!normalizedEventId) {
      return;
    }

    const eventChannel = supabase
      .channel(`event-approval-workflow-events-${normalizedEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `event_id=eq.${normalizedEventId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_requests",
          filter: `entity_ref=eq.${normalizedEventId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `event_id=eq.${normalizedEventId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(eventChannel);
    };
  }, [eventId, scheduleRefresh]);

  useEffect(() => {
    const requestId = requestIdRef.current;
    if (!requestId) {
      return;
    }

    const requestChannel = supabase
      .channel(`event-approval-workflow-request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_steps",
          filter: `approval_request_id=eq.${requestId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_decisions",
          filter: `approval_request_id=eq.${requestId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(requestChannel);
    };
  }, [snapshot.approvalRequest?.id, scheduleRefresh]);

  const graph = useMemo(() => buildGraph(snapshot), [snapshot]);

  return {
    nodes: graph.nodes,
    edges: graph.edges,
    quickSummary: graph.quickSummary,
    isLoading,
    error,
    requestId: snapshot.approvalRequest?.id || null,
    refresh,
  };
}
