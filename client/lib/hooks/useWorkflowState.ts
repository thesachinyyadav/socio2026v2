"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";

import { supabase } from "@/lib/supabaseClient";
import {
  ApprovalVisualStatus,
  getStatusLabel,
} from "@/app/manage/_components/approvalWorkflowVisuals";

export type WorkflowType = "event" | "fest";

type StemNodeKey = "submission" | "hod" | "dean" | "cfo" | "accounts";
type ServiceNodeKey = "it" | "catering" | "venue";
export type WorkflowNodeKey = StemNodeKey | ServiceNodeKey;

const STEM_POSITIONS: Record<StemNodeKey, { x: number; y: number }> = {
  submission: { x: 0, y: 0 },
  hod: { x: 0, y: 170 },
  dean: { x: 0, y: 340 },
  cfo: { x: 0, y: 510 },
  accounts: { x: 0, y: 510 },
};

const SERVICE_POSITIONS: Record<ServiceNodeKey, { x: number; y: number }> = {
  it: { x: -320, y: 760 },
  catering: { x: 0, y: 760 },
  venue: { x: 320, y: 760 },
};

const STEM_ROLE_CODES: Record<StemNodeKey, string> = {
  submission: "SUBMISSION",
  hod: "L1_HOD",
  dean: "L2_DEAN",
  cfo: "L3_CFO",
  accounts: "L4_ACCOUNTS",
};

