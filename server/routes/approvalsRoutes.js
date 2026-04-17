import express from "express";
import {
  insert,
  queryAll,
  queryOne,
  update,
} from "../config/database.js";
import {
  authenticateUser,
  checkRoleExpiration,
  getUserInfo,
} from "../middleware/authMiddleware.js";
import {
  ROLE_CODES,
  hasAnyRoleCode,
  isServiceRoleCode,
  normalizeRoleCode,
} from "../utils/roleAccessService.js";
import {
  sendBroadcastNotification,
  sendUserNotifications,
} from "./notificationRoutes.js";
import {
  LIFECYCLE_STATUS,
  normalizeLifecycleStatus,
  shouldEntityRemainDraft,
} from "../utils/lifecycleStatus.js";
import { shouldSendFinalApprovalBroadcast } from "../utils/notificationLifecycle.js";
import { resolveDepartmentId } from "./departmentsRoutes.js";

const router = express.Router();

const isMissingRelationError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
};

const isMissingColumnError = (error, columnName) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const normalizedColumn = String(columnName || "").toLowerCase();

  if (!normalizedColumn) {
    return false;
  }

  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes(`column \"${normalizedColumn}\"`) ||
    message.includes(`${normalizedColumn} does not exist`) ||
    (message.includes("could not find") && message.includes(normalizedColumn))
  );
};

const normalizeWorkflowStatus = (value, fallback = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || String(fallback || "").trim().toUpperCase();
};

const resolveActivationState = (approvalState, serviceState) => {
  const normalizedApprovalState = normalizeWorkflowStatus(approvalState, "PENDING");
  const normalizedServiceState = normalizeWorkflowStatus(serviceState, "APPROVED");

  if (normalizedApprovalState === "REJECTED" || normalizedServiceState === "REJECTED") {
    return "REJECTED";
  }

  if (normalizedApprovalState !== "APPROVED") {
    return "PENDING";
  }

  if (normalizedServiceState === "REJECTED") {
    return "REJECTED";
  }

  if (normalizedServiceState === "PENDING") {
    return "PENDING";
  }

  return "ACTIVE";
};

const resolveLifecycleStatusFromWorkflow = ({
  currentStatus,
  approvalState,
  serviceApprovalState,
}) => {
  const normalizedApprovalState = normalizeWorkflowStatus(approvalState, "PENDING");
  const normalizedServiceState = normalizeWorkflowStatus(serviceApprovalState, "APPROVED");

  if (normalizedApprovalState === "REJECTED" || normalizedServiceState === "REJECTED") {
    return LIFECYCLE_STATUS.REVISION_REQUESTED;
  }

  if (
    normalizedApprovalState === "UNDER_REVIEW" ||
    normalizedApprovalState === "PENDING" ||
    normalizedServiceState === "PENDING"
  ) {
    return LIFECYCLE_STATUS.DRAFT;
  }

  if (normalizedApprovalState === "APPROVED" && normalizedServiceState === "APPROVED") {
    return LIFECYCLE_STATUS.APPROVED;
  }

  return normalizeLifecycleStatus(currentStatus, LIFECYCLE_STATUS.DRAFT);
};

const resolveEventLifecycleStatusFromWorkflow = ({
  currentStatus,
  approvalState,
  serviceApprovalState,
}) => {
  const normalizedApprovalState = normalizeWorkflowStatus(approvalState, "PENDING");
  const normalizedServiceState = normalizeWorkflowStatus(serviceApprovalState, "APPROVED");

  if (normalizedApprovalState === "APPROVED" && normalizedServiceState === "APPROVED") {
    // Events should go live immediately once all required approvals are done.
    return LIFECYCLE_STATUS.PUBLISHED;
  }

  return resolveLifecycleStatusFromWorkflow({
    currentStatus,
    approvalState,
    serviceApprovalState,
  });
};

const WORKFLOW_PHASE = Object.freeze({
  DRAFT: "draft",
  DEPT_APPROVAL: "dept_approval",
  FINANCE_APPROVAL_CFO: "finance_approval_cfo",
  FINANCE_APPROVAL_ACCOUNTS: "finance_approval_accounts",
  LOGISTICS_APPROVAL: "logistics_approval",
  APPROVED: "approved",
});

const DEPT_APPROVAL_ROLE_CODES = new Set([
  ROLE_CODES.HOD,
  ROLE_CODES.DEAN,
  ROLE_CODES.ORGANIZER_TEACHER,
]);

const WORKFLOW_STATUS_BY_ROLE_CODE = {
  [ROLE_CODES.HOD]: "pending_hod",
  [ROLE_CODES.DEAN]: "pending_dean",
  [ROLE_CODES.CFO]: "pending_cfo",
  [ROLE_CODES.ACCOUNTS]: "pending_accounts",
  [ROLE_CODES.FINANCE_OFFICER]: "pending_accounts",
  [ROLE_CODES.ORGANIZER_TEACHER]: "pending_organiser",
};

const normalizeWorkflowPhase = (value, fallback = WORKFLOW_PHASE.DRAFT) => {
  const normalized = String(value || "").trim().toLowerCase();
  const allowed = new Set(Object.values(WORKFLOW_PHASE));
  return allowed.has(normalized) ? normalized : String(fallback || "").trim().toLowerCase();
};

const normalizeWorkflowStatusToken = (value, fallback = "") =>
  String(value || fallback)
    .trim()
    .toLowerCase();

const resolveWorkflowPhaseFromActiveStep = (
  activeStep,
  fallback = WORKFLOW_PHASE.DEPT_APPROVAL
) => {
  const roleCode = normalizeRoleCode(activeStep?.role_code || activeStep?.step_code);

  if (!roleCode) {
    return normalizeWorkflowPhase(fallback, WORKFLOW_PHASE.DEPT_APPROVAL);
  }

  if (roleCode === ROLE_CODES.CFO) {
    return WORKFLOW_PHASE.FINANCE_APPROVAL_CFO;
  }

  if (roleCode === ROLE_CODES.ACCOUNTS || roleCode === ROLE_CODES.FINANCE_OFFICER) {
    return WORKFLOW_PHASE.FINANCE_APPROVAL_ACCOUNTS;
  }

  if (DEPT_APPROVAL_ROLE_CODES.has(roleCode)) {
    return WORKFLOW_PHASE.DEPT_APPROVAL;
  }

  return normalizeWorkflowPhase(fallback, WORKFLOW_PHASE.DEPT_APPROVAL);
};

const resolveWorkflowStatusFromActiveStep = (activeStep, fallback) => {
  const roleCode = normalizeRoleCode(activeStep?.role_code || activeStep?.step_code);
  if (!roleCode) {
    return normalizeWorkflowStatusToken(fallback);
  }

  return normalizeWorkflowStatusToken(
    WORKFLOW_STATUS_BY_ROLE_CODE[roleCode] || fallback
  );
};

const getActivePendingStepForRequest = async (approvalRequestId) => {
  const normalizedRequestId = String(approvalRequestId || "").trim();
  if (!normalizedRequestId) {
    return null;
  }

  const pendingSteps = await queryAll("approval_steps", {
    where: {
      approval_request_id: normalizedRequestId,
      status: "PENDING",
    },
    order: { column: "sequence_order", ascending: true },
    limit: 1,
  });

  return (pendingSteps || [])[0] || null;
};

const getActivePendingSequenceForRequest = async (
  approvalRequestId,
  cache = new Map()
) => {
  const normalizedRequestId = String(approvalRequestId || "").trim();
  if (!normalizedRequestId) {
    return null;
  }

  if (cache.has(normalizedRequestId)) {
    return cache.get(normalizedRequestId);
  }

  const pendingSteps = await queryAll("approval_steps", {
    where: {
      approval_request_id: normalizedRequestId,
      status: "PENDING",
    },
    select: "sequence_order",
    order: { column: "sequence_order", ascending: true },
  });

  const activeSequence = Array.isArray(pendingSteps) && pendingSteps.length > 0
    ? Number(pendingSteps[0]?.sequence_order || 0)
    : null;

  cache.set(normalizedRequestId, activeSequence);
  return activeSequence;
};

const promoteQueuedServiceRequestsForEvent = async (eventId) => {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) {
    return 0;
  }

  try {
    const queuedRequests = await queryAll("service_requests", {
      where: {
        event_id: normalizedEventId,
        status: "QUEUED",
      },
      select: "id",
    });

    if (!Array.isArray(queuedRequests) || queuedRequests.length === 0) {
      return 0;
    }

    await update(
      "service_requests",
      {
        status: "PENDING",
        updated_at: new Date().toISOString(),
      },
      {
        event_id: normalizedEventId,
        status: "QUEUED",
      }
    );

    return queuedRequests.length;
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "status")) {
      return 0;
    }

    throw error;
  }
};

const LOGISTICS_LEVEL_BY_SERVICE = {
  it: "L5_IT",
  venue: "L5_VENUE",
  catering: "L5_CATERING",
  stalls: "L5_STALLS",
};

const createLogisticsApprovalRequestsForEvent = async (eventId) => {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) return;

  try {
    const eventRecord = await queryOne("events", { where: { event_id: normalizedEventId } });
    if (!eventRecord) return;

    const additionalRequests =
      eventRecord.additional_requests && typeof eventRecord.additional_requests === "object"
        ? eventRecord.additional_requests
        : {};

    const requestedLevels = Object.entries(LOGISTICS_LEVEL_BY_SERVICE)
      .filter(([serviceKey]) => {
        const service = additionalRequests[serviceKey];
        return service && (service.enabled === true || service.enabled === "true");
      })
      .map(([, level]) => level);

    if (requestedLevels.length === 0) return;

    const existingRows = await queryAll("approval_requests", {
      where: { event_id: normalizedEventId },
      select: "approval_level,status",
    }).catch(() => []);

    const activeLevels = new Set(
      (existingRows || [])
        .filter((row) => {
          const st = String(row?.status || "").toLowerCase();
          return st === "pending" || st === "under_review" || st === "approved";
        })
        .map((row) => String(row?.approval_level || "").toUpperCase())
    );

    const nowIso = new Date().toISOString();
    const organizerEmail = String(eventRecord.organizer_email || eventRecord.created_by || "").trim();
    const organizingSchool = String(eventRecord.organizing_school || "").trim() || null;
    const campusHostedAt = String(eventRecord.campus_hosted_at || "").trim() || null;

    const rowsToInsert = requestedLevels
      .filter((level) => !activeLevels.has(level))
      .map((level) => ({
        request_id: `AR-${normalizedEventId}-${level.toLowerCase()}-${Date.now()}`,
        entity_type: "EVENT",
        entity_ref: normalizedEventId,
        event_id: normalizedEventId,
        approval_level: level,
        status: "pending",
        requested_by_email: organizerEmail || null,
        organizing_school: organizingSchool,
        campus_hosted_at: campusHostedAt,
        is_budget_related: false,
        submitted_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
        latest_comment: `Auto-generated after approval for ${level} service.`,
      }));

    if (rowsToInsert.length === 0) return;

    await insert("approval_requests", rowsToInsert);
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "approval_level")) {
      return;
    }
    console.warn("[ApprovalsRoute] Failed to create logistics approval requests:", error?.message);
  }
};

const isEventInLogisticsPhase = (eventRecord) => {
  const workflowPhase = normalizeWorkflowPhase(eventRecord?.workflow_phase, "");
  if (workflowPhase) {
    return workflowPhase === WORKFLOW_PHASE.LOGISTICS_APPROVAL;
  }

  const approvalState = normalizeWorkflowStatus(eventRecord?.approval_state, "APPROVED");
  const serviceState = normalizeWorkflowStatus(eventRecord?.service_approval_state, "APPROVED");
  return approvalState === "APPROVED" && serviceState === "PENDING";
};

const recomputeEventServiceApprovalState = async (eventId) => {
  if (!eventId) {
    return "APPROVED";
  }

  try {
    const serviceRequests = await queryAll("service_requests", {
      where: { event_id: eventId },
    });

    const statuses = (serviceRequests || []).map((request) =>
      normalizeWorkflowStatus(request?.status, "PENDING")
    );

    if (statuses.length === 0) {
      return "APPROVED";
    }

    if (statuses.some((status) => status === "REJECTED")) {
      return "REJECTED";
    }

    if (statuses.some((status) => status === "PENDING" || status === "QUEUED")) {
      return "PENDING";
    }

    return "APPROVED";
  } catch (error) {
    if (isMissingRelationError(error)) {
      return "APPROVED";
    }

    throw error;
  }
};

