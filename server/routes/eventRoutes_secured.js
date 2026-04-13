import express from "express";
import {
  queryAll,
  queryOne,
  insert,
  update,
  remove,
} from "../config/database.js";
import { multerUpload } from "../utils/multerConfig.js";
import { uploadFileToSupabase, getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { parseOptionalFloat, parseOptionalInt, parseJsonField } from "../utils/parsers.js";
import { v4 as uuidv4 } from "uuid";
import { 
  authenticateUser, 
  getUserInfo, 
  checkRoleExpiration,
  requireOrganiser, 
  requireOwnership, 
  optionalAuth 
} from "../middleware/authMiddleware.js";
import { sendBroadcastNotification } from "./notificationRoutes.js";
import { pushEventToGated, shouldPushEventToGated, isGatedEnabled } from "../utils/gatedSync.js";
import { ROLE_CODES, hasAnyRoleCode } from "../utils/roleAccessService.js";
import {
  LIFECYCLE_STATUS,
  deriveLifecycleStatus,
  normalizeLifecycleStatus,
  shouldEntityRemainDraft,
} from "../utils/lifecycleStatus.js";

const router = express.Router();
const debugRoutesEnabled = process.env.NODE_ENV !== "production";
const MANUAL_UNARCHIVE_OVERRIDE = "system:manual_unarchive_override";

const getRoleCodes = (userInfo) => (Array.isArray(userInfo?.role_codes) ? userInfo.role_codes : []);

const isMasterAdminUser = (userInfo) => {
  return Boolean(userInfo?.is_masteradmin) || hasAnyRoleCode(getRoleCodes(userInfo), [ROLE_CODES.MASTER_ADMIN]);
};

const isOrganizerTeacherUser = (userInfo) => {
  return Boolean(userInfo?.is_organiser) || hasAnyRoleCode(getRoleCodes(userInfo), [ROLE_CODES.ORGANIZER_TEACHER]);
};

const isOrganizerStudentOnlyUser = (userInfo) => {
  const hasStudentRole = hasAnyRoleCode(getRoleCodes(userInfo), [ROLE_CODES.ORGANIZER_STUDENT]);
  return hasStudentRole && !isOrganizerTeacherUser(userInfo) && !isMasterAdminUser(userInfo);
};

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
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  const normalizedColumn = String(columnName || "").toLowerCase();

  if (!normalizedColumn) return false;

  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes(`column \"${normalizedColumn}\"`) ||
    message.includes(`${normalizedColumn} does not exist`) ||
    (message.includes("could not find") && message.includes(normalizedColumn)) ||
    details.includes(normalizedColumn) ||
    hint.includes(normalizedColumn)
  );
};

const isMissingAdditionalRequestsColumnError = (error) =>
  isMissingColumnError(error, "additional_requests");

const queryFestById = async (festId) => {
  if (!festId) {
    return null;
  }

  try {
    const festRow = await queryOne("fests", { where: { fest_id: festId } });
    if (festRow) {
      return festRow;
    }
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
  }

  try {
    return await queryOne("fest", { where: { fest_id: festId } });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw error;
  }
};

const isFestApprovedForChildEvent = (festRecord) => {
  if (!festRecord) {
    return false;
  }

  if (asBoolean(festRecord.is_archived)) {
    return false;
  }

  const lifecycleStatus = normalizeLifecycleStatus(
    festRecord.status,
    asBoolean(festRecord.is_draft)
      ? LIFECYCLE_STATUS.DRAFT
      : LIFECYCLE_STATUS.PUBLISHED
  );

  if (
    lifecycleStatus === LIFECYCLE_STATUS.PUBLISHED ||
    lifecycleStatus === LIFECYCLE_STATUS.APPROVED
  ) {
    return true;
  }

  if (
    lifecycleStatus === LIFECYCLE_STATUS.DRAFT ||
    lifecycleStatus === LIFECYCLE_STATUS.PENDING_APPROVALS ||
    lifecycleStatus === LIFECYCLE_STATUS.REVISION_REQUESTED
  ) {
    return false;
  }

  const approvalState = String(festRecord.approval_state || "").trim().toUpperCase();
  if (approvalState) {
    return approvalState === "APPROVED";
  }

  if (typeof festRecord.status === "string") {
    const status = festRecord.status.trim().toLowerCase();
    if (status === "rejected" || status === "cancelled" || status === "draft") {
      return false;
    }
  }

  return true;
};