const STEM_TITLES: Record<StemNodeKey, string> = {
  submission: "Submission",
  hod: "HOD Approval",
  dean: "Dean Approval",
  cfo: "CFO Approval",
  accounts: "Accounts Approval",
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

type GenericRow = Record<string, unknown>;

type WorkflowEntityRow = {
  workflowId: string;
  title: string;
  approvalRequestId: string | null;
  workflowStatus: string | null;
  updatedAt: string | null;
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

export type WorkflowNodeData = {
  nodeKey: WorkflowNodeKey;
  kind: "stem" | "service";
  title: string;
  roleCode: string;
  status: ApprovalVisualStatus;
  statusLabel: string;
  description: string;
  approverName: string | null;
  approverEmail: string | null;
  approverRole: string | null;
  approverAvatarUrl: string | null;
  timestamp: string | null;
  reviewNote: string | null;
  stepCode: string | null;
  requestId: string | null;
};

export type WorkflowGraphNode = Node<WorkflowNodeData>;

export type WorkflowTimelineEvent = {
  id: string;
  title: string;
  subtitle: string;
  status: ApprovalVisualStatus;
  timestamp: string | null;
  updatedAt: string | null;
  actorName: string | null;
  actorEmail: string | null;
  roleCode: string | null;
  note: string | null;
  source: "submission" | "approval" | "service" | "incident";
};

export type WorkflowQuickSummaryStageId = "L1_HOD" | "L2_DEAN" | "L3_CFO" | "L4_ACCOUNTS";

export type WorkflowQuickSummaryItem = {
  id: WorkflowQuickSummaryStageId;
  label: string;
  status: ApprovalVisualStatus;
  statusLabel: string;
  timestamp: string | null;
  note: string | null;
};

type WorkflowSnapshot = {
  entity: WorkflowEntityRow | null;
  approvalRequest: ApprovalRequestRow | null;
  approvalSteps: ApprovalStepRow[];
  approvalDecisions: ApprovalDecisionRow[];
  serviceRequests: ServiceRequestRow[];
  serviceDecisions: ServiceDecisionRow[];
  incidentLogs: GenericRow[];
  usersById: Record<string, UserRow>;
  usersByEmail: Record<string, UserRow>;
};

export type WorkflowStateResult = {
  entityTitle: string;
  nodes: WorkflowGraphNode[];
  edges: Edge[];
  timelineEvents: WorkflowTimelineEvent[];
  quickSummary: WorkflowQuickSummaryItem[];
  requestId: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeUpper(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function toReadableTimestamp(value?: string | null): string | null {
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

function toTimestampMs(value?: string | null): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function stripRevisionPrefix(value?: string | null): string | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const prefix = "RETURN_FOR_REVISION:";
  if (raw.toUpperCase().startsWith(prefix)) {
    const cleaned = raw.slice(prefix.length).trim();
    return cleaned || null;
  }

  return raw;
}

function isSchemaError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  const code = normalizeUpper(error?.code);
  const message = normalizeLower(error?.message);

  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("relation")
  );
}

function inferStepRole(step: ApprovalStepRow | null): string {
  const signature = `${normalizeUpper(step?.step_code)} ${normalizeUpper(step?.role_code)}`;

  if (signature.includes("HOD") || signature.includes("L1_HOD")) {
    return "HOD";
  }

  if (signature.includes("DEAN") || signature.includes("L2_DEAN")) {
    return "DEAN";
  }

  if (signature.includes("CFO") || signature.includes("L3_CFO")) {
    return "CFO";
  }

  if (signature.includes("ACCOUNTS") || signature.includes("L4_ACCOUNTS") || signature.includes("ACCOUNT")) {
    return "ACCOUNTS";
  }

  return normalizeUpper(step?.role_code || step?.step_code);
}

function resolveRoleLabel(roleCode?: string | null): string {
  const token = normalizeUpper(roleCode);

  if (token.includes("L1_HOD") || token === "HOD") {
    return "HOD";
  }

  if (token.includes("L2_DEAN") || token === "DEAN") {
    return "Dean";
  }

  if (token.includes("L3_CFO") || token === "CFO") {
    return "CFO";
  }

  if (token.includes("L4_ACCOUNTS") || token.includes("ACCOUNTS") || token.includes("ACCOUNT")) {
    return "Accounts";
  }

  if (token.includes("SERVICE_IT")) {
    return "IT";
  }

  if (token.includes("SERVICE_CATERING")) {
    return "Catering";
  }

  if (token.includes("SERVICE_VENUE")) {
    return "Venue";
  }

  return normalizeText(roleCode) || "Approver";
}

function inferServiceNodeKey(row: ServiceRequestRow): ServiceNodeKey | null {
  const serviceType = normalizeLower(row.service_type);
  const roleCode = normalizeUpper(row.service_role_code);

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

function findStemStep(nodeKey: StemNodeKey, steps: ApprovalStepRow[]): ApprovalStepRow | null {
  if (nodeKey === "submission") {
    return null;
  }

  return (
    steps.find((step) => {
      const signature = `${normalizeUpper(step.step_code)} ${normalizeUpper(step.role_code)}`;

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
        return (
          signature.includes("ACCOUNTS") ||
          signature.includes("L4_ACCOUNTS") ||
          signature.includes("ACCOUNT")
        );
      }

      return false;
    }) || null
  );
}

function hasApprovedDecision(decision: ApprovalDecisionRow | null): boolean {
  return normalizeUpper(decision?.decision) === "APPROVED";
}

function hasRejectedDecision(decision: ApprovalDecisionRow | null): boolean {
  const decisionToken = normalizeUpper(decision?.decision);
  const commentToken = normalizeUpper(decision?.comment);
  return decisionToken === "REJECTED" || commentToken.startsWith("RETURN_FOR_REVISION");
}

function hasApprovedStep(step: ApprovalStepRow | null): boolean {
  return normalizeUpper(step?.status) === "APPROVED";
}

function hasRejectedStep(step: ApprovalStepRow | null): boolean {
  return normalizeUpper(step?.status) === "REJECTED";
}

function hasPendingStep(step: ApprovalStepRow | null): boolean {
  const token = normalizeUpper(step?.status);
  return token === "PENDING" || token === "UNDER_REVIEW";
}

function hasBlockedStep(step: ApprovalStepRow | null): boolean {
  const token = normalizeUpper(step?.status);
  return token === "WAITING" || token === "QUEUED" || token === "NOT_STARTED";
}

function getFallbackStemStatuses(
  workflowType: WorkflowType,
  workflowStatus: string | null | undefined
): Record<StemNodeKey, ApprovalVisualStatus> {
  const token = normalizeLower(workflowStatus);
  const base: Record<StemNodeKey, ApprovalVisualStatus> = {
    submission: "approved",
    hod: "blocked",
    dean: "blocked",
    cfo: "blocked",
    accounts: "blocked",
  };

  if (token.includes("pending_hod") || token.includes("pending_level_1")) {
    base.hod = "pending";
    return base;
  }

  if (token.includes("pending_dean") || token.includes("pending_level_2")) {
    base.hod = "approved";
    base.dean = "pending";
    return base;
  }

  if (workflowType === "fest" && (token.includes("pending_cfo") || token.includes("pending_level_3"))) {
    base.hod = "approved";
    base.dean = "approved";
    base.cfo = "pending";
    return base;
  }

  if (workflowType === "event" && (token.includes("pending_accounts") || token.includes("pending_level_4") || token.includes("pending_cfo"))) {
    base.hod = "approved";
    base.dean = "approved";
    base.accounts = "pending";
    return base;
  }

  if (token.includes("rejected") || token.includes("return")) {
    base.hod = "rejected";
    return base;
  }

  if (token.includes("approved") || token.includes("live")) {
    base.hod = "approved";
    base.dean = "approved";
    if (workflowType === "fest") {
      base.cfo = "approved";
    } else {
      base.accounts = "approved";
    }
  }

  return base;
}

function resolveStemSequence(workflowType: WorkflowType): StemNodeKey[] {
  if (workflowType === "fest") {
    return ["submission", "hod", "dean", "cfo"];
  }

  return ["submission", "hod", "dean", "accounts"];
}

function toApproverContext(input: {
  userId?: string | null;
  email?: string | null;
  roleCode?: string | null;
  usersById: Record<string, UserRow>;
  usersByEmail: Record<string, UserRow>;
}) {
  const userId = normalizeText(input.userId);
  const email = normalizeLower(input.email);

  const userById = userId ? input.usersById[userId] : null;
  const userByEmail = email ? input.usersByEmail[email] : null;
  const user = userById || userByEmail || null;

  const resolvedEmail = email || normalizeLower(user?.email) || null;
  const resolvedName = normalizeText(user?.name) || (resolvedEmail ? resolvedEmail.split("@")[0] : null);

  return {
    name: resolvedName,
    email: resolvedEmail,
    role: resolveRoleLabel(input.roleCode),
    avatarUrl: normalizeText(user?.avatar_url) || null,
  };
}

function mapUsersById(rows: UserRow[]): Record<string, UserRow> {
  return rows.reduce<Record<string, UserRow>>((acc, row) => {
    const id = normalizeText(row.id);
    if (id) {
      acc[id] = row;
    }
    return acc;
  }, {});
}

function mapUsersByEmail(rows: UserRow[]): Record<string, UserRow> {
  return rows.reduce<Record<string, UserRow>>((acc, row) => {
    const email = normalizeLower(row.email);
    if (email) {
      acc[email] = row;
    }
    return acc;
  }, {});
}

async function loadUsersLookup(input: {
  approvalDecisions: ApprovalDecisionRow[];
  serviceDecisions: ServiceDecisionRow[];
}) {
  const userIds = new Set<string>();
  const emails = new Set<string>();

  [...input.approvalDecisions, ...input.serviceDecisions].forEach((decision) => {
    const userId = normalizeText(decision.decided_by_user_id);
    const email = normalizeLower(decision.decided_by_email);

    if (userId) {
      userIds.add(userId);
    }

    if (email) {
      emails.add(email);
    }
  });

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

async function fetchEventEntityRow(workflowId: string): Promise<WorkflowEntityRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("event_id,title,approval_request_id,workflow_status,updated_at")
    .eq("event_id", workflowId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load event workflow context.");
  }

  if (!data) {
    return null;
  }

  return {
    workflowId,
    title: normalizeText((data as GenericRow).title) || "Untitled Event",
    approvalRequestId: normalizeText((data as GenericRow).approval_request_id) || null,
    workflowStatus: normalizeText((data as GenericRow).workflow_status) || null,
    updatedAt: normalizeText((data as GenericRow).updated_at) || null,
  };
}

async function fetchFestEntityRow(workflowId: string): Promise<WorkflowEntityRow | null> {
  const tableCandidates = ["fests", "fest"] as const;

  for (const tableName of tableCandidates) {
    const { data, error } = await supabase
      .from(tableName)
      .select("fest_id,fest_title,approval_request_id,workflow_status,updated_at")
      .eq("fest_id", workflowId)
      .maybeSingle();

    if (error) {
      if (isSchemaError(error)) {
        continue;
      }

      throw new Error(error.message || "Unable to load fest workflow context.");
    }

    if (!data) {
      continue;
    }

    return {
      workflowId,
      title: normalizeText((data as GenericRow).fest_title) || "Untitled Fest",
      approvalRequestId: normalizeText((data as GenericRow).approval_request_id) || null,
      workflowStatus: normalizeText((data as GenericRow).workflow_status) || null,
      updatedAt: normalizeText((data as GenericRow).updated_at) || null,
    };
  }

  return null;
}

async function fetchEntityRow(workflowType: WorkflowType, workflowId: string) {
  if (workflowType === "event") {
    return fetchEventEntityRow(workflowId);
  }

  return fetchFestEntityRow(workflowId);
}

async function fetchApprovalRequestById(requestId: string): Promise<ApprovalRequestRow | null> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select(
      "id,request_id,entity_type,entity_ref,event_id,status,submitted_at,decided_at,latest_comment,is_budget_related,approval_level,created_at,updated_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load approval request.");
  }

  return (data as ApprovalRequestRow | null) || null;
}