const updateWithMissingColumnFallback = async ({
  tableName,
  updates,
  where,
  removableColumns = [],
}) => {
  let fallbackUpdates = {
    ...updates,
  };
  let attempts = 0;

  while (attempts <= removableColumns.length) {
    try {
      await update(tableName, fallbackUpdates, where);
      return true;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return false;
      }

      const missingColumns = removableColumns.filter(
        (columnName) =>
          Object.prototype.hasOwnProperty.call(fallbackUpdates, columnName) &&
          isMissingColumnError(error, columnName)
      );

      if (missingColumns.length === 0) {
        throw error;
      }

      missingColumns.forEach((columnName) => {
        delete fallbackUpdates[columnName];
      });

      if (Object.keys(fallbackUpdates).length === 0) {
        return false;
      }

      attempts += 1;
    }
  }

  return false;
};

const syncApprovalOutcomeToEvent = async ({ approvalRequest, requestStatus, decidedByEmail, comment }) => {
  const eventId = String(approvalRequest?.entity_ref || "").trim();
  if (!eventId) {
    return;
  }

  const nowIso = new Date().toISOString();

  try {
    const eventRecord = await queryOne("events", {
      where: { event_id: eventId },
    });

    if (!eventRecord) {
      return;
    }

    const normalizedRequestStatus = normalizeWorkflowStatus(requestStatus, "UNDER_REVIEW");
    const activePendingStep =
      normalizedRequestStatus === "UNDER_REVIEW"
        ? await getActivePendingStepForRequest(approvalRequest?.id)
        : null;

    if (normalizedRequestStatus === "APPROVED") {
      await promoteQueuedServiceRequestsForEvent(eventId);
      await createLogisticsApprovalRequestsForEvent(eventId);
    }

    const serviceApprovalState = await recomputeEventServiceApprovalState(eventId);
    const resolvedActivationState = resolveActivationState(
      normalizedRequestStatus,
      serviceApprovalState
    );
    const lifecycleStatus = resolveEventLifecycleStatusFromWorkflow({
      currentStatus: eventRecord?.status,
      approvalState: normalizedRequestStatus,
      serviceApprovalState,
    });

    const workflowPhase =
      normalizedRequestStatus === "REJECTED"
        ? normalizeWorkflowPhase(eventRecord?.workflow_phase, WORKFLOW_PHASE.DRAFT)
        : normalizedRequestStatus === "APPROVED"
        ? serviceApprovalState === "PENDING"
          ? WORKFLOW_PHASE.LOGISTICS_APPROVAL
          : WORKFLOW_PHASE.APPROVED
        : resolveWorkflowPhaseFromActiveStep(
            activePendingStep,
            normalizeWorkflowPhase(eventRecord?.workflow_phase, WORKFLOW_PHASE.DEPT_APPROVAL)
          );

    const workflowStatus =
      normalizedRequestStatus === "REJECTED"
        ? "rejected"
        : normalizedRequestStatus === "APPROVED"
        ? "fully_approved"
        : resolveWorkflowStatusFromActiveStep(
            activePendingStep,
            normalizeWorkflowStatusToken(eventRecord?.workflow_status, "pending_hod")
          );

    const updates = {
      approval_state: normalizedRequestStatus,
      service_approval_state: serviceApprovalState,
      activation_state: resolvedActivationState,
      workflow_phase: workflowPhase,
      workflow_status: workflowStatus,
      status: lifecycleStatus,
      is_draft: shouldEntityRemainDraft(lifecycleStatus),
      updated_at: nowIso,
    };

    if (normalizedRequestStatus === "APPROVED") {
      updates.approved_at = nowIso;
      updates.approved_by = decidedByEmail || null;
      updates.rejected_at = null;
      updates.rejected_by = null;
      updates.rejection_reason = null;
    }

    if (normalizedRequestStatus === "REJECTED") {
      const rejectionReason =
        stripRevisionPrefix(comment) || "Rejected in approval workflow";

      updates.rejected_at = nowIso;
      updates.rejected_by = decidedByEmail || null;
      updates.rejection_reason = rejectionReason;
      updates.approved_at = null;
      updates.approved_by = null;
    }

    const persisted = await updateWithMissingColumnFallback({
      tableName: "events",
      updates,
      where: { event_id: eventId },
      removableColumns: [
        "approval_state",
        "service_approval_state",
        "activation_state",
        "workflow_phase",
        "workflow_status",
        "status",
        "is_draft",
        "approved_at",
        "approved_by",
        "rejected_at",
        "rejected_by",
        "rejection_reason",
      ],
    });

    if (!persisted) {
      return;
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      return;
    }

    throw error;
  }
};