const createTeacherApprovalRequestForChildEvent = async ({ eventRecord, userInfo }) => {
  try {
    const requestId = `APR-${eventRecord.event_id}-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const isBudgetRelated = Number(eventRecord.registration_fee || 0) > 0;

    const insertedRequest = await insert("approval_requests", [
      {
        request_id: requestId,
        entity_type: "FEST_CHILD_EVENT",
        entity_ref: eventRecord.event_id,
        parent_fest_ref: eventRecord.fest_id,
        requested_by_user_id: userInfo?.id || null,
        requested_by_email: userInfo?.email || null,
        organizing_dept: eventRecord.organizing_dept || null,
        campus_hosted_at: eventRecord.campus_hosted_at || null,
        is_budget_related: isBudgetRelated,
        status: "UNDER_REVIEW",
        submitted_at: nowIso,
      },
    ]);

    const approvalRequest = insertedRequest?.[0];
    if (!approvalRequest) {
      return null;
    }

    await insert("approval_steps", [
      {
        approval_request_id: approvalRequest.id,
        step_code: "ORGANIZER_TEACHER",
        role_code: ROLE_CODES.ORGANIZER_TEACHER,
        step_group: 1,
        sequence_order: 1,
        required_count: 1,
        status: "PENDING",
      },
    ]);

    return approvalRequest;
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("[EventCreate] Approval tables are not available yet; skipping teacher approval request creation.");
      return null;
    }

    throw error;
  }
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

  if (normalizedServiceState === "PENDING") {
    return "PENDING";
  }

  return "ACTIVE";
};

const normalizeEventLifecycleStatus = (eventRecord, fallback) => {
  const defaultStatus = fallback ||
    (asBoolean(eventRecord?.is_draft)
      ? LIFECYCLE_STATUS.DRAFT
      : LIFECYCLE_STATUS.PUBLISHED);

  return normalizeLifecycleStatus(eventRecord?.status, defaultStatus);
};

const isBudgetRelatedFromEventPayload = ({
  claimsApplicable,
  registrationFee,
  noFinancialRequirements,
}) => {
  if (Boolean(noFinancialRequirements)) {
    return false;
  }

  const parsedFee = Number(registrationFee || 0);
  return Boolean(claimsApplicable) || (Number.isFinite(parsedFee) && parsedFee > 0);
};

const parseCustomFieldsForNoFinancialRequirements = (customFieldsValue) => {
  const parsed = parseJsonField(customFieldsValue, []);
  return Array.isArray(parsed) ? parsed : [];
};

const hasNoFinancialRequirementsInCustomFields = (customFieldsValue) => {
  const customFields = parseCustomFieldsForNoFinancialRequirements(customFieldsValue);

  return customFields.some((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      return false;
    }

    const normalizedKey = String(field.key || field.label || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");

    if (!normalizedKey.includes("financial")) {
      return false;
    }

    const rawValue = field.value;

    if (isNoFinancialRequirementsRequested(rawValue)) {
      return true;
    }

    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      return (
        isNoFinancialRequirementsRequested(rawValue.noFinancialRequirements) ||
        isNoFinancialRequirementsRequested(rawValue.no_financial_requirements) ||
        isNoFinancialRequirementsRequested(rawValue.enabled)
      );
    }

    return false;
  });
};

const eventHasNoFinancialRequirements = (eventRecord = {}) => {
  return (
    isNoFinancialRequirementsRequested(eventRecord?.no_financial_requirements) ||
    isNoFinancialRequirementsRequested(eventRecord?.noFinancialRequirements) ||
    hasNoFinancialRequirementsInCustomFields(eventRecord?.custom_fields)
  );
};

const findActiveApprovalRequestForEntity = async ({ entityType, entityRef }) => {
  const normalizedEntityType = normalizeWorkflowStatus(entityType);
  const normalizedEntityRef = String(entityRef || "").trim();

  if (!normalizedEntityType || !normalizedEntityRef) {
    return null;
  }

  try {
    const rows = await queryAll("approval_requests", {
      where: {
        entity_type: normalizedEntityType,
        entity_ref: normalizedEntityRef,
      },
      order: { column: "created_at", ascending: false },
    });

    return (
      (rows || []).find((row) => {
        const status = normalizeWorkflowStatus(row?.status);
        return status === "UNDER_REVIEW" || status === "DRAFT" || status === "PENDING";
      }) || null
    );
  } catch (error) {
    const missingWorkflowColumns =
      isMissingColumnError(error, "entity_type") ||
      isMissingColumnError(error, "entity_ref") ||
      isMissingColumnError(error, "status");

    if (isMissingRelationError(error) || missingWorkflowColumns) {
      return null;
    }

    throw error;
  }
};

const createApprovalRequestWithSteps = async ({
  entityType,
  entityRef,
  parentFestRef = null,
  userInfo,
  organizingDept = null,
  campusHostedAt = null,
  isBudgetRelated = false,
  steps = [],
}) => {
  const normalizedEntityType = normalizeWorkflowStatus(entityType);
  const normalizedEntityRef = String(entityRef || "").trim();

  if (!normalizedEntityType || !normalizedEntityRef) {
    return null;
  }

  const existingRequest = await findActiveApprovalRequestForEntity({
    entityType: normalizedEntityType,
    entityRef: normalizedEntityRef,
  });

  if (existingRequest) {
    return existingRequest;
  }

  try {
    const nowIso = new Date().toISOString();
    const insertedRequest = await insert("approval_requests", [
      {
        request_id: `APR-${normalizedEntityType}-${normalizedEntityRef}-${Date.now()}`,
        entity_type: normalizedEntityType,
        entity_ref: normalizedEntityRef,
        parent_fest_ref: parentFestRef,
        requested_by_user_id: userInfo?.id || null,
        requested_by_email: userInfo?.email || null,
        organizing_dept: organizingDept,
        campus_hosted_at: campusHostedAt,
        is_budget_related: Boolean(isBudgetRelated),
        status: "UNDER_REVIEW",
        submitted_at: nowIso,
      },
    ]);

    const approvalRequest = insertedRequest?.[0];
    if (!approvalRequest) {
      return null;
    }

    if (Array.isArray(steps) && steps.length > 0) {
      await insert(
        "approval_steps",
        steps.map((step, index) => ({
          approval_request_id: approvalRequest.id,
          step_code: String(step?.stepCode || `STEP_${index + 1}`)
            .trim()
            .toUpperCase(),
          role_code: normalizeWorkflowStatus(step?.roleCode),
          step_group: Number(step?.stepGroup || index + 1),
          sequence_order: Number(step?.sequenceOrder || index + 1),
          required_count: Number(step?.requiredCount || 1),
          status: "PENDING",
        }))
      );
    }

    return approvalRequest;
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("[EventCreate] Approval workflow tables are not available yet; skipping approval request creation.");
      return null;
    }

    if (String(error?.code || "") === "23505") {
      return findActiveApprovalRequestForEntity({
        entityType: normalizedEntityType,
        entityRef: normalizedEntityRef,
      });
    }

    throw error;
  }
};

const createStandaloneApprovalRequestForEvent = async ({
  eventRecord,
  userInfo,
  isBudgetRelated,
}) => {
  const eventId = String(eventRecord?.event_id || "").trim();
  if (!eventId) {
    return null;
  }
  const approvalSteps = [
    {
      stepCode: "HOD",
      roleCode: ROLE_CODES.HOD,
      stepGroup: 1,
      sequenceOrder: 1,
      requiredCount: 1,
    },
    {
      stepCode: "DEAN",
      roleCode: ROLE_CODES.DEAN,
      stepGroup: 2,
      sequenceOrder: 2,
      requiredCount: 1,
    },
  ];

  if (Boolean(isBudgetRelated)) {
    approvalSteps.push({
      stepCode: "CFO",
      roleCode: ROLE_CODES.CFO,
      stepGroup: 3,
      sequenceOrder: 3,
      requiredCount: 1,
    });
  }

  const approvalRequest = await createApprovalRequestWithSteps({
    entityType: "STANDALONE_EVENT",
    entityRef: eventId,
    parentFestRef: null,
    userInfo,
    organizingDept: eventRecord?.organizing_dept || null,
    campusHostedAt: eventRecord?.campus_hosted_at || null,
    isBudgetRelated: Boolean(isBudgetRelated),
    steps: approvalSteps,
  });

  return approvalRequest;
};

const applyEventWorkflowState = async ({
  eventId,
  approvalState,
  serviceApprovalState,
  approvalRequestId,
  isBudgetRelated,
  lifecycleStatus,
}) => {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) {
    return {
      applied: false,
      activationState: "ACTIVE",
      normalizedApprovalState: "APPROVED",
      normalizedServiceState: "APPROVED",
      normalizedLifecycleStatus: LIFECYCLE_STATUS.DRAFT,
    };
  }

  const normalizedApprovalState = normalizeWorkflowStatus(approvalState, "APPROVED");
  const normalizedServiceState = normalizeWorkflowStatus(serviceApprovalState, "APPROVED");
  const activationState = resolveActivationState(
    normalizedApprovalState,
    normalizedServiceState
  );
  const normalizedLifecycleStatus = normalizeLifecycleStatus(
    lifecycleStatus,
    deriveLifecycleStatus({
      currentStatus: LIFECYCLE_STATUS.DRAFT,
      approvalState: normalizedApprovalState,
      serviceApprovalState: normalizedServiceState,
      isDraft: true,
    })
  );

  const workflowPayload = {
    approval_state: normalizedApprovalState,
    service_approval_state: normalizedServiceState,
    activation_state: activationState,
    status: normalizedLifecycleStatus,
    is_draft: shouldEntityRemainDraft(normalizedLifecycleStatus),
    updated_at: new Date().toISOString(),
  };

  if (approvalRequestId !== undefined) {
    workflowPayload.approval_request_id = approvalRequestId;
  }

  if (isBudgetRelated !== undefined) {
    workflowPayload.is_budget_related = Boolean(isBudgetRelated);
  }

  try {
    await update("events", workflowPayload, { event_id: normalizedEventId });
    return {
      applied: true,
      activationState,
      normalizedApprovalState,
      normalizedServiceState,
      normalizedLifecycleStatus,
    };
  } catch (error) {
    const missingWorkflowColumns =
      isMissingColumnError(error, "approval_state") ||
      isMissingColumnError(error, "service_approval_state") ||
      isMissingColumnError(error, "activation_state") ||
      isMissingColumnError(error, "approval_request_id") ||
      isMissingColumnError(error, "is_budget_related") ||
      isMissingColumnError(error, "status");

    if (missingWorkflowColumns) {
      console.warn("[EventWorkflow] Workflow state columns missing; skipping workflow-state persistence.");
      return {
        applied: false,
        activationState,
        normalizedApprovalState,
        normalizedServiceState,
        normalizedLifecycleStatus,
      };
    }

    throw error;
  }
};

const collectRequestedServiceRoleCodes = (additionalRequests = {}) => {
  const requestedRoleCodes = [];

  if (asBoolean(additionalRequests?.it?.enabled)) {
    requestedRoleCodes.push(ROLE_CODES.SERVICE_IT);
  }

  if (asBoolean(additionalRequests?.venue?.enabled)) {
    requestedRoleCodes.push(ROLE_CODES.SERVICE_VENUE);
  }

  if (asBoolean(additionalRequests?.catering?.enabled)) {
    requestedRoleCodes.push(ROLE_CODES.SERVICE_CATERING);
  }

  if (asBoolean(additionalRequests?.stalls?.enabled)) {
    requestedRoleCodes.push(ROLE_CODES.SERVICE_STALLS);
  }

  if (asBoolean(additionalRequests?.security?.enabled)) {
    requestedRoleCodes.push(ROLE_CODES.SERVICE_SECURITY);
  }

  return requestedRoleCodes;
};

const getServiceRequestDetails = (additionalRequests, roleCode) => {
  const normalizedRoleCode = String(roleCode || "").trim().toUpperCase();

  if (normalizedRoleCode === ROLE_CODES.SERVICE_IT) {
    return additionalRequests?.it || {};
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_VENUE) {
    return additionalRequests?.venue || {};
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_CATERING) {
    return additionalRequests?.catering || {};
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_STALLS) {
    return additionalRequests?.stalls || {};
  }

  if (normalizedRoleCode === ROLE_CODES.SERVICE_SECURITY) {
    return additionalRequests?.security || {};
  }

  return {};
};

const createServiceRequestsForEvent = async ({ eventRecord, userInfo, approvalRequestId = null }) => {
  try {
    const eventId = String(eventRecord?.event_id || "").trim();
    if (!eventId) {
      return { createdCount: 0, requestedRoleCodes: [] };
    }

    const additionalRequests = sanitizeAdditionalRequests(eventRecord?.additional_requests);
    const requestedRoleCodes = collectRequestedServiceRoleCodes(additionalRequests);

    if (requestedRoleCodes.length === 0) {
      return { createdCount: 0, requestedRoleCodes: [] };
    }

    const nowIso = new Date().toISOString();
    const rows = requestedRoleCodes.map((roleCode, index) => ({
      service_request_id: `SR-${eventId}-${Date.now()}-${index + 1}`,
      event_id: eventId,
      approval_request_id: approvalRequestId,
      service_role_code: roleCode,
      requested_by_user_id: userInfo?.id || null,
      requested_by_email: userInfo?.email || null,
      status: "PENDING",
      details: getServiceRequestDetails(additionalRequests, roleCode),
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const inserted = await insert("service_requests", rows);

    return {
      createdCount: Array.isArray(inserted) ? inserted.length : 0,
      requestedRoleCodes,
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("[EventCreate] Service request tables are not available yet; skipping service request creation.");
      return { createdCount: 0, requestedRoleCodes: [] };
    }

    if (String(error?.code || "") === "23505") {
      console.warn("[EventCreate] Duplicate pending service requests detected; skipping duplicate insert.");
      return { createdCount: 0, requestedRoleCodes: [] };
    }

    throw error;
  }
};

const findLatestApprovalRequestByEntityRef = async ({ entityRef, entityTypes }) => {
  const normalizedEntityRef = String(entityRef || "").trim();
  if (!normalizedEntityRef) {
    return null;
  }

  const allowedEntityTypes = new Set(
    (entityTypes || [])
      .map((entityType) => normalizeWorkflowStatus(entityType))
      .filter(Boolean)
  );

  if (allowedEntityTypes.size === 0) {
    return null;
  }

  const rows = await queryAll("approval_requests", {
    where: { entity_ref: normalizedEntityRef },
    order: { column: "created_at", ascending: false },
  });

  return (
    (rows || []).find((row) =>
      allowedEntityTypes.has(normalizeWorkflowStatus(row?.entity_type))
    ) || null
  );
};

const hasApprovedStepForCodes = (steps, requiredCodes) => {
  const requiredCodeSet = new Set(
    (requiredCodes || []).map((code) => normalizeWorkflowStatus(code)).filter(Boolean)
  );

  if (requiredCodeSet.size === 0) {
    return true;
  }

  return (steps || []).some((step) => {
    const stepCode = normalizeWorkflowStatus(step?.step_code);
    const roleCode = normalizeWorkflowStatus(step?.role_code);
    const stepStatus = normalizeWorkflowStatus(step?.status);

    if (stepStatus !== "APPROVED") {
      return false;
    }

    return requiredCodeSet.has(stepCode) || requiredCodeSet.has(roleCode);
  });
};

const isNoFinancialRequirementsRequested = (value) => {
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "on";
  }
  return false;
};

const validateStandaloneApprovalChainForPublish = async ({ eventRecord }) => {
  const eventId = String(eventRecord?.event_id || "").trim();
  if (!eventId) {
    return { ok: false, reason: "Event id missing" };
  }

  const approvalRequest = await findLatestApprovalRequestByEntityRef({
    entityRef: eventId,
    entityTypes: ["STANDALONE_EVENT", "EVENT"],
  });

  if (!approvalRequest) {
    return { ok: false, reason: "Approval request not found" };
  }

  const requestStatus = normalizeWorkflowStatus(approvalRequest.status);
  if (requestStatus !== "APPROVED") {
    return { ok: false, reason: "Approval request is not approved" };
  }

  const steps = await queryAll("approval_steps", {
    where: { approval_request_id: approvalRequest.id },
    order: { column: "sequence_order", ascending: true },
  });

  const hasHodApproval = hasApprovedStepForCodes(steps, ["HOD", ROLE_CODES.HOD]);
  const hasDeanApproval = hasApprovedStepForCodes(steps, ["DEAN", ROLE_CODES.DEAN]);
  const noFinancialRequirements = eventHasNoFinancialRequirements(eventRecord);
  const isBudgetRelated =
    (!noFinancialRequirements && asBoolean(eventRecord?.is_budget_related)) ||
    isBudgetRelatedFromEventPayload({
      claimsApplicable: eventRecord?.claims_applicable,
      registrationFee: eventRecord?.registration_fee,
      noFinancialRequirements,
    });

  const hasFinanceApproval = !isBudgetRelated
    ? true
    : hasApprovedStepForCodes(steps, [
        "CFO",
        "FINANCE",
        "ACCOUNTS",
        ROLE_CODES.CFO,
        ROLE_CODES.ACCOUNTS,
      ]);

  return {
    ok: hasHodApproval && hasDeanApproval && hasFinanceApproval,
    reason: hasHodApproval
      ? hasDeanApproval
        ? hasFinanceApproval
          ? ""
          : "Finance approval missing"
        : "Dean approval missing"
      : "HOD approval missing",
  };
};

const validateLegacyLogisticsTableStatus = async ({ tableName, eventId }) => {
  try {
    const rows = await queryAll(tableName, {
      where: { event_id: eventId },
      select: "status",
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return true;
    }

    return rows.every(
      (row) => normalizeWorkflowStatus(row?.status) === "APPROVED"
    );
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "event_id")) {
      return true;
    }

    throw error;
  }
};

const validateSubEventLogisticsForPublish = async ({ eventRecord }) => {
  const eventId = String(eventRecord?.event_id || "").trim();
  if (!eventId) {
    return { ok: false, reason: "Event id missing" };
  }

  const normalizedFestId = normalizeFestReference(eventRecord?.fest_id);
  if (!normalizedFestId) {
    return { ok: false, reason: "fest_id missing for sub-event" };
  }

  const parentFest = await queryFestById(normalizedFestId);
  if (!parentFest) {
    return { ok: false, reason: "Parent fest not found" };
  }

  const additionalRequests = sanitizeAdditionalRequests(eventRecord?.additional_requests);
  const requiredServiceRoles = collectRequestedServiceRoleCodes(additionalRequests);
  const serviceRequests = await queryAll("service_requests", {
    where: { event_id: eventId },
    order: { column: "created_at", ascending: false },
  }).catch((error) => {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw error;
  });

  const serviceRows = Array.isArray(serviceRequests) ? serviceRequests : [];

  for (const roleCode of requiredServiceRoles) {
    const roleRows = serviceRows.filter(
      (row) =>
        normalizeWorkflowStatus(row?.service_role_code) ===
        normalizeWorkflowStatus(roleCode)
    );

    if (roleRows.length === 0) {
      return { ok: false, reason: `Missing service approvals for ${roleCode}` };
    }

    const hasPendingOrRejected = roleRows.some((row) => {
      const status = normalizeWorkflowStatus(row?.status, "PENDING");
      return status !== "APPROVED";
    });

    if (hasPendingOrRejected) {
      return { ok: false, reason: `Service approvals incomplete for ${roleCode}` };
    }
  }

  const [venueBookingsOk, eventResourcesOk] = await Promise.all([
    validateLegacyLogisticsTableStatus({ tableName: "venue_bookings", eventId }),
    validateLegacyLogisticsTableStatus({ tableName: "event_resources", eventId }),
  ]);

  if (!venueBookingsOk || !eventResourcesOk) {
    return { ok: false, reason: "Legacy logistics approvals are incomplete" };
  }

  return { ok: true, reason: "" };
};

const getIncompleteApprovalErrorPayload = (reason) => ({
  error: "403 Forbidden: Incomplete Approval Chain",
  code: "INCOMPLETE_APPROVAL_CHAIN",
  reason: reason || "Required approvals are incomplete",
});

// HEALTH CHECK - Verify Supabase connection
router.get("/debug/health", async (req, res) => {
  try {
    const result = await queryOne("events", { where: { event_id: "test" } });
    return res.json({
      status: "ok",
      supabase: "connected",
      message: "✅ Supabase connection is working"
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      supabase: "disconnected",
      message: "❌ Supabase connection failed",
      error: error.message
    });
  }
});

// DIAGNOSTIC ENDPOINT - Check authentication and organiser status
if (debugRoutesEnabled) {
  router.get("/debug/status", 
    authenticateUser,
    getUserInfo(),
    checkRoleExpiration,
    async (req, res) => {
      try {
        console.log("[DEBUG] User status request from:", req.userInfo.email);
        
        return res.json({
          authenticated: true,
          userId: req.userInfo.auth_uuid,
          email: req.userInfo.email,
          isOrganiser: req.userInfo.is_organiser,
          organiserExpiresAt: req.userInfo.organiser_expires_at,
          isMasterAdmin: req.userInfo.is_masteradmin,
          isSupport: req.userInfo.is_support,
          message: req.userInfo.is_organiser 
            ? "✅ You have organiser privileges" 
            : "❌ You do NOT have organiser privileges. Contact admin to enable.",
          roles: {
            organiser: req.userInfo.is_organiser,
            masteradmin: req.userInfo.is_masteradmin,
            support: req.userInfo.is_support
          }
        });
      } catch (error) {
        console.error("[DEBUG] Error checking status:", error);
        return res.status(500).json({ 
          error: error.message,
          message: "Error checking authentication status"
        });
      }
  });
}

const normalizeJsonField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value; // Already an object/array
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed;
    } catch (e) {
      console.warn("JSON Parse warning for value:", value, e.message);
      return []; // fallback
    }
  }
  return [];
};

const normalizeStringListField = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === "string" || typeof item === "number")
          .map((item) => String(item).trim())
          .filter(Boolean);
      }

      if (typeof parsed === "string" || typeof parsed === "number") {
        const parsedValue = String(parsed).trim();
        return parsedValue ? [parsedValue] : [];
      }
    } catch {
      if (trimmed.includes(",")) {
        return trimmed
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return [trimmed];
    }
  }

  if (typeof value === "number") {
    return [String(value)];
  }

  return [];
};

const normalizeSingleStringField = (value) => {
  const normalizedList = normalizeStringListField(value);
  return normalizedList[0] || "";
};

const normalizeFestReference = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (lowered === "none" || lowered === "null" || lowered === "undefined") {
    return null;
  }

  return normalized;
};

const getValidDate = (value) => {
  if (!value) return null;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const shouldAutoArchiveEvent = (event) => {
  const archivedBy = String(event?.archived_by || "").trim().toLowerCase();
  if (archivedBy === MANUAL_UNARCHIVE_OVERRIDE) {
    return false;
  }

  const parsedEndDate = getValidDate(event?.end_date || event?.event_date);
  if (!parsedEndDate) return false;

  parsedEndDate.setHours(0, 0, 0, 0);
  const archiveThreshold = new Date(parsedEndDate);
  archiveThreshold.setDate(archiveThreshold.getDate() + 2);

  return getTodayStart().getTime() >= archiveThreshold.getTime();
};

const asBoolean = (value) => {
  return value === true || value === 1 || value === "1" || value === "true";
};

const ORGANIZER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ORGANIZER_EMAIL_MAX_LENGTH = 100;
const STRICT_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULT_ADDITIONAL_REQUESTS = {
  it: {
    enabled: false,
    description: "",
  },
  venue: {
    enabled: false,
    selectedVenue: "",
    customVenue: "",
    startTime: "",
    endTime: "",
  },
  catering: {
    enabled: false,
    approximateCount: "",
    description: "",
  },
  stalls: {
    enabled: false,
    canopySelected: false,
    canopyQuantity: "0",
    canopyDescription: "",
    hardboardSelected: false,
    hardboardQuantity: "0",
    hardboardDescription: "",
    description: "",
  },
  security: {
    enabled: false,
    description: "",
  },
};

const buildAdditionalRequestsDefaults = () => ({
  it: { ...DEFAULT_ADDITIONAL_REQUESTS.it },
  venue: { ...DEFAULT_ADDITIONAL_REQUESTS.venue },
  catering: { ...DEFAULT_ADDITIONAL_REQUESTS.catering },
  stalls: { ...DEFAULT_ADDITIONAL_REQUESTS.stalls },
  security: { ...DEFAULT_ADDITIONAL_REQUESTS.security },
});

const parseAdditionalRequestsValue = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
};

const sanitizeAdditionalRequests = (value) => {
  const defaults = buildAdditionalRequestsDefaults();
  const parsed = parseAdditionalRequestsValue(value);

  return {
    it: {
      ...defaults.it,
      ...(parsed.it || {}),
      description: normalizeSingleStringField(parsed?.it?.description || ""),
    },
    venue: {
      ...defaults.venue,
      ...(parsed.venue || {}),
      selectedVenue: normalizeSingleStringField(parsed?.venue?.selectedVenue || ""),
      customVenue: normalizeSingleStringField(parsed?.venue?.customVenue || ""),
      startTime: normalizeSingleStringField(parsed?.venue?.startTime || ""),
      endTime: normalizeSingleStringField(parsed?.venue?.endTime || ""),
    },
    catering: {
      ...defaults.catering,
      ...(parsed.catering || {}),
      approximateCount: normalizeSingleStringField(parsed?.catering?.approximateCount || ""),
      description: normalizeSingleStringField(parsed?.catering?.description || ""),
    },
    stalls: {
      ...defaults.stalls,
      ...(parsed.stalls || {}),
      canopyQuantity: normalizeSingleStringField(parsed?.stalls?.canopyQuantity || "0"),
      canopyDescription: normalizeSingleStringField(parsed?.stalls?.canopyDescription || ""),
      hardboardQuantity: normalizeSingleStringField(parsed?.stalls?.hardboardQuantity || "0"),
      hardboardDescription: normalizeSingleStringField(parsed?.stalls?.hardboardDescription || ""),
      description: normalizeSingleStringField(
        parsed?.stalls?.description ||
          parsed?.stalls?.hardboardDescription ||
          parsed?.stalls?.canopyDescription ||
          ""
      ),
    },
    security: {
      ...defaults.security,
      ...(parsed.security || {}),
      description: normalizeSingleStringField(parsed?.security?.description || ""),
    },
  };
};

const normalizeVenueLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const parseStrictTimeToMinutes = (timeValue) => {
  const normalized = normalizeSingleStringField(timeValue);
  if (!STRICT_HHMM_REGEX.test(normalized)) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatMinutesToHHMM = (totalMinutes) => {
  const safeMinutes = Number(totalMinutes);
  if (!Number.isFinite(safeMinutes) || safeMinutes < 0) return "00:00";
  const normalized = safeMinutes % (24 * 60);
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const normalizeExistingTime = (timeValue) => {
  const normalized = normalizeSingleStringField(timeValue);
  const match = /^(\d{1,2}):(\d{2})/.exec(normalized);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
};

const parseDateOnlyValue = (value) => {
  const parsed = getValidDate(value);
  if (!parsed) return null;
  const normalized = new Date(parsed);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const rangesOverlap = (rangeAStart, rangeAEnd, rangeBStart, rangeBEnd) => {
  if (!rangeAStart || !rangeAEnd || !rangeBStart || !rangeBEnd) {
    return false;
  }

  return (
    rangeAStart.getTime() <= rangeBEnd.getTime() &&
    rangeAEnd.getTime() >= rangeBStart.getTime()
  );
};

const buildVenueBookingWindowFromEvent = (eventRecord) => {
  const additionalRequests = sanitizeAdditionalRequests(eventRecord?.additional_requests);
  const venueModuleEnabled = asBoolean(additionalRequests?.venue?.enabled);

  const venueName = venueModuleEnabled
    ? normalizeSingleStringField(
        additionalRequests.venue.selectedVenue || additionalRequests.venue.customVenue
      )
    : normalizeSingleStringField(eventRecord?.venue || "");

  if (!venueName) {
    return null;
  }

  const startDate = parseDateOnlyValue(eventRecord?.event_date);
  const endDate = parseDateOnlyValue(eventRecord?.end_date || eventRecord?.event_date);
  if (!startDate || !endDate) {
    return null;
  }

  const normalizedStartTime = venueModuleEnabled
    ? normalizeSingleStringField(additionalRequests.venue.startTime)
    : normalizeExistingTime(eventRecord?.event_time);

  const normalizedEndTime = venueModuleEnabled
    ? normalizeSingleStringField(additionalRequests.venue.endTime)
    : "";

  const startMinutes = parseStrictTimeToMinutes(normalizedStartTime);
  if (startMinutes === null) {
    return null;
  }

  const resolvedEndMinutesRaw = parseStrictTimeToMinutes(normalizedEndTime);
  const endMinutes =
    resolvedEndMinutesRaw !== null && resolvedEndMinutesRaw > startMinutes
      ? resolvedEndMinutesRaw
      : startMinutes + 60;

  return {
    eventId: eventRecord?.event_id || null,
    venueName,
    normalizedVenue: normalizeVenueLabel(venueName),
    startDate,
    endDate,
    startMinutes,
    endMinutes,
    startTime: formatMinutesToHHMM(startMinutes),
    endTime: formatMinutesToHHMM(endMinutes),
  };
};

const validateAdditionalRequestsPayload = ({
  additionalRequestsRaw,
  hasFestSelected,
  eventDate,
  endDate,
}) => {
  const fieldErrors = {};

  const addFieldError = (path, message) => {
    if (!fieldErrors[path]) {
      fieldErrors[path] = message;
    }
  };

  const additionalRequests = sanitizeAdditionalRequests(additionalRequestsRaw);

  if (!hasFestSelected) {
    return {
      fieldErrors,
      additionalRequests: buildAdditionalRequestsDefaults(),
      venueBooking: null,
    };
  }

  if (asBoolean(additionalRequests.it.enabled)) {
    if (!normalizeSingleStringField(additionalRequests.it.description)) {
      addFieldError(
        "additionalRequests.it.description",
        "IT description is required when IT module is selected"
      );
    }
  }

  let venueBooking = null;
  if (asBoolean(additionalRequests.venue.enabled)) {
    const selectedVenue = normalizeSingleStringField(
      additionalRequests.venue.selectedVenue
    );
    const customVenue = normalizeSingleStringField(
      additionalRequests.venue.customVenue
    );
    const startTime = normalizeSingleStringField(additionalRequests.venue.startTime);
    const endTime = normalizeSingleStringField(additionalRequests.venue.endTime);

    if (!selectedVenue && !customVenue) {
      addFieldError(
        "additionalRequests.venue.selectedVenue",
        "Select a predefined venue or enter a custom venue"
      );
    }

    if (selectedVenue && customVenue) {
      addFieldError(
        "additionalRequests.venue.customVenue",
        "Choose either predefined venue or custom venue, not both"
      );
    }

    if (!startTime) {
      addFieldError(
        "additionalRequests.venue.startTime",
        "Start time is required when Venue module is selected"
      );
    } else if (!STRICT_HHMM_REGEX.test(startTime)) {
      addFieldError(
        "additionalRequests.venue.startTime",
        "Start time must be in 24-hour HH:mm format"
      );
    }

    if (!endTime) {
      addFieldError(
        "additionalRequests.venue.endTime",
        "End time is required when Venue module is selected"
      );
    } else if (!STRICT_HHMM_REGEX.test(endTime)) {
      addFieldError(
        "additionalRequests.venue.endTime",
        "End time must be in 24-hour HH:mm format"
      );
    }

    const startMinutes = parseStrictTimeToMinutes(startTime);
    const endMinutes = parseStrictTimeToMinutes(endTime);
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      addFieldError(
        "additionalRequests.venue.endTime",
        "End time must be greater than start time"
      );
    }

    const startDate = parseDateOnlyValue(eventDate);
    const finalEndDate = parseDateOnlyValue(endDate || eventDate);

    if (
      selectedVenue ||
      customVenue ||
      startMinutes !== null ||
      endMinutes !== null
    ) {
      if (!startDate || !finalEndDate) {
        addFieldError(
          "eventDate",
          "Valid event dates are required for venue conflict validation"
        );
      }
    }

    if (
      Object.keys(fieldErrors).length === 0 &&
      (selectedVenue || customVenue) &&
      startMinutes !== null &&
      endMinutes !== null &&
      endMinutes > startMinutes &&
      startDate &&
      finalEndDate
    ) {
      const resolvedVenueName = selectedVenue || customVenue;
      venueBooking = {
        venueName: resolvedVenueName,
        normalizedVenue: normalizeVenueLabel(resolvedVenueName),
        startDate,
        endDate: finalEndDate,
        startMinutes,
        endMinutes,
        startTime: formatMinutesToHHMM(startMinutes),
        endTime: formatMinutesToHHMM(endMinutes),
      };
    }
  }

  if (asBoolean(additionalRequests.catering.enabled)) {
    const rawCount = normalizeSingleStringField(
      additionalRequests.catering.approximateCount
    );
    const description = normalizeSingleStringField(additionalRequests.catering.description);

    if (!rawCount) {
      addFieldError(
        "additionalRequests.catering.approximateCount",
        "Approximate count is required for Catering"
      );
    } else {
      const numericCount = Number(rawCount);
      if (!Number.isFinite(numericCount) || numericCount <= 0) {
        addFieldError(
          "additionalRequests.catering.approximateCount",
          "Approximate count must be a positive number"
        );
      }
    }

    if (!description) {
      addFieldError(
        "additionalRequests.catering.description",
        "Catering description is required"
      );
    }
  }

  if (asBoolean(additionalRequests.stalls.enabled)) {
    const canopySelected = asBoolean(additionalRequests.stalls.canopySelected);
    const hardboardSelected = asBoolean(additionalRequests.stalls.hardboardSelected);

    if (!canopySelected && !hardboardSelected) {
      addFieldError(
        "additionalRequests.stalls.canopySelected",
        "Select at least one stall type"
      );
    }

    let hasPositiveQuantity = false;
    const validateQuantity = (selected, rawValue, fieldPath) => {
      if (!selected) return;

      const normalized = normalizeSingleStringField(rawValue);
      if (!normalized) {
        addFieldError(fieldPath, "Quantity is required for selected stall type");
        return;
      }

      const numeric = Number(normalized);
      if (!Number.isFinite(numeric)) {
        addFieldError(fieldPath, "Quantity must be a valid number");
        return;
      }

      if (numeric < 0) {
        addFieldError(fieldPath, "Quantity cannot be negative");
        return;
      }

      if (numeric > 0) {
        hasPositiveQuantity = true;
      }
    };

    validateQuantity(
      canopySelected,
      additionalRequests.stalls.canopyQuantity,
      "additionalRequests.stalls.canopyQuantity"
    );
    validateQuantity(
      hardboardSelected,
      additionalRequests.stalls.hardboardQuantity,
      "additionalRequests.stalls.hardboardQuantity"
    );

    if ((canopySelected || hardboardSelected) && !hasPositiveQuantity) {
      addFieldError(
        "additionalRequests.stalls.canopyQuantity",
        "At least one selected stall type must have quantity greater than 0"
      );
    }
  }

  if (asBoolean(additionalRequests.security.enabled)) {
    if (!normalizeSingleStringField(additionalRequests.security.description)) {
      addFieldError(
        "additionalRequests.security.description",
        "Security description is required when Security module is selected"
      );
    }
  }

  return {
    fieldErrors,
    additionalRequests,
    venueBooking,
  };
};

const findVenueConflict = async ({ venueBooking, ignoreEventId }) => {
  if (!venueBooking) return null;

  let candidateEvents = [];
  try {
    candidateEvents = await queryAll("events", {
      select: "event_id,event_date,end_date,event_time,venue,additional_requests",
    });
  } catch (error) {
    if (!isMissingAdditionalRequestsColumnError(error)) {
      throw error;
    }

    console.warn(
      "[VenueConflict] 'additional_requests' column missing; retrying conflict scan without it."
    );
    candidateEvents = await queryAll("events", {
      select: "event_id,event_date,end_date,event_time,venue",
    });
  }

  for (const candidate of candidateEvents || []) {
    if (!candidate?.event_id) continue;
    if (ignoreEventId && candidate.event_id === ignoreEventId) continue;

    const existingBooking = buildVenueBookingWindowFromEvent(candidate);
    if (!existingBooking) continue;

    if (existingBooking.normalizedVenue !== venueBooking.normalizedVenue) continue;

    if (
      !rangesOverlap(
        venueBooking.startDate,
        venueBooking.endDate,
        existingBooking.startDate,
        existingBooking.endDate
      )
    ) {
      continue;
    }

    const hasTimeOverlap =
      venueBooking.startMinutes < existingBooking.endMinutes &&
      venueBooking.endMinutes > existingBooking.startMinutes;

    if (!hasTimeOverlap) continue;

    return existingBooking;
  }

  return null;
};

const normalizeEmailAddress = (value) => String(value || "").trim().toLowerCase();
const isValidEmailAddress = (value) => ORGANIZER_EMAIL_REGEX.test(normalizeEmailAddress(value));

const deriveArchiveState = (event) => {
  const manualArchived = asBoolean(event?.is_archived);
  const autoArchived = shouldAutoArchiveEvent(event);

  return {
    is_archived: manualArchived,
    archived_at: event?.archived_at || null,
    archived_effective: manualArchived || autoArchived,
    archive_source: manualArchived ? "manual" : autoArchived ? "auto" : null,
  };
};

const isMissingArchiveColumnsError = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    (message.includes("column") &&
      (message.includes("is_archived") || message.includes("archived_at") || message.includes("archived_by")))
  );
};

const persistAutoArchivedEvents = async (events) => {
  const eventList = Array.isArray(events) ? events : [];
  const nowIso = new Date().toISOString();

  const candidates = eventList.filter((event) => {
    if (asBoolean(event?.is_archived)) return false;
    return shouldAutoArchiveEvent(event);
  });

  if (candidates.length === 0) {
    return eventList;
  }

  const archivedEventIds = new Set();

  for (const event of candidates) {
    const eventId = event?.event_id;
    if (!eventId) continue;

    try {
      await update(
        "events",
        {
          is_archived: true,
          archived_at: nowIso,
          archived_by: event?.archived_by || "system:auto_end_date",
          updated_at: nowIso,
        },
        { event_id: eventId }
      );
      archivedEventIds.add(eventId);
      continue;
    } catch (error) {
      const code = String(error?.code || "");
      const message = String(error?.message || "").toLowerCase();
      const missingArchivedByColumn = code === "42703" && message.includes("archived_by");

      if (!missingArchivedByColumn) {
        console.warn(`[AutoArchive] Failed to auto-archive ${eventId}:`, error?.message || error);
        continue;
      }
    }

    try {
      await update(
        "events",
        {
          is_archived: true,
          archived_at: nowIso,
          updated_at: nowIso,
        },
        { event_id: eventId }
      );
      archivedEventIds.add(eventId);
    } catch (fallbackError) {
      console.warn(`[AutoArchive] Fallback auto-archive failed for ${eventId}:`, fallbackError?.message || fallbackError);
    }
  }

  if (archivedEventIds.size === 0) {
    return eventList;
  }

  return eventList.map((event) => {
    if (!archivedEventIds.has(event?.event_id)) {
      return event;
    }

    return {
      ...event,
      is_archived: true,
      archived_at: event?.archived_at || nowIso,
      archived_by: event?.archived_by || "system:auto_end_date",
    };
  });
};


// GET all events - PUBLIC ACCESS (no auth required)
router.get("/", optionalAuth, checkRoleExpiration, async (req, res) => {
  try {
    const { page, pageSize, search, status, sortBy, sortOrder, archive, include_drafts } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const includeDraftsRequested =
      typeof include_drafts === "string" && include_drafts.toLowerCase() === "true";
    const canViewDrafts = Boolean(req.userInfo?.is_masteradmin || req.userInfo?.is_organiser);
    const shouldIncludeDrafts = includeDraftsRequested && canViewDrafts;
    
    let queryOptions = { 
      order: { column: "created_at", ascending: false } 
    };

    // Push basic status filtering to database
    if (status === "upcoming" || status === "active") {
      queryOptions.filters = [{ column: "event_date", operator: "gte", value: today }];
    } else if (status === "past") {
      queryOptions.filters = [{ column: "event_date", operator: "lt", value: today }];
    }

    const events = await queryAll("events", queryOptions);
    const eventsWithAutoArchive = await persistAutoArchivedEvents(events);

    // Build registration counts once so both sorting and UI display use the same value.
    const registrations = await queryAll("registrations", { select: "event_id" });
    const eventRegistrationCounts = {};
    (registrations || []).forEach((reg) => {
      if (reg.event_id) {
        eventRegistrationCounts[reg.event_id] = (eventRegistrationCounts[reg.event_id] || 0) + 1;
      }
    });

    // Parse JSON fields for each event
    let processedEvents = eventsWithAutoArchive.map((event) => {
      const archiveState = deriveArchiveState(event);
      return {
        ...event,
        fest: event.fest_id || null, // Map fest_id to fest for frontend compatibility
        department_access: normalizeJsonField(event.department_access),
        rules: normalizeJsonField(event.rules),
        schedule: normalizeJsonField(event.schedule),
        prizes: normalizeJsonField(event.prizes),
        custom_fields: normalizeJsonField(event.custom_fields),
        additional_requests: sanitizeAdditionalRequests(event.additional_requests),
        campus_hosted_at: normalizeSingleStringField(event.campus_hosted_at),
        allowed_campuses: normalizeStringListField(event.allowed_campuses),
        registration_count: eventRegistrationCounts[event.event_id] || 0,
        ...archiveState,
      };
    });

    const normalizedSearch = typeof search === "string" ? search.trim().toLowerCase() : "";
    if (normalizedSearch) {
      processedEvents = processedEvents.filter((event) =>
        event.title?.toLowerCase().includes(normalizedSearch) ||
        event.organizing_dept?.toLowerCase().includes(normalizedSearch)
      );
    }

    const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "all";
    if (normalizedStatus !== "all" && normalizedStatus !== "active") {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Normalize to start of day
      
      processedEvents = processedEvents.filter((event) => {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(0, 0, 0, 0); // Normalize to start of day
        
        const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        
        if (normalizedStatus === "past") return diffDays < 0;
        if (normalizedStatus === "live") return Math.abs(diffDays) < 1;
        if (normalizedStatus === "thisweek") return diffDays >= 0 && diffDays <= 7;
        if (normalizedStatus === "upcoming") return diffDays >= 0;
        return true;
      });
    }

    const normalizedArchive = typeof archive === "string" ? archive.toLowerCase() : "all";
    if (normalizedArchive === "archived") {
      processedEvents = processedEvents.filter((event) => event.archived_effective);
    } else if (normalizedArchive === "active") {
      processedEvents = processedEvents.filter((event) => !event.archived_effective);
    }

    if (!shouldIncludeDrafts) {
      processedEvents = processedEvents.filter((event) => !asBoolean(event.is_draft));
    }

    const normalizedSortBy = typeof sortBy === "string" ? sortBy : "date";
    const normalizedSortOrder = sortOrder === "asc" ? "asc" : "desc";
    processedEvents.sort((a, b) => {
      let result = 0;
      switch (normalizedSortBy) {
        case "title":
          result = (a.title || "").localeCompare(b.title || "");
          break;
        case "dept":
        case "organizing_dept":
          result = (a.organizing_dept || "").localeCompare(b.organizing_dept || "");
          break;
        case "registrations":
        case "registration_count":
          result = (a.registration_count || 0) - (b.registration_count || 0);
          break;
        case "date":
        case "event_date":
          result = new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime();
          break;
        case "created_at":
          result = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        default:
          result = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
      }
      return normalizedSortOrder === "asc" ? result : -result;
    });

    const shouldPaginate = page !== undefined || pageSize !== undefined;
    if (!shouldPaginate) {
      return res.status(200).json({ events: processedEvents });
    }

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 200);
    const totalItems = processedEvents.length;
    const totalPages = Math.max(Math.ceil(totalItems / parsedPageSize), 1);
    const safePage = Math.min(parsedPage, totalPages);
    const start = (safePage - 1) * parsedPageSize;
    const pagedEvents = processedEvents.slice(start, start + parsedPageSize);

    return res.status(200).json({
      events: pagedEvents,
      pagination: {
        page: safePage,
        pageSize: parsedPageSize,
        totalItems,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1
      },
      filters: {
        search: normalizedSearch,
        status: normalizedStatus,
        archive: normalizedArchive,
      },
      sort: {
        by: normalizedSortBy,
        order: normalizedSortOrder
      }
    });
  } catch (error) {
    console.error("Server error GET /api/events:", error);
    return res.status(500).json({ error: "Internal server error while fetching events." });
  }
});

// GET specific event by ID - PUBLIC ACCESS
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
      return res.status(400).json({
        error: "Event ID must be provided in the URL path and be a non-empty string.",
      });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });

    if (!event) {
      return res.status(404).json({ error: `Event with ID '${eventId}' not found.` });
    }

    // Parse JSON fields
    const archiveState = deriveArchiveState(event);
    const processedEvent = {
      ...event,
      fest: event.fest_id || null, // Map fest_id to fest for frontend compatibility
      department_access: normalizeJsonField(event.department_access),
      rules: normalizeJsonField(event.rules),
      schedule: normalizeJsonField(event.schedule),
      prizes: normalizeJsonField(event.prizes),
      custom_fields: normalizeJsonField(event.custom_fields),
      additional_requests: sanitizeAdditionalRequests(event.additional_requests),
      campus_hosted_at: normalizeSingleStringField(event.campus_hosted_at),
      allowed_campuses: normalizeStringListField(event.allowed_campuses),
      ...archiveState,
    };

    return res.status(200).json({ event: processedEvent });
  } catch (error) {
    console.error("Server error GET /api/events/:eventId:", error);
    return res.status(500).json({ error: "Internal server error while fetching event." });
  }
});

// POST create new event - REQUIRES AUTHENTICATION + ORGANISER PRIVILEGES
router.post(
  "/",
  multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  authenticateUser,           // Verify JWT token
  getUserInfo(),           // Get user info from DB via helper
  (req, res, next) => {
    const canCreateEvent =
      isMasterAdminUser(req.userInfo) ||
      isOrganizerTeacherUser(req.userInfo) ||
      hasAnyRoleCode(getRoleCodes(req.userInfo), [ROLE_CODES.ORGANIZER_STUDENT]);

    if (!canCreateEvent) {
      return res.status(403).json({
        error: "Access denied: Organizer Teacher or Organizer Student privileges required",
      });
    }

    return next();
  },
  async (req, res) => {
    const uploadedFilePaths = {
      image: null,
      banner: null,
      pdf: null,
    };

    console.log("POST /api/events - Request received");
    console.log("Content-Type:", req.headers['content-type']); // Log content type
    
    if (req.files) {
      console.log("Files keys:", Object.keys(req.files));
      if (req.files.eventImage) console.log("eventImage:", req.files.eventImage[0].originalname, req.files.eventImage[0].mimetype, req.files.eventImage[0].size);
      if (req.files.bannerImage) console.log("bannerImage:", req.files.bannerImage[0].originalname, req.files.bannerImage[0].mimetype, req.files.bannerImage[0].size);
    } else {
      console.log("No files in req.files");
    }

    try {
      const {
        title,
        description,
        event_date,
        event_time,
        venue,
        category,
        claims_applicable,
        registration_fee,
        organizing_school,
        organizing_dept,
        fest,
        fest_id,
        department_access,
        rules,
        schedule,
        prizes,
        max_participants,
        send_notifications,
        is_draft,
        is_archived,
        save_as_draft
      } = req.body;

      const userIsMasterAdmin = isMasterAdminUser(req.userInfo);
      const userIsOrganizerTeacher = isOrganizerTeacherUser(req.userInfo);
      const userIsOrganizerStudentOnly = isOrganizerStudentOnlyUser(req.userInfo);
      const normalizedFestId = normalizeFestReference(fest_id ?? fest);

      const shouldSaveAsDraftByInput =
        asBoolean(is_draft) ||
        asBoolean(save_as_draft);
      const shouldSaveAsDraft = shouldSaveAsDraftByInput || userIsOrganizerStudentOnly;
      const shouldArchiveOnCreate =
        asBoolean(is_archived) && !shouldSaveAsDraft && !userIsOrganizerStudentOnly;
      const hasExplicitNotificationPreference =
        send_notifications !== undefined &&
        send_notifications !== null &&
        String(send_notifications).trim() !== "";
      const shouldSendNotificationsByPreference =
        !shouldSaveAsDraft &&
        (hasExplicitNotificationPreference ? asBoolean(send_notifications) : true);
      const parsedRegistrationFee = parseOptionalFloat(registration_fee);
      const claimsApplicable =
        claims_applicable === "true" || claims_applicable === true;
      const noFinancialRequirementsRequested = eventHasNoFinancialRequirements(req.body || {});
      const isStandaloneBudgetRelated = isBudgetRelatedFromEventPayload({
        claimsApplicable,
        registrationFee: parsedRegistrationFee,
        noFinancialRequirements: noFinancialRequirementsRequested,
      });

      let parentFest = null;
      let childFestApproved = false;

      if (normalizedFestId) {
        parentFest = await queryFestById(normalizedFestId);

        if (!parentFest) {
          return res.status(404).json({
            error: "Selected parent fest was not found.",
          });
        }

        childFestApproved = isFestApprovedForChildEvent(parentFest);
      }

      if (userIsOrganizerStudentOnly && !normalizedFestId) {
        return res.status(403).json({
          error: "Organizer Student can only create events under an approved fest.",
        });
      }

      if (userIsOrganizerStudentOnly && !childFestApproved) {
        return res.status(403).json({
          error: "Organizer Student can only create events under an approved fest.",
        });
      }

      if (!shouldSaveAsDraft && normalizedFestId && !childFestApproved) {
        return res.status(403).json({
          error: "Events can be published under a fest only after the parent fest is approved.",
        });
      }

      const organizerEmailInput = normalizeSingleStringField(req.body.organizer_email || "");
      const fallbackOrganizerEmail = normalizeEmailAddress(req.userInfo?.email || "");
      const organizerEmail = normalizeEmailAddress(
        organizerEmailInput || fallbackOrganizerEmail
      );

      if (!organizerEmail) {
        return res.status(400).json({
          error: "Organizer contact email is required.",
        });
      }

      if (organizerEmail.length > ORGANIZER_EMAIL_MAX_LENGTH) {
        return res.status(400).json({
          error: "Organizer contact email must be 100 characters or fewer.",
        });
      }

      if (!isValidEmailAddress(organizerEmail)) {
        return res.status(400).json({
          error: "Please provide a valid organizer contact email.",
        });
      }

      // Validation
      if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and must be a non-empty string." });
      }

      console.log("✅ Title validation passed:", title);

      // Generate slug-based ID from title
      let event_id = title
        ? title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "";

      if (!event_id) {
        event_id = uuidv4().replace(/-/g, "");
      }
      console.log("Generated event_id:", event_id);

      // Validate event_id uniqueness
      const existingEvent = await queryOne("events", { where: { event_id } });
      if (existingEvent) {
        return res.status(400).json({
          error: `An event with the title "${title}" already exists. Please use a different title.`
        });
      }

      console.log("✅ Event ID uniqueness checked");

      // Handle file uploads
      const files = req.files;
      
      // Upload Event Image
      if (files?.eventImage && files.eventImage[0]) {
        try {
          console.log(`📁 Uploading eventImage: ${files.eventImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.eventImage[0], "event-images", event_id);
          uploadedFilePaths.image = result?.publicUrl || null;
          console.log(`✅ Event image uploaded: ${uploadedFilePaths.image}`);
        } catch (imgError) {
          console.error("❌ Event image upload failed:", imgError.message);
          throw new Error(`Failed to upload event image: ${imgError.message}`);
        }
      } else {
        console.log("⚠️  No event image provided (optional)");
      }

      // Upload Banner Image
      if (files?.bannerImage && files.bannerImage[0]) {
        try {
          console.log(`📁 Uploading bannerImage: ${files.bannerImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", event_id);
          uploadedFilePaths.banner = result?.publicUrl || null;
          console.log(`✅ Banner image uploaded: ${uploadedFilePaths.banner}`);
        } catch (bannerError) {
          console.error("❌ Banner image upload failed:", bannerError.message);
          // Don't throw - banner is optional
        }
      } else {
        console.log("⚠️  No banner image provided (optional)");
      }

      // Upload PDF
      if (files?.pdfFile && files.pdfFile[0]) {
        try {
          console.log(`📁 Uploading pdfFile: ${files.pdfFile[0].originalname}`);
          const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", event_id);
          uploadedFilePaths.pdf = result?.publicUrl || null;
          console.log(`✅ PDF uploaded: ${uploadedFilePaths.pdf}`);
        } catch (pdfError) {
          console.error("❌ PDF upload failed:", pdfError.message);
          // Don't throw - PDF is optional
        }
      } else {
        console.log("⚠️  No PDF provided (optional)");
      }

      // Parse and validate JSON fields
      const parsedDepartmentAccess = parseJsonField(department_access, []);
      const parsedRules = parseJsonField(rules, []);
      const parsedSchedule = parseJsonField(schedule, []);
      const parsedPrizes = parseJsonField(prizes, []);
      const parsedCustomFields = parseJsonField(req.body.custom_fields, []);
      const organizingSchool = normalizeSingleStringField(
        organizing_school || req.body.organizingSchool || ""
      );
      const normalizedFestReference = normalizedFestId;
      const campusHostedAt = normalizeSingleStringField(
        req.body.campus_hosted_at || req.body.campusHostedAt || ""
      );
      const parsedAllowedCampuses = normalizeStringListField(
        req.body.allowed_campuses
      );

      const additionalRequestsValidation = validateAdditionalRequestsPayload({
        additionalRequestsRaw: req.body.additional_requests,
        hasFestSelected: Boolean(normalizedFestReference),
        eventDate: event_date || null,
        endDate: req.body.end_date || event_date || null,
      });

      if (Object.keys(additionalRequestsValidation.fieldErrors).length > 0) {
        return res.status(400).json({
          error: "Additional request validation failed.",
          fieldErrors: additionalRequestsValidation.fieldErrors,
        });
      }

      if (additionalRequestsValidation.venueBooking) {
        const conflict = await findVenueConflict({
          venueBooking: additionalRequestsValidation.venueBooking,
          ignoreEventId: null,
        });

        if (conflict) {
          const conflictMessage = `This venue is already booked from ${conflict.startTime} to ${conflict.endTime}. Please choose a different time slot or venue.`;
          return res.status(409).json({
            error: conflictMessage,
            code: "VENUE_TIME_CONFLICT",
            fieldErrors: {
              "additionalRequests.venue.selectedVenue": conflictMessage,
              "additionalRequests.venue.customVenue": conflictMessage,
              "additionalRequests.venue.startTime": conflictMessage,
              "additionalRequests.venue.endTime": conflictMessage,
            },
            conflict: {
              event_id: conflict.eventId,
              start_time: conflict.startTime,
              end_time: conflict.endTime,
            },
          });
        }
      }

      if (!campusHostedAt) {
        return res.status(400).json({
          error: "Campus hosted at is required.",
        });
      }

      if (!Array.isArray(parsedAllowedCampuses) || parsedAllowedCampuses.length === 0) {
        return res.status(400).json({
          error: "At least one allowed campus is required.",
        });
      }

      if (!organizingSchool) {
        return res.status(400).json({
          error: "Organizing school is required.",
        });
      }

      console.log("✅ JSON fields parsed successfully");
      console.log("About to insert event into database with:", {
        event_id,
        title: title?.trim(),
        organizing_dept,
        created_by: req.userInfo?.email,
        fileUrls: uploadedFilePaths,
        roleContext: {
          userIsMasterAdmin,
          userIsOrganizerTeacher,
          userIsOrganizerStudentOnly,
        },
      });

      const eventInsertPayload = {
        event_id,
        title: title.trim(),
        description: description || null,
        event_date: event_date || null,
        event_time: event_time || null,
        end_date: req.body.end_date || null,
        venue: venue || null,
        category: category || null,
        department_access: parsedDepartmentAccess,
        claims_applicable: claimsApplicable,
        registration_fee: parsedRegistrationFee,
        participants_per_team: parseOptionalInt(max_participants, 1),
        event_image_url: uploadedFilePaths.image,
        banner_url: uploadedFilePaths.banner,
        pdf_url: uploadedFilePaths.pdf,
        rules: parsedRules,
        schedule: parsedSchedule,
        prizes: parsedPrizes,
        custom_fields: parsedCustomFields,
        organizer_email: organizerEmail,
        organizer_phone: req.body.organizer_phone || null,
        whatsapp_invite_link: req.body.whatsapp_invite_link || null,
        organizing_school: organizingSchool,
        organizing_dept: organizing_dept || null,
        fest_id: normalizedFestReference,
        created_by: req.userInfo?.email,
        auth_uuid: req.userId,
        registration_deadline: req.body.registration_deadline || null,
        total_participants: 0,
        is_draft: shouldSaveAsDraft,
        status: shouldSaveAsDraft
          ? LIFECYCLE_STATUS.DRAFT
          : LIFECYCLE_STATUS.PUBLISHED,
        is_archived: shouldArchiveOnCreate,
        archived_at: shouldArchiveOnCreate ? new Date().toISOString() : null,
        archived_by: shouldArchiveOnCreate
          ? req.userInfo?.email || req.userId || "system:create_archive"
          : null,
        // Outsider & campus fields
        allow_outsiders: req.body.allow_outsiders === "true" || req.body.allow_outsiders === true ? 1 : 0,
        on_spot: req.body.on_spot === "true" || req.body.on_spot === true ? 1 : 0,
        outsider_registration_fee: parseOptionalFloat(req.body.outsider_registration_fee || req.body.outsiderRegistrationFee, null),
        outsider_max_participants: parseOptionalInt(req.body.outsider_max_participants || req.body.outsiderMaxParticipants, null),
        campus_hosted_at: campusHostedAt,
        allowed_campuses: parsedAllowedCampuses,
        min_participants: parseOptionalInt(req.body.min_participants || req.body.minParticipants, 1),
        additional_requests: additionalRequestsValidation.additionalRequests,
      };

      // Insert event with creator's auth_uuid
      let created;
      try {
        created = await insert("events", [eventInsertPayload]);
      } catch (insertError) {
        const hasMissingLifecycleStatusColumn = isMissingColumnError(insertError, "status");
        if (!isMissingAdditionalRequestsColumnError(insertError) && !hasMissingLifecycleStatusColumn) {
          throw insertError;
        }

        console.warn(
          "[EventCreate] Missing optional columns on events table; retrying create without unsupported payload fields."
        );
        const fallbackInsertPayload = {
          ...eventInsertPayload,
        };
        delete fallbackInsertPayload.additional_requests;
        if (hasMissingLifecycleStatusColumn) {
          delete fallbackInsertPayload.status;
        }
        created = await insert("events", [fallbackInsertPayload]);
      }

      if (!created || created.length === 0) {
        throw new Error("Event was not created successfully (no rows returned from insert).");
      }

      console.log("✅ Event inserted successfully:", event_id);

      let createdEventRecord = created[0];
      let primaryApprovalRequest = null;
      let approvalState = "APPROVED";
      let pendingDeanApproval = false;
      let pendingHodApproval = false;
      let pendingCfoApproval = false;

      const queueTeacherApproval =
        userIsOrganizerStudentOnly && Boolean(normalizedFestReference) && childFestApproved;
      const queueStandaloneApproval =
        !queueTeacherApproval &&
        !shouldSaveAsDraft &&
        !shouldArchiveOnCreate &&
        !Boolean(normalizedFestReference);

      if (queueTeacherApproval) {
        primaryApprovalRequest = await createTeacherApprovalRequestForChildEvent({
          eventRecord: createdEventRecord,
          userInfo: req.userInfo,
        });

        if (primaryApprovalRequest) {
          approvalState = "UNDER_REVIEW";
        }
      } else if (queueStandaloneApproval) {
        primaryApprovalRequest = await createStandaloneApprovalRequestForEvent({
          eventRecord: createdEventRecord,
          userInfo: req.userInfo,
          isBudgetRelated: isStandaloneBudgetRelated,
        });

        if (primaryApprovalRequest) {
          approvalState = "UNDER_REVIEW";
          const primaryRoleCode = normalizeWorkflowStatus(
            primaryApprovalRequest?.primary_role_code,
            ROLE_CODES.DEAN
          );
          pendingDeanApproval = primaryRoleCode === ROLE_CODES.DEAN;
          pendingHodApproval = primaryRoleCode === ROLE_CODES.HOD;
          pendingCfoApproval = Boolean(isStandaloneBudgetRelated);
        }
      }

      const serviceWorkflow = (!shouldSaveAsDraft && !shouldArchiveOnCreate)
        ? await createServiceRequestsForEvent({
            eventRecord: createdEventRecord,
            userInfo: req.userInfo,
            approvalRequestId: primaryApprovalRequest?.id || null,
          })
        : { createdCount: 0, requestedRoleCodes: [] };

      const serviceApprovalState =
        (serviceWorkflow.requestedRoleCodes || []).length > 0 ? "PENDING" : "APPROVED";
      let activationState = resolveActivationState(approvalState, serviceApprovalState);

      const shouldApplyWorkflowState =
        Boolean(primaryApprovalRequest) ||
        (serviceWorkflow.requestedRoleCodes || []).length > 0;

      if (shouldApplyWorkflowState) {
        const workflowResult = await applyEventWorkflowState({
          eventId: event_id,
          approvalState,
          serviceApprovalState,
          approvalRequestId: primaryApprovalRequest?.id || null,
          isBudgetRelated: queueStandaloneApproval ? isStandaloneBudgetRelated : false,
        });

        activationState = workflowResult.activationState;

        if (workflowResult.applied) {
          const refreshedEvent = await queryOne("events", {
            where: { event_id },
          });

          if (refreshedEvent) {
            createdEventRecord = refreshedEvent;
          }
        }
      }

      const canGoLiveNow =
        !shouldSaveAsDraft &&
        !shouldArchiveOnCreate &&
        activationState === "ACTIVE";
      const shouldSendNotifications =
        canGoLiveNow && shouldSendNotificationsByPreference;

      // Send notifications to all users about the new event (non-blocking)
      if (shouldSendNotifications) {
        sendBroadcastNotification({
          title: 'New Event Published',
          message: `${title} — Check out this new event!`,
          type: 'info',
          event_id: event_id,
          event_title: title,
          action_url: `/event/${event_id}`
        }).then(() => {
          console.log(`✅ Sent notifications for new event: ${title}`);
        }).catch((notifError) => {
          console.error('❌ Failed to send event notifications:', notifError);
        });
      } else {
        console.log(`ℹ️ Notifications skipped for event ${event_id} (draft or notifications disabled).`);
      }

      // Push to UniversityGated if outsiders are enabled (non-blocking)
      if (canGoLiveNow && isGatedEnabled()) {
        const createdEvent = created[0];
        shouldPushEventToGated(createdEvent, queryOne).then(async (shouldPush) => {
          if (shouldPush) {
            try {
              await pushEventToGated(
                createdEvent,
                req.userInfo?.email || req.body.organizer_email,
                req.userInfo?.name || 'SOCIO Organiser'
              );
              console.log(`✅ Pushed event "${title}" to UniversityGated`);
            } catch (gatedError) {
              console.error(`❌ Failed to push event to Gated:`, gatedError.message);
            }
          }
        }).catch((err) => {
          console.error('❌ Error checking Gated push eligibility:', err.message);
        });
      }

      let responseMessage = "Event created successfully";
      if (queueTeacherApproval && primaryApprovalRequest) {
        responseMessage = "Event submitted successfully and routed to Organizer Teacher approval";
      } else if (pendingDeanApproval || pendingHodApproval) {
        const primaryApproverLabel = pendingHodApproval ? "HOD" : "Dean";
        responseMessage = pendingCfoApproval
          ? `Event submitted successfully and routed to ${primaryApproverLabel} and CFO approvals`
          : `Event submitted successfully and routed to ${primaryApproverLabel} approval`;
      } else if (!canGoLiveNow && (serviceWorkflow.createdCount || 0) > 0) {
        responseMessage = "Event submitted successfully and routed for service approvals";
      }

      return res.status(201).json({ 
        message: responseMessage,
        event_id,
        created_by: req.userInfo.email,
        pending_teacher_review: queueTeacherApproval && Boolean(primaryApprovalRequest),
        pending_dean_review: pendingDeanApproval,
        pending_hod_review: pendingHodApproval,
        pending_cfo_review: pendingCfoApproval,
        approval_request_id: primaryApprovalRequest?.request_id || null,
        pending_service_approvals: serviceWorkflow.createdCount || 0,
        pending_service_roles: serviceWorkflow.requestedRoleCodes || [],
        activation_state: activationState,
        lifecycle_status: normalizeEventLifecycleStatus(createdEventRecord),
        is_live: canGoLiveNow,
      });

    } catch (error) {
      console.error("❌ Server error POST /api/events:", error);
      console.error("🔴 Detailed error info:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBodyKeys: Object.keys(req.body || {}),
        userId: req.userId,
        userEmail: req.userInfo?.email,
        isOrganiser: req.userInfo?.is_organiser
      });
      
      // Clean up uploaded files on error
      try {
        for (const [key, filePath] of Object.entries(uploadedFilePaths)) {
          if (filePath) {
            await deleteFileFromLocal(getPathFromStorageUrl(filePath, `event-${key}s`), `event-${key}s`);
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }

      // Return detailed error information
      let errorDetail = error.message || "Unknown error occurred";

      const statusCode = Number(error?.statusCode || error?.status);
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({
          error: errorDetail,
          details: errorDetail,
          context: {
            endpoint: "/api/events",
            method: "POST",
            userId: req.userId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      // Truncate stack trace for response
      const stackLines = (error.stack || "").split("\n").slice(0, 3).join(" | ");
      
      return res.status(500).json({ 
        error: "Internal server error while creating event",
        details: errorDetail,
        context: {
          endpoint: "/api/events",
          method: "POST",
          userId: req.userId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// PATCH archive/unarchive event - REQUIRES AUTHENTICATION + OWNERSHIP OR MASTER ADMIN
router.patch(
  "/:eventId/archive",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    if (req.userInfo?.is_masteradmin || req.userInfo?.is_organiser) {
      return next();
    }
    return res.status(403).json({ error: "Access denied: Organiser privileges required" });
  },
  requireOwnership("events", "eventId", "auth_uuid"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const rawArchiveValue = req.body?.archive;
      const shouldArchive =
        rawArchiveValue === true || rawArchiveValue === "true" || rawArchiveValue === 1 || rawArchiveValue === "1";
      const shouldUnarchive =
        rawArchiveValue === false || rawArchiveValue === "false" || rawArchiveValue === 0 || rawArchiveValue === "0";

      if (!shouldArchive && !shouldUnarchive) {
        return res.status(400).json({
          error: "Invalid payload: 'archive' must be a boolean (true or false).",
        });
      }

      const archiveValue = shouldArchive;
      const nowIso = new Date().toISOString();
      const buildArchivePayload = (includeArchivedBy = true) => ({
        is_archived: archiveValue,
        archived_at: archiveValue ? nowIso : null,
        ...(includeArchivedBy
          ? {
              archived_by: archiveValue
                ? req.userInfo?.email || req.userId || null
                : MANUAL_UNARCHIVE_OVERRIDE,
            }
          : {}),
        updated_at: nowIso,
      });

      let updatedRows;
      try {
        updatedRows = await update("events", buildArchivePayload(true), { event_id: eventId });
      } catch (error) {
        const code = String(error?.code || "");
        const message = String(error?.message || "").toLowerCase();
        const missingArchivedByColumn = code === "42703" && message.includes("archived_by");

        if (!missingArchivedByColumn) {
          throw error;
        }

        console.warn("[Archive] 'archived_by' column missing; retrying archive update without it.");
        updatedRows = await update("events", buildArchivePayload(false), { event_id: eventId });
      }

      if (!updatedRows || updatedRows.length === 0) {
        return res.status(404).json({ error: "Event not found." });
      }

      const updatedEvent = updatedRows[0];
      const archiveState = deriveArchiveState(updatedEvent);

      return res.status(200).json({
        message: archiveValue ? "Event archived successfully." : "Event restored successfully.",
        event: {
          ...updatedEvent,
          fest: updatedEvent.fest_id || null, // Map fest_id to fest for frontend compatibility
          ...archiveState,
        },
      });
    } catch (error) {
      if (isMissingArchiveColumnsError(error)) {
        return res.status(500).json({
          error: "Archive columns are missing. Run latest DB migrations and retry.",
        });
      }

      console.error("Server error PATCH /api/events/:eventId/archive:", error);
      return res.status(500).json({ error: "Internal server error while updating archive state." });
    }
  }
);

// PUT update event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.put(
  "/:eventId",
  multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('events', 'eventId', 'auth_uuid'),  // Check ownership using auth_uuid (master admin bypass built-in)
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const event = req.resource; // Existing event from middleware
      const files = req.files;
      
      // DEBUG: Log what we received
      console.log("=== PUT EVENT RECEIVED ===");
      console.log("req.body:", JSON.stringify(req.body, null, 2));
      console.log("req.body.title:", req.body.title);
      console.log("typeof req.body.title:", typeof req.body.title);
      console.log("files:", files ? Object.keys(files) : "no files");
      console.log("=== END ===");
      
      const uploadedFilePaths = {
        image: event.event_image_url,
        banner: event.banner_url,
        pdf: event.pdf_url,
      };

      console.log("📁 Initial file paths from existing event:");
      console.log(`  image: ${uploadedFilePaths.image}`);
      console.log(`  banner: ${uploadedFilePaths.banner}`);
      console.log(`  pdf: ${uploadedFilePaths.pdf}`);

      // Handle file uploads if new files are provided
      try {
        if (files?.eventImage && files.eventImage[0]) {
          console.log(`📤 Uploading new event image: ${files.eventImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.eventImage[0], "event-images", eventId);
          if (result?.publicUrl) {
            console.log(`✅ Event image uploaded successfully: ${result.publicUrl}`);
            uploadedFilePaths.image = result.publicUrl;
          } else {
            console.warn(`⚠️ Event image upload returned no URL - keeping existing image`);
          }
        } else if (req.body.removeImageFile === "true") {
          console.log(`🗑️ Event image removal requested.`);
          uploadedFilePaths.image = null;
        }

        if (files?.bannerImage && files.bannerImage[0]) {
          console.log(`📤 Uploading new banner image: ${files.bannerImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", eventId);
          if (result?.publicUrl) {
            console.log(`✅ Banner image uploaded successfully: ${result.publicUrl}`);
            uploadedFilePaths.banner = result.publicUrl;
          } else {
            console.warn(`⚠️ Banner image upload returned no URL - keeping existing banner`);
          }
        } else if (req.body.removeBannerFile === "true") {
          console.log(`🗑️ Banner image removal requested.`);
          uploadedFilePaths.banner = null;
        }
        
        if (files?.pdfFile && files.pdfFile[0]) {
          console.log(`📤 Uploading new PDF: ${files.pdfFile[0].originalname}`);
          const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", eventId);
          if (result?.publicUrl) {
            console.log(`✅ PDF uploaded successfully: ${result.publicUrl}`);
            uploadedFilePaths.pdf = result.publicUrl;
          } else {
            console.warn(`⚠️ PDF upload returned no URL - keeping existing PDF`);
          }
        } else if (req.body.removePdfFile === "true") {
          console.log(`🗑️ PDF removal requested.`);
          uploadedFilePaths.pdf = null;
        }
      } catch (fileError) {
        console.error("❌ File upload error during event update:", fileError.message);
        throw fileError; // Re-throw to be caught by main try-catch
      }

      console.log("📁 Updated file paths after upload:");
      console.log(`  image: ${uploadedFilePaths.image}`);
      console.log(`  banner: ${uploadedFilePaths.banner}`);
      console.log(`  pdf: ${uploadedFilePaths.pdf}`);

      const {
        title,
        description,
        event_date,
        event_time,
        venue,
        category,
        claims_applicable,
        registration_fee,
        organizing_school,
        organizing_dept,
        fest,
        fest_id,
        department_access,
        rules,
        schedule,
        prizes,
        max_participants,
        send_notifications,
        is_draft,
        is_archived,
        save_as_draft
      } = req.body;

      const userIsMasterAdmin = isMasterAdminUser(req.userInfo);
      const userIsOrganizerTeacher = isOrganizerTeacherUser(req.userInfo);
      const userIsOrganizerStudentOnly = isOrganizerStudentOnlyUser(req.userInfo);
      const normalizedFestReference = normalizeFestReference(fest_id ?? fest);

      const rawArchivePreference =
        is_archived !== undefined && is_archived !== null && String(is_archived).trim() !== ""
          ? is_archived
          : undefined;
      const hasArchivePreference =
        rawArchivePreference !== undefined &&
        rawArchivePreference !== null &&
        String(rawArchivePreference).trim() !== "";
      const shouldArchiveFromRequest = asBoolean(rawArchivePreference);
      const rawDraftPreference =
        is_draft !== undefined && is_draft !== null && String(is_draft).trim() !== ""
          ? is_draft
          : save_as_draft;
      const hasDraftPreference =
        rawDraftPreference !== undefined &&
        rawDraftPreference !== null &&
        String(rawDraftPreference).trim() !== "";
      const shouldDraftFromRequest = asBoolean(rawDraftPreference);
      const hasExplicitNotificationPreference =
        send_notifications !== undefined &&
        send_notifications !== null &&
        String(send_notifications).trim() !== "";
      const wasDraftBeforeUpdate = asBoolean(event?.is_draft);
      const currentLifecycleStatus = normalizeEventLifecycleStatus(
        event,
        wasDraftBeforeUpdate ? LIFECYCLE_STATUS.DRAFT : undefined
      );
      const wantsPublishIntent = hasDraftPreference && !shouldDraftFromRequest;
      const isApprovalResubmissionIntent =
        wantsPublishIntent &&
        (currentLifecycleStatus === LIFECYCLE_STATUS.DRAFT ||
          currentLifecycleStatus === LIFECYCLE_STATUS.REVISION_REQUESTED);
      const isApprovedLifecyclePublishIntent =
        wantsPublishIntent && currentLifecycleStatus === LIFECYCLE_STATUS.APPROVED;
      const isPendingLifecyclePublishIntent =
        wantsPublishIntent &&
        currentLifecycleStatus === LIFECYCLE_STATUS.PENDING_APPROVALS;
      const isPublishTransition =
        isApprovalResubmissionIntent || isApprovedLifecyclePublishIntent;
      let shouldSendPublishNotifications =
        wantsPublishIntent &&
        (hasExplicitNotificationPreference ? asBoolean(send_notifications) : true);
      const parsedRegistrationFee = parseOptionalFloat(registration_fee);
      const claimsApplicable =
        claims_applicable === "true" || claims_applicable === true;
      const noFinancialRequirementsRequested = eventHasNoFinancialRequirements({
        ...event,
        ...req.body,
      });
      const isStandaloneBudgetRelated = isBudgetRelatedFromEventPayload({
        claimsApplicable,
        registrationFee: parsedRegistrationFee,
        noFinancialRequirements: noFinancialRequirementsRequested,
      });
      const organizerEmailInput = normalizeSingleStringField(req.body.organizer_email || "");
      const resolvedOrganizerEmail = normalizeEmailAddress(
        organizerEmailInput || event?.organizer_email || req.userInfo?.email || ""
      );

      if (!resolvedOrganizerEmail) {
        return res.status(400).json({
          error: "Organizer contact email is required.",
        });
      }

      if (resolvedOrganizerEmail.length > ORGANIZER_EMAIL_MAX_LENGTH) {
        return res.status(400).json({
          error: "Organizer contact email must be 100 characters or fewer.",
        });
      }

      if (!isValidEmailAddress(resolvedOrganizerEmail)) {
        return res.status(400).json({
          error: "Please provide a valid organizer contact email.",
        });
      }

      // ─── AUTO-UNARCHIVE LOGIC ───────────────────────────────────────────
      // If an event was auto-archived (date passed) but then the date is changed
      // to a future date, automatically unarchive it
      const newEventDate = getValidDate(event_date || req.body.end_date);
      const isDateChangedToFuture = newEventDate && newEventDate > getTodayStart();
      const wasAutoArchivedBySystem = asBoolean(event?.is_archived) && 
        (event?.archived_by?.includes("system:auto_end_date") || !event?.archived_by);
      const shouldAutoUnarchive = isDateChangedToFuture && wasAutoArchivedBySystem && asBoolean(event?.is_archived);
      
      if (shouldAutoUnarchive) {
        console.log(`[AutoUnarchive] Event ${eventId} date changed to future (${event_date}). Auto-unarchiving.`);
      }

      if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and must be a non-empty string." });
      }

      // Check if title changed and generate new event_id
      let newEventId = eventId; // Default to current ID
      const titleChanged = title.trim() !== event.title;
      
      if (titleChanged) {
        // Generate new slug-based ID from new title
        newEventId = title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");
        
        if (!newEventId) {
          newEventId = uuidv4().replace(/-/g, "");
        }
        
        // Check if new event_id already exists (and it's not the same event)
        if (newEventId !== eventId) {
          const existingEvent = await queryOne("events", { where: { event_id: newEventId } });
          if (existingEvent) {
            return res.status(400).json({ 
              error: `An event with the ID '${newEventId}' already exists. Please use a different title.` 
            });
          }
        }
        
        console.log(`Title changed: Updating event_id from '${eventId}' to '${newEventId}'`);
      }

      // Parse JSON fields
      const parsedDepartmentAccess = parseJsonField(department_access, []);
      const parsedRules = parseJsonField(rules, []);
      const parsedSchedule = parseJsonField(schedule, []);
      const parsedPrizes = parseJsonField(prizes, []);
      const parsedCustomFields = parseJsonField(req.body.custom_fields, []);
      const organizingSchool = normalizeSingleStringField(
        organizing_school || req.body.organizingSchool || event.organizing_school || ""
      );
      const campusHostedAt = normalizeSingleStringField(
        req.body.campus_hosted_at || req.body.campusHostedAt || ""
      );
      const parsedAllowedCampuses = normalizeStringListField(
        req.body.allowed_campuses
      );
      const additionalRequestsValidation = validateAdditionalRequestsPayload({
        additionalRequestsRaw: req.body.additional_requests,
        hasFestSelected: Boolean(normalizedFestReference),
        eventDate: event_date || event?.event_date || null,
        endDate:
          req.body.end_date ||
          event?.end_date ||
          event_date ||
          event?.event_date ||
          null,
      });

      if (Object.keys(additionalRequestsValidation.fieldErrors).length > 0) {
        return res.status(400).json({
          error: "Additional request validation failed.",
          fieldErrors: additionalRequestsValidation.fieldErrors,
        });
      }

      if (additionalRequestsValidation.venueBooking) {
        const conflict = await findVenueConflict({
          venueBooking: additionalRequestsValidation.venueBooking,
          ignoreEventId: eventId,
        });

        if (conflict) {
          const conflictMessage = `This venue is already booked from ${conflict.startTime} to ${conflict.endTime}. Please choose a different time slot or venue.`;
          return res.status(409).json({
            error: conflictMessage,
            code: "VENUE_TIME_CONFLICT",
            fieldErrors: {
              "additionalRequests.venue.selectedVenue": conflictMessage,
              "additionalRequests.venue.customVenue": conflictMessage,
              "additionalRequests.venue.startTime": conflictMessage,
              "additionalRequests.venue.endTime": conflictMessage,
            },
            conflict: {
              event_id: conflict.eventId,
              start_time: conflict.startTime,
              end_time: conflict.endTime,
            },
          });
        }
      }

      if (!campusHostedAt) {
        return res.status(400).json({
          error: "Campus hosted at is required.",
        });
      }

      if (!Array.isArray(parsedAllowedCampuses) || parsedAllowedCampuses.length === 0) {
        return res.status(400).json({
          error: "At least one allowed campus is required.",
        });
      }

      if (!organizingSchool) {
        return res.status(400).json({
          error: "Organizing school is required.",
        });
      }

      let parentFest = null;
      let childFestApproved = false;

      if (normalizedFestReference) {
        parentFest = await queryFestById(normalizedFestReference);

        if (!parentFest) {
          return res.status(404).json({
            error: "Selected parent fest was not found.",
          });
        }

        childFestApproved = isFestApprovedForChildEvent(parentFest);
      }

      if (userIsOrganizerStudentOnly && !normalizedFestReference) {
        return res.status(403).json({
          error: "Organizer Student can only update events under an approved fest.",
        });
      }

      if (userIsOrganizerStudentOnly && !childFestApproved) {
        return res.status(403).json({
          error: "Organizer Student can only update events under an approved fest.",
        });
      }

      if (wantsPublishIntent && normalizedFestReference && !childFestApproved) {
        return res.status(403).json({
          error: "Events can be published under a fest only after the parent fest is approved.",
        });
      }

      if (isPendingLifecyclePublishIntent) {
        return res.status(403).json(
          getIncompleteApprovalErrorPayload("Approvals are still pending")
        );
      }

      // Prepare update payload
      // Note: Only include event_id if it's NOT changing (to avoid primary key update issues)
      const archiveOverridePayload = hasArchivePreference
        ? {
            is_archived: shouldArchiveFromRequest,
            archived_at: shouldArchiveFromRequest ? new Date().toISOString() : null,
            archived_by: shouldArchiveFromRequest
              ? req.userInfo?.email || req.userId || "system:manual_archive"
              : MANUAL_UNARCHIVE_OVERRIDE,
          }
        : shouldAutoUnarchive
          ? { is_archived: false, archived_at: null, archived_by: null }
          : {};

      const previousRegistrationFee = Number(event?.registration_fee || 0);
      const nextRegistrationFee = Number(parsedRegistrationFee || 0);
      const hasBudgetIncrease =
        Number.isFinite(previousRegistrationFee) &&
        Number.isFinite(nextRegistrationFee) &&
        nextRegistrationFee > previousRegistrationFee;
      const claimsFlagRaised =
        !asBoolean(event?.claims_applicable) && claimsApplicable;
      const shouldRevertApprovedToDraft =
        !hasDraftPreference &&
        currentLifecycleStatus === LIFECYCLE_STATUS.APPROVED &&
        (hasBudgetIncrease || claimsFlagRaised);

      let draftOverridePayload = {};

      if (hasDraftPreference && shouldDraftFromRequest) {
        draftOverridePayload = {
          is_draft: true,
          status: LIFECYCLE_STATUS.DRAFT,
          is_archived: false,
          archived_at: null,
          archived_by: null,
        };
      }

      if (hasDraftPreference && wantsPublishIntent && wasDraftBeforeUpdate) {
        draftOverridePayload = {
          ...draftOverridePayload,
          is_archived: false,
          archived_at: null,
          archived_by: null,
        };
      }

      if (shouldRevertApprovedToDraft) {
        draftOverridePayload = {
          ...draftOverridePayload,
          is_draft: true,
          status: LIFECYCLE_STATUS.DRAFT,
          approval_state: "PENDING",
          activation_state: "PENDING",
          approval_request_id: null,
          approved_at: null,
          approved_by: null,
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        };
      }

      const updateData = {
        title: title.trim(),
        description: description || null,
        event_date: event_date || null,
        event_time: event_time || null,
        end_date: req.body.end_date || null,
        venue: venue || null,
        category: category || null,
        department_access: parsedDepartmentAccess,
        claims_applicable: claimsApplicable,
        registration_fee: parsedRegistrationFee,
        participants_per_team: parseOptionalInt(max_participants, 1),
        event_image_url: uploadedFilePaths.image,
        banner_url: uploadedFilePaths.banner,
        pdf_url: uploadedFilePaths.pdf,
        rules: parsedRules,
        schedule: parsedSchedule,
        prizes: parsedPrizes,
        custom_fields: parsedCustomFields,
        organizer_email: resolvedOrganizerEmail,
        organizer_phone: req.body.organizer_phone || null,
        whatsapp_invite_link: req.body.whatsapp_invite_link || null,
        organizing_school: organizingSchool,
        organizing_dept: organizing_dept || null,
        fest_id: normalizedFestReference,
        registration_deadline: req.body.registration_deadline || null,
        // Preserve existing total_participants unless there is a specific admin action to modify it.
        // Include outsider-related settings so toggles persist from the client.
        allow_outsiders: req.body.allow_outsiders === "true" || req.body.allow_outsiders === true ? 1 : 0,
        on_spot: req.body.on_spot === "true" || req.body.on_spot === true ? 1 : 0,
        outsider_registration_fee: parseOptionalFloat(req.body.outsider_registration_fee || req.body.outsiderRegistrationFee, null),
        outsider_max_participants: parseOptionalInt(req.body.outsider_max_participants || req.body.outsiderMaxParticipants, null),
        campus_hosted_at: campusHostedAt,
        allowed_campuses: parsedAllowedCampuses,
        min_participants: parseOptionalInt(req.body.min_participants || req.body.minParticipants, 1),
        additional_requests: additionalRequestsValidation.additionalRequests,
        updated_at: new Date().toISOString(),
        ...archiveOverridePayload,
        ...draftOverridePayload
      };

      console.log("🔄 UPDATE DATA - File URLs being saved to database:");
      console.log(`  event_image_url: ${updateData.event_image_url}`);
      console.log(`  banner_url: ${updateData.banner_url}`);
      console.log(`  pdf_url: ${updateData.pdf_url}`);

      // If event_id changed, update related records first
      if (newEventId !== eventId) {
        try {
          // Update registrations to point to new event_id
          await update("registrations", { event_id: newEventId }, { event_id: eventId });
          console.log(`Updated registrations from event_id '${eventId}' to '${newEventId}'`);
        } catch (regError) {
          console.log(`No registrations to update or error: ${regError.message}`);
        }
        
        try {
          // Update attendance_status to point to new event_id
          await update("attendance_status", { event_id: newEventId }, { event_id: eventId });
          console.log(`Updated attendance_status from event_id '${eventId}' to '${newEventId}'`);
        } catch (attError) {
          console.log(`No attendance records to update or error: ${attError.message}`);
        }
        
        try {
          // Update notifications: event_id, event_title, and action_url so links stay valid
          await update("notifications", { 
            event_id: newEventId, 
            event_title: title.trim(),
            action_url: `/event/${newEventId}` 
          }, { event_id: eventId });
          console.log(`Updated notifications from event_id '${eventId}' to '${newEventId}'`);
        } catch (notifError) {
          console.log(`No notifications to update or error: ${notifError.message}`);
        }
      }

      let updated;
      try {
        updated = await update("events", updateData, { event_id: eventId });
      } catch (updateError) {
        const fallbackColumnsToDrop = [];

        if (isMissingAdditionalRequestsColumnError(updateError)) {
          fallbackColumnsToDrop.push("additional_requests");
        }

        [
          "status",
          "approval_state",
          "activation_state",
          "approval_request_id",
          "approved_at",
          "approved_by",
          "rejected_at",
          "rejected_by",
          "rejection_reason",
        ].forEach((columnName) => {
          if (isMissingColumnError(updateError, columnName)) {
            fallbackColumnsToDrop.push(columnName);
          }
        });

        if (fallbackColumnsToDrop.length === 0) {
          throw updateError;
        }

        console.warn(
          `[EventUpdate] Missing optional columns (${fallbackColumnsToDrop.join(", ")}); retrying update without unsupported payload fields.`
        );
        const fallbackUpdateData = {
          ...updateData,
        };
        fallbackColumnsToDrop.forEach((columnName) => {
          delete fallbackUpdateData[columnName];
        });
        updated = await update("events", fallbackUpdateData, { event_id: eventId });
      }

      const notifyPublishIfNeeded = (eventRecord) => {
        if (!shouldSendPublishNotifications) {
          return;
        }

        const eventTitle = eventRecord?.title || title.trim() || "An event";
        const publishedEventId = eventRecord?.event_id || newEventId || eventId;
        sendBroadcastNotification({
          title: "Event Published",
          message: `${eventTitle} is now live! Check it out.`,
          type: "info",
          event_id: publishedEventId,
          event_title: eventTitle,
          action_url: `/event/${publishedEventId}`,
        })
          .then(() => {
            console.log(
              `✅ Sent publish notifications for updated event: ${eventTitle}`
            );
          })
          .catch((notifError) => {
            console.error(
              "❌ Failed to send publish notifications during update:",
              notifError
            );
          });
      };

      console.log("💾 Database update result:");
      if (updated && updated.length > 0) {
        console.log(`✅ Event updated successfully`);
        console.log(`  Saved image URL: ${updated[0].event_image_url}`);
        console.log(`  Saved banner URL: ${updated[0].banner_url}`);
        console.log(`  Saved PDF URL: ${updated[0].pdf_url}`);
      }

      let updatedEvent = Array.isArray(updated) ? updated[0] : null;
      if (!updatedEvent) {
        console.warn("⚠️ Update query returned no data, fetching event from database...");
        updatedEvent = await queryOne("events", { where: { event_id: newEventId || eventId } });
      }

      if (!updatedEvent) {
        throw new Error("Event update failed - could not verify update");
      }

      let activationState = resolveActivationState(
        updatedEvent?.approval_state,
        updatedEvent?.service_approval_state
      );
      let workflowApprovalRequest = null;
      let pendingDeanApproval = false;
      let pendingHodApproval = false;
      let pendingCfoApproval = false;
      let eventPublishedNow = false;

      if (isApprovalResubmissionIntent) {
        const isStandalonePublish = !normalizedFestReference;
        let nextApprovalState = normalizeWorkflowStatus(updatedEvent?.approval_state, "APPROVED");
        let nextServiceState = normalizeWorkflowStatus(updatedEvent?.service_approval_state, "APPROVED");
        let standaloneBudgetRelated = false;

        if (userIsOrganizerStudentOnly && normalizedFestReference && childFestApproved) {
          workflowApprovalRequest = await createTeacherApprovalRequestForChildEvent({
            eventRecord: updatedEvent,
            userInfo: req.userInfo,
          });

          if (workflowApprovalRequest) {
            nextApprovalState = "UNDER_REVIEW";
          }
        } else if (isStandalonePublish) {
          standaloneBudgetRelated = isStandaloneBudgetRelated;

          workflowApprovalRequest = await createStandaloneApprovalRequestForEvent({
            eventRecord: updatedEvent,
            userInfo: req.userInfo,
            isBudgetRelated: standaloneBudgetRelated,
          });

          if (workflowApprovalRequest) {
            nextApprovalState = "UNDER_REVIEW";
            const primaryRoleCode = normalizeWorkflowStatus(
              workflowApprovalRequest?.primary_role_code,
              ROLE_CODES.DEAN
            );
            pendingDeanApproval = primaryRoleCode === ROLE_CODES.DEAN;
            pendingHodApproval = primaryRoleCode === ROLE_CODES.HOD;
            pendingCfoApproval = Boolean(standaloneBudgetRelated);
          }
        }

        const serviceWorkflowOnPublish = await createServiceRequestsForEvent({
          eventRecord: updatedEvent,
          userInfo: req.userInfo,
          approvalRequestId:
            workflowApprovalRequest?.id || updatedEvent?.approval_request_id || null,
        });

        if ((serviceWorkflowOnPublish.requestedRoleCodes || []).length > 0) {
          nextServiceState = "PENDING";
        }

        const hasWorkflowToAwait =
          Boolean(workflowApprovalRequest) ||
          (serviceWorkflowOnPublish.requestedRoleCodes || []).length > 0;

        if (hasWorkflowToAwait) {
          const workflowResult = await applyEventWorkflowState({
            eventId: String(updatedEvent?.event_id || newEventId || eventId),
            approvalState: nextApprovalState,
            serviceApprovalState: nextServiceState,
            approvalRequestId:
              workflowApprovalRequest?.id || updatedEvent?.approval_request_id || null,
            isBudgetRelated: isStandalonePublish ? standaloneBudgetRelated : false,
            lifecycleStatus: LIFECYCLE_STATUS.PENDING_APPROVALS,
          });

          activationState = workflowResult.activationState;
          shouldSendPublishNotifications = false;

          if (workflowResult.applied) {
            const refreshedEvent = await queryOne("events", {
              where: { event_id: String(updatedEvent?.event_id || newEventId || eventId) },
            });

            if (refreshedEvent) {
              updatedEvent = refreshedEvent;
            }
          }
        } else {
          const publishResult = await applyEventWorkflowState({
            eventId: String(updatedEvent?.event_id || newEventId || eventId),
            approvalState: "APPROVED",
            serviceApprovalState: "APPROVED",
            approvalRequestId: updatedEvent?.approval_request_id || null,
            isBudgetRelated: false,
            lifecycleStatus: LIFECYCLE_STATUS.PUBLISHED,
          });

          activationState = publishResult.activationState;
          eventPublishedNow = true;

          if (publishResult.applied) {
            const refreshedEvent = await queryOne("events", {
              where: { event_id: String(updatedEvent?.event_id || newEventId || eventId) },
            });

            if (refreshedEvent) {
              updatedEvent = refreshedEvent;
            }
          }
        }
      } else if (isApprovedLifecyclePublishIntent) {
        const publishValidation = normalizedFestReference
          ? await validateSubEventLogisticsForPublish({ eventRecord: updatedEvent })
          : await validateStandaloneApprovalChainForPublish({ eventRecord: updatedEvent });

        if (!publishValidation.ok) {
          return res.status(403).json(
            getIncompleteApprovalErrorPayload(publishValidation.reason)
          );
        }

        const publishResult = await applyEventWorkflowState({
          eventId: String(updatedEvent?.event_id || newEventId || eventId),
          approvalState: normalizeWorkflowStatus(updatedEvent?.approval_state, "APPROVED"),
          serviceApprovalState: normalizeWorkflowStatus(
            updatedEvent?.service_approval_state,
            "APPROVED"
          ),
          approvalRequestId: updatedEvent?.approval_request_id || null,
          isBudgetRelated: !normalizedFestReference ? isStandaloneBudgetRelated : undefined,
          lifecycleStatus: LIFECYCLE_STATUS.PUBLISHED,
        });

        activationState = publishResult.activationState;
        eventPublishedNow = true;

        if (publishResult.applied) {
          const refreshedEvent = await queryOne("events", {
            where: { event_id: String(updatedEvent?.event_id || newEventId || eventId) },
          });

          if (refreshedEvent) {
            updatedEvent = refreshedEvent;
          }
        }
      }

      if (!eventPublishedNow) {
        shouldSendPublishNotifications = false;
      }

      notifyPublishIfNeeded(updatedEvent);

      // Push to UniversityGated if outsiders were enabled/changed (non-blocking)
      if (isGatedEnabled() && !asBoolean(updatedEvent?.is_draft)) {
        shouldPushEventToGated(updatedEvent, queryOne).then(async (shouldPush) => {
          if (shouldPush) {
            try {
              await pushEventToGated(
                updatedEvent,
                req.userInfo?.email || req.body.organizer_email,
                req.userInfo?.name || 'SOCIO Organiser'
              );
              console.log(`✅ Pushed updated event "${updatedEvent.title}" to UniversityGated`);
            } catch (gatedError) {
              console.error(`❌ Failed to push updated event to Gated:`, gatedError.message);
            }
          }
        }).catch((err) => {
          console.error('❌ Error checking Gated push eligibility on update:', err.message);
        });
      }

      let responseMessage = "Event updated successfully";
      if (shouldRevertApprovedToDraft) {
        responseMessage =
          "Budget-related changes detected. Event moved back to draft for resubmission.";
      } else if (hasDraftPreference && shouldDraftFromRequest) {
        responseMessage = "Event saved as draft successfully";
      } else if (isApprovalResubmissionIntent && (pendingDeanApproval || pendingHodApproval)) {
        const primaryApproverLabel = pendingHodApproval ? "HOD" : "Dean";
        responseMessage = pendingCfoApproval
          ? `Event submitted successfully and routed to ${primaryApproverLabel} and CFO approvals`
          : `Event submitted successfully and routed to ${primaryApproverLabel} approval`;
      } else if (isApprovalResubmissionIntent && !eventPublishedNow) {
        responseMessage = "Event submitted successfully and routed for approval";
      } else if (eventPublishedNow) {
        responseMessage = "Event published successfully";
      }

      const lifecycleStatus = normalizeEventLifecycleStatus(updatedEvent, currentLifecycleStatus);

      return res.status(200).json({ 
        message: responseMessage,
        event: updatedEvent,
        event_id: newEventId,
        id_changed: newEventId !== eventId,
        activation_state: activationState,
        lifecycle_status: lifecycleStatus,
        pending_dean_review: pendingDeanApproval,
        pending_hod_review: pendingHodApproval,
        pending_cfo_review: pendingCfoApproval,
        approval_request_id: workflowApprovalRequest?.request_id || null,
        is_live:
          activationState === "ACTIVE" &&
          !asBoolean(updatedEvent?.is_draft) &&
          lifecycleStatus === LIFECYCLE_STATUS.PUBLISHED,
      });

    } catch (error) {
      console.error("❌ Server error PUT /api/events/:eventId:", error);
      console.error("🔴 Detailed error info:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBodyKeys: Object.keys(req.body || {}),
        userId: req.userId,
        userEmail: req.userInfo?.email,
        isOrganiser: req.userInfo?.is_organiser,
        eventId: req.params.eventId,
        supabaseError: error.status || error.statusCode || "N/A",
        errorType: error.constructor.name
      });
      
      // More detailed logging for debugging
      if (error.message && error.message.includes('Supabase')) {
        console.error("🔴 Supabase-specific error detected - checking connectivity...");
      }

      const statusCode = Number(error?.statusCode || error?.status);
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({
          error: error.message,
          details: error.message,
          context: {
            endpoint: `/api/events/${req.params.eventId}`,
            method: "PUT",
            userId: req.userId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      return res.status(500).json({ 
        error: "Internal server error while updating event.",
        details: error.message,
        context: {
          endpoint: `/api/events/${req.params.eventId}`,
          method: "PUT",
          userId: req.userId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// POST publish event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.post(
  "/:eventId/publish",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership("events", "eventId", "auth_uuid"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const eventRecord = req.resource;

      if (!eventRecord) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (asBoolean(eventRecord?.is_archived)) {
        return res.status(400).json({
          error: "Archived events cannot be published. Unarchive before publishing.",
        });
      }

      const lifecycleStatus = normalizeEventLifecycleStatus(eventRecord);
      if (lifecycleStatus === LIFECYCLE_STATUS.PUBLISHED && !asBoolean(eventRecord?.is_draft)) {
        return res.status(200).json({
          message: "Event is already published",
          event: eventRecord,
          lifecycle_status: lifecycleStatus,
          activation_state: normalizeWorkflowStatus(eventRecord?.activation_state, "ACTIVE"),
          is_live: true,
        });
      }

      if (lifecycleStatus === LIFECYCLE_STATUS.PENDING_APPROVALS) {
        return res.status(403).json(
          getIncompleteApprovalErrorPayload("Approvals are still pending")
        );
      }

      const normalizedFestId = normalizeFestReference(eventRecord?.fest_id);
      let publishValidation;

      if (normalizedFestId) {
        const parentFest = await queryFestById(normalizedFestId);
        if (!parentFest || !isFestApprovedForChildEvent(parentFest)) {
          return res.status(403).json(
            getIncompleteApprovalErrorPayload(
              "Parent fest must be approved before publishing this event"
            )
          );
        }

        publishValidation = await validateSubEventLogisticsForPublish({
          eventRecord,
        });
      } else {
        publishValidation = await validateStandaloneApprovalChainForPublish({
          eventRecord,
        });
      }

      if (!publishValidation.ok) {
        return res.status(403).json(
          getIncompleteApprovalErrorPayload(publishValidation.reason)
        );
      }

      await applyEventWorkflowState({
        eventId,
        approvalState: normalizeWorkflowStatus(eventRecord?.approval_state, "APPROVED"),
        serviceApprovalState: normalizeWorkflowStatus(
          eventRecord?.service_approval_state,
          "APPROVED"
        ),
        approvalRequestId: eventRecord?.approval_request_id || null,
        isBudgetRelated: !normalizedFestId
          ? isBudgetRelatedFromEventPayload({
              claimsApplicable: eventRecord?.claims_applicable,
              registrationFee: eventRecord?.registration_fee,
              noFinancialRequirements: eventHasNoFinancialRequirements(eventRecord),
            })
          : undefined,
        lifecycleStatus: LIFECYCLE_STATUS.PUBLISHED,
      });

      const refreshedEvent =
        (await queryOne("events", { where: { event_id: eventId } })) || eventRecord;
      const shouldSendNotifications = req.body?.send_notifications !== false;

      if (shouldSendNotifications) {
        sendBroadcastNotification({
          title: "Event Published",
          message: `${refreshedEvent?.title || "An event"} is now live! Check it out.",
          type: "info",
          event_id: eventId,
          event_title: refreshedEvent?.title || null,
          action_url: `/event/${eventId}`,
        }).catch((notifError) => {
          console.error("❌ Failed to send publish notifications:", notifError);
        });
      }

      if (isGatedEnabled() && !asBoolean(refreshedEvent?.is_draft)) {
        shouldPushEventToGated(refreshedEvent, queryOne)
          .then(async (shouldPush) => {
            if (!shouldPush) return;

            try {
              await pushEventToGated(
                refreshedEvent,
                req.userInfo?.email || refreshedEvent?.organizer_email,
                req.userInfo?.name || "SOCIO Organiser"
              );
            } catch (gatedError) {
              console.error("❌ Failed to push published event to Gated:", gatedError.message);
            }
          })
          .catch((gatedError) => {
            console.error("❌ Failed to evaluate Gated sync for published event:", gatedError.message);
          });
      }

      const resolvedActivationState = normalizeWorkflowStatus(
        refreshedEvent?.activation_state,
        "ACTIVE"
      );

      return res.status(200).json({
        message: "Event published successfully",
        event: refreshedEvent,
        lifecycle_status: normalizeEventLifecycleStatus(
          refreshedEvent,
          LIFECYCLE_STATUS.PUBLISHED
        ),
        activation_state: resolvedActivationState,
        is_live: resolvedActivationState === "ACTIVE" && !asBoolean(refreshedEvent?.is_draft),
      });
    } catch (error) {
      console.error("Server error POST /api/events/:eventId/publish:", error);
      return res.status(500).json({
        error: "Internal server error while publishing event.",
      });
    }
  }
);

// DELETE event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES  
router.delete(
  "/:eventId", 
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('events', 'eventId', 'auth_uuid'),  // Master admin bypass built-in
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const event = req.resource; // From ownership middleware

      // Delete associated files
      const filesToDelete = [
        { url: event.event_image_url, bucket: "event-images" },
        { url: event.banner_url, bucket: "event-banners" },
        { url: event.pdf_url, bucket: "event-pdfs" }
      ];

      for (const fileInfo of filesToDelete) {
        if (fileInfo.url) {
          const filePath = getPathFromStorageUrl(fileInfo.url, fileInfo.bucket);
          if (filePath) {
            await deleteFileFromLocal(filePath, fileInfo.bucket);
          }
        }
      }

      await remove("attendance_status", { event_id: eventId });
      await remove("registrations", { event_id: eventId });
      const deleted = await remove("events", { event_id: eventId });

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ error: "Event not found or already deleted." });
      }

      return res.status(200).json({ 
        message: "Event deleted successfully",
        deleted_by: req.userInfo.email 
      });

    } catch (error) {
      console.error("Server error DELETE /api/events/:eventId:", error);
      return res.status(500).json({ error: "Internal server error while deleting event." });
    }
  }
);

export default router;