async function fetchLatestApprovalRequest(workflowType: WorkflowType, workflowId: string) {
  let response = await supabase
    .from("approval_requests")
    .select(
      "id,request_id,entity_type,entity_ref,event_id,status,submitted_at,decided_at,latest_comment,is_budget_related,approval_level,created_at,updated_at"
    )
    .eq("entity_ref", workflowId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (response.error && workflowType === "event") {
    response = await supabase
      .from("approval_requests")
      .select(
        "id,request_id,entity_type,entity_ref,event_id,status,submitted_at,decided_at,latest_comment,is_budget_related,approval_level,created_at,updated_at"
      )
      .eq("event_id", workflowId)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  if (response.error) {
    throw new Error(response.error.message || "Unable to load latest approval request.");
  }

  return Array.isArray(response.data) && response.data.length > 0
    ? (response.data[0] as ApprovalRequestRow)
    : null;
}

async function fetchServiceRequestsForEvent(eventId: string): Promise<ServiceRequestRow[]> {
  let response = await supabase
    .from("service_requests")
    .select("*")
    .or(`event_id.eq.${eventId},and(entity_type.eq.event,entity_id.eq.${eventId})`)
    .order("updated_at", { ascending: false });

  if (response.error) {
    response = await supabase
      .from("service_requests")
      .select("*")
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false });
  }

  if (response.error) {
    throw new Error(response.error.message || "Unable to load service requests.");
  }

  return ((response.data as ServiceRequestRow[] | null) || []).map((row) => ({
    ...row,
    id: normalizeText(row.id),
  }));
}