const syncApprovalOutcomeToFest = async ({ approvalRequest, requestStatus, decidedByEmail, comment }) => {
  const festId = String(approvalRequest?.entity_ref || "").trim();
  if (!festId) {
    return;
  }

  const nowIso = new Date().toISOString();
  const normalizedRequestStatus = normalizeWorkflowStatus(requestStatus, "UNDER_REVIEW");
  const activePendingStep =
    normalizedRequestStatus === "UNDER_REVIEW"
      ? await getActivePendingStepForRequest(approvalRequest?.id)
      : null;

  for (const tableName of ["fests", "fest"]) {
    try {
      const festRecord = await queryOne(tableName, {
        where: { fest_id: festId },
      });

      if (!festRecord) {
        continue;
      }

      const resolvedActivationState =
        normalizedRequestStatus === "APPROVED"
          ? "ACTIVE"
          : normalizedRequestStatus === "REJECTED"
          ? "REJECTED"
          : "PENDING";
      const lifecycleStatus = resolveLifecycleStatusFromWorkflow({
        currentStatus: festRecord?.status,
        approvalState: normalizedRequestStatus,
        serviceApprovalState: "APPROVED",
      });

      const workflowPhase =
        normalizedRequestStatus === "REJECTED"
          ? normalizeWorkflowPhase(festRecord?.workflow_phase, WORKFLOW_PHASE.DRAFT)
          : normalizedRequestStatus === "APPROVED"
          ? WORKFLOW_PHASE.APPROVED
          : resolveWorkflowPhaseFromActiveStep(
              activePendingStep,
              normalizeWorkflowPhase(festRecord?.workflow_phase, WORKFLOW_PHASE.DEPT_APPROVAL)
            );

      const workflowStatus =
        normalizedRequestStatus === "REJECTED"
          ? "rejected"
          : normalizedRequestStatus === "APPROVED"
          ? "fully_approved"
          : resolveWorkflowStatusFromActiveStep(
              activePendingStep,
              normalizeWorkflowStatusToken(festRecord?.workflow_status, "pending_hod")
            );

      const updates = {
        approval_state: normalizedRequestStatus,
        activation_state: resolvedActivationState,
        workflow_phase: workflowPhase,
        workflow_status: workflowStatus,
        status: lifecycleStatus,
        is_draft: shouldEntityRemainDraft(lifecycleStatus),
        updated_at: nowIso,
      };

      if (normalizedRequestStatus === "APPROVED") {
        updates.approved_at = nowIso;
        updates.approved_by = decidedByEmail || null;
        updates.rejected_at = null;
        updates.rejected_by = null;
        updates.rejection_reason = null;
      }

      if (normalizedRequestStatus === "REJECTED") {
        const rejectionReason =
          stripRevisionPrefix(comment) || "Rejected in approval workflow";

        updates.rejected_at = nowIso;
        updates.rejected_by = decidedByEmail || null;
        updates.rejection_reason = rejectionReason;
        updates.approved_at = null;
        updates.approved_by = null;
      }

      const persisted = await updateWithMissingColumnFallback({
        tableName,
        updates,
        where: { fest_id: festId },
        removableColumns: [
          "approval_state",
          "activation_state",
          "workflow_phase",
          "workflow_status",
          "status",
          "is_draft",
          "approved_at",
          "approved_by",
          "rejected_at",
          "rejected_by",
          "rejection_reason",
        ],
      });

      if (persisted) {
        return;
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      throw error;
    }
  }
};

const syncApprovalOutcomeToEntity = async ({ approvalRequest, requestStatus, decidedByEmail, comment }) => {
  const entityType = normalizeWorkflowStatus(approvalRequest?.entity_type);
  if (!entityType) {
    return;
  }

  if (["EVENT", "STANDALONE_EVENT", "FEST_CHILD_EVENT"].includes(entityType)) {
    await syncApprovalOutcomeToEvent({ approvalRequest, requestStatus, decidedByEmail, comment });
    return;
  }

  if (entityType === "FEST") {
    await syncApprovalOutcomeToFest({ approvalRequest, requestStatus, decidedByEmail, comment });
  }
};

const syncServiceOutcomeToEvent = async ({ serviceRequest, decidedByEmail, comment }) => {
  const eventId = String(serviceRequest?.event_id || "").trim();
  if (!eventId) {
    return;
  }

  const nowIso = new Date().toISOString();

  try {
    const eventRecord = await queryOne("events", {
      where: { event_id: eventId },
    });

    if (!eventRecord) {
      return;
    }

    const serviceApprovalState = await recomputeEventServiceApprovalState(eventId);
    const currentApprovalState = normalizeWorkflowStatus(eventRecord.approval_state, "APPROVED");
    const resolvedActivationState = resolveActivationState(
      currentApprovalState,
      serviceApprovalState
    );
    const lifecycleStatus = resolveEventLifecycleStatusFromWorkflow({
      currentStatus: eventRecord?.status,
      approvalState: currentApprovalState,
      serviceApprovalState,
    });

    const workflowPhase =
      serviceApprovalState === "PENDING" || serviceApprovalState === "REJECTED"
        ? WORKFLOW_PHASE.LOGISTICS_APPROVAL
        : currentApprovalState === "APPROVED"
        ? WORKFLOW_PHASE.APPROVED
        : normalizeWorkflowPhase(eventRecord?.workflow_phase, WORKFLOW_PHASE.DRAFT);

    const workflowStatus =
      serviceApprovalState === "REJECTED"
        ? "rejected"
        : currentApprovalState === "APPROVED" && serviceApprovalState === "APPROVED"
        ? "fully_approved"
        : normalizeWorkflowStatusToken(eventRecord?.workflow_status, "fully_approved");

    const updates = {
      service_approval_state: serviceApprovalState,
      activation_state: resolvedActivationState,
      workflow_phase: workflowPhase,
      workflow_status: workflowStatus,
      status: lifecycleStatus,
      is_draft: shouldEntityRemainDraft(lifecycleStatus),
      updated_at: nowIso,
    };

    if (serviceApprovalState === "REJECTED") {
      updates.rejected_at = nowIso;
      updates.rejected_by = decidedByEmail || null;
      updates.rejection_reason = comment || "Rejected in service workflow";
    }

    if (serviceApprovalState === "APPROVED" && currentApprovalState === "APPROVED") {
      updates.rejected_at = null;
      updates.rejected_by = null;
      updates.rejection_reason = null;
      updates.approved_at = eventRecord.approved_at || nowIso;
      updates.approved_by = eventRecord.approved_by || decidedByEmail || null;
    }

    const persisted = await updateWithMissingColumnFallback({
      tableName: "events",
      updates,
      where: { event_id: eventId },
      removableColumns: [
        "service_approval_state",
        "activation_state",
        "workflow_phase",
        "workflow_status",
        "status",
        "is_draft",
        "approved_at",
        "approved_by",
        "rejected_at",
        "rejected_by",
        "rejection_reason",
      ],
    });

    if (!persisted) {
      return;
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      return;
    }

    throw error;
  }
};

const normalizeDecision = (decision) => String(decision || "").trim().toUpperCase();
const isTruthyValue = (value) => {
  if (value === true || value === 1 || value === "1") {
    return true;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "yes", "on"].includes(normalized);
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeDepartmentScopeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeSchoolScopeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeDepartmentScopeForMatching = (value) =>
  normalizeDepartmentScopeValue(value)
    .replace(/[_-]+/g, " ")
    .replace(/^department of\s+/, "")
    .replace(/^department\s+/, "")
    .replace(/^dept(?:\.)?\s+of\s+/, "")
    .replace(/^dept(?:\.)?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

const buildDepartmentScopeCandidates = (value) => {
  const candidates = new Set();
  const raw = normalizeDepartmentScopeValue(value);
  const canonical = normalizeDepartmentScopeForMatching(value);

  if (raw) {
    candidates.add(raw);
  }

  if (canonical) {
    candidates.add(canonical);
    candidates.add(canonical.replace(/\s+/g, "_"));
    candidates.add(`dept_${canonical.replace(/\s+/g, "_")}`);
    candidates.add(`department_${canonical.replace(/\s+/g, "_")}`);
    candidates.add(`department of ${canonical}`);
  }

  return Array.from(candidates).filter((candidate) => candidate.length > 0);
};

const resolveSchoolScopeFromDepartmentValue = async (departmentValue) => {
  const normalized = String(departmentValue || "").trim();
  if (!normalized) return "";

  try {
    if (UUID_REGEX.test(normalized)) {
      const row = await queryOne("departments", { where: { id: normalized }, select: "id,school" });
      return normalizeSchoolScopeValue(row?.school);
    }

    const rows = await queryAll("departments", { select: "id,name,school" });
    for (const row of rows || []) {
      if (normalizeDepartmentScopeValue(row?.name) === normalizeDepartmentScopeValue(normalized)) {
        const school = normalizeSchoolScopeValue(row?.school);
        if (school) return school;
      }
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  return "";
};

const isRoleAssignmentActive = (assignment) => {
  if (!assignment || assignment.is_active === false) {
    return false;
  }

  const now = Date.now();
  const validFrom = assignment.valid_from
    ? new Date(String(assignment.valid_from)).getTime()
    : null;
  const validUntil = assignment.valid_until
    ? new Date(String(assignment.valid_until)).getTime()
    : null;

  if (Number.isFinite(validFrom) && validFrom > now) {
    return false;
  }

  if (Number.isFinite(validUntil) && validUntil <= now) {
    return false;
  }

  return true;
};

const resolveDeptNameById = async (id) => {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;

  try {
    const row = await queryOne("departments", { where: { id: normalizedId }, select: "id,name" });
    if (row?.name) return row.name;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  return null;
};

const resolveDepartmentLabelsFromIds = async (departmentIds) => {
  const labels = new Set();

  for (const departmentId of departmentIds) {
    const normalizedId = String(departmentId || "").trim();
    if (!normalizedId) {
      continue;
    }

    labels.add(normalizeDepartmentScopeValue(normalizedId));

    try {
      const name = await resolveDeptNameById(normalizedId);
      if (name) {
        labels.add(normalizeDepartmentScopeValue(name));
      }
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }
  }

  return labels;
};

const resolveHodDepartmentScope = async (req) => {
  if (req.__hodDepartmentScope instanceof Set) {
    return req.__hodDepartmentScope;
  }

  const departmentScope = new Set();
  const departmentIdCandidates = new Set();

  const addScopeValue = (value) => {
    const normalizedValue = normalizeDepartmentScopeValue(value);
    if (normalizedValue) {
      departmentScope.add(normalizedValue);
    }
  };

  const userDepartmentId = String(req.userInfo?.department_id || "").trim();
  if (userDepartmentId) {
    addScopeValue(userDepartmentId);
    departmentIdCandidates.add(userDepartmentId);
  }

  const userId = String(req.userInfo?.id || "").trim();
  if (userId) {
    try {
      const assignments = await queryAll("user_role_assignments", {
        where: { user_id: userId, role_code: ROLE_CODES.HOD },
        select: "department_id,department_scope,is_active,valid_from,valid_until",
      });

      for (const assignment of assignments || []) {
        if (!isRoleAssignmentActive(assignment)) {
          continue;
        }

        const uuidDeptId = String(assignment.department_id || "").trim();
        if (uuidDeptId) {
          departmentIdCandidates.add(uuidDeptId);
        }

        // Also add text-based department_scope as a direct normalized scope value
        const textScope = String(assignment.department_scope || "").trim();
        if (textScope) {
          addScopeValue(textScope);
        }
      }
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }
  }

  const departmentLabels = await resolveDepartmentLabelsFromIds(
    Array.from(departmentIdCandidates)
  );

  departmentLabels.forEach((label) => departmentScope.add(label));

  req.__hodDepartmentScope = departmentScope;
  return departmentScope;
};

const resolveDeanSchoolScope = async (req) => {
  if (req.__deanSchoolScope instanceof Set) {
    return req.__deanSchoolScope;
  }

  const schoolScope = new Set();

  const addScopeValue = (value) => {
    const normalizedValue = normalizeSchoolScopeValue(value);
    if (normalizedValue) {
      schoolScope.add(normalizedValue);
    }
  };

  addScopeValue(req.userInfo?.school_id);
  addScopeValue(req.userInfo?.school);

  const userId = String(req.userInfo?.id || "").trim();
  if (userId) {
    try {
      const assignments = await queryAll("user_role_assignments", {
        where: { user_id: userId, role_code: ROLE_CODES.DEAN },
        select: "school_scope,department_id,is_active,valid_from,valid_until",
      });

      for (const assignment of assignments || []) {
        if (!isRoleAssignmentActive(assignment)) {
          continue;
        }

        const schoolScopeValue = String(assignment.school_scope || "").trim();
        if (!schoolScopeValue) {
          continue;
        }

        addScopeValue(schoolScopeValue);
      }
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }
  }

  req.__deanSchoolScope = schoolScope;
  return schoolScope;
};

const resolveApprovalRequestScopeValue = async ({
  approvalRequest,
  scopeColumn,
  normalizeScopeValue,
}) => {
  const directScopeValue = normalizeScopeValue(approvalRequest?.[scopeColumn]);
  if (directScopeValue) {
    return directScopeValue;
  }

  const entityType = normalizeWorkflowStatus(approvalRequest?.entity_type);
  const entityRef = String(approvalRequest?.entity_ref || "").trim();

  if (!entityRef) {
    return "";
  }

  try {
    if (["EVENT", "STANDALONE_EVENT", "FEST_CHILD_EVENT"].includes(entityType)) {
      const event = await queryOne("events", {
        where: { event_id: entityRef },
        select: `event_id,${scopeColumn}`,
      });

      return normalizeScopeValue(event?.[scopeColumn]);
    }

    if (entityType === "FEST") {
      try {
        const fest = await queryOne("fests", {
          where: { fest_id: entityRef },
          select: `fest_id,${scopeColumn}`,
        });

        return normalizeScopeValue(fest?.[scopeColumn]);
      } catch (error) {
        if (isMissingRelationError(error) || isMissingColumnError(error, scopeColumn)) {
          return "";
        }

        throw error;
      }
    }
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, scopeColumn)) {
      return "";
    }

    throw error;
  }

  return "";
};

const resolveApprovalRequestDepartmentScopeValue = async (approvalRequest) => {
  // Use UUID column on the approval_request row
  const deptId = String(approvalRequest?.organizing_dept_id || "").trim();
  if (deptId) {
    try {
      const name = await resolveDeptNameById(deptId);
      if (name) return normalizeDepartmentScopeValue(name);
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }

  // Try text organizing_dept field on the approval_request directly
  const directDeptText = String(approvalRequest?.organizing_dept || "").trim();
  if (directDeptText) {
    return normalizeDepartmentScopeValue(directDeptText);
  }

  // Fallback: UUID + text columns on the linked event or fest entity
  const entityType = normalizeWorkflowStatus(approvalRequest?.entity_type);
  const entityRef = String(approvalRequest?.entity_ref || "").trim();
  if (!entityRef) return "";

  try {
    let entityDeptId = null;
    let entityDeptText = null;
    if (["EVENT", "STANDALONE_EVENT", "FEST_CHILD_EVENT"].includes(entityType)) {
      const event = await queryOne("events", { where: { event_id: entityRef }, select: "organizing_dept_id" });
      entityDeptId = String(event?.organizing_dept_id || "").trim();
    } else if (entityType === "FEST") {
      const fest = await queryOne("fests", { where: { fest_id: entityRef }, select: "organizing_dept_id" });
      if (fest) {
        entityDeptId = String(fest?.organizing_dept_id || "").trim();
      }
    }
    if (entityDeptId) {
      const name = await resolveDeptNameById(entityDeptId);
      if (name) return normalizeDepartmentScopeValue(name);
    }
    if (entityDeptText) {
      return normalizeDepartmentScopeValue(entityDeptText);
    }
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "organizing_dept_id")) return "";
    throw error;
  }

  return "";
};

const resolveApprovalRequestSchoolScopeValue = async (approvalRequest) => {
  const directSchoolScope = await resolveApprovalRequestScopeValue({
    approvalRequest,
    scopeColumn: "organizing_school",
    normalizeScopeValue: normalizeSchoolScopeValue,
  });

  if (directSchoolScope) {
    return directSchoolScope;
  }

  const departmentScope = await resolveApprovalRequestDepartmentScopeValue(
    approvalRequest
  );

  if (!departmentScope) {
    return "";
  }

  return resolveSchoolScopeFromDepartmentValue(departmentScope);
};

const resolveApprovalRequestCampusScopeValue = async (approvalRequest) => {
  return resolveApprovalRequestScopeValue({
    approvalRequest,
    scopeColumn: "campus_hosted_at",
    normalizeScopeValue: (value) => String(value || "").trim(),
  });
};

const canHodAccessApprovalRequest = async (req, approvalRequest) => {
  if (isMasterAdminRequest(req)) {
    return true;
  }

  const departmentScope = await resolveHodDepartmentScope(req);
  if (departmentScope.size === 0) {
    return false;
  }

  const requestDepartment = await resolveApprovalRequestDepartmentScopeValue(
    approvalRequest
  );

  if (!requestDepartment) {
    return false;
  }

  return departmentScope.has(requestDepartment);
};

const canDeanAccessApprovalRequest = async (req, approvalRequest) => {
  if (isMasterAdminRequest(req)) {
    return true;
  }

  const schoolScope = await resolveDeanSchoolScope(req);
  if (schoolScope.size === 0) {
    return false;
  }

  const requestSchool = await resolveApprovalRequestSchoolScopeValue(approvalRequest);
  if (!requestSchool) {
    return false;
  }

  return schoolScope.has(requestSchool);
};

const getUserRoleCodes = (req) => {
  return Array.isArray(req.userInfo?.role_codes) ? req.userInfo.role_codes : [];
};

const isMasterAdminRequest = (req) => {
  return Boolean(req.userInfo?.is_masteradmin) || hasAnyRoleCode(getUserRoleCodes(req), [ROLE_CODES.MASTER_ADMIN]);
};

const hasQueueRoleAccess = (req, roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  if (!normalizedRoleCode) {
    return false;
  }

  if (hasAnyRoleCode(getUserRoleCodes(req), [normalizedRoleCode])) {
    return true;
  }

  const userInfo = req.userInfo || {};

  if (normalizedRoleCode === ROLE_CODES.HOD) {
    return isTruthyValue(userInfo.is_hod);
  }

  if (normalizedRoleCode === ROLE_CODES.DEAN) {
    return isTruthyValue(userInfo.is_dean);
  }

  if (normalizedRoleCode === ROLE_CODES.CFO) {
    return isTruthyValue(userInfo.is_cfo);
  }

  if (
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  ) {
    return (
      isTruthyValue(userInfo.is_finance_officer) ||
      isTruthyValue(userInfo.is_finance_office)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_IT) {
    return isTruthyValue(userInfo.is_service_it);
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_VENUE) {
    return (
      isTruthyValue(userInfo.is_service_venue) ||
      isTruthyValue(userInfo.is_venue_manager)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_CATERING) {
    return isTruthyValue(userInfo.is_service_catering);
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_STALLS) {
    return isTruthyValue(userInfo.is_service_stalls);
  }

  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_STUDENT) {
    return isTruthyValue(userInfo.is_organiser_student);
  }

  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_TEACHER) {
    return isTruthyValue(userInfo.is_organiser);
  }

  return false;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isLikelyEmailAddress = (value) => /.+@.+\..+/.test(String(value || "").trim());

const pickPreferredNotificationEmail = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate);
    if (normalized && isLikelyEmailAddress(normalized)) {
      return normalized;
    }
  }

  return "";
};

const stripRevisionPrefix = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const prefix = "RETURN_FOR_REVISION:";
  if (raw.toUpperCase().startsWith(prefix)) {
    return raw.slice(prefix.length).trim();
  }

  return raw;
};

const getApprovalRequestForEvent = async (eventId) => {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) {
    return null;
  }

  const event = await queryOne("events", {
    where: { event_id: normalizedEventId },
    select: "event_id,approval_request_id,created_by,organizer_email,organiser_email",
  });

  if (!event || !event.approval_request_id) {
    return null;
  }

  const approvalRequest = await queryOne("approval_requests", {
    where: { id: event.approval_request_id },
  });

  if (!approvalRequest) {
    return null;
  }

  return { approvalRequest, event };
};

const canReadApprovalRequest = async (req, approvalRequest, steps = []) => {
  if (!approvalRequest) {
    return false;
  }

  if (isMasterAdminRequest(req)) {
    return true;
  }

  const currentUserId = String(req.userInfo?.id || "").trim();
  const currentUserEmail = normalizeEmail(req.userInfo?.email);

  if (currentUserId && String(approvalRequest.requested_by_user_id || "").trim() === currentUserId) {
    return true;
  }

  if (
    currentUserEmail &&
    normalizeEmail(approvalRequest.requested_by_email) === currentUserEmail
  ) {
    return true;
  }

  const userRoleCodes = getUserRoleCodes(req);
  const stepRoleCodes = (steps || [])
    .map((step) => normalizeRoleCode(step?.role_code))
    .filter(Boolean);

  if (stepRoleCodes.length > 0 && hasAnyRoleCode(userRoleCodes, stepRoleCodes)) {
    const hasHodRoleForStep =
      stepRoleCodes.includes(ROLE_CODES.HOD) &&
      hasAnyRoleCode(userRoleCodes, [ROLE_CODES.HOD]);
    if (hasHodRoleForStep && (await canHodAccessApprovalRequest(req, approvalRequest))) {
      return true;
    }

    const hasDeanRoleForStep =
      stepRoleCodes.includes(ROLE_CODES.DEAN) &&
      hasAnyRoleCode(userRoleCodes, [ROLE_CODES.DEAN]);
    if (hasDeanRoleForStep && (await canDeanAccessApprovalRequest(req, approvalRequest))) {
      return true;
    }

    const nonScopedRoles = stepRoleCodes.filter(
      (roleCode) => roleCode !== ROLE_CODES.HOD && roleCode !== ROLE_CODES.DEAN
    );

    if (nonScopedRoles.length > 0 && hasAnyRoleCode(userRoleCodes, nonScopedRoles)) {
      return true;
    }
  }

  const entityType = normalizeWorkflowStatus(approvalRequest.entity_type);
  const entityRef = String(approvalRequest.entity_ref || "").trim();

  if (!currentUserEmail || !entityRef) {
    return false;
  }

  try {
    if (["EVENT", "STANDALONE_EVENT", "FEST_CHILD_EVENT"].includes(entityType)) {
      const event = await queryOne("events", {
        where: { event_id: entityRef },
        select: "event_id,created_by,organizer_email,organiser_email",
      });

      if (!event) {
        return false;
      }

      const ownerCandidates = [
        normalizeEmail(event.created_by),
        normalizeEmail(event.organizer_email),
        normalizeEmail(event.organiser_email),
      ].filter(Boolean);

      return ownerCandidates.includes(currentUserEmail);
    }

    if (entityType === "FEST") {
      for (const tableName of ["fests", "fest"]) {
        try {
          const fest = await queryOne(tableName, {
            where: { fest_id: entityRef },
            select: "fest_id,created_by,contact_email",
          });

          if (!fest) {
            continue;
          }

          const ownerCandidates = [
            normalizeEmail(fest.created_by),
            normalizeEmail(fest.contact_email),
          ].filter(Boolean);

          return ownerCandidates.includes(currentUserEmail);
        } catch (error) {
          if (isMissingRelationError(error)) {
            continue;
          }

          throw error;
        }
      }
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      return false;
    }

    throw error;
  }

  return false;
};

const ensureQueueAccess = async (req, res, roleCode, approvalRequest = null) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if (!normalizedRoleCode) {
    res.status(400).json({ error: "roleCode is required" });
    return false;
  }

  if (isMasterAdminRequest(req)) {
    return true;
  }

  if (!hasQueueRoleAccess(req, normalizedRoleCode)) {
    res.status(403).json({ error: "Access denied: role queue access not permitted" });
    return false;
  }

  if (normalizedRoleCode === ROLE_CODES.HOD) {
    const departmentScope = await resolveHodDepartmentScope(req);
    if (departmentScope.size === 0) {
      res.status(403).json({
        error: "Access denied: no department scope is configured for this HOD account.",
      });
      return false;
    }

    if (approvalRequest) {
      const canAccessRequest = await canHodAccessApprovalRequest(req, approvalRequest);
      if (!canAccessRequest) {
        res.status(403).json({
          error: "Access denied: this request does not belong to your department scope.",
        });
        return false;
      }
    }
  }

  if (normalizedRoleCode === ROLE_CODES.DEAN) {
    const schoolScope = await resolveDeanSchoolScope(req);
    if (schoolScope.size === 0) {
      res.status(403).json({
        error: "Access denied: no school scope is configured for this Dean account.",
      });
      return false;
    }

    if (approvalRequest) {
      const canAccessRequest = await canDeanAccessApprovalRequest(req, approvalRequest);
      if (!canAccessRequest) {
        res.status(403).json({
          error: "Access denied: this request does not belong to your school scope.",
        });
        return false;
      }
    }
  }

  return true;
};

const persistApprovalRequestScopeForRouting = async (approvalRequest) => {
  if (!approvalRequest?.id) {
    return approvalRequest;
  }

  const currentDeptId = String(approvalRequest?.organizing_dept_id || "").trim();
  const currentSchool = String(approvalRequest?.organizing_school || "").trim();
  const currentCampus = String(approvalRequest?.campus_hosted_at || "").trim();

  const updates = {};

  // Populate organizing_dept_id (UUID) if missing
  if (!currentDeptId) {
    const resolvedDepartment = await resolveApprovalRequestDepartmentScopeValue(approvalRequest);
    if (resolvedDepartment) {
      const resolvedId = await resolveDepartmentId(resolvedDepartment).catch(() => null);
      if (resolvedId) {
        updates.organizing_dept_id = resolvedId;
      }
    }
  }

  if (!currentSchool) {
    const resolvedSchool = await resolveApprovalRequestSchoolScopeValue(approvalRequest);

    if (resolvedSchool) {
      updates.organizing_school = resolvedSchool;
    }
  }

  if (!currentCampus) {
    const resolvedCampus = await resolveApprovalRequestCampusScopeValue(approvalRequest);
    if (resolvedCampus) {
      updates.campus_hosted_at = resolvedCampus;
    }
  }

  if (Object.keys(updates).length === 0) {
    return approvalRequest;
  }

  const nowIso = new Date().toISOString();
  const persisted = await updateWithMissingColumnFallback({
    tableName: "approval_requests",
    updates: {
      ...updates,
      updated_at: nowIso,
    },
    where: { id: approvalRequest.id },
    removableColumns: ["organizing_dept_id", "organizing_school", "campus_hosted_at"],
  });

  if (!persisted) {
    return approvalRequest;
  }

  return {
    ...approvalRequest,
    ...updates,
    updated_at: nowIso,
  };
};

const shouldInsertDeanStepForRequest = async (approvalRequest) => {
  const entityType = String(approvalRequest?.entity_type || "").trim().toUpperCase();
  // Fests always follow HOD → Dean, so always insert Dean.
  if (entityType === "FEST" || entityType === "FEST_CHILD_EVENT") {
    return true;
  }

  const eventId = resolveEventIdFromApprovalRequest(approvalRequest);
  if (!eventId) {
    // Unknown entity scope; preserve legacy behaviour (insert Dean).
    return true;
  }

  try {
    const eventRow = await queryOne("events", {
      where: { event_id: eventId },
      select: "event_id,requires_dean_approval,needs_hod_dean_approval",
    });

    if (!eventRow) {
      return true;
    }

    if (eventRow.requires_dean_approval !== undefined && eventRow.requires_dean_approval !== null) {
      return Boolean(eventRow.requires_dean_approval);
    }

    // Legacy rows where the new column doesn't exist: fall back to combined flag.
    return Boolean(eventRow.needs_hod_dean_approval);
  } catch (error) {
    if (
      isMissingRelationError(error) ||
      isMissingColumnError(error, "requires_dean_approval")
    ) {
      return true;
    }

    throw error;
  }
};

const ensureDeanStepAfterHodTransition = async ({ approvalRequest, approvalStep, nowIso }) => {
  const requestDbId = String(approvalRequest?.id || "").trim();
  if (!requestDbId) {
    return;
  }

  const stepRoleCode = normalizeRoleCode(approvalStep?.role_code || approvalStep?.step_code);
  if (stepRoleCode !== ROLE_CODES.HOD) {
    return;
  }

  const existingDeanSteps = await queryAll("approval_steps", {
    where: {
      approval_request_id: requestDbId,
      role_code: ROLE_CODES.DEAN,
    },
    order: { column: "sequence_order", ascending: true },
    limit: 1,
  });

  if ((existingDeanSteps || []).length > 0) {
    return;
  }

  // Standalone events may have `requires_dean_approval = false` — in that case,
  // do not inject a Dean step after HOD. Fests always cascade to Dean.
  if (!(await shouldInsertDeanStepForRequest(approvalRequest))) {
    return;
  }

  const hodSequenceOrder = Number(approvalStep?.sequence_order || 0) || 1;
  const hodStepGroup = Number(approvalStep?.step_group || hodSequenceOrder) || hodSequenceOrder;

  const allSteps = await queryAll("approval_steps", {
    where: { approval_request_id: requestDbId },
    order: { column: "sequence_order", ascending: false },
  });

  for (const stepRow of allSteps || []) {
    const stepId = String(stepRow?.id || "").trim();
    if (!stepId || stepId === String(approvalStep?.id || "").trim()) {
      continue;
    }

    const sequenceOrder = Number(stepRow?.sequence_order || 0);
    if (!Number.isFinite(sequenceOrder) || sequenceOrder <= hodSequenceOrder) {
      continue;
    }

    const stepGroupValue = Number(stepRow?.step_group || sequenceOrder);
    const shiftedStepGroup = Number.isFinite(stepGroupValue) && stepGroupValue > 0
      ? stepGroupValue + 1
      : sequenceOrder + 1;

    await update(
      "approval_steps",
      {
        sequence_order: sequenceOrder + 1,
        step_group: shiftedStepGroup,
        updated_at: nowIso,
      },
      { id: stepId }
    );
  }

  await update(
    "approval_steps",
    {
      status: "WAITING",
      updated_at: nowIso,
    },
    {
      approval_request_id: requestDbId,
      status: "PENDING",
    }
  );

  await insert("approval_steps", [
    {
      approval_request_id: requestDbId,
      step_code: "DEAN",
      role_code: ROLE_CODES.DEAN,
      step_group: hodStepGroup + 1,
      sequence_order: hodSequenceOrder + 1,
      required_count: 1,
      status: "WAITING",
      created_at: nowIso,
      updated_at: nowIso,
    },
  ]);
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveEventIdFromApprovalRequest = (approvalRequest) => {
  if (!isEventEntityType(approvalRequest?.entity_type)) {
    return "";
  }

  return String(approvalRequest?.event_id || approvalRequest?.entity_ref || "").trim();
};

const resolveBudgetAmountFromEventRow = async (eventId) => {
  const attemptSelects = [
    "event_id,total_estimated_expense,estimated_budget_amount,budget_amount",
    "event_id,estimated_budget_amount,budget_amount",
    "event_id,budget_amount",
  ];

  for (const select of attemptSelects) {
    try {
      const eventRow = await queryOne("events", {
        where: { event_id: eventId },
        select,
      });

      if (!eventRow) {
        return null;
      }

      const candidates = [
        eventRow.total_estimated_expense,
        eventRow.estimated_budget_amount,
        eventRow.budget_amount,
      ];

      for (const candidate of candidates) {
        const parsed = toFiniteNumber(candidate, 0);
        if (parsed > 0) {
          return parsed;
        }
      }

      return 0;
    } catch (error) {
      if (
        isMissingColumnError(error, "total_estimated_expense") ||
        isMissingColumnError(error, "estimated_budget_amount") ||
        isMissingColumnError(error, "budget_amount")
      ) {
        continue;
      }

      throw error;
    }
  }

  return null;
};

const resolveBudgetAmountForApprovalRequest = async (approvalRequest) => {
  const eventId = resolveEventIdFromApprovalRequest(approvalRequest);
  if (!eventId) {
    return null;
  }

  try {
    const eventBudget = await resolveBudgetAmountFromEventRow(eventId);
    if (eventBudget !== null && eventBudget > 0) {
      return eventBudget;
    }

    const budgetRecord = await queryOne("event_budgets", {
      where: { event_id: eventId },
      select: "event_id,total_estimated_expense,total_actual_expense",
    });

    if (!budgetRecord) {
      return eventBudget !== null ? eventBudget : 0;
    }

    const estimatedExpense = toFiniteNumber(budgetRecord.total_estimated_expense, 0);
    if (estimatedExpense > 0) {
      return estimatedExpense;
    }

    const actualExpense = Math.max(toFiniteNumber(budgetRecord.total_actual_expense, 0), 0);
    if (actualExpense > 0) {
      return actualExpense;
    }

    return eventBudget !== null ? eventBudget : 0;
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "total_estimated_expense")) {
      return null;
    }

    throw error;
  }
};

const shouldRequireFinanceAfterDeanApproval = async (approvalRequest) => {
  const resolvedBudgetAmount = await resolveBudgetAmountForApprovalRequest(approvalRequest);
  if (resolvedBudgetAmount !== null) {
    return resolvedBudgetAmount > 0;
  }

  return isTruthyValue(approvalRequest?.is_budget_related);
};

const isFinanceRoleCode = (roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  return (
    normalizedRoleCode === ROLE_CODES.CFO ||
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  );
};

const resolveFinanceStepCode = (roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  if (normalizedRoleCode === ROLE_CODES.CFO) {
    return "L3_CFO";
  }

  if (
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  ) {
    return "L4_ACCOUNTS";
  }

  return "";
};