async function fetchServiceDecisions(serviceRequestIds: string[]): Promise<ServiceDecisionRow[]> {
  if (serviceRequestIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("service_decisions")
    .select("*")
    .in("service_request_id", serviceRequestIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load service decisions.");
  }

  return (data as ServiceDecisionRow[] | null) || [];
}

async function fetchIncidentLogs(workflowType: WorkflowType, workflowId: string): Promise<GenericRow[]> {
  const eventCandidates = [
    () =>
      supabase
        .from("incident_logs")
        .select("*")
        .eq("event_id", workflowId)
        .order("updated_at", { ascending: true }),
    () =>
      supabase
        .from("incident_logs")
        .select("*")
        .eq("entity_id", workflowId)
        .order("updated_at", { ascending: true }),
  ];

  const festCandidates = [
    () =>
      supabase
        .from("incident_logs")
        .select("*")
        .eq("fest_id", workflowId)
        .order("updated_at", { ascending: true }),
    () =>
      supabase
        .from("incident_logs")
        .select("*")
        .eq("entity_id", workflowId)
        .order("updated_at", { ascending: true }),
    () =>
      supabase
        .from("incident_logs")
        .select("*")
        .eq("event_id", workflowId)
        .order("updated_at", { ascending: true }),
  ];

  const candidates = workflowType === "event" ? eventCandidates : festCandidates;

  for (const candidate of candidates) {
    const { data, error } = await candidate();

    if (!error) {
      return (data as GenericRow[] | null) || [];
    }

    if (!isSchemaError(error)) {
      throw new Error(error.message || "Unable to load incident logs.");
    }
  }

  return [];
}

function buildWorkflowGraph(snapshot: WorkflowSnapshot, workflowType: WorkflowType) {
  const stemSequence = resolveStemSequence(workflowType);
  const fallbackStemStatuses = getFallbackStemStatuses(workflowType, snapshot.entity?.workflowStatus || null);

  const orderedSteps = [...snapshot.approvalSteps].sort((left, right) => {
    const leftSeq = Number(left.sequence_order || 0);
    const rightSeq = Number(right.sequence_order || 0);
    if (leftSeq !== rightSeq) {
      return leftSeq - rightSeq;
    }

    return toTimestampMs(left.updated_at || left.created_at || null) - toTimestampMs(right.updated_at || right.created_at || null);
  });

  const latestDecisionByStepId = new Map<string, ApprovalDecisionRow>();
  snapshot.approvalDecisions.forEach((decision) => {
    const stepId = normalizeText(decision.approval_step_id);
    if (!stepId || latestDecisionByStepId.has(stepId)) {
      return;
    }

    latestDecisionByStepId.set(stepId, decision);
  });

  const stemNodes: WorkflowGraphNode[] = [];
  let previousApproved = true;

  stemSequence.forEach((nodeKey) => {
    const step = findStemStep(nodeKey, orderedSteps);
    const decision = step ? latestDecisionByStepId.get(step.id) || null : null;

    let status: ApprovalVisualStatus = fallbackStemStatuses[nodeKey];

    if (nodeKey === "submission") {
      status = "approved";
    } else if (hasRejectedDecision(decision) || hasRejectedStep(step)) {
      status = "rejected";
    } else if (hasApprovedDecision(decision) || hasApprovedStep(step)) {
      status = "approved";
    } else if (!previousApproved) {
      status = "blocked";
    } else if (hasPendingStep(step)) {
      status = "pending";
    } else if (hasBlockedStep(step)) {
      status = "blocked";
    }

    const approver = toApproverContext({
      userId: decision?.decided_by_user_id || null,
      email: decision?.decided_by_email || null,
      roleCode: decision?.role_code || step?.role_code || null,
      usersById: snapshot.usersById,
      usersByEmail: snapshot.usersByEmail,
    });

    const reviewNote = stripRevisionPrefix(decision?.comment || snapshot.approvalRequest?.latest_comment || null);

    let description = "Awaiting action";
    if (status === "approved") {
      description = approver.name ? `Approved by ${approver.name}` : "Approved";
    } else if (status === "pending") {
      description = `${resolveRoleLabel(step?.role_code || STEM_ROLE_CODES[nodeKey])} review in progress`;
    } else if (status === "rejected") {
      description = reviewNote || "Returned for revision";
    } else {
      description = "Blocked by earlier approval gate";
    }

    stemNodes.push({
      id: nodeKey,
      type: "workflowNode",
      position: STEM_POSITIONS[nodeKey],
      draggable: false,
      connectable: false,
      selectable: true,
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
        approverRole: approver.role,
        approverAvatarUrl: approver.avatarUrl,
        timestamp: toReadableTimestamp(
          decision?.created_at || step?.decided_at || step?.updated_at || snapshot.approvalRequest?.updated_at || null
        ),
        reviewNote,
        stepCode: normalizeText(step?.step_code) || null,
        requestId: snapshot.approvalRequest?.id || null,
      },
    });

    previousApproved = previousApproved && status === "approved";
  });

  const edges: Edge[] = [];
  for (let index = 1; index < stemSequence.length; index += 1) {
    const from = stemSequence[index - 1];
    const to = stemSequence[index];

    edges.push({
      id: `edge-${from}-${to}`,
      source: from,
      target: to,
      type: "smoothstep",
      animated: true,
    });
  }

  const allNodes: WorkflowGraphNode[] = [...stemNodes];

  if (workflowType === "event") {
    const accountsNode = stemNodes.find((node) => node.id === "accounts") || null;
    const accountsApproved = accountsNode?.data.status === "approved";

    const serviceRequestsByKey = new Map<ServiceNodeKey, ServiceRequestRow>();
    snapshot.serviceRequests.forEach((request) => {
      const key = inferServiceNodeKey(request);
      if (!key || serviceRequestsByKey.has(key)) {
        return;
      }

      serviceRequestsByKey.set(key, request);
    });

    const latestServiceDecisionByRequestId = new Map<string, ServiceDecisionRow>();
    snapshot.serviceDecisions.forEach((decision) => {
      const requestId = normalizeText(decision.service_request_id);
      if (!requestId || latestServiceDecisionByRequestId.has(requestId)) {
        return;
      }

      latestServiceDecisionByRequestId.set(requestId, decision);
    });

    (Object.keys(SERVICE_TITLES) as ServiceNodeKey[]).forEach((serviceKey) => {
      const request = serviceRequestsByKey.get(serviceKey);
      if (!request) {
        return;
      }

      const decision = latestServiceDecisionByRequestId.get(normalizeText(request.id)) || null;
      const requestStatus = normalizeUpper(request.status);
      const decisionStatus = normalizeUpper(decision?.decision);
      const commentStatus = normalizeUpper(decision?.comment);

      let status: ApprovalVisualStatus = accountsApproved ? "pending" : "blocked";

      if (decisionStatus === "APPROVED" || requestStatus.includes("APPROVED")) {
        status = "approved";
      } else if (
        decisionStatus === "REJECTED" ||
        requestStatus.includes("REJECT") ||
        commentStatus.startsWith("RETURN_FOR_REVISION")
      ) {
        status = "rejected";
      }

      const approver = toApproverContext({
        userId: decision?.decided_by_user_id || null,
        email: decision?.decided_by_email || null,
        roleCode: decision?.role_code || request.service_role_code || null,
        usersById: snapshot.usersById,
        usersByEmail: snapshot.usersByEmail,
      });

      const reviewNote = stripRevisionPrefix(decision?.comment || null);

      let description = "Waiting for Accounts gate";
      if (status === "approved") {
        description = approver.name ? `Approved by ${approver.name}` : "Approved";
      } else if (status === "pending") {
        description = `${resolveRoleLabel(request.service_role_code)} queue is pending`;
      } else if (status === "rejected") {
        description = reviewNote || "Returned for revision";
      }

      const nodeId = `service-${serviceKey}`;

      allNodes.push({
        id: nodeId,
        type: "workflowNode",
        position: SERVICE_POSITIONS[serviceKey],
        draggable: false,
        connectable: false,
        selectable: true,
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
          approverRole: approver.role,
          approverAvatarUrl: approver.avatarUrl,
          timestamp: toReadableTimestamp(
            decision?.created_at || request.decided_at || request.updated_at || request.created_at || null
          ),
          reviewNote,
          stepCode: normalizeText(request.service_request_id) || null,
          requestId: normalizeText(request.id) || null,
        },
      });

      edges.push({
        id: `edge-accounts-${nodeId}`,
        source: "accounts",
        target: nodeId,
        type: "smoothstep",
        animated: true,
      });
    });
  }

  const quickSummary: WorkflowQuickSummaryItem[] = [
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
    nodes: allNodes,
    edges,
    quickSummary,
  };
}