const ensureFinanceStepsAfterDeanTransition = async ({ approvalRequest, approvalStep, nowIso }) => {
  const requestDbId = String(approvalRequest?.id || "").trim();
  if (!requestDbId) {
    return;
  }

  const stepRoleCode = normalizeRoleCode(approvalStep?.role_code || approvalStep?.step_code);
  if (stepRoleCode !== ROLE_CODES.DEAN) {
    return;
  }

  const requiresFinanceApproval = await shouldRequireFinanceAfterDeanApproval(approvalRequest);

  const allSteps = await queryAll("approval_steps", {
    where: { approval_request_id: requestDbId },
    order: { column: "sequence_order", ascending: false },
  });

  const financeSteps = (allSteps || []).filter((stepRow) =>
    isFinanceRoleCode(stepRow?.role_code || stepRow?.step_code)
  );

  if (!requiresFinanceApproval) {
    for (const stepRow of financeSteps) {
      const stepId = String(stepRow?.id || "").trim();
      if (!stepId) {
        continue;
      }

      const currentStatus = String(stepRow?.status || "").trim().toUpperCase();
      if (!["PENDING", "WAITING"].includes(currentStatus)) {
        continue;
      }

      await update(
        "approval_steps",
        {
          status: "SKIPPED",
          updated_at: nowIso,
        },
        { id: stepId }
      );
    }

    return;
  }

  for (const financeStep of financeSteps) {
    const stepId = String(financeStep?.id || "").trim();
    if (!stepId) {
      continue;
    }

    const desiredStepCode = resolveFinanceStepCode(
      financeStep?.role_code || financeStep?.step_code
    );
    const currentStepCode = String(financeStep?.step_code || "").trim();

    if (!desiredStepCode || currentStepCode.toUpperCase() === desiredStepCode) {
      continue;
    }

    await update(
      "approval_steps",
      {
        step_code: desiredStepCode,
        updated_at: nowIso,
      },
      { id: stepId }
    );
  }

  const cfoStep = financeSteps.find(
    (stepRow) => normalizeRoleCode(stepRow?.role_code || stepRow?.step_code) === ROLE_CODES.CFO
  );

  const accountsStep = financeSteps.find((stepRow) => {
    const roleCode = normalizeRoleCode(stepRow?.role_code || stepRow?.step_code);
    return roleCode === ROLE_CODES.ACCOUNTS || roleCode === ROLE_CODES.FINANCE_OFFICER;
  });

  if (cfoStep && accountsStep) {
    return;
  }

  if (cfoStep && !accountsStep) {
    const cfoSequenceOrder = Number(cfoStep?.sequence_order || 0) || 1;
    const cfoStepGroup = Number(cfoStep?.step_group || cfoSequenceOrder) || cfoSequenceOrder;

    for (const stepRow of allSteps || []) {
      const stepId = String(stepRow?.id || "").trim();
      if (!stepId || stepId === String(cfoStep?.id || "").trim()) {
        continue;
      }

      const sequenceOrder = Number(stepRow?.sequence_order || 0);
      if (!Number.isFinite(sequenceOrder) || sequenceOrder <= cfoSequenceOrder) {
        continue;
      }

      const stepGroupValue = Number(stepRow?.step_group || sequenceOrder);
      const shiftedStepGroup = Number.isFinite(stepGroupValue) && stepGroupValue > 0
        ? stepGroupValue + 1
        : sequenceOrder + 1;

      await update(
        "approval_steps",
        {
          sequence_order: sequenceOrder + 1,
          step_group: shiftedStepGroup,
          updated_at: nowIso,
        },
        { id: stepId }
      );
    }

    await insert("approval_steps", [
      {
        approval_request_id: requestDbId,
        step_code: "L4_ACCOUNTS",
        role_code: ROLE_CODES.ACCOUNTS,
        step_group: cfoStepGroup + 1,
        sequence_order: cfoSequenceOrder + 1,
        required_count: 1,
        status: "WAITING",
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    return;
  }

  if (!cfoStep && accountsStep) {
    const accountsSequenceOrder = Number(accountsStep?.sequence_order || 0) || 1;
    const accountsStepGroup = Number(accountsStep?.step_group || accountsSequenceOrder) || accountsSequenceOrder;

    for (const stepRow of allSteps || []) {
      const stepId = String(stepRow?.id || "").trim();
      if (!stepId || stepId === String(accountsStep?.id || "").trim()) {
        continue;
      }

      const sequenceOrder = Number(stepRow?.sequence_order || 0);
      if (!Number.isFinite(sequenceOrder) || sequenceOrder < accountsSequenceOrder) {
        continue;
      }

      const stepGroupValue = Number(stepRow?.step_group || sequenceOrder);
      const shiftedStepGroup = Number.isFinite(stepGroupValue) && stepGroupValue > 0
        ? stepGroupValue + 1
        : sequenceOrder + 1;

      await update(
        "approval_steps",
        {
          sequence_order: sequenceOrder + 1,
          step_group: shiftedStepGroup,
          updated_at: nowIso,
        },
        { id: stepId }
      );
    }

    const existingAccountsStatus = String(accountsStep?.status || "").trim().toUpperCase();
    await update(
      "approval_steps",
      {
        sequence_order: accountsSequenceOrder + 1,
        step_group: accountsStepGroup + 1,
        step_code: "L4_ACCOUNTS",
        status: ["APPROVED", "REJECTED", "SKIPPED"].includes(existingAccountsStatus)
          ? existingAccountsStatus
          : "WAITING",
        updated_at: nowIso,
      },
      { id: String(accountsStep?.id || "").trim() }
    );

    await insert("approval_steps", [
      {
        approval_request_id: requestDbId,
        step_code: "L3_CFO",
        role_code: ROLE_CODES.CFO,
        step_group: accountsStepGroup,
        sequence_order: accountsSequenceOrder,
        required_count: 1,
        status: "WAITING",
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    return;
  }

  const deanSequenceOrder = Number(approvalStep?.sequence_order || 0) || 1;
  const deanStepGroup = Number(approvalStep?.step_group || deanSequenceOrder) || deanSequenceOrder;

  for (const stepRow of allSteps || []) {
    const stepId = String(stepRow?.id || "").trim();
    if (!stepId || stepId === String(approvalStep?.id || "").trim()) {
      continue;
    }

    const sequenceOrder = Number(stepRow?.sequence_order || 0);
    if (!Number.isFinite(sequenceOrder) || sequenceOrder <= deanSequenceOrder) {
      continue;
    }

    const stepGroupValue = Number(stepRow?.step_group || sequenceOrder);
    const shiftedStepGroup = Number.isFinite(stepGroupValue) && stepGroupValue > 0
      ? stepGroupValue + 2
      : sequenceOrder + 2;

    await update(
      "approval_steps",
      {
        sequence_order: sequenceOrder + 2,
        step_group: shiftedStepGroup,
        updated_at: nowIso,
      },
      { id: stepId }
    );
  }

  await insert("approval_steps", [
    {
      approval_request_id: requestDbId,
      step_code: "L3_CFO",
      role_code: ROLE_CODES.CFO,
      step_group: deanStepGroup + 1,
      sequence_order: deanSequenceOrder + 1,
      required_count: 1,
      status: "WAITING",
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      approval_request_id: requestDbId,
      step_code: "L4_ACCOUNTS",
      role_code: ROLE_CODES.ACCOUNTS,
      step_group: deanStepGroup + 2,
      sequence_order: deanSequenceOrder + 2,
      required_count: 1,
      status: "WAITING",
      created_at: nowIso,
      updated_at: nowIso,
    },
  ]);
};

const ensureAccountsStepAfterCfoTransition = async ({ approvalRequest, approvalStep, nowIso }) => {
  const requestDbId = String(approvalRequest?.id || "").trim();
  if (!requestDbId) {
    return;
  }

  const stepRoleCode = normalizeRoleCode(approvalStep?.role_code || approvalStep?.step_code);
  if (stepRoleCode !== ROLE_CODES.CFO) {
    return;
  }

  const allSteps = await queryAll("approval_steps", {
    where: { approval_request_id: requestDbId },
    order: { column: "sequence_order", ascending: false },
  });

  const existingAccountsStep = (allSteps || []).find((stepRow) => {
    const roleCode = normalizeRoleCode(stepRow?.role_code || stepRow?.step_code);
    return roleCode === ROLE_CODES.ACCOUNTS || roleCode === ROLE_CODES.FINANCE_OFFICER;
  });

  if (existingAccountsStep) {
    const existingStepId = String(existingAccountsStep?.id || "").trim();
    const existingStatus = String(existingAccountsStep?.status || "").trim().toUpperCase();

    const desiredStepCode = resolveFinanceStepCode(
      existingAccountsStep?.role_code || existingAccountsStep?.step_code
    );
    const currentStepCode = String(existingAccountsStep?.step_code || "").trim();

    const patchFields = {};

    if (desiredStepCode && currentStepCode.toUpperCase() !== desiredStepCode) {
      patchFields.step_code = desiredStepCode;
    }

    // If the accounts step was skipped (e.g. zero-budget path during Dean approval),
    // reactivate it to WAITING so the promotion loop picks it up.
    if (existingStatus === "SKIPPED") {
      patchFields.status = "WAITING";
    }

    if (Object.keys(patchFields).length > 0) {
      await update(
        "approval_steps",
        { ...patchFields, updated_at: nowIso },
        { id: existingStepId }
      );
    }

    return;
  }

  const cfoSequenceOrder = Number(approvalStep?.sequence_order || 0) || 1;
  const cfoStepGroup = Number(approvalStep?.step_group || cfoSequenceOrder) || cfoSequenceOrder;

  for (const stepRow of allSteps || []) {
    const stepId = String(stepRow?.id || "").trim();
    if (!stepId || stepId === String(approvalStep?.id || "").trim()) {
      continue;
    }

    const sequenceOrder = Number(stepRow?.sequence_order || 0);
    if (!Number.isFinite(sequenceOrder) || sequenceOrder <= cfoSequenceOrder) {
      continue;
    }

    const stepGroupValue = Number(stepRow?.step_group || sequenceOrder);
    const shiftedStepGroup = Number.isFinite(stepGroupValue) && stepGroupValue > 0
      ? stepGroupValue + 1
      : sequenceOrder + 1;

    await update(
      "approval_steps",
      {
        sequence_order: sequenceOrder + 1,
        step_group: shiftedStepGroup,
        updated_at: nowIso,
      },
      { id: stepId }
    );
  }

  await insert("approval_steps", [
    {
      approval_request_id: requestDbId,
      step_code: "L4_ACCOUNTS",
      role_code: ROLE_CODES.ACCOUNTS,
      step_group: cfoStepGroup + 1,
      sequence_order: cfoSequenceOrder + 1,
      required_count: 1,
      status: "WAITING",
      created_at: nowIso,
      updated_at: nowIso,
    },
  ]);
};

const recomputeApprovalRequestStatus = async (approvalRequestId) => {
  const steps = await queryAll("approval_steps", {
    where: { approval_request_id: approvalRequestId },
    order: { column: "sequence_order", ascending: true },
  });

  const nowIso = new Date().toISOString();

  if (steps.some((step) => String(step.status || "").toUpperCase() === "REJECTED")) {
    await update(
      "approval_requests",
      { status: "REJECTED", decided_at: nowIso, updated_at: nowIso },
      { id: approvalRequestId }
    );
    return "REJECTED";
  }

  const allCompleted = steps.length > 0 && steps.every((step) => {
    const status = String(step.status || "").toUpperCase();
    return status === "APPROVED" || status === "SKIPPED";
  });

  if (allCompleted) {
    await update(
      "approval_requests",
      { status: "APPROVED", decided_at: nowIso, updated_at: nowIso },
      { id: approvalRequestId }
    );
    return "APPROVED";
  }

  await update(
    "approval_requests",
    { status: "UNDER_REVIEW", updated_at: nowIso },
    { id: approvalRequestId }
  );

  return "UNDER_REVIEW";
};

const getApprovalRoleLabel = (roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if (normalizedRoleCode === ROLE_CODES.HOD) return "HOD";
  if (normalizedRoleCode === ROLE_CODES.DEAN) return "Dean";
  if (normalizedRoleCode === ROLE_CODES.CFO) return "CFO";
  if (
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  ) {
    return "Finance Officer";
  }
  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_TEACHER) {
    return "Organizer Teacher";
  }
  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_STUDENT) {
    return "Student Organiser";
  }
  if (normalizedRoleCode === ROLE_CODES.SERVICE_IT) {
    return "IT Team";
  }
  if (normalizedRoleCode === ROLE_CODES.SERVICE_VENUE) {
    return "Venue Team";
  }
  if (normalizedRoleCode === ROLE_CODES.SERVICE_CATERING) {
    return "Catering Team";
  }
  if (normalizedRoleCode === ROLE_CODES.SERVICE_STALLS) {
    return "Stalls Team";
  }

  return normalizedRoleCode || "Approver";
};

const isEventEntityType = (entityType) =>
  ["EVENT", "STANDALONE_EVENT", "FEST_CHILD_EVENT"].includes(
    normalizeWorkflowStatus(entityType)
  );

const normalizeNotificationScopeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const roleMatchesUserRecord = (userRow, roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  const normalizedUniversityRole = normalizeNotificationScopeValue(
    userRow?.university_role
  );

  if (normalizedRoleCode === ROLE_CODES.HOD) {
    return isTruthyValue(userRow?.is_hod) || normalizedUniversityRole === "hod";
  }

  if (normalizedRoleCode === ROLE_CODES.DEAN) {
    return isTruthyValue(userRow?.is_dean) || normalizedUniversityRole === "dean";
  }

  if (normalizedRoleCode === ROLE_CODES.CFO) {
    return isTruthyValue(userRow?.is_cfo) || normalizedUniversityRole === "cfo";
  }

  if (
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  ) {
    return (
      isTruthyValue(userRow?.is_finance_office) ||
      isTruthyValue(userRow?.is_finance_officer) ||
      ["finance_officer", "accounts"].includes(normalizedUniversityRole)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_IT) {
    return (
      isTruthyValue(userRow?.is_service_it) ||
      ["service_it", "it", "it_service"].includes(normalizedUniversityRole)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_VENUE) {
    return (
      isTruthyValue(userRow?.is_service_venue) ||
      ["service_venue", "venue", "venue_service"].includes(normalizedUniversityRole)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_CATERING) {
    return (
      isTruthyValue(userRow?.is_service_catering) ||
      ["service_catering", "catering", "catering_service"].includes(normalizedUniversityRole)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_STALLS) {
    return (
      isTruthyValue(userRow?.is_service_stalls) ||
      isTruthyValue(userRow?.is_stalls_misc) ||
      ["service_stalls", "stalls", "stalls_service"].includes(normalizedUniversityRole)
    );
  }

  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_STUDENT) {
    return (
      isTruthyValue(userRow?.is_organiser_student) ||
      ["organizer", "organiser", "organizer_student", "organiser_student"].includes(
        normalizedUniversityRole
      )
    );
  }

  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_TEACHER) {
    return (
      isTruthyValue(userRow?.is_organiser) ||
      ["organizer", "organiser", "organizer_teacher", "organiser_teacher"].includes(
        normalizedUniversityRole
      )
    );
  }

  return false;
};

const isUserWithinNotificationScope = (userRow, roleCode, scope = {}) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  const campusScope = normalizeNotificationScopeValue(scope.campusScope);
  const schoolScope = normalizeSchoolScopeValue(scope.schoolScope);
  const departmentScope = normalizeDepartmentScopeForMatching(scope.departmentScope);

  if (campusScope) {
    const userCampus = normalizeNotificationScopeValue(userRow?.campus);
    if (userCampus && userCampus !== campusScope) {
      return false;
    }
  }

  if (normalizedRoleCode === ROLE_CODES.DEAN && schoolScope) {
    const userSchool =
      normalizeSchoolScopeValue(userRow?.school) || normalizeSchoolScopeValue(userRow?.school_id);
    if (userSchool && userSchool !== schoolScope) {
      return false;
    }
  }

  if (normalizedRoleCode === ROLE_CODES.HOD && departmentScope) {
    const userDepartment =
      normalizeDepartmentScopeForMatching(userRow?.department) ||
      normalizeDepartmentScopeForMatching(userRow?.department_id);
    if (userDepartment && userDepartment !== departmentScope) {
      return false;
    }
  }

  return true;
};

const resolveRoleRecipientEmails = async ({
  roleCode,
  campusScope,
  schoolScope,
  departmentScope,
  excludeEmails = [],
}) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  if (!normalizedRoleCode) {
    return [];
  }

  const excluded = new Set(
    (excludeEmails || [])
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );

  try {
    let userRows = await queryAll("users", {
      select:
        "email,campus,school,school_id,department,department_id,university_role,is_hod,is_dean,is_cfo,is_finance_office,is_finance_officer,is_service_it,is_service_venue,is_service_catering,is_service_stalls,is_organiser_student,is_organiser",
    }).catch(async (error) => {
      if (
        !isMissingColumnError(error, "is_finance_officer") &&
        !isMissingColumnError(error, "is_finance_office") &&
        !isMissingColumnError(error, "department")
      ) {
        throw error;
      }

      return queryAll("users", {
        select:
          "email,campus,school,school_id,department_id,university_role,is_hod,is_dean,is_cfo,is_finance_office,is_service_it,is_service_venue,is_service_catering,is_service_stalls,is_organiser_student,is_organiser",
      });
    });

    // Pre-resolve department UUIDs to names for scope matching (handles post-035 state)
    const deptIdToName = {};
    for (const userRow of userRows || []) {
      const deptId = String(userRow?.department_id || "").trim();
      if (deptId && !deptIdToName[deptId] && !userRow?.department) {
        const name = await resolveDeptNameById(deptId).catch(() => null);
        if (name) deptIdToName[deptId] = name;
      }
    }

    const recipients = new Set();

    for (const userRow of userRows || []) {
      const email = normalizeEmail(userRow?.email);
      if (!email || excluded.has(email)) {
        continue;
      }

      if (!roleMatchesUserRecord(userRow, normalizedRoleCode)) {
        continue;
      }

      // Enrich with resolved department name if the text column is absent
      const enrichedUser = userRow?.department
        ? userRow
        : { ...userRow, department: deptIdToName[String(userRow?.department_id || "").trim()] || userRow?.department };

      if (
        !isUserWithinNotificationScope(enrichedUser, normalizedRoleCode, {
          campusScope,
          schoolScope,
          departmentScope,
        })
      ) {
        continue;
      }

      recipients.add(email);
    }

    return Array.from(recipients);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw error;
  }
};

const resolveRoleDashboardUrl = (roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if (normalizedRoleCode === ROLE_CODES.HOD) return "/manage/hod";
  if (normalizedRoleCode === ROLE_CODES.DEAN) return "/manage/dean";
  if (normalizedRoleCode === ROLE_CODES.CFO) return "/manage/cfo";
  if (
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  ) {
    return "/manage/finance";
  }
  if (normalizedRoleCode === ROLE_CODES.SERVICE_IT) return "/manage/it";
  if (normalizedRoleCode === ROLE_CODES.SERVICE_VENUE) return "/manage/venue";
  if (normalizedRoleCode === ROLE_CODES.SERVICE_CATERING) return "/manage/catering";
  if (normalizedRoleCode === ROLE_CODES.SERVICE_STALLS) return "/manage/stalls";

  return "/manage";
};

const notifyNextApprovalStageRole = async ({
  approvalRequest,
  currentApprovalStep,
  nextPendingStep,
  actorEmail,
}) => {
  if (!nextPendingStep) {
    return;
  }

  const context = await resolveApprovalNotificationContext(approvalRequest);
  if (!context) {
    return;
  }

  const nextRoleCode = normalizeRoleCode(
    nextPendingStep?.role_code || nextPendingStep?.step_code
  );
  if (!nextRoleCode) {
    return;
  }

  const recipientEmails = await resolveRoleRecipientEmails({
    roleCode: nextRoleCode,
    campusScope: approvalRequest?.campus_hosted_at,
    schoolScope: approvalRequest?.organizing_school,
    departmentScope: approvalRequest?.organizing_dept_id,
    excludeEmails: [approvalRequest?.requested_by_email, actorEmail],
  });

  if (recipientEmails.length === 0) {
    return;
  }

  const currentRoleLabel = getApprovalRoleLabel(currentApprovalStep?.role_code);
  const nextRoleLabel = getApprovalRoleLabel(nextRoleCode);

  await sendUserNotifications({
    userEmails: recipientEmails,
    title: `${context.entityLabel} awaiting ${nextRoleLabel} review`,
    message: `${context.title} was approved by ${currentRoleLabel} and is now pending ${nextRoleLabel} approval.`,
    type: "info",
    event_id: context.notificationEntityId,
    event_title: context.title,
    action_url: resolveRoleDashboardUrl(nextRoleCode),
  });
};

const notifyLogisticsAndStudentOrganiserHandoff = async ({
  approvalRequest,
}) => {
  if (!isEventEntityType(approvalRequest?.entity_type)) {
    return;
  }

  const context = await resolveApprovalNotificationContext(approvalRequest);
  if (!context?.notificationEntityId || !context?.record) {
    return;
  }

  const eventWorkflowPhase = normalizeWorkflowPhase(context.record?.workflow_phase, "");
  if (eventWorkflowPhase !== WORKFLOW_PHASE.LOGISTICS_APPROVAL) {
    return;
  }

  let serviceRequests = [];
  try {
    const serviceRequestRows = await queryAll("service_requests", {
      where: { event_id: context.notificationEntityId },
      select: "service_role_code,status",
    });
    serviceRequests = Array.isArray(serviceRequestRows) ? serviceRequestRows : [];
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
  }

  const pendingServiceRoleCodes = Array.from(
    new Set(
      serviceRequests
        .filter((requestRow) =>
          ["PENDING", "QUEUED"].includes(
            normalizeWorkflowStatus(requestRow?.status, "PENDING")
          )
        )
        .map((requestRow) => normalizeRoleCode(requestRow?.service_role_code))
        .filter((roleCode) => isServiceRoleCode(roleCode))
    )
  );

  if (pendingServiceRoleCodes.length > 0) {
    const serviceRecipientEmails = new Set();

    for (const roleCode of pendingServiceRoleCodes) {
      const roleEmails = await resolveRoleRecipientEmails({
        roleCode,
        campusScope:
          approvalRequest?.campus_hosted_at || context.record?.campus_hosted_at || null,
      });

      roleEmails.forEach((email) => serviceRecipientEmails.add(email));
    }

    if (serviceRecipientEmails.size > 0) {
      const serviceLabel = pendingServiceRoleCodes
        .map((roleCode) => getApprovalRoleLabel(roleCode))
        .join(", ");

      await sendUserNotifications({
        userEmails: Array.from(serviceRecipientEmails),
        title: `${context.entityLabel} moved to logistics`,
        message: `${context.title} has moved to logistics review (${serviceLabel}). Please action it from your queue.`,
        type: "info",
        event_id: context.notificationEntityId,
        event_title: context.title,
        action_url: "/manage",
      });
    }
  }

  if (context.organizerEmail) {
    await sendUserNotifications({
      userEmails: [context.organizerEmail],
      title: `${context.entityLabel} moved to logistics`,
      message: `${context.title} has cleared finance approvals and moved to logistics processing.`,
      type: "success",
      event_id: context.notificationEntityId,
      event_title: context.title,
      action_url: context.actionUrl,
    });
  }
};

const resolveApprovalNotificationContext = async (approvalRequest) => {
  const entityType = normalizeWorkflowStatus(approvalRequest?.entity_type);
  const entityRef = String(approvalRequest?.entity_ref || "").trim();

  if (!entityType || !entityRef) {
    return null;
  }

  if (isEventEntityType(entityType)) {
    const event = await queryOne("events", {
      where: { event_id: entityRef },
      select:
        "event_id,title,organizer_email,created_by,status,is_draft,activation_state,workflow_phase,workflow_status,campus_hosted_at,approval_request_id",
    });

    if (!event) {
      return null;
    }

    const organizerEmail = pickPreferredNotificationEmail(
      approvalRequest?.requested_by_email,
      event.organizer_email,
      event.created_by
    );

    return {
      entityLabel: "Event",
      entityId: entityRef,
      title: String(event.title || "").trim() || "Event",
      organizerEmail,
      actionUrl: `/approvals/organiser/${encodeURIComponent(entityRef)}`,
      publicActionUrl: `/event/${encodeURIComponent(entityRef)}`,
      notificationEntityId: entityRef,
      record: event,
    };
  }

  if (entityType === "FEST") {
    let fest = null;

    for (const tableName of ["fests", "fest"]) {
      try {
        fest = await queryOne(tableName, {
          where: { fest_id: entityRef },
          select: "fest_id,fest_title,contact_email,created_by,status,is_draft,activation_state,workflow_status,approval_request_id",
        });

        if (fest) {
          break;
        }
      } catch (error) {
        if (isMissingRelationError(error)) {
          continue;
        }

        throw error;
      }
    }

    if (!fest) {
      return null;
    }

    const organizerEmail = pickPreferredNotificationEmail(
      approvalRequest?.requested_by_email,
      fest.contact_email,
      fest.created_by
    );

    return {
      entityLabel: "Fest",
      entityId: entityRef,
      title: String(fest.fest_title || "").trim() || "Fest",
      organizerEmail,
      actionUrl: `/approvals/fest/${encodeURIComponent(entityRef)}`,
      publicActionUrl: `/fest/${encodeURIComponent(entityRef)}`,
      notificationEntityId: entityRef,
      record: fest,
    };
  }

  return null;
};

const notifyDecisionToOrganizer = async ({
  approvalRequest,
  approvalStep,
  decision,
  comment,
  requestStatus,
}) => {
  const context = await resolveApprovalNotificationContext(approvalRequest);
  if (!context?.organizerEmail) {
    return;
  }

  const normalizedDecision = normalizeDecision(decision);
  const normalizedRequestStatus = normalizeWorkflowStatus(requestStatus, "UNDER_REVIEW");
  const roleLabel = getApprovalRoleLabel(approvalStep?.role_code);
  const revisionNote = stripRevisionPrefix(comment);
  const wasReturnedForRevision =
    normalizedDecision === "REJECTED" &&
    String(comment || "").toUpperCase().startsWith("RETURN_FOR_REVISION:");

  let title = `${context.entityLabel} update`;
  let message = `${context.title} has a new approval update.`;
  let type = "info";

  if (normalizedDecision === "APPROVED") {
    if (normalizedRequestStatus === "APPROVED") {
      const workflowPhase = normalizeWorkflowPhase(context.record?.workflow_phase, "");
      if (workflowPhase === WORKFLOW_PHASE.LOGISTICS_APPROVAL) {
        title = `${context.entityLabel} moved to logistics`;
        message = `${context.title} has cleared budget approvals and moved to logistics processing.`;
        type = "info";
      } else {
          const isEventApproval = isEventEntityType(approvalRequest?.entity_type);
          if (isEventApproval) {
            title = `${context.entityLabel} published`;
            message = `${context.title} has been fully approved and published automatically.`;
          } else {
            title = `${context.entityLabel} fully approved`;
            message = `${context.title} has been fully approved. You can now publish it.`;
          }
        type = "success";
      }
    } else {
      title = `${context.entityLabel} approved by ${roleLabel}`;
      message = `${context.title} was approved by ${roleLabel}. Remaining approvals are still in progress.`;
      type = "info";
    }
  } else if (wasReturnedForRevision) {
    title = `${context.entityLabel} returned for revision by ${roleLabel}`;
    message = revisionNote
      ? `${context.title} was returned for revision by ${roleLabel}. Note: ${revisionNote}`
      : `${context.title} was returned for revision by ${roleLabel}.`;
    type = "warning";
  } else if (normalizedDecision === "REJECTED") {
    title = `${context.entityLabel} rejected by ${roleLabel}`;
    message = revisionNote
      ? `${context.title} was rejected by ${roleLabel}. Note: ${revisionNote}`
      : `${context.title} was rejected by ${roleLabel}. Please review and resubmit.`;
    type = "error";
  }

  await sendUserNotifications({
    userEmails: [context.organizerEmail],
    title,
    message,
    type,
    event_id: context.notificationEntityId,
    event_title: context.title,
    action_url: context.actionUrl,
  });
};

const notifyPublicBroadcastOnFinalApproval = async ({
  approvalRequest,
  requestStatus,
}) => {
  const normalizedRequestStatus = normalizeWorkflowStatus(requestStatus, "UNDER_REVIEW");
  if (normalizedRequestStatus !== "APPROVED") {
    return;
  }

  const context = await resolveApprovalNotificationContext(approvalRequest);
  if (!context?.notificationEntityId || !context?.record) {
    return;
  }

  const shouldBroadcast = shouldSendFinalApprovalBroadcast({
    record: context.record,
    defaultSendNotifications: true,
    requireLiveRecord: true,
  });

  if (!shouldBroadcast) {
    return;
  }

  await sendBroadcastNotification({
    title: `${context.entityLabel} Approved`,
    message: `${context.title} has been approved.`,
    type: "info",
    event_id: context.notificationEntityId,
    event_title: context.title,
    action_url: context.publicActionUrl || context.actionUrl,
  });
};

const notifyServiceDecisionToRequester = async ({
  serviceRequest,
  decision,
  comment,
  decidedByEmail,
}) => {
  const requesterEmail = pickPreferredNotificationEmail(serviceRequest?.requested_by_email);
  if (!requesterEmail) {
    return;
  }

  const eventId = String(serviceRequest?.event_id || "").trim() || null;
  let eventTitle = String(serviceRequest?.event_title || "").trim();

  if (!eventTitle && eventId) {
    try {
      const event = await queryOne("events", {
        where: { event_id: eventId },
        select: "title",
      });
      eventTitle = String(event?.title || "").trim();
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }
  }

  const normalizedDecision = normalizeDecision(decision);
  const actorEmail = normalizeEmail(decidedByEmail) || "Approver";
  const revisionNote = stripRevisionPrefix(comment);
  const wasReturnedForRevision =
    normalizedDecision === "REJECTED" &&
    String(comment || "").toUpperCase().startsWith("RETURN_FOR_REVISION:");

  let title = "Service request update";
  let message = `A service approval decision was recorded by ${actorEmail}.`;
  let type = "info";

  if (normalizedDecision === "APPROVED") {
    title = "Service request approved";
    message = `${eventTitle || "Your event"} passed the current service approval step.`;
    type = "success";
  } else if (wasReturnedForRevision) {
    title = "Service request returned for revision";
    message = revisionNote
      ? `${eventTitle || "Your event"} was returned for revision. Note: ${revisionNote}`
      : `${eventTitle || "Your event"} was returned for revision.`;
    type = "warning";
  } else if (normalizedDecision === "REJECTED") {
    title = "Service request rejected";
    message = revisionNote
      ? `${eventTitle || "Your event"} service approval was rejected. Note: ${revisionNote}`
      : `${eventTitle || "Your event"} service approval was rejected.`;
    type = "error";
  }

  await sendUserNotifications({
    userEmails: [requesterEmail],
    title,
    message,
    type,
    event_id: eventId,
    event_title: eventTitle || null,
    action_url: "/manage",
  });
};

router.use(authenticateUser, getUserInfo(), checkRoleExpiration);

router.get("/me/roles", async (req, res) => {
  const roleCodes = getUserRoleCodes(req);

  return res.status(200).json({
    user: {
      email: req.userInfo?.email || null,
      is_masteradmin: Boolean(req.userInfo?.is_masteradmin),
      is_organiser: Boolean(req.userInfo?.is_organiser),
    },
    role_codes: roleCodes,
    role_assignments: Array.isArray(req.userInfo?.role_assignments) ? req.userInfo.role_assignments : [],
  });
});

router.get("/requests/by-event/:eventId", async (req, res) => {
  try {
    const eventId = String(req.params.eventId || "").trim();
    if (!eventId) {
      return res.status(400).json({ error: "Missing eventId" });
    }

    const payload = await getApprovalRequestForEvent(eventId);
    if (!payload?.approvalRequest) {
      return res.status(404).json({ error: "Approval request not found for event" });
    }

    const hasAccess = await canReadApprovalRequest(req, payload.approvalRequest, []);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied: approval request visibility not permitted" });
    }

    return res.status(200).json({ approval_request: payload.approvalRequest });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Approval workflow schema is not available yet. Run latest migrations first.",
      });
    }

    console.error("Error fetching approval request for event:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/requests/timeline", async (req, res) => {
  try {
    const rawRequestIds =
      String(req.query.requestIds || req.query.request_ids || "").trim();

    const requestIds = Array.from(
      new Set(
        rawRequestIds
          .split(",")
          .map((value) => String(value || "").trim())
          .filter((value) => UUID_REGEX.test(value))
      )
    );

    if (requestIds.length === 0) {
      return res.status(400).json({
        error: "Provide at least one UUID request id via requestIds query param.",
      });
    }

    if (requestIds.length > 30) {
      return res.status(400).json({ error: "Maximum 30 request ids are allowed per call." });
    }

    const requests = [];
    const missingRequestIds = [];

    for (const requestId of requestIds) {
      let approvalRequest;
      try {
        approvalRequest = await queryOne("approval_requests", {
          where: { id: requestId },
          select:
            "id,request_id,entity_type,entity_ref,parent_fest_ref,requested_by_user_id,requested_by_email,organizing_dept_id,organizing_school,campus_hosted_at,is_budget_related,status,submitted_at,decided_at,latest_comment,created_at,updated_at",
        });
      } catch (error) {
        if (!isMissingColumnError(error, "organizing_school")) {
          throw error;
        }

        approvalRequest = await queryOne("approval_requests", {
          where: { id: requestId },
          select:
            "id,request_id,entity_type,entity_ref,parent_fest_ref,requested_by_user_id,requested_by_email,organizing_dept_id,campus_hosted_at,is_budget_related,status,submitted_at,decided_at,latest_comment,created_at,updated_at",
        });
      }

      if (!approvalRequest) {
        missingRequestIds.push(requestId);
        continue;
      }

      const steps = await queryAll("approval_steps", {
        where: { approval_request_id: approvalRequest.id },
        select:
          "id,approval_request_id,step_code,role_code,step_group,sequence_order,required_count,status,decided_at,created_at,updated_at",
        order: { column: "sequence_order", ascending: true },
      });

      const hasAccess = await canReadApprovalRequest(req, approvalRequest, steps);
      if (!hasAccess) {
        continue;
      }

      const decisions = await queryAll("approval_decisions", {
        where: { approval_request_id: approvalRequest.id },
        select:
          "id,approval_step_id,decided_by_user_id,decided_by_email,role_code,decision,comment,created_at",
        order: { column: "created_at", ascending: false },
      });

      const latestDecisionByStepId = new Map();
      for (const decision of decisions || []) {
        const stepId = String(decision?.approval_step_id || "").trim();
        if (!stepId || latestDecisionByStepId.has(stepId)) {
          continue;
        }

        latestDecisionByStepId.set(stepId, decision);
      }

      const mappedSteps = (steps || []).map((step) => {
        const latestDecision = latestDecisionByStepId.get(step.id) || null;
        return {
          ...step,
          latest_decision: latestDecision,
        };
      });

      requests.push({
        ...approvalRequest,
        steps: mappedSteps,
      });
    }

    return res.status(200).json({
      requests,
      missing_request_ids: missingRequestIds,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Approval workflow schema is not available yet. Run latest migrations first.",
      });
    }

    console.error("Error loading approval timeline requests:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/queues/:roleCode", async (req, res) => {
  try {
    const roleCode = normalizeRoleCode(req.params.roleCode);

    if (!(await ensureQueueAccess(req, res, roleCode))) {
      return;
    }

    const hodDepartmentScope =
      roleCode === ROLE_CODES.HOD ? await resolveHodDepartmentScope(req) : null;
    const deanSchoolScope =
      roleCode === ROLE_CODES.DEAN ? await resolveDeanSchoolScope(req) : null;

    const queueSteps = await queryAll("approval_steps", {
      where: { role_code: roleCode, status: "PENDING" },
      order: { column: "created_at", ascending: true },
    });

    const activeSequenceByRequestId = new Map();
    const items = [];
    for (const step of queueSteps || []) {
      const approvalRequestId = String(step?.approval_request_id || "").trim();
      if (!approvalRequestId) {
        continue;
      }

      const activeSequence = await getActivePendingSequenceForRequest(
        approvalRequestId,
        activeSequenceByRequestId
      );

      const stepSequence = Number(step?.sequence_order || 0);
      if (Number.isFinite(activeSequence) && activeSequence > 0 && stepSequence !== activeSequence) {
        continue;
      }

      if (roleCode === ROLE_CODES.DEAN) {
        const normalizedStepCode = normalizeWorkflowStatus(step?.step_code);
        if (normalizedStepCode && !["DEAN", "L2_DEAN"].includes(normalizedStepCode)) {
          continue;
        }
      }

      const approvalRequest = await queryOne("approval_requests", {
        where: { id: step.approval_request_id },
      });

      if (!approvalRequest) {
        continue;
      }

      if (
        hodDepartmentScope &&
        hodDepartmentScope.size > 0 &&
        !(await canHodAccessApprovalRequest(req, approvalRequest))
      ) {
        continue;
      }

      if (
        deanSchoolScope &&
        deanSchoolScope.size > 0 &&
        !(await canDeanAccessApprovalRequest(req, approvalRequest))
      ) {
        continue;
      }

      items.push({
        request_id: approvalRequest.request_id,
        status: approvalRequest.status,
        entity_type: approvalRequest.entity_type,
        entity_ref: approvalRequest.entity_ref,
        organizing_dept_id: approvalRequest.organizing_dept_id,
        organizing_school: approvalRequest.organizing_school,
        campus_hosted_at: approvalRequest.campus_hosted_at,
        step_code: step.step_code,
        step_group: step.step_group,
        sequence_order: step.sequence_order,
        created_at: step.created_at,
      });
    }

    return res.status(200).json({
      role_code: roleCode,
      pending_count: items.length,
      items,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Approval workflow schema is not available yet. Run latest migrations first.",
      });
    }

    console.error("Error loading approval queue:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-queues/:roleCode", async (req, res) => {
  try {
    const roleCode = normalizeRoleCode(req.params.roleCode);

    if (!isServiceRoleCode(roleCode)) {
      return res.status(400).json({ error: "Invalid service role code" });
    }

    if (!(await ensureQueueAccess(req, res, roleCode))) {
      return;
    }

    const serviceQueue = await queryAll("service_requests", {
      where: { service_role_code: roleCode, status: "PENDING" },
      order: { column: "created_at", ascending: true },
    });

    const eventLogisticsPhaseCache = new Map();
    const logisticsItems = [];

    for (const requestRow of serviceQueue || []) {
      const eventId = String(requestRow?.event_id || "").trim();
      if (!eventId) {
        continue;
      }

      if (!eventLogisticsPhaseCache.has(eventId)) {
        let eventRecord = null;

        try {
          eventRecord = await queryOne("events", {
            where: { event_id: eventId },
            select:
              "event_id,workflow_phase,workflow_status,approval_state,service_approval_state",
          });
        } catch (error) {
          if (isMissingColumnError(error, "workflow_phase")) {
            eventRecord = await queryOne("events", {
              where: { event_id: eventId },
              select: "event_id,workflow_status,approval_state,service_approval_state",
            });
          } else {
            throw error;
          }
        }

        eventLogisticsPhaseCache.set(
          eventId,
          eventRecord ? isEventInLogisticsPhase(eventRecord) : false
        );
      }

      if (!eventLogisticsPhaseCache.get(eventId)) {
        continue;
      }

      let approvalRequest = null;
      if (requestRow?.approval_request_id) {
        approvalRequest = await queryOne("approval_requests", {
          where: { id: requestRow.approval_request_id },
          select: "entity_type,entity_ref,organizing_dept_id,organizing_school",
        }).catch((error) => {
          if (isMissingRelationError(error)) {
            return null;
          }

          throw error;
        });
      }

      let eventRecord = null;
      try {
        eventRecord = await queryOne("events", {
          where: { event_id: eventId },
          select: "event_id,title,event_date,organizing_dept_id,organizing_school,campus_hosted_at",
        });
      } catch (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
      }

      logisticsItems.push({
        id: requestRow.id,
        service_request_id: requestRow.service_request_id,
        service_role_code: requestRow.service_role_code,
        status: requestRow.status,
        approval_request_id: requestRow.approval_request_id,
        event_id: eventId,
        entity_type: normalizeWorkflowStatus(approvalRequest?.entity_type) === "FEST"
          ? "fest"
          : "event",
        entity_id: String(approvalRequest?.entity_ref || eventId).trim(),
        organizing_dept_id:
          approvalRequest?.organizing_dept_id || eventRecord?.organizing_dept_id || null,
        organizing_school:
          approvalRequest?.organizing_school || eventRecord?.organizing_school || null,
        campus_hosted_at: eventRecord?.campus_hosted_at || null,
        event_title: eventRecord?.title || null,
        event_date: eventRecord?.event_date || null,
        requested_by_email: requestRow.requested_by_email || null,
        details: requestRow.details || {},
        created_at: requestRow.created_at,
        updated_at: requestRow.updated_at,
      });
    }

    return res.status(200).json({
      role_code: roleCode,
      pending_count: logisticsItems.length,
      items: logisticsItems,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Service workflow schema is not available yet. Run latest migrations first.",
      });
    }

    console.error("Error loading service queue:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/requests/:requestId/steps/:stepCode/decision", async (req, res) => {
  try {
    const { requestId, stepCode } = req.params;
    const decision = normalizeDecision(req.body?.decision);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
    }

    let approvalRequest = await queryOne("approval_requests", {
      where: { request_id: requestId },
    });

    if (!approvalRequest) {
      approvalRequest = await queryOne("approval_requests", {
        where: { id: requestId },
      });
    }

    if (!approvalRequest) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const normalizedStepCode = normalizeWorkflowStatus(stepCode);
    const pendingStepsForRequest = await queryAll("approval_steps", {
      where: {
        approval_request_id: approvalRequest.id,
        status: "PENDING",
      },
      order: { column: "sequence_order", ascending: true },
    });

    let approvalStep = (pendingStepsForRequest || []).find(
      (stepRow) =>
        normalizeWorkflowStatus(stepRow?.step_code) === normalizedStepCode
    ) || null;

    if (!approvalStep) {
      approvalStep = await queryOne("approval_steps", {
        where: {
          approval_request_id: approvalRequest.id,
          step_code: stepCode,
        },
      });
    }

    if (!approvalStep) {
      const normalizedRequestedRoleCode = normalizeRoleCode(stepCode);

      if (normalizedRequestedRoleCode) {
        approvalStep = (pendingStepsForRequest || []).find(
          (stepRow) =>
            normalizeRoleCode(stepRow?.role_code || stepRow?.step_code) ===
            normalizedRequestedRoleCode
        ) || null;
      }
    }

    if (!approvalStep) {
      return res.status(404).json({ error: "Approval step not found" });
    }

    const stepStatus = String(approvalStep.status || "").toUpperCase();
    if (stepStatus !== "PENDING") {
      return res.status(409).json({
        error: "Approval step is not pending",
        current_status: approvalStep.status,
      });
    }

    const activePendingStep = await getActivePendingStepForRequest(approvalRequest.id);
    if (!activePendingStep || String(activePendingStep.id || "") !== String(approvalStep.id || "")) {
      return res.status(409).json({
        error: "Only the current active approval step can be decided.",
      });
    }

    const stepRoleCode = normalizeRoleCode(
      approvalStep.role_code || approvalStep.step_code
    );

    if (!(await ensureQueueAccess(req, res, stepRoleCode, approvalRequest))) {
      return;
    }

    const nowIso = new Date().toISOString();

    approvalRequest = await persistApprovalRequestScopeForRouting(approvalRequest);

    const updatedStepRows = await update(
      "approval_steps",
      {
        status: decision,
        decided_at: nowIso,
        updated_at: nowIso,
      },
      { id: approvalStep.id }
    );

    if (!Array.isArray(updatedStepRows) || updatedStepRows.length === 0) {
      throw new Error("Failed to persist approval step decision.");
    }

    const insertedDecisionRows = await insert("approval_decisions", [{
      approval_request_id: approvalRequest.id,
      approval_step_id: approvalStep.id,
      decided_by_user_id: req.userInfo?.id || null,
      decided_by_email: req.userInfo?.email || null,
      role_code: stepRoleCode,
      decision,
      comment,
    }]);

    if (!Array.isArray(insertedDecisionRows) || insertedDecisionRows.length === 0) {
      throw new Error("Failed to persist approval decision record.");
    }

    if (decision === "APPROVED") {
      await ensureDeanStepAfterHodTransition({
        approvalRequest,
        approvalStep,
        nowIso,
      });

      await ensureFinanceStepsAfterDeanTransition({
        approvalRequest,
        approvalStep,
        nowIso,
      });

      await ensureAccountsStepAfterCfoTransition({
        approvalRequest,
        approvalStep,
        nowIso,
      });

      const waitingSteps = await queryAll("approval_steps", {
        where: {
          approval_request_id: approvalRequest.id,
          status: "WAITING",
        },
        order: { column: "sequence_order", ascending: true },
        limit: 1,
      });

      const nextWaitingStep = (waitingSteps || [])[0] || null;
      if (nextWaitingStep?.id) {
        await update(
          "approval_steps",
          { status: "PENDING", updated_at: nowIso },
          { id: nextWaitingStep.id }
        );
      }
    }

    if (decision === "REJECTED") {
      await update(
        "approval_steps",
        { status: "SKIPPED", updated_at: nowIso },
        { approval_request_id: approvalRequest.id, status: "PENDING" }
      );

      await update(
        "approval_steps",
        { status: "SKIPPED", updated_at: nowIso },
        { approval_request_id: approvalRequest.id, status: "WAITING" }
      );
    }

    const requestStatus = await recomputeApprovalRequestStatus(approvalRequest.id);
    await syncApprovalOutcomeToEntity({
      approvalRequest,
      requestStatus,
      decidedByEmail: req.userInfo?.email || null,
      comment,
    });

    const nextPendingStep =
      decision === "APPROVED" && requestStatus === "UNDER_REVIEW"
        ? await getActivePendingStepForRequest(approvalRequest.id)
        : null;

    if (nextPendingStep) {
      notifyNextApprovalStageRole({
        approvalRequest,
        currentApprovalStep: approvalStep,
        nextPendingStep,
        actorEmail: req.userInfo?.email || null,
      }).catch((notificationError) => {
        console.error(
          "[ApprovalNotify] Failed to dispatch next-stage role notification:",
          notificationError
        );
      });
    }

    if (decision === "APPROVED") {
      notifyLogisticsAndStudentOrganiserHandoff({
        approvalRequest,
      }).catch((notificationError) => {
        console.error(
          "[ApprovalNotify] Failed to dispatch logistics/student organiser handoff notifications:",
          notificationError
        );
      });
    }

    notifyDecisionToOrganizer({
      approvalRequest,
      approvalStep,
      decision,
      comment,
      requestStatus,
    }).catch((notificationError) => {
      console.error(
        "[ApprovalNotify] Failed to dispatch organizer decision notification:",
        notificationError
      );
    });

    notifyPublicBroadcastOnFinalApproval({
      approvalRequest,
      requestStatus,
    }).catch((broadcastError) => {
      console.error(
        "[ApprovalBroadcast] Failed to dispatch public final-approval broadcast:",
        broadcastError
      );
    });

    return res.status(200).json({
      message: "Decision recorded",
      request_id: requestId,
      step_code: stepCode,
      decision,
      request_status: requestStatus,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Approval workflow schema is not available yet. Run latest migrations first.",
      });
    }

    if (String(error?.code || "") === "23505") {
      return res.status(409).json({ error: "Decision already recorded by this user for this step" });
    }

    console.error("Error recording approval decision:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/service-requests/:serviceRequestId/decision", async (req, res) => {
  try {

    const { serviceRequestId } = req.params;
    const decision = normalizeDecision(req.body?.decision);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
    }

    let serviceRequest = await queryOne("service_requests", {
      where: { service_request_id: serviceRequestId },
    });

    if (!serviceRequest) {
      serviceRequest = await queryOne("service_requests", {
        where: { id: serviceRequestId },
      });
    }

    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const currentStatus = String(serviceRequest.status || "").toUpperCase();
    if (currentStatus !== "PENDING") {
      return res.status(409).json({
        error: "Service request is not pending",
        current_status: serviceRequest.status,
      });
    }

    const serviceEventId = String(serviceRequest.event_id || "").trim();
    if (serviceEventId) {
      let parentEvent = null;

      try {
        parentEvent = await queryOne("events", {
          where: { event_id: serviceEventId },
          select:
            "event_id,workflow_phase,workflow_status,approval_state,service_approval_state",
        });
      } catch (error) {
        if (isMissingColumnError(error, "workflow_phase")) {
          parentEvent = await queryOne("events", {
            where: { event_id: serviceEventId },
            select: "event_id,workflow_status,approval_state,service_approval_state",
          });
        } else {
          throw error;
        }
      }

      if (parentEvent && !isEventInLogisticsPhase(parentEvent)) {
        return res.status(409).json({
          error: "Service decisions are enabled only during logistics approval phase.",
        });
      }
    }

    const serviceRoleCode = normalizeRoleCode(serviceRequest.service_role_code);

    if (!isServiceRoleCode(serviceRoleCode)) {
      return res.status(400).json({ error: "Invalid service role on request" });
    }

    let approvalRequest = null;
    if (serviceRequest.approval_request_id) {
      approvalRequest = await queryOne("approval_requests", {
        where: { id: serviceRequest.approval_request_id },
      });
    }

    if (!(await ensureQueueAccess(req, res, serviceRoleCode, approvalRequest))) {
      return;
    }

    const nowIso = new Date().toISOString();

    await update(
      "service_requests",
      {
        status: decision,
        decided_at: nowIso,
        updated_at: nowIso,
      },
      { id: serviceRequest.id }
    );

    await insert("service_decisions", [{
      service_request_id: serviceRequest.id,
      decided_by_user_id: req.userInfo?.id || null,
      decided_by_email: req.userInfo?.email || null,
      role_code: serviceRoleCode,
      decision,
      comment,
    }]);

    await syncServiceOutcomeToEvent({
      serviceRequest,
      decidedByEmail: req.userInfo?.email || null,
      comment,
    });

    notifyServiceDecisionToRequester({
      serviceRequest,
      decision,
      comment,
      decidedByEmail: req.userInfo?.email || null,
    }).catch((notificationError) => {
      console.error(
        "[ServiceApprovalNotify] Failed to dispatch requester decision notification:",
        notificationError
      );
    });

    return res.status(200).json({
      message: "Service decision recorded",
      service_request_id: serviceRequestId,
      role_code: serviceRoleCode,
      decision,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Service workflow schema is not available yet. Run latest migrations first.",
      });
    }

    if (String(error?.code || "") === "23505") {
      return res.status(409).json({ error: "Decision already recorded by this user for this service request" });
    }

    console.error("Error recording service decision:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