function buildTimeline(
  snapshot: WorkflowSnapshot,
  workflowType: WorkflowType
): WorkflowTimelineEvent[] {
  const timelineEvents: WorkflowTimelineEvent[] = [];

  const submittedAt =
    snapshot.approvalRequest?.submitted_at ||
    snapshot.approvalRequest?.created_at ||
    snapshot.entity?.updatedAt ||
    null;

  timelineEvents.push({
    id: `${workflowType}-submission-${snapshot.approvalRequest?.id || snapshot.entity?.workflowId || "unknown"}`,
    title: `${workflowType === "event" ? "Event" : "Fest"} submitted`,
    subtitle:
      normalizeText(snapshot.approvalRequest?.request_id) ||
      `Workflow tracking started for ${snapshot.entity?.title || "this record"}`,
    status: "approved",
    timestamp: toReadableTimestamp(submittedAt),
    updatedAt: submittedAt,
    actorName: null,
    actorEmail: null,
    roleCode: "SUBMISSION",
    note: null,
    source: "submission",
  });

  const stepById = new Map<string, ApprovalStepRow>();
  snapshot.approvalSteps.forEach((step) => {
    const stepId = normalizeText(step.id);
    if (stepId) {
      stepById.set(stepId, step);
    }
  });

  const decisionsAscending = [...snapshot.approvalDecisions].sort(
    (left, right) => toTimestampMs(left.created_at || null) - toTimestampMs(right.created_at || null)
  );

  decisionsAscending.forEach((decision) => {
    const step = stepById.get(normalizeText(decision.approval_step_id));
    const roleCode = normalizeText(decision.role_code) || inferStepRole(step || null);
    const roleLabel = resolveRoleLabel(roleCode);

    const decisionToken = normalizeUpper(decision.decision);
    const note = stripRevisionPrefix(decision.comment || null);

    let status: ApprovalVisualStatus = "pending";
    let title = `${roleLabel} updated`;

    if (decisionToken === "APPROVED") {
      status = "approved";
      title = `${roleLabel} approved`;
    } else if (decisionToken === "REJECTED") {
      status = "rejected";
      title = note ? `${roleLabel} returned for revision` : `${roleLabel} rejected`;
    }

    const approver = toApproverContext({
      userId: decision.decided_by_user_id || null,
      email: decision.decided_by_email || null,
      roleCode,
      usersById: snapshot.usersById,
      usersByEmail: snapshot.usersByEmail,
    });

    timelineEvents.push({
      id: `decision-${decision.id}`,
      title,
      subtitle: approver.name
        ? `by ${approver.name}${approver.email ? ` (${approver.email})` : ""}`
        : `Role: ${roleLabel}`,
      status,
      timestamp: toReadableTimestamp(decision.created_at || null),
      updatedAt: decision.created_at || null,
      actorName: approver.name,
      actorEmail: approver.email,
      roleCode: roleCode || null,
      note,
      source: "approval",
    });
  });

  if (workflowType === "event") {
    const serviceLabelByRequestId = new Map<string, string>();

    const serviceRequestsAscending = [...snapshot.serviceRequests].sort(
      (left, right) => toTimestampMs(left.created_at || null) - toTimestampMs(right.created_at || null)
    );

    serviceRequestsAscending.forEach((request) => {
      const requestId = normalizeText(request.id);
      const serviceKey = inferServiceNodeKey(request);
      const serviceLabel = serviceKey ? SERVICE_TITLES[serviceKey] : resolveRoleLabel(request.service_role_code);
      const statusToken = normalizeUpper(request.status);

      let status: ApprovalVisualStatus = "pending";
      if (statusToken.includes("APPROVED")) {
        status = "approved";
      } else if (statusToken.includes("REJECT")) {
        status = "rejected";
      }

      if (requestId) {
        serviceLabelByRequestId.set(requestId, serviceLabel);
      }

      timelineEvents.push({
        id: `service-request-${requestId || request.service_request_id || Math.random()}`,
        title: `${serviceLabel} requested`,
        subtitle: normalizeText(request.service_request_id) || "Logistics request created",
        status,
        timestamp: toReadableTimestamp(request.created_at || request.updated_at || null),
        updatedAt: request.created_at || request.updated_at || null,
        actorName: null,
        actorEmail: null,
        roleCode: normalizeText(request.service_role_code) || null,
        note: null,
        source: "service",
      });
    });

    const serviceDecisionsAscending = [...snapshot.serviceDecisions].sort(
      (left, right) => toTimestampMs(left.created_at || null) - toTimestampMs(right.created_at || null)
    );

    serviceDecisionsAscending.forEach((decision) => {
      const requestId = normalizeText(decision.service_request_id);
      const serviceLabel = serviceLabelByRequestId.get(requestId) || resolveRoleLabel(decision.role_code);
      const decisionToken = normalizeUpper(decision.decision);
      const note = stripRevisionPrefix(decision.comment || null);

      let status: ApprovalVisualStatus = "pending";
      let title = `${serviceLabel} updated`;

      if (decisionToken === "APPROVED") {
        status = "approved";
        title = `${serviceLabel} approved`;
      } else if (decisionToken === "REJECTED") {
        status = "rejected";
        title = note ? `${serviceLabel} returned for revision` : `${serviceLabel} rejected`;
      }

      const approver = toApproverContext({
        userId: decision.decided_by_user_id || null,
        email: decision.decided_by_email || null,
        roleCode: decision.role_code || null,
        usersById: snapshot.usersById,
        usersByEmail: snapshot.usersByEmail,
      });

      timelineEvents.push({
        id: `service-decision-${decision.id}`,
        title,
        subtitle: approver.name
          ? `by ${approver.name}${approver.email ? ` (${approver.email})` : ""}`
          : `Role: ${resolveRoleLabel(decision.role_code)}`,
        status,
        timestamp: toReadableTimestamp(decision.created_at || null),
        updatedAt: decision.created_at || null,
        actorName: approver.name,
        actorEmail: approver.email,
        roleCode: normalizeText(decision.role_code) || null,
        note,
        source: "service",
      });
    });
  }

  snapshot.incidentLogs.forEach((row, index) => {
    const description = normalizeText(row.description || row.details || row.message);
    if (!description) {
      return;
    }

    const severity = normalizeLower(row.severity);
    const category = normalizeText(row.category) || "General";
    const timestamp = normalizeText(row.updated_at || row.created_at || row.reported_at) || null;

    let status: ApprovalVisualStatus = "pending";
    if (severity === "critical" || severity === "high") {
      status = "rejected";
    }

    timelineEvents.push({
      id: `incident-${normalizeText(row.id || row.incident_id || row.log_id) || index}`,
      title: `Incident logged (${category})`,
      subtitle: description,
      status,
      timestamp: toReadableTimestamp(timestamp),
      updatedAt: timestamp,
      actorName: normalizeText(row.reported_by || row.reported_by_email || row.created_by) || null,
      actorEmail: normalizeText(row.reported_by_email || row.created_by) || null,
      roleCode: "INCIDENT",
      note: normalizeText(row.resolution_notes || "") || null,
      source: "incident",
    });
  });

  return timelineEvents.sort((left, right) => toTimestampMs(left.updatedAt) - toTimestampMs(right.updatedAt));
}

export function useWorkflowState(workflowType: WorkflowType, workflowId: string): WorkflowStateResult {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>({
    entity: null,
    approvalRequest: null,
    approvalSteps: [],
    approvalDecisions: [],
    serviceRequests: [],
    serviceDecisions: [],
    incidentLogs: [],
    usersById: {},
    usersByEmail: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const approvalRequestIdRef = useRef<string | null>(null);
  const refreshDebounceRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const normalizedWorkflowId = normalizeText(workflowId);
    if (!normalizedWorkflowId) {
      setError("Missing workflow id.");
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const entity = await fetchEntityRow(workflowType, normalizedWorkflowId);

      let approvalRequest: ApprovalRequestRow | null = null;
      const directRequestId = normalizeText(entity?.approvalRequestId);

      if (directRequestId) {
        approvalRequest = await fetchApprovalRequestById(directRequestId);
      }

      if (!approvalRequest) {
        approvalRequest = await fetchLatestApprovalRequest(workflowType, normalizedWorkflowId);
      }

      const approvalSteps: ApprovalStepRow[] = [];
      const approvalDecisions: ApprovalDecisionRow[] = [];

      if (approvalRequest?.id) {
        const [stepsResult, decisionsResult] = await Promise.all([
          supabase
            .from("approval_steps")
            .select("id,approval_request_id,step_code,role_code,sequence_order,status,decided_at,created_at,updated_at")
            .eq("approval_request_id", approvalRequest.id)
            .order("sequence_order", { ascending: true }),
          supabase
            .from("approval_decisions")
            .select("id,approval_request_id,approval_step_id,decided_by_user_id,decided_by_email,role_code,decision,comment,created_at")
            .eq("approval_request_id", approvalRequest.id)
            .order("created_at", { ascending: false }),
        ]);

        if (stepsResult.error) {
          throw new Error(stepsResult.error.message || "Unable to load approval steps.");
        }

        if (decisionsResult.error) {
          throw new Error(decisionsResult.error.message || "Unable to load approval decisions.");
        }

        approvalSteps.push(...((stepsResult.data as ApprovalStepRow[] | null) || []));
        approvalDecisions.push(...((decisionsResult.data as ApprovalDecisionRow[] | null) || []));
      }

      let serviceRequests: ServiceRequestRow[] = [];
      let serviceDecisions: ServiceDecisionRow[] = [];

      if (workflowType === "event") {
        serviceRequests = await fetchServiceRequestsForEvent(normalizedWorkflowId);

        const requestIds = serviceRequests
          .map((request) => normalizeText(request.id))
          .filter(Boolean);

        serviceDecisions = await fetchServiceDecisions(requestIds);
      }

      const incidentLogs = await fetchIncidentLogs(workflowType, normalizedWorkflowId);

      const usersLookup = await loadUsersLookup({
        approvalDecisions,
        serviceDecisions,
      });

      approvalRequestIdRef.current = normalizeText(approvalRequest?.id) || null;

      setSnapshot({
        entity,
        approvalRequest,
        approvalSteps,
        approvalDecisions,
        serviceRequests,
        serviceDecisions,
        incidentLogs,
        usersById: usersLookup.usersById,
        usersByEmail: usersLookup.usersByEmail,
      });
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : "Unexpected error while loading workflow state.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, workflowType]);

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
    const normalizedWorkflowId = normalizeText(workflowId);
    if (!normalizedWorkflowId) {
      return;
    }

    const entityChannel = supabase
      .channel(`workflow-entity-${workflowType}-${normalizedWorkflowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: workflowType === "event" ? "events" : "fests",
          filter: `${workflowType === "event" ? "event_id" : "fest_id"}=eq.${normalizedWorkflowId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_requests",
          filter: `entity_ref=eq.${normalizedWorkflowId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_logs",
          ...(workflowType === "event" ? { filter: `event_id=eq.${normalizedWorkflowId}` } : {}),
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(entityChannel);
    };
  }, [workflowId, workflowType, scheduleRefresh]);

  useEffect(() => {
    const requestId = approvalRequestIdRef.current;
    if (!requestId) {
      return;
    }

    const approvalChannel = supabase
      .channel(`workflow-approval-${requestId}`)
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
      void supabase.removeChannel(approvalChannel);
    };
  }, [snapshot.approvalRequest?.id, scheduleRefresh]);

  useEffect(() => {
    if (workflowType !== "event") {
      return;
    }

    const normalizedWorkflowId = normalizeText(workflowId);
    if (!normalizedWorkflowId) {
      return;
    }

    const serviceChannel = supabase
      .channel(`workflow-service-${normalizedWorkflowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `event_id=eq.${normalizedWorkflowId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_decisions",
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(serviceChannel);
    };
  }, [workflowId, workflowType, scheduleRefresh]);

  const graph = useMemo(() => buildWorkflowGraph(snapshot, workflowType), [snapshot, workflowType]);
  const timelineEvents = useMemo(() => buildTimeline(snapshot, workflowType), [snapshot, workflowType]);

  return {
    entityTitle: snapshot.entity?.title || (workflowType === "event" ? "Event Workflow" : "Fest Workflow"),
    nodes: graph.nodes,
    edges: graph.edges,
    timelineEvents,
    quickSummary: graph.quickSummary,
    requestId: snapshot.approvalRequest?.id || null,
    isLoading,
    error,
    refresh,
  };
}
