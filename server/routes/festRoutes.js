import express from "express";
import { getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { v4 as uuidv4 } from "uuid";
import { queryAll, queryOne, insert, update, remove } from "../config/database.js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership,
  optionalAuth
} from "../middleware/authMiddleware.js";
import { sendBroadcastNotification } from "./notificationRoutes.js";
import { pushFestToGated, isGatedEnabled } from "../utils/gatedSync.js";
import { getFestTableForDatabase } from "../utils/festTableResolver.js";
import { ROLE_CODES, hasAnyRoleCode } from "../utils/roleAccessService.js";
import { resolveRoleMatrixApprover } from "../utils/roleMatrixApprover.js";
import {
  LIFECYCLE_STATUS,
  normalizeLifecycleStatus,
  shouldEntityRemainDraft,
} from "../utils/lifecycleStatus.js";
import {
  hasApprovalRequestReference,
  isRecordLiveForNotifications,
  shouldSendCreateBroadcast,
  shouldSendPublishBroadcast,
} from "../utils/notificationLifecycle.js";

const router = express.Router();

const getRoleCodes = (userInfo) =>
  Array.isArray(userInfo?.role_codes) ? userInfo.role_codes : [];

const canAccessNonPublicFests = (userInfo) => {
  const roleCodes = getRoleCodes(userInfo);

  return Boolean(
    userInfo &&
      (userInfo.is_masteradmin ||
        userInfo.is_organiser ||
        userInfo.is_organiser_student ||
        userInfo.is_organiser_teacher ||
        hasAnyRoleCode(roleCodes, [
          ROLE_CODES.MASTER_ADMIN,
          ROLE_CODES.ORGANIZER_TEACHER,
          ROLE_CODES.ORGANIZER_STUDENT,
        ]))
  );
};

const normalizeJsonField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to parse JSON field:", error.message);
      return [];
    }
  }
  if (typeof value === "object" && value !== null) {
    return Array.isArray(value) ? value : [];
  }
  return [];
};

const pickDefined = (...values) => values.find((value) => value !== undefined);

const parseJsonLikeField = (value, fallbackValue) => {
  if (value === undefined) return undefined;
  if (value === null) return fallbackValue;

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return fallbackValue;

    try {
      return JSON.parse(trimmedValue);
    } catch (error) {
      console.warn("Failed to parse JSON update field:", error.message);
      return fallbackValue;
    }
  }

  return value;
};

const FEST_BUDGET_SETTINGS_KEY = "__budget_approval__";
const FEST_APPROVAL_SETTINGS_KEY = "__approval_workflow__";

const normalizeWorkflowStatus = (value, fallback = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || String(fallback || "").trim().toUpperCase();
};

const normalizeFestLifecycleStatus = (festRecord, fallback) => {
  const defaultStatus =
    fallback ||
    (asBoolean(festRecord?.is_draft)
      ? LIFECYCLE_STATUS.DRAFT
      : LIFECYCLE_STATUS.PUBLISHED);

  return normalizeLifecycleStatus(festRecord?.status, defaultStatus);
};

const isFestLiveForNotifications = (festRecord) => {
  return isRecordLiveForNotifications(festRecord);
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

const validateFestApprovalChainForPublish = async ({ festRecord }) => {
  const festId = String(festRecord?.fest_id || "").trim();
  if (!festId) {
    return { ok: false, reason: "Fest id missing" };
  }

  const approvalRequests = await queryAll("approval_requests", {
    where: {
      entity_type: "FEST",
      entity_ref: festId,
    },
    order: { column: "created_at", ascending: false },
  }).catch((error) => {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw error;
  });

  const approvalRequest = Array.isArray(approvalRequests) ? approvalRequests[0] : null;
  if (!approvalRequest) {
    return { ok: false, reason: "Approval request not found" };
  }

  if (normalizeWorkflowStatus(approvalRequest.status) !== "APPROVED") {
    return { ok: false, reason: "Approval request is not approved" };
  }

  const steps = await queryAll("approval_steps", {
    where: { approval_request_id: approvalRequest.id },
    order: { column: "sequence_order", ascending: true },
  }).catch((error) => {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw error;
  });

  const hasHodApproval = hasApprovedStepForCodes(steps, ["HOD", ROLE_CODES.HOD]);
  const hasDeanApproval = hasApprovedStepForCodes(steps, ["DEAN", ROLE_CODES.DEAN]);
  const isBudgetRelated =
    asBoolean(festRecord?.is_budget_related) ||
    extractBudgetApprovalRequirement(festRecord?.custom_fields);
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

export const extractBudgetApprovalRequirement = (customFieldsValue) => {
  const parsedCustomFields = parseJsonLikeField(customFieldsValue, []);
  if (!Array.isArray(parsedCustomFields)) {
    return false;
  }

  const budgetField = parsedCustomFields.find((field) => {
    if (!field || typeof field !== "object") {
      return false;
    }

    return String(field.key || "").trim() === FEST_BUDGET_SETTINGS_KEY;
  });

  if (!budgetField || typeof budgetField !== "object") {
    return false;
  }

  const fieldValue = budgetField.value;
  if (!fieldValue || typeof fieldValue !== "object") {
    return false;
  }

  return (
    fieldValue.requiresBudgetApproval === true ||
    String(fieldValue.requiresBudgetApproval || "").trim().toLowerCase() === "true"
  );
};

const parseBooleanWithFallback = (value, fallbackValue) => {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }

  return fallbackValue;
};

const normalizeFestApprovalWorkflow = (value) => {
  return {
    requiresHodApproval: true,
    requiresDeanApproval: true,
  };
};

const extractFestApprovalWorkflow = ({ customFieldsValue, directValue }) => {
  const parsedDirectValue = parseJsonLikeField(directValue, null);
  if (
    parsedDirectValue &&
    typeof parsedDirectValue === "object" &&
    !Array.isArray(parsedDirectValue)
  ) {
    return normalizeFestApprovalWorkflow(parsedDirectValue);
  }

  const parsedCustomFields = parseJsonLikeField(customFieldsValue, []);
  if (!Array.isArray(parsedCustomFields)) {
    return normalizeFestApprovalWorkflow(null);
  }

  const approvalField = parsedCustomFields.find((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      return false;
    }

    return String(field.key || "").trim() === FEST_APPROVAL_SETTINGS_KEY;
  });

  if (!approvalField || typeof approvalField !== "object" || Array.isArray(approvalField)) {
    return normalizeFestApprovalWorkflow(null);
  }

  return normalizeFestApprovalWorkflow(approvalField.value);
};

const formatApprovalPathLabel = ({ approvalWorkflow, isBudgetRelated }) => {
  const stages = [];

  if (approvalWorkflow?.requiresHodApproval) {
    stages.push("HOD");
  }

  if (approvalWorkflow?.requiresDeanApproval) {
    stages.push("Dean");
  }

  if (Boolean(isBudgetRelated)) {
    stages.push("CFO");
    stages.push("Accounts");
  }

  if (stages.length === 0) {
    return "approval";
  }

  if (stages.length === 1) {
    return `${stages[0]} approval`;
  }

  if (stages.length === 2) {
    return `${stages[0]} and ${stages[1]} approvals`;
  }

  return `${stages.slice(0, -1).join(", ")}, and ${stages[stages.length - 1]} approvals`;
};

export const findActiveApprovalRequestForEntity = async ({ entityType, entityRef }) => {
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
      isMissingColumnError(error) &&
      (String(error?.message || "").toLowerCase().includes("entity_type") ||
        String(error?.message || "").toLowerCase().includes("entity_ref"));

    if (isMissingRelationError(error) || missingWorkflowColumns) {
      return null;
    }

    throw error;
  }
};

export const createFestApprovalRequest = async ({
  festRecord,
  userInfo,
  isBudgetRelated,
  approvalWorkflow,
}) => {
  const festId = String(festRecord?.fest_id || "").trim();
  if (!festId) {
    return null;
  }

  const departmentScope = festRecord?.organizing_dept || null;
  const schoolScope = festRecord?.organizing_school || null;
  const campusScope =
    festRecord?.campus_hosted_at || festRecord?.department_hosted_at || null;

  const hodApprover = await resolveRoleMatrixApprover({
    roleCode: ROLE_CODES.HOD,
    department: departmentScope,
    school: schoolScope,
    campus: campusScope,
  });

  if (!hodApprover?.email) {
    const routingError = new Error(
      `No active HOD assignee is mapped for department '${departmentScope || "Unknown"}'. Contact admin.`
    );
    routingError.statusCode = 400;
    throw routingError;
  }

  const deanApprover = await resolveRoleMatrixApprover({
    roleCode: ROLE_CODES.DEAN,
    department: departmentScope,
    school: schoolScope,
    campus: campusScope,
    excludeEmail: hodApprover.email,
  });

  if (!deanApprover?.email) {
    const routingError = new Error(
      `No active Dean assignee is mapped for department '${departmentScope || "Unknown"}'. Contact admin.`
    );
    routingError.statusCode = 400;
    throw routingError;
  }

  const primaryRoleCode = ROLE_CODES.HOD;
  const primaryStepCode = "HOD";

  const existingRequest = await findActiveApprovalRequestForEntity({
    entityType: "FEST",
    entityRef: festId,
  });

  if (existingRequest) {
    return existingRequest;
  }

  try {
    const nowIso = new Date().toISOString();
    const requestPayload = {
      request_id: `APR-FEST-${festId}-${Date.now()}`,
      entity_type: "FEST",
      entity_ref: festId,
      parent_fest_ref: null,
      requested_by_user_id: userInfo?.id || null,
      requested_by_email: userInfo?.email || null,
      organizing_dept: festRecord?.organizing_dept || null,
      organizing_school: festRecord?.organizing_school || null,
      campus_hosted_at:
        festRecord?.campus_hosted_at || festRecord?.department_hosted_at || null,
      is_budget_related: Boolean(isBudgetRelated),
      status: "UNDER_REVIEW",
      submitted_at: nowIso,
    };

    let insertedRequest;
    try {
      insertedRequest = await insert("approval_requests", [requestPayload]);
    } catch (insertError) {
      if (!isMissingColumnError(insertError, "organizing_school")) {
        throw insertError;
      }

      delete requestPayload.organizing_school;
      insertedRequest = await insert("approval_requests", [requestPayload]);
    }

    const approvalRequest = insertedRequest?.[0];
    if (!approvalRequest) {
      return null;
    }

    const approvalSteps = [
      {
        approval_request_id: approvalRequest.id,
        step_code: "HOD",
        role_code: ROLE_CODES.HOD,
        step_group: 1,
        sequence_order: 1,
        required_count: 1,
        status: "PENDING",
      },
      {
        approval_request_id: approvalRequest.id,
        step_code: "DEAN",
        role_code: ROLE_CODES.DEAN,
        step_group: 2,
        sequence_order: 2,
        required_count: 1,
        status: "WAITING",
      },
    ];

    if (Boolean(isBudgetRelated)) {
      approvalSteps.push({
        approval_request_id: approvalRequest.id,
        step_code: "CFO",
        role_code: ROLE_CODES.CFO,
        step_group: 3,
        sequence_order: 3,
        required_count: 1,
        status: "WAITING",
      });

      approvalSteps.push({
        approval_request_id: approvalRequest.id,
        step_code: "ACCOUNTS",
        role_code: ROLE_CODES.ACCOUNTS,
        step_group: 4,
        sequence_order: 4,
        required_count: 1,
        status: "WAITING",
      });
    }

    await insert("approval_steps", approvalSteps);
    approvalRequest.primary_role_code = primaryRoleCode;
    approvalRequest.primary_step_code = primaryStepCode;
    return approvalRequest;
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("[FestWorkflow] Approval tables are not available yet; skipping fest approval request creation.");
      return null;
    }

    if (String(error?.code || "") === "23505") {
      return findActiveApprovalRequestForEntity({
        entityType: "FEST",
        entityRef: festId,
      });
    }

    throw error;
  }
};

export const applyFestWorkflowState = async ({ festTable, festId, approvalRequestId, isBudgetRelated }) => {
  const normalizedFestId = String(festId || "").trim();
  if (!normalizedFestId) {
    return { applied: false, activationState: "ACTIVE" };
  }

  const pendingLifecycleStatus = LIFECYCLE_STATUS.DRAFT;

  const workflowPayload = {
    approval_state: "UNDER_REVIEW",
    activation_state: "PENDING",
    approval_request_id: approvalRequestId || null,
    is_budget_related: Boolean(isBudgetRelated),
    status: pendingLifecycleStatus,
    is_draft: shouldEntityRemainDraft(pendingLifecycleStatus),
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  };

  try {
    await update(festTable, workflowPayload, { fest_id: normalizedFestId });
    return { applied: true, activationState: "PENDING" };
  } catch (error) {
    const normalizedMessage = String(error?.message || "").toLowerCase();
    const workflowColumns = [
      "approval_state",
      "activation_state",
      "approval_request_id",
      "is_budget_related",
      "status",
      "is_draft",
      "approved_at",
      "approved_by",
      "rejected_at",
      "rejected_by",
      "rejection_reason",
    ];

    const missingWorkflowColumns = workflowColumns.filter((columnName) =>
      normalizedMessage.includes(columnName)
    );

    if (isMissingColumnError(error)) {
      const fallbackWorkflowPayload = {
        ...workflowPayload,
      };

      if (missingWorkflowColumns.length > 0) {
        missingWorkflowColumns.forEach((columnName) => {
          delete fallbackWorkflowPayload[columnName];
        });
      } else {
        // Most legacy DBs miss status first; drop it as a safe fallback.
        delete fallbackWorkflowPayload.status;
      }

      if (Object.keys(fallbackWorkflowPayload).length > 0) {
        try {
          await update(festTable, fallbackWorkflowPayload, { fest_id: normalizedFestId });
          return { applied: true, activationState: "PENDING" };
        } catch (fallbackError) {
          if (!isMissingColumnError(fallbackError)) {
            throw fallbackError;
          }
        }
      }

      console.warn(
        `[FestWorkflow] Workflow columns missing on fest table (${missingWorkflowColumns.join(", ") || "unknown"}); applied fallback payload.`
      );
      return { applied: false, activationState: "PENDING" };
    }

    throw error;
  }
};

const parseComparableDate = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      parsed.setHours(0, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const asBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  (typeof value === "string" && ["true", "yes", "on"].includes(value.trim().toLowerCase()));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_REGEX = /^\+?[\d\s-]{10,14}$/;
const MAX_EMAIL_LENGTH = 100;
const CHRIST_EMAIL_DOMAIN = "@christuniversity.in";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").trim();
const isValidEmail = (value) => EMAIL_REGEX.test(normalizeEmail(value));
const isChristUniversityEmail = (value) =>
  normalizeEmail(value).endsWith(CHRIST_EMAIL_DOMAIN);

const normalizeEventHead = (head) => {
  if (typeof head === "string") {
    return {
      email: normalizeEmail(head),
      expiresAt: null,
    };
  }

  if (!head || typeof head !== "object" || Array.isArray(head)) {
    return {
      email: "",
      expiresAt: null,
    };
  }

  return {
    email: normalizeEmail(head.email),
    expiresAt: head.expiresAt || null,
  };
};

const deriveFestStatusFromDates = (
  openingDateValue,
  closingDateValue,
  fallbackStatus = "upcoming"
) => {
  const openingDate = parseComparableDate(openingDateValue);
  const closingDate = parseComparableDate(closingDateValue) || openingDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!openingDate && !closingDate) {
    return fallbackStatus;
  }

  if (openingDate && today < openingDate) {
    return "upcoming";
  }

  if (closingDate && today > closingDate) {
    return "past";
  }

  return "ongoing";
};

const isMissingColumnError = (error) => String(error?.code || "") === "42703";
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
const FEST_TABLE_CANDIDATES = ["fests", "fest"];
const resolveFestTableCandidates = (primaryTable) =>
  Array.from(new Set([primaryTable, ...FEST_TABLE_CANDIDATES].filter(Boolean)));
const normalizeFestKey = (value) => String(value || "").trim().toLowerCase();

const getMergedFestsFromCandidates = async (queryOptions, primaryTable) => {
  const tables = resolveFestTableCandidates(primaryTable);
  const festById = new Map();

  for (const tableName of tables) {
    try {
      const rows = await queryAll(tableName, queryOptions);
      for (const fest of rows || []) {
        const key = String(fest?.fest_id || "").trim();
        if (!key) continue;
        if (!festById.has(key)) {
          festById.set(key, fest);
        }
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      // Legacy table variants may not support newer filter/order columns.
      if (isMissingColumnError(error)) {
        try {
          const fallbackRows = await queryAll(tableName, { select: "*" });
          for (const fest of fallbackRows || []) {
            const key = String(fest?.fest_id || "").trim();
            if (!key) continue;
            if (!festById.has(key)) {
              festById.set(key, fest);
            }
          }
          continue;
        } catch (fallbackError) {
          if (isMissingRelationError(fallbackError) || isMissingColumnError(fallbackError)) {
            continue;
          }
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  return Array.from(festById.values());
};

const getFestByIdFromCandidates = async (festId, primaryTable) => {
  const tables = resolveFestTableCandidates(primaryTable);

  for (const tableName of tables) {
    try {
      const fest = await queryOne(tableName, { where: { fest_id: festId } });
      if (fest) {
        return fest;
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }
      throw error;
    }
  }

  return null;
};

const deriveFestsFromEvents = (events, festRegistrationCounts = {}) => {
  const derivedFestMap = new Map();
  for (const event of events || []) {
    const festKey = String(event?.fest_id || event?.fest || "").trim();
    if (!festKey) continue;

    if (!derivedFestMap.has(festKey)) {
      const eventOwnerEmail =
        event?.organizer_email || event?.organiser_email || null;
      derivedFestMap.set(festKey, {
        fest_id: festKey,
        fest_title: festKey,
        organizing_dept: event?.organizing_dept || null,
        opening_date: event?.event_date || null,
        closing_date: event?.event_date || null,
        created_at: event?.created_at || null,
        created_by: event?.created_by || eventOwnerEmail,
        contact_email: eventOwnerEmail,
        organizer_email: eventOwnerEmail,
        registration_count: festRegistrationCounts[festKey] || 0,
        _eventCount: 0,
        _activeEventCount: 0,
      });
    }

    const entry = derivedFestMap.get(festKey);
    entry._eventCount += 1;
    if (!asBoolean(event?.is_archived)) {
      entry._activeEventCount += 1;
    }

    if (!entry.organizing_dept && event?.organizing_dept) {
      entry.organizing_dept = event.organizing_dept;
    }

    if (!entry.opening_date && event?.event_date) {
      entry.opening_date = event.event_date;
    }

    if (!entry.closing_date && event?.event_date) {
      entry.closing_date = event.event_date;
    }

    if (!entry.created_at && event?.created_at) {
      entry.created_at = event.created_at;
    }

    if (!entry.created_by && (event?.created_by || event?.organizer_email || event?.organiser_email)) {
      entry.created_by = event?.created_by || event?.organizer_email || event?.organiser_email;
    }

    if (!entry.contact_email && (event?.organizer_email || event?.organiser_email)) {
      entry.contact_email = event?.organizer_email || event?.organiser_email;
    }

    if (!entry.organizer_email && (event?.organizer_email || event?.organiser_email)) {
      entry.organizer_email = event?.organizer_email || event?.organiser_email;
    }
  }

  return Array.from(derivedFestMap.values()).map((fest) => ({
    fest_id: fest.fest_id,
    fest_title: fest.fest_title,
    organizing_dept: fest.organizing_dept,
    opening_date: fest.opening_date,
    closing_date: fest.closing_date,
    created_at: fest.created_at,
    created_by: fest.created_by || null,
    contact_email: fest.contact_email || null,
    organizer_email: fest.organizer_email || null,
    registration_count: fest.registration_count,
    is_archived: fest._eventCount > 0 && fest._activeEventCount === 0,
  }));
};

const mapFestResponse = (fest) => {
  if (!fest) return fest;
  try {
    return {
      ...fest,
      department_access: normalizeJsonField(fest.department_access),
      event_heads: normalizeJsonField(fest.event_heads),
      timeline: normalizeJsonField(fest.timeline),
      sponsors: normalizeJsonField(fest.sponsors),
      social_links: normalizeJsonField(fest.social_links),
      faqs: normalizeJsonField(fest.faqs),
      custom_fields: normalizeJsonField(fest.custom_fields)
    };
  } catch (error) {
    console.error("Error mapping fest response:", error.message, fest);
    return fest;
  }
};

// GET all fests
router.get("/", optionalAuth, checkRoleExpiration, async (req, res) => {
  try {
    const { page, pageSize, search, status, archive, sortBy, sortOrder, include_drafts, owned_only } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const includeDraftsRequested =
      typeof include_drafts === "string" && include_drafts.toLowerCase() === "true";
    const ownedOnlyRequested =
      typeof owned_only === "string" && owned_only.toLowerCase() === "true";

    let queryOptions = {
      order: { column: "created_at", ascending: false }
    };

    // Optimization: Filter by date in database if status is upcoming
    if (status === "upcoming") {
      queryOptions.filters = [
        { column: "closing_date", operator: "gte", value: today }
      ];
    } else if (status === "past") {
      queryOptions.filters = [
        { column: "closing_date", operator: "lt", value: today }
      ];
    }

    console.log(`Fetching fests with status: ${status || 'all'}...`);
    let fests = [];
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      fests = await getMergedFestsFromCandidates(queryOptions, festTable);
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
      console.warn("[Fests] Fest tables not available; falling back to event-derived fests.");
      fests = [];
    }

    let events = [];
    const eventSelectCandidates = [
      "event_id, fest, fest_id, organizing_dept, event_date, created_at, is_archived, created_by, organizer_email, organiser_email",
      "event_id, fest, fest_id, organizing_dept, event_date, created_at, is_archived, created_by, organizer_email",
      "event_id, fest, fest_id, organizing_dept, event_date, created_at, is_archived, created_by",
      "event_id, fest_id, organizing_dept, event_date, created_at, is_archived, created_by",
      "event_id, fest_id, organizing_dept, event_date, created_at, is_archived",
    ];

    for (const selectClause of eventSelectCandidates) {
      try {
        events = await queryAll("events", { select: selectClause });
        break;
      } catch (error) {
        if (isMissingRelationError(error)) {
          events = [];
          break;
        }

        if (isMissingColumnError(error)) {
          continue;
        }

        throw error;
      }
    }

    let registrations = [];
    try {
      registrations = await queryAll("registrations", { select: "event_id" });
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        registrations = [];
      } else {
        throw error;
      }
    }

    const eventRegistrationCounts = {};
    (registrations || []).forEach((reg) => {
      if (reg.event_id) {
        eventRegistrationCounts[reg.event_id] = (eventRegistrationCounts[reg.event_id] || 0) + 1;
      }
    });

    console.log(`Found ${fests?.length || 0} fests`);

    const festTitleToId = new Map((fests || []).map((fest) => [fest.fest_title, fest.fest_id]));
    const festRegistrationCounts = {};
    (events || []).forEach((event) => {
      const linkedFestKey = event.fest || event.fest_id;
      if (!linkedFestKey) return;
      const matchedFestId = festTitleToId.get(linkedFestKey) || linkedFestKey;
      const eventCount = eventRegistrationCounts[event.event_id] || 0;
      festRegistrationCounts[matchedFestId] = (festRegistrationCounts[matchedFestId] || 0) + eventCount;
    });

    let processedFests = (fests || []).map((fest) => ({
      ...mapFestResponse(fest),
      registration_count: festRegistrationCounts[fest.fest_id] || 0
    }));

    const hasCanonicalFestRows = processedFests.length > 0;
    if (!hasCanonicalFestRows && (events || []).length > 0) {
      processedFests = deriveFestsFromEvents(events, festRegistrationCounts);
    }

    const normalizedSearch = typeof search === "string" ? search.trim().toLowerCase() : "";
    if (normalizedSearch) {
      processedFests = processedFests.filter((fest) =>
        fest.fest_title?.toLowerCase().includes(normalizedSearch) ||
        fest.organizing_dept?.toLowerCase().includes(normalizedSearch)
      );
    }

    const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "all";
    if (normalizedStatus !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      processedFests = processedFests.filter((fest) => {
        const openingDate = parseComparableDate(fest.opening_date);
        const closingDate = parseComparableDate(fest.closing_date) || openingDate;

        if (!openingDate && !closingDate) {
          return false;
        }

        const referenceEndDate = closingDate || openingDate;
        if (!referenceEndDate) {
          return false;
        }

        if (normalizedStatus === "past") {
          return referenceEndDate.getTime() < today.getTime();
        }

        if (normalizedStatus === "ongoing") {
          if (!openingDate || !closingDate) return false;
          return openingDate.getTime() <= today.getTime() && closingDate.getTime() >= today.getTime();
        }

        if (normalizedStatus === "upcoming") {
          return referenceEndDate.getTime() >= today.getTime();
        }

        return true;
      });
    }

    const normalizedArchive = typeof archive === "string" ? archive.toLowerCase() : "all";

    // Filter out archived/draft fests for public callers unless draft inclusion is explicitly allowed.
    const userInfo = req.userInfo;
    const requesterEmail = normalizeEmail(userInfo?.email || req.user?.email || "");
    const requesterAuthUuid = String(userInfo?.auth_uuid || req.userId || req.user?.id || "")
      .trim()
      .toLowerCase();
    const hasRequesterIdentity = Boolean(requesterEmail || requesterAuthUuid);
    const normalizeOwnerIdentity = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const festMatchesRequesterOwnership = (fest) => {
      const ownerCandidates = [
        fest?.created_by,
        fest?.created_by_email,
        fest?.contact_email,
        fest?.organizer_email,
        fest?.organiser_email,
        fest?.auth_uuid,
      ]
        .map((candidate) => normalizeOwnerIdentity(candidate))
        .filter(Boolean);

      if (ownerCandidates.length === 0) {
        return false;
      }

      if (requesterEmail && ownerCandidates.includes(requesterEmail)) {
        return true;
      }

      if (requesterAuthUuid && ownerCandidates.includes(requesterAuthUuid)) {
        return true;
      }

      return false;
    };

    const canAccessNonPublicViaOwnedScope = ownedOnlyRequested && hasRequesterIdentity;

    if (ownedOnlyRequested) {
      processedFests = hasRequesterIdentity
        ? processedFests.filter((fest) => festMatchesRequesterOwnership(fest))
        : [];
    }

    const isAdminOrOrganizer = canAccessNonPublicFests(userInfo);
    const shouldIncludeDrafts =
      includeDraftsRequested && (isAdminOrOrganizer || canAccessNonPublicViaOwnedScope);
    
    if (!isAdminOrOrganizer && !canAccessNonPublicViaOwnedScope) {
      processedFests = processedFests.filter((fest) => !fest.is_archived && !asBoolean(fest.is_draft));

      console.log(`[Archive Filter] Non-organizer viewing ${processedFests.length} non-archived fests`);
    } else {
      console.log(`[Archive Filter] Organizer/Admin viewing all ${processedFests.length} fests (incl. archived)`);
    }

    if (normalizedArchive === "archived") {
      processedFests = processedFests.filter((fest) => Boolean(fest.is_archived));
    } else if (normalizedArchive === "active") {
      processedFests = processedFests.filter(
        (fest) => !fest.is_archived && (shouldIncludeDrafts || !asBoolean(fest.is_draft))
      );
    } else if (!shouldIncludeDrafts) {
      processedFests = processedFests.filter((fest) => !asBoolean(fest.is_draft));
    }

    const hasExplicitSortBy = typeof sortBy === "string" && sortBy.trim() !== "";
    const hasExplicitSortOrder = sortOrder === "asc" || sortOrder === "desc";
    const normalizedSortBy = hasExplicitSortBy
      ? sortBy
      : normalizedStatus === "upcoming"
        ? "opening_date"
        : "date";
    const normalizedSortOrder = hasExplicitSortOrder
      ? sortOrder
      : normalizedStatus === "upcoming"
        ? "asc"
        : "desc";
    processedFests.sort((a, b) => {
      let result = 0;
      switch (normalizedSortBy) {
        case "title":
          result = (a.fest_title || "").localeCompare(b.fest_title || "");
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
        case "opening_date":
          result =
            (parseComparableDate(a.opening_date)?.getTime() || 0) -
            (parseComparableDate(b.opening_date)?.getTime() || 0);
          break;
        case "created_at":
          result =
            (parseComparableDate(a.created_at)?.getTime() || 0) -
            (parseComparableDate(b.created_at)?.getTime() || 0);
          break;
        default:
          result =
            (parseComparableDate(a.created_at)?.getTime() || 0) -
            (parseComparableDate(b.created_at)?.getTime() || 0);
          break;
      }
      return normalizedSortOrder === "asc" ? result : -result;
    });

    const shouldPaginate = page !== undefined || pageSize !== undefined;
    if (!shouldPaginate) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).json({ fests: processedFests });
    }

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 200);
    const totalItems = processedFests.length;
    const totalPages = Math.max(Math.ceil(totalItems / parsedPageSize), 1);
    const safePage = Math.min(parsedPage, totalPages);
    const start = (safePage - 1) * parsedPageSize;
    const pagedFests = processedFests.slice(start, start + parsedPageSize);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({
      fests: pagedFests,
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
    console.error("Error fetching fests:", error);
    console.error("Error details:", error.message, error.stack);
    return res.status(500).json({
      error: "Internal server error while fetching fests.",
      details: error.message
    });
  }
});

// GET specific fest by ID
router.get("/:festId", optionalAuth, checkRoleExpiration, async (req, res) => {
  try {
    const { festId: festSlug } = req.params;
    console.log(`[Fest GET] Fetching fest: ${festSlug}`);
    
    if (!festSlug || typeof festSlug !== "string" || festSlug.trim() === "") {
      return res.status(400).json({
        error: "Fest ID (slug) must be provided in the URL path and be a non-empty string.",
      });
    }

    console.log(`[Fest GET] Getting fest table...`);
    let fest = null;
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      console.log(`[Fest GET] Querying ${festTable} table for fest_id: ${festSlug}`);
      fest = await getFestByIdFromCandidates(festSlug, festTable);
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
      console.warn(`[Fest GET] Fest tables unavailable while querying ${festSlug}; returning not found.`);
      fest = null;
    }

    if (!fest) {
      console.warn(`[Fest GET] Fest not found: ${festSlug}`);
      return res.status(404).json({ error: `Fest with ID (slug) '${festSlug}' not found.` });
    }

    // Check if fest is archived
    if (fest.is_archived) {
      const userInfo = req.userInfo;
      const isAdminOrOrganizer = canAccessNonPublicFests(userInfo);
      
      if (!isAdminOrOrganizer) {
        console.warn(`[Fest GET] Archived fest access denied: ${festSlug}`);
        return res.status(403).json({ error: "This fest is archived and not available" });
      }
    }

    try {
      const subheadsRecords = await queryAll("fest_subheads", {
        where: { fest_id: fest.fest_id, is_active: true }
      });
      if (subheadsRecords && subheadsRecords.length > 0) {
        fest.subheads = subheadsRecords.map(record => record.user_email);
      } else {
        fest.subheads = [];
      }
    } catch (subheadQueryError) {
      if (!isMissingRelationError(subheadQueryError)) {
        console.warn("Failed to fetch subheads:", subheadQueryError);
      }
      fest.subheads = [];
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({ fest: mapFestResponse(fest) });
  } catch (error) {
    console.error("❌ Error fetching fest:", error);
    console.error("🔴 Fest GET error details:", {
      message: error.message,
      stack: error.stack,
      festId: req.params.festId
    });
    return res.status(500).json({ 
      error: "Internal server error while fetching specific fest.",
      details: error.message
    });
  }
});

// POST - Create new fest - REQUIRES AUTHENTICATION + ORGANISER PRIVILEGES
router.post(
  "/",
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const festData = req.body;
      const draftPreferenceInput = pickDefined(
        festData.is_draft,
        festData.isDraft,
        festData.save_as_draft
      );
      const hasDraftPreference =
        draftPreferenceInput !== undefined &&
        draftPreferenceInput !== null &&
        String(draftPreferenceInput).trim() !== "";
      const shouldSaveAsDraft = hasDraftPreference && asBoolean(draftPreferenceInput);
      const requiresApprovalSubmission = !shouldSaveAsDraft;
      const sendNotificationsInput = pickDefined(
        festData.send_notifications,
        festData.sendNotifications
      );

      // Basic validation
      const title = String(festData.festTitle || festData.title || "").trim();
      const school = String(
        festData.organizingSchool || festData.organizing_school || ""
      ).trim();
      const dept = String(festData.organizingDept || festData.organizing_dept || "").trim();
      const contactEmail = normalizeEmail(
        pickDefined(festData.contactEmail, festData.contact_email)
      );
      const contactPhone = normalizePhone(
        pickDefined(festData.contactPhone, festData.contact_phone)
      );
      const eventHeadsInput = pickDefined(festData.eventHeads, festData.event_heads);
      const eventHeads = Array.isArray(eventHeadsInput)
        ? eventHeadsInput
        : parseJsonLikeField(eventHeadsInput, []);
      const normalizedEventHeads = Array.isArray(eventHeads)
        ? eventHeads.map(normalizeEventHead).filter((head) => head.email)
        : [];
      
      const subheadsInput = pickDefined(festData.subheads);
      const normalizedSubheads = Array.isArray(subheadsInput)
        ? subheadsInput.map((email) => normalizeEmail(email)).filter(Boolean)
        : [];
      const hasDuplicateSubheads =
        new Set(normalizedSubheads).size !== normalizedSubheads.length;
      const subheads = Array.from(new Set(normalizedSubheads));

      if (!title || !school || !dept) {
        console.log("Validation failed. Received:", JSON.stringify(festData));
        return res.status(400).json({
          error: "Fest title, organizing school, and organizing department are required",
        });
      }

      if (!contactEmail) {
        return res.status(400).json({ error: "Contact email is required." });
      }

      if (contactEmail.length > MAX_EMAIL_LENGTH) {
        return res.status(400).json({ error: "Contact email must be 100 characters or fewer." });
      }

      if (!isValidEmail(contactEmail)) {
        return res.status(400).json({ error: "Please provide a valid contact email." });
      }

      if (!isChristUniversityEmail(contactEmail)) {
        return res.status(400).json({
          error: "Contact email must use @christuniversity.in domain.",
        });
      }

      if (!contactPhone) {
        return res.status(400).json({ error: "Contact phone is required." });
      }

      if (!PHONE_REGEX.test(contactPhone)) {
        return res.status(400).json({ error: "Contact phone must be 10-14 digits." });
      }

      const invalidHeadEmail = normalizedEventHeads.some(
        (head) => !isValidEmail(head.email)
      );

      if (invalidHeadEmail) {
        return res.status(400).json({
          error: "Each event head must have a valid email address.",
        });
      }

      const overlongHeadEmail = normalizedEventHeads.some(
        (head) => head.email.length > MAX_EMAIL_LENGTH
      );

      if (overlongHeadEmail) {
        return res.status(400).json({
          error: "Each event head email must be 100 characters or fewer.",
        });
      }

      const missingHeadExpiry = normalizedEventHeads.some((head) => {
        return !head.expiresAt;
      });

      if (missingHeadExpiry) {
        return res.status(400).json({
          error: "Each event head must have an expiry date and time.",
        });
      }

      if (hasDuplicateSubheads) {
        return res.status(400).json({
          error: "Subhead emails must be unique.",
        });
      }

      if (subheads.length > 20) {
        return res.status(400).json({
          error: "Maximum 20 subheads are allowed.",
        });
      }

      const invalidSubhead = subheads.find(
        (email) =>
          !isValidEmail(email) ||
          !isChristUniversityEmail(email) ||
          email.length > MAX_EMAIL_LENGTH
      );
      if (invalidSubhead) {
        return res.status(400).json({
          error:
            "Each subhead must have a valid @christuniversity.in email and be 100 characters or fewer.",
        });
      }

      const organizerEmails = new Set([
        normalizeEmail(req.userInfo?.email || ""),
        contactEmail,
      ]);
      if (subheads.some((email) => organizerEmails.has(email))) {
        return res.status(400).json({
          error:
            "You are the organizer of this fest. You cannot add yourself as a subhead.",
        });
      }

      // Generate slug-based ID from title
      const titleForSlug = title;
      let fest_id = titleForSlug
        ? titleForSlug
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
        : "";

      if (!fest_id) {
        fest_id = uuidv4().replace(/-/g, "");
      }

      // Validate fest_id uniqueness
      const existingFest = await queryOne(festTable, { where: { fest_id } });
      if (existingFest) {
        return res.status(400).json({
          error: `A fest with the title "${title}" already exists (ID: '${fest_id}'). Please use a different title.`
        });
      }

      // Proceed with insertion
      const openingDateValue = festData.openingDate || festData.opening_date || null;
      const closingDateValue = festData.closingDate || festData.closing_date || null;
      const openingDateComparable = parseComparableDate(openingDateValue);
      const closingDateComparable =
        parseComparableDate(closingDateValue) || openingDateComparable;

      if (!openingDateComparable) {
        return res.status(400).json({
          error: "Opening date is required and must be a valid date.",
        });
      }

      const minimumOpeningDate = new Date();
      minimumOpeningDate.setHours(0, 0, 0, 0);
      minimumOpeningDate.setDate(minimumOpeningDate.getDate() + 7);

      if (openingDateComparable < minimumOpeningDate) {
        return res.status(400).json({
          error: "Opening date must be at least 7 days from today.",
        });
      }

      if (closingDateComparable && closingDateComparable < openingDateComparable) {
        return res.status(400).json({
          error: "Closing date must be on or after opening date.",
        });
      }
      const parsedCustomFields =
        parseJsonLikeField(
          pickDefined(festData.custom_fields, festData.customFields),
          []
        ) || [];
      const isBudgetRelated = extractBudgetApprovalRequirement(parsedCustomFields);
      const approvalWorkflow = extractFestApprovalWorkflow({
        customFieldsValue: parsedCustomFields,
        directValue: pickDefined(festData.approval_settings, festData.approvalSettings),
      });

      const festPayload = {
        fest_id,
        fest_title: title,
        description: festData.description || festData.detailed_description || festData.detailedDescription || "",
        opening_date: openingDateValue,
        closing_date: closingDateValue,
        fest_image_url: festData.festImageUrl || festData.fest_image_url || null,
        organizing_school: school,
        organizing_dept: dept,
        department_access: festData.departmentAccess || festData.department_access || [],
        category: festData.category || "",
        contact_email: contactEmail,
        contact_phone: contactPhone,
        event_heads: normalizedEventHeads,
        created_by: req.userInfo?.email,
        auth_uuid: req.userId,
        // New enhanced fest fields
        venue: festData.venue || null,
        status: shouldSaveAsDraft
          ? LIFECYCLE_STATUS.DRAFT
          : LIFECYCLE_STATUS.PENDING_APPROVALS,
        registration_deadline: festData.registration_deadline || null,
        timeline: festData.timeline || [],
        sponsors: festData.sponsors || [],
        social_links: festData.social_links || [],
        faqs: festData.faqs || [],
        custom_fields: parsedCustomFields,
        campus_hosted_at: festData.campus_hosted_at || festData.campusHostedAt || null,
        allowed_campuses: festData.allowed_campuses || festData.allowedCampuses || [],
        department_hosted_at: festData.department_hosted_at || festData.departmentHostedAt || null,
        allow_outsiders: festData.allow_outsiders === true || festData.allow_outsiders === 'true' || festData.allowOutsiders === true || festData.allowOutsiders === 'true' ? true : false,
        is_draft: true,
      };

      let inserted;
      try {
        inserted = await insert(festTable, [festPayload]);
      } catch (insertError) {
        if (!isMissingColumnError(insertError, "status")) {
          throw insertError;
        }

        const fallbackFestPayload = {
          ...festPayload,
        };
        delete fallbackFestPayload.status;
        inserted = await insert(festTable, [fallbackFestPayload]);
      }
      let createdFest = inserted?.[0];
      let workflowApprovalRequest = null;
      let activationState = requiresApprovalSubmission ? "PENDING" : "ACTIVE";
      let shouldPublishNow = false;
      let pendingDeanApproval = false;
      let pendingHodApproval = false;
      let pendingCfoApproval = false;

      if (requiresApprovalSubmission) {
        workflowApprovalRequest = await createFestApprovalRequest({
          festRecord: {
            ...(createdFest || {}),
            ...festPayload,
            fest_id,
          },
          userInfo: req.userInfo,
          isBudgetRelated,
          approvalWorkflow,
        });

        const workflowResult = await applyFestWorkflowState({
          festTable,
          festId: fest_id,
          approvalRequestId: workflowApprovalRequest?.id || null,
          isBudgetRelated,
        });

        activationState = workflowResult.activationState;

        if (workflowApprovalRequest) {
          const primaryRoleCode = normalizeWorkflowStatus(
            workflowApprovalRequest?.primary_role_code,
            ROLE_CODES.DEAN
          );
          pendingDeanApproval = primaryRoleCode === ROLE_CODES.DEAN;
          pendingHodApproval = primaryRoleCode === ROLE_CODES.HOD;
          pendingCfoApproval = Boolean(isBudgetRelated);
        }

        if (workflowResult.applied) {
          const refreshedFest = await queryOne(festTable, { where: { fest_id } });
          if (refreshedFest) {
            createdFest = refreshedFest;
          }
        }
      }

      // Grant organiser-student access to event heads with expiration dates
      for (const head of normalizedEventHeads) {
        if (head && head.email) {
          try {
            // Find the user by email
            const user = await queryOne("users", { where: { email: head.email } });
            if (user) {
              // Update user's organiser-student status with expiration
              await update("users", {
                is_organiser_student: true,
                organiser_expires_at: head.expiresAt || null
              }, { email: head.email });
              console.log(`Granted organiser-student access to ${head.email} (expires: ${head.expiresAt || 'never'})`);
            } else {
              console.log(`User ${head.email} not found, organiser-student access will be granted when they sign up`);
            }
          } catch (userError) {
            console.error(`Error updating organiser-student status for ${head.email}:`, userError);
          }
        }
      }

      // Insert subheads into fest_subheads
      if (subheads.length > 0) {
        try {
          const subheadsData = subheads.map(email => ({
            fest_id,
            user_email: email,
            added_by: req.userInfo?.email || festPayload.created_by,
            is_active: true
          }));
          await insert("fest_subheads", subheadsData);
          console.log(`✅ Added ${subheadsData.length} subheads to fest ${fest_id}`);
        } catch (subheadError) {
          console.error("❌ Failed to add fest subheads:", subheadError);
        }
      }

      const isFestReadyForNotifications = isFestLiveForNotifications(createdFest);
      const shouldSendNotifications = shouldSendCreateBroadcast({
        record: createdFest,
        sendNotificationsInput,
        defaultSendNotifications: true,
        hasApprovalRequest: Boolean(
          workflowApprovalRequest?.id ||
            String(createdFest?.approval_request_id || "").trim()
        ),
      });

      // Send notifications to all users about the new fest (non-blocking)
      if (shouldSendNotifications && isFestReadyForNotifications) {
        sendBroadcastNotification({
          title: 'New Fest Announced',
          message: `${festPayload.fest_title} — Don't miss this fest!`,
          type: 'info',
          event_id: fest_id,
          event_title: festPayload.fest_title,
          action_url: `/fest/${fest_id}`
        }).then(() => {
          console.log(`✅ Sent notifications for new fest: ${festPayload.fest_title}`);
        }).catch((notifError) => {
          console.error('❌ Failed to send fest notifications:', notifError);
        });
      }

      // Push to UniversityGated if outsiders are enabled (non-blocking)
      if (shouldPublishNow && isGatedEnabled() && festPayload.allow_outsiders) {
        pushFestToGated(
          festPayload,
          req.userInfo?.email || festPayload.created_by,
          req.userInfo?.name || 'SOCIO Organiser'
        ).then(() => {
          console.log(`✅ Pushed fest "${festPayload.fest_title}" to UniversityGated`);
        }).catch((gatedError) => {
          console.error(`❌ Failed to push fest to Gated:`, gatedError.message);
        });
      }

      return res.status(201).json({
        message: workflowApprovalRequest
          ? ((pendingDeanApproval || pendingHodApproval)
              ? (pendingCfoApproval
                  ? `Fest submitted successfully and routed to ${pendingHodApproval ? "HOD" : "Dean"} and CFO approvals`
                  : `Fest submitted successfully and routed to ${pendingHodApproval ? "HOD" : "Dean"} approval`)
              : "Fest submitted successfully and routed for approval")
          : requiresApprovalSubmission
            ? "Fest submitted successfully and pending approval"
          : "Fest created successfully",
        fest: mapFestResponse(createdFest),
        lifecycle_status: normalizeFestLifecycleStatus(createdFest),
        approval_request_id: workflowApprovalRequest?.request_id || null,
        pending_dean_review: pendingDeanApproval,
        pending_hod_review: pendingHodApproval,
        pending_cfo_review: pendingCfoApproval,
        activation_state: activationState,
        is_live: isFestReadyForNotifications,
      });

    } catch (error) {
      console.error("Error creating fest:", error);

      const missingCustomFieldsColumn =
        isMissingColumnError(error) &&
        String(error?.message || "").toLowerCase().includes("custom_fields");

      if (missingCustomFieldsColumn) {
        return res.status(500).json({
          error:
            "Database migration required: fests.custom_fields is missing. Run server migrations before creating fests with custom fields.",
        });
      }

      const statusCode = Number(error?.statusCode || error?.status);
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({ error: error.message || "Invalid approval routing configuration." });
      }

      return res.status(500).json({ error: "Internal server error while creating fest." });
    }
  });

// PUT - Update fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.put(
  "/:festId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),  // Master admin bypass built-in
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const { festId } = req.params;
      const updateData = req.body;
      const existingFest = req.resource; // From ownership middleware

      // Get the new title
      const incomingTitle = updateData.fest_title ?? updateData.festTitle ?? updateData.title;
      const normalizedNewTitle =
        incomingTitle !== undefined && incomingTitle !== null
          ? String(incomingTitle).trim()
          : undefined;
      const titleChanged =
        typeof normalizedNewTitle === "string" &&
        normalizedNewTitle !== "" &&
        normalizedNewTitle !== existingFest.fest_title;

      const departmentAccessInput = pickDefined(updateData.department_access, updateData.departmentAccess);
      const eventHeadsInput = pickDefined(updateData.event_heads, updateData.eventHeads);
      const customFieldsInput = pickDefined(updateData.custom_fields, updateData.customFields);
      const organizingSchoolInput = pickDefined(updateData.organizing_school, updateData.organizingSchool);
      const normalizedOrganizingSchool =
        organizingSchoolInput !== undefined
          ? String(organizingSchoolInput || "").trim()
          : undefined;
      const organizingDeptInput = pickDefined(updateData.organizing_dept, updateData.organizingDept);
      const normalizedOrganizingDept =
        organizingDeptInput !== undefined
          ? String(organizingDeptInput || "").trim()
          : undefined;
      const existingOrganizingSchool = String(existingFest.organizing_school || "").trim();
      const effectiveOrganizingSchool =
        normalizedOrganizingSchool !== undefined
          ? normalizedOrganizingSchool
          : existingOrganizingSchool;
      const contactEmailInput = pickDefined(updateData.contact_email, updateData.contactEmail);
      const normalizedContactEmail =
        contactEmailInput !== undefined
          ? normalizeEmail(contactEmailInput)
          : undefined;
      const contactPhoneInput = pickDefined(updateData.contact_phone, updateData.contactPhone);
      const normalizedContactPhone =
        contactPhoneInput !== undefined
          ? normalizePhone(contactPhoneInput)
          : undefined;
      const campusHostedAtInput = pickDefined(updateData.campus_hosted_at, updateData.campusHostedAt);
      const allowedCampusesInput = pickDefined(updateData.allowed_campuses, updateData.allowedCampuses);
      const departmentHostedAtInput = pickDefined(updateData.department_hosted_at, updateData.departmentHostedAt);
      const allowOutsidersInput = pickDefined(updateData.allow_outsiders, updateData.allowOutsiders);
      const draftPreferenceInput = pickDefined(updateData.is_draft, updateData.isDraft, updateData.save_as_draft);
      const hasDraftPreference =
        draftPreferenceInput !== undefined &&
        draftPreferenceInput !== null &&
        String(draftPreferenceInput).trim() !== "";
      const shouldSaveAsDraft = hasDraftPreference ? asBoolean(draftPreferenceInput) : false;
      const sendNotificationsInput = pickDefined(updateData.send_notifications, updateData.sendNotifications);
      const hasExplicitNotificationPreference =
        sendNotificationsInput !== undefined &&
        sendNotificationsInput !== null &&
        String(sendNotificationsInput).trim() !== "";
      const wasDraftBeforeUpdate = asBoolean(existingFest?.is_draft);
      const currentLifecycleStatus = normalizeFestLifecycleStatus(existingFest);
      const wantsPublishIntent = hasDraftPreference && !shouldSaveAsDraft;
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
        (hasExplicitNotificationPreference ? asBoolean(sendNotificationsInput) : true);
      const parsedEventHeadsInput =
        eventHeadsInput !== undefined
          ? parseJsonLikeField(eventHeadsInput, [])
          : undefined;
      const normalizedEventHeadsInput = Array.isArray(parsedEventHeadsInput)
        ? parsedEventHeadsInput.map(normalizeEventHead).filter((head) => head.email)
        : [];
      const hasEventHeadsUpdate = eventHeadsInput !== undefined;

      if (isPendingLifecyclePublishIntent) {
        return res.status(403).json({
          error: "403 Forbidden: Incomplete Approval Chain",
          code: "INCOMPLETE_APPROVAL_CHAIN",
          reason: "Approvals are still pending",
        });
      }

      if (normalizedNewTitle !== undefined && !normalizedNewTitle) {
        return res.status(400).json({
          error: "Fest title cannot be empty.",
        });
      }

      if (normalizedOrganizingDept !== undefined && !normalizedOrganizingDept) {
        return res.status(400).json({
          error: "Organizing department cannot be empty.",
        });
      }

      if (!effectiveOrganizingSchool) {
        return res.status(400).json({
          error: "Organizing school is required.",
        });
      }

      if (normalizedContactEmail !== undefined) {
        if (!normalizedContactEmail) {
          return res.status(400).json({ error: "Contact email is required." });
        }

        if (normalizedContactEmail.length > MAX_EMAIL_LENGTH) {
          return res.status(400).json({
            error: "Contact email must be 100 characters or fewer.",
          });
        }

        if (!isValidEmail(normalizedContactEmail)) {
          return res.status(400).json({ error: "Please provide a valid contact email." });
        }

        if (!isChristUniversityEmail(normalizedContactEmail)) {
          return res.status(400).json({
            error: "Contact email must use @christuniversity.in domain.",
          });
        }
      }

      if (normalizedContactPhone !== undefined) {
        if (!normalizedContactPhone) {
          return res.status(400).json({ error: "Contact phone is required." });
        }

        if (!PHONE_REGEX.test(normalizedContactPhone)) {
          return res.status(400).json({
            error: "Contact phone must be 10-14 digits.",
          });
        }
      }

      if (hasEventHeadsUpdate) {
        const invalidHeadEmail = normalizedEventHeadsInput.some(
          (head) => !isValidEmail(head.email)
        );

        if (invalidHeadEmail) {
          return res.status(400).json({
            error: "Each event head must have a valid email address.",
          });
        }

        const overlongHeadEmail = normalizedEventHeadsInput.some(
          (head) => head.email.length > MAX_EMAIL_LENGTH
        );

        if (overlongHeadEmail) {
          return res.status(400).json({
            error: "Each event head email must be 100 characters or fewer.",
          });
        }

        const missingHeadExpiry = normalizedEventHeadsInput.some((head) => {
          return !head.expiresAt;
        });

        if (missingHeadExpiry) {
          return res.status(400).json({
            error: "Each event head must have an expiry date and time.",
          });
        }
      }
      const incomingOpeningDate = pickDefined(updateData.opening_date, updateData.openingDate);
      const incomingClosingDate = pickDefined(updateData.closing_date, updateData.closingDate);

      const updatePayload = {};

      // Determine the image URL to save:
      // - If festImageUrl key exists in body (even as null), use that value explicitly
      // - This allows clearing the image by sending festImageUrl: null
      const incomingImageUrl = 'festImageUrl' in updateData
        ? updateData.festImageUrl
        : ('fest_image_url' in updateData ? updateData.fest_image_url : undefined);
      const parsedCustomFields = parseJsonLikeField(customFieldsInput, []);
      const effectiveCustomFields =
        parsedCustomFields === undefined ? existingFest.custom_fields : parsedCustomFields;
      const isBudgetRelated = extractBudgetApprovalRequirement(effectiveCustomFields);
      const approvalWorkflow = extractFestApprovalWorkflow({
        customFieldsValue: effectiveCustomFields,
        directValue: pickDefined(updateData.approval_settings, updateData.approvalSettings),
      });

      console.log(`[Fest Update] Image URL received: ${JSON.stringify(incomingImageUrl)} (type: ${typeof incomingImageUrl})`);
      console.log(`[Fest Update] 'festImageUrl' in body: ${'festImageUrl' in updateData}`);

      const mapFields = [
        ["fest_title", normalizedNewTitle],
        ["description", updateData.description ?? updateData.detailed_description ?? updateData.detailedDescription],
        ["opening_date", incomingOpeningDate],
        ["closing_date", incomingClosingDate],
        ["fest_image_url", incomingImageUrl],
        ["organizing_school", normalizedOrganizingSchool],
        ["organizing_dept", normalizedOrganizingDept],
        ["category", updateData.category],
        ["contact_email", normalizedContactEmail],
        ["contact_phone", normalizedContactPhone],
        ["department_access", parseJsonLikeField(departmentAccessInput, [])],
        ["event_heads", hasEventHeadsUpdate ? normalizedEventHeadsInput : undefined],
        ["custom_fields", parsedCustomFields],
        // New enhanced fest fields - parse JSON safely
        ["venue", updateData.venue],
        [
          "status",
          hasDraftPreference && shouldSaveAsDraft
            ? LIFECYCLE_STATUS.DRAFT
            : undefined,
        ],
        ["registration_deadline", updateData.registration_deadline],
        ["timeline", parseJsonLikeField(updateData.timeline, [])],
        ["sponsors", parseJsonLikeField(updateData.sponsors, [])],
        ["social_links", parseJsonLikeField(updateData.social_links, [])],
        ["faqs", parseJsonLikeField(updateData.faqs, [])],
        ["campus_hosted_at", campusHostedAtInput],
        ["allowed_campuses", parseJsonLikeField(allowedCampusesInput, [])],
        ["department_hosted_at", departmentHostedAtInput],
        ["allow_outsiders", allowOutsidersInput !== undefined ? (allowOutsidersInput === true || allowOutsidersInput === 'true') : undefined],
        ["is_draft", hasDraftPreference && shouldSaveAsDraft ? true : undefined],
      ];

      for (const [key, value] of mapFields) {
        // Include the field if value is not undefined (null IS included to allow clearing fields)
        if (value !== undefined) {
          updatePayload[key] = value;
        }
      }

      console.log(`[Fest Update] fest_image_url in updatePayload: ${JSON.stringify(updatePayload.fest_image_url)}`);

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      updatePayload.updated_at = new Date().toISOString();
      
      console.log(`[Fest Update] Payload for ${festId}:`, JSON.stringify(updatePayload, null, 2));
      console.log(`[Fest Update] Using table: ${festTable}`);

      if (titleChanged) {
        try {
          // Update notifications event_title so they match the new name
          const updatedTitle = normalizedNewTitle;
          await update("notifications", {
            event_title: updatedTitle,
          }, { event_id: festId });
          console.log(`Updated notification titles for fest_id '${festId}' to '${updatedTitle}'`);
        } catch (notifError) {
          console.log(`No notifications to update or error: ${notifError.message}`);
        }

        // Update any legacy events that might be referencing the fest by its OLD title
        try {
          await update("events", { fest_id: festId }, { fest: existingFest.fest_title });
        } catch (eventsError) { }
      }

      let updated;
      try {
        updated = await update(festTable, updatePayload, { fest_id: festId });
      } catch (updateError) {
        if (!isMissingColumnError(updateError) || !String(updateError?.message || "").toLowerCase().includes("status")) {
          console.error("[Fest Update ERROR] Supabase update failed:", {
            errorMessage: updateError.message,
            errorCode: updateError.code,
            errorDetails: JSON.stringify(updateError, null, 2),
            tableName: festTable,
            festId: festId,
            payloadKeys: Object.keys(updatePayload)
          });
          throw updateError;
        }

        const fallbackPayload = {
          ...updatePayload,
        };
        delete fallbackPayload.status;
        updated = await update(festTable, fallbackPayload, { fest_id: festId });
      }
      
      let updatedFest = updated?.[0];
      
      // If update didn't return data, try fetching the updated fest
      if (!updatedFest) {
        console.warn("⚠️ Update query returned no data, fetching fest from database...");
        try {
          updatedFest = await queryOne(festTable, { where: { fest_id: festId } });
          if (!updatedFest) {
            throw new Error("Could not fetch updated fest after update");
          }
          console.log(`✅ Fest updated and refetched successfully: ${festId}`);
        } catch (refetchError) {
          console.error("❌ Failed to refetch fest after update:", refetchError.message);
          throw new Error("Fest update failed - could not verify update");
        }
      } else {
        console.log(`✅ Fest updated successfully: ${festId}`);
      }

      let workflowApprovalRequest = null;
      let activationState = normalizeWorkflowStatus(updatedFest?.activation_state, "ACTIVE");
      let pendingDeanApproval = false;
      let pendingHodApproval = false;
      let pendingCfoApproval = false;
      let festPublishedNow = false;

      if (isApprovalResubmissionIntent) {
        workflowApprovalRequest = await createFestApprovalRequest({
          festRecord: {
            ...(updatedFest || {}),
            ...updatePayload,
            fest_id: festId,
          },
          userInfo: req.userInfo,
          isBudgetRelated,
          approvalWorkflow,
        });

        if (workflowApprovalRequest) {
          const workflowResult = await applyFestWorkflowState({
            festTable,
            festId,
            approvalRequestId: workflowApprovalRequest.id,
            isBudgetRelated,
          });

          activationState = workflowResult.activationState;
          const primaryRoleCode = normalizeWorkflowStatus(
            workflowApprovalRequest?.primary_role_code,
            ROLE_CODES.DEAN
          );
          pendingDeanApproval = primaryRoleCode === ROLE_CODES.DEAN;
          pendingHodApproval = primaryRoleCode === ROLE_CODES.HOD;
          pendingCfoApproval = Boolean(isBudgetRelated);
          shouldSendPublishNotifications = false;

          if (workflowResult.applied) {
            const refreshedFest = await queryOne(festTable, { where: { fest_id: festId } });
            if (refreshedFest) {
              updatedFest = refreshedFest;
            }
          }
        }
      } else if (isApprovedLifecyclePublishIntent) {
        const publishValidation = await validateFestApprovalChainForPublish({
          festRecord: updatedFest,
        });

        if (!publishValidation.ok) {
          return res.status(403).json({
            error: "403 Forbidden: Incomplete Approval Chain",
            code: "INCOMPLETE_APPROVAL_CHAIN",
            reason: publishValidation.reason,
          });
        }

        try {
          await update(
            festTable,
            {
              status: LIFECYCLE_STATUS.PUBLISHED,
              is_draft: false,
              activation_state: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
            { fest_id: festId }
          );
        } catch (publishUpdateError) {
          if (!isMissingColumnError(publishUpdateError) || !String(publishUpdateError?.message || "").toLowerCase().includes("status")) {
            throw publishUpdateError;
          }

          await update(
            festTable,
            {
              is_draft: false,
              activation_state: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
            { fest_id: festId }
          );
        }

        const refreshedFest = await queryOne(festTable, { where: { fest_id: festId } });
        if (refreshedFest) {
          updatedFest = refreshedFest;
        }

        activationState = normalizeWorkflowStatus(updatedFest?.activation_state, "ACTIVE");
        festPublishedNow = true;
      }

      if (!festPublishedNow) {
        shouldSendPublishNotifications = false;
      }

      const canPublishNow =
        activationState === "ACTIVE" &&
        !asBoolean(updatedFest?.is_draft) &&
        normalizeFestLifecycleStatus(updatedFest) === LIFECYCLE_STATUS.PUBLISHED;
      const isFestReadyForNotifications = isFestLiveForNotifications(updatedFest);

      // Push to UniversityGated if outsiders are now enabled (non-blocking)
      if (isGatedEnabled() && updatedFest && canPublishNow) {
        const outsidersEnabled = updatedFest.allow_outsiders === true || updatedFest.allow_outsiders === 'true';
        if (outsidersEnabled) {
          pushFestToGated(
            updatedFest,
            req.userInfo?.email || updatedFest.created_by,
            req.userInfo?.name || 'SOCIO Organiser'
          ).then(() => {
            console.log(`✅ Pushed updated fest "${updatedFest.fest_title}" to UniversityGated`);
          }).catch((gatedError) => {
            console.error(`❌ Failed to push updated fest to Gated:`, gatedError.message);
          });
        }
      }

      const shouldSendPublishBroadcastNow = shouldSendPublishBroadcast({
        record: updatedFest,
        sendNotificationsInput: shouldSendPublishNotifications,
        defaultSendNotifications: true,
        hasApprovalRequest: hasApprovalRequestReference(updatedFest),
        legacyWorkflowStatus: updatedFest?.workflow_status,
      });

      if (shouldSendPublishBroadcastNow && isFestReadyForNotifications) {
        sendBroadcastNotification({
          title: "Fest Published",
          message: `${updatedFest.fest_title} is now live!`,
          type: "info",
          event_id: festId,
          event_title: updatedFest.fest_title,
          action_url: `/fest/${festId}`,
        }).catch((notifError) => {
          console.error("❌ Failed to send fest publish notifications:", notifError);
        });
      }

      // Grant organiser-student access to event heads with expiration dates
      try {
        const eventHeads = hasEventHeadsUpdate ? normalizedEventHeadsInput : [];
        console.log(`[EventHeads] Processing ${eventHeads.length} event heads`);
        
        for (const head of eventHeads) {
          if (head && head.email) {
            try {
              console.log(`[EventHeads] Looking up user: ${head.email}`);
              // Find the user by email
              const user = await queryOne("users", { where: { email: head.email } });
              if (user) {
                console.log(`[EventHeads] Found user, updating organiser-student status...`);
                // Update user's organiser-student status with expiration
                await update("users", {
                  is_organiser_student: true,
                  organiser_expires_at: head.expiresAt || null
                }, { email: head.email });
                console.log(`✅ Granted organiser-student access to ${head.email} (expires: ${head.expiresAt || 'never'})`);
              } else {
                console.log(`[EventHeads] ⚠️ User ${head.email} not found, organiser-student access will be granted when they sign up`);
              }
            } catch (userError) {
              console.error(`❌ Error updating organiser-student status for ${head.email}:`, userError.message);
              // Continue processing other heads even if one fails
            }
          }
        }
      } catch (eventHeadsError) {
        console.error(`❌ Error processing event heads:`, eventHeadsError.message);
        // Don't fail the entire update, just log and continue
      }

      // Update subheads if provided
      const subheadsInput = pickDefined(updateData.subheads);
      if (subheadsInput !== undefined) {
        try {
          const normalizedSubheads = Array.isArray(subheadsInput)
            ? subheadsInput.map((email) => normalizeEmail(email)).filter(Boolean)
            : [];
          const hasDuplicateSubheads =
            new Set(normalizedSubheads).size !== normalizedSubheads.length;
          const subheads = Array.from(new Set(normalizedSubheads));

          if (hasDuplicateSubheads) {
            return res.status(400).json({
              error: "Subhead emails must be unique.",
            });
          }

          if (subheads.length > 20) {
            return res.status(400).json({
              error: "Maximum 20 subheads are allowed.",
            });
          }

          const invalidSubhead = subheads.find(
            (email) =>
              !isValidEmail(email) ||
              !isChristUniversityEmail(email) ||
              email.length > MAX_EMAIL_LENGTH
          );
          if (invalidSubhead) {
            return res.status(400).json({
              error:
                "Each subhead must have a valid @christuniversity.in email and be 100 characters or fewer.",
            });
          }

          const organizerEmailForSubheadCheck = normalizeEmail(
            pickDefined(updateData.contact_email, updateData.contactEmail) ||
              existingFest.contact_email ||
              req.userInfo?.email ||
              ""
          );
          if (
            organizerEmailForSubheadCheck &&
            subheads.includes(organizerEmailForSubheadCheck)
          ) {
            return res.status(400).json({
              error:
                "You are the organizer of this fest. You cannot add yourself as a subhead.",
            });
          }
            
          // Delete old subheads
          await remove("fest_subheads", { fest_id: festId });
          
          if (subheads.length > 0) {
            const subheadsData = subheads.map(email => ({
              fest_id: festId,
              user_email: email,
              added_by: req.userInfo?.email || existingFest.created_by,
              is_active: true
            }));
            await insert("fest_subheads", subheadsData);
            console.log(`✅ Updated ${subheadsData.length} subheads for fest ${festId}`);
          }
        } catch (subheadsError) {
          console.error(`❌ Error updating subheads:`, subheadsError.message);
        }
      }

      console.log(`[response] About to send success response for fest ${festId}`);
      const lifecycleStatus = normalizeFestLifecycleStatus(
        updatedFest,
        currentLifecycleStatus
      );
      let responseMessage = "Fest updated successfully";

      if (hasDraftPreference && shouldSaveAsDraft) {
        responseMessage = "Fest saved as draft successfully";
      } else if (isApprovalResubmissionIntent && (pendingDeanApproval || pendingHodApproval)) {
        responseMessage = pendingCfoApproval
          ? `Fest submitted successfully and routed to ${pendingHodApproval ? "HOD" : "Dean"} and CFO approvals`
          : `Fest submitted successfully and routed to ${pendingHodApproval ? "HOD" : "Dean"} approval`;
      } else if (isApprovalResubmissionIntent) {
        responseMessage = "Fest submitted successfully and routed for approval";
      } else if (festPublishedNow) {
        responseMessage = "Fest published successfully";
      }

      return res.status(200).json({
        message: responseMessage,
        fest: mapFestResponse(updatedFest),
        fest_id: festId,
        id_changed: false,
        lifecycle_status: lifecycleStatus,
        approval_request_id: workflowApprovalRequest?.request_id || null,
        pending_dean_review: pendingDeanApproval,
        pending_hod_review: pendingHodApproval,
        pending_cfo_review: pendingCfoApproval,
        activation_state: activationState,
        is_live: canPublishNow,
      });

    } catch (error) {
      console.error("❌ Error updating fest:", error);
      console.error("🔴 Detailed error info:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBodyKeys: Object.keys(req.body || {}),
        userId: req.userId,
        userEmail: req.userInfo?.email,
        isOrganiser: req.userInfo?.is_organiser,
        festId: req.params.festId
      });

      const missingCustomFieldsColumn =
        isMissingColumnError(error) &&
        String(error?.message || "").toLowerCase().includes("custom_fields");

      if (missingCustomFieldsColumn) {
        return res.status(500).json({
          error:
            "Database migration required: fests.custom_fields is missing. Run server migrations before updating fest custom fields.",
        });
      }

      const statusCode = Number(error?.statusCode || error?.status);
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({ error: error.message || "Invalid approval routing configuration." });
      }

      return res.status(500).json({ 
        error: "Internal server error while updating fest.",
        details: error.message,
        context: {
          endpoint: `/api/fests/${req.params.festId}`,
          method: "PUT",
          userId: req.userId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

// POST publish fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.post(
  "/:festId/publish",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const { festId } = req.params;

      const festRecord = await queryOne(festTable, { where: { fest_id: festId } });
      if (!festRecord) {
        return res.status(404).json({ error: "Fest not found." });
      }

      if (asBoolean(festRecord?.is_archived)) {
        return res.status(400).json({
          error: "Archived fests cannot be published. Unarchive before publishing.",
        });
      }

      const lifecycleStatus = normalizeFestLifecycleStatus(festRecord);
      if (lifecycleStatus === LIFECYCLE_STATUS.PUBLISHED && !asBoolean(festRecord?.is_draft)) {
        return res.status(200).json({
          message: "Fest is already published",
          fest: mapFestResponse(festRecord),
          lifecycle_status: lifecycleStatus,
          activation_state: normalizeWorkflowStatus(festRecord?.activation_state, "ACTIVE"),
          is_live: true,
        });
      }

      if (lifecycleStatus === LIFECYCLE_STATUS.PENDING_APPROVALS) {
        return res.status(403).json({
          error: "403 Forbidden: Incomplete Approval Chain",
          code: "INCOMPLETE_APPROVAL_CHAIN",
          reason: "Approvals are still pending",
        });
      }

      const publishValidation = await validateFestApprovalChainForPublish({
        festRecord,
      });

      if (!publishValidation.ok) {
        return res.status(403).json({
          error: "403 Forbidden: Incomplete Approval Chain",
          code: "INCOMPLETE_APPROVAL_CHAIN",
          reason: publishValidation.reason,
        });
      }

      try {
        await update(
          festTable,
          {
            status: LIFECYCLE_STATUS.PUBLISHED,
            is_draft: false,
            activation_state: "ACTIVE",
            updated_at: new Date().toISOString(),
          },
          { fest_id: festId }
        );
      } catch (publishError) {
        if (!isMissingColumnError(publishError) || !String(publishError?.message || "").toLowerCase().includes("status")) {
          throw publishError;
        }

        await update(
          festTable,
          {
            is_draft: false,
            activation_state: "ACTIVE",
            updated_at: new Date().toISOString(),
          },
          { fest_id: festId }
        );
      }

      const refreshedFest = await queryOne(festTable, { where: { fest_id: festId } });
      const publishedFest = refreshedFest || festRecord;
      const shouldSendNotifications = shouldSendPublishBroadcast({
        record: publishedFest,
        sendNotificationsInput: req.body?.send_notifications,
        defaultSendNotifications: true,
        hasApprovalRequest: hasApprovalRequestReference(publishedFest),
        legacyWorkflowStatus: publishedFest?.workflow_status,
      });

      if (shouldSendNotifications) {
        sendBroadcastNotification({
          title: "Fest Published",
          message: `${publishedFest.fest_title || "A fest"} is now live!`,
          type: "info",
          event_id: festId,
          event_title: publishedFest.fest_title || null,
          action_url: `/fest/${festId}`,
        }).catch((notifError) => {
          console.error("❌ Failed to send fest publish notifications:", notifError);
        });
      } else {
        console.log(`ℹ️ Publish notification skipped for fest ${festId} (not live or notifications disabled).`);
      }

      if (isGatedEnabled() && (publishedFest.allow_outsiders === true || publishedFest.allow_outsiders === 'true')) {
        pushFestToGated(
          publishedFest,
          req.userInfo?.email || publishedFest.created_by,
          req.userInfo?.name || 'SOCIO Organiser'
        ).catch((gatedError) => {
          console.error("❌ Failed to push published fest to Gated:", gatedError.message);
        });
      }

      const resolvedActivationState = normalizeWorkflowStatus(
        publishedFest?.activation_state,
        "ACTIVE"
      );

      return res.status(200).json({
        message: "Fest published successfully",
        fest: mapFestResponse(publishedFest),
        lifecycle_status: normalizeFestLifecycleStatus(
          publishedFest,
          LIFECYCLE_STATUS.PUBLISHED
        ),
        activation_state: resolvedActivationState,
        is_live: resolvedActivationState === "ACTIVE" && !asBoolean(publishedFest?.is_draft),
      });
    } catch (error) {
      console.error("Server error POST /api/fests/:festId/publish:", error);
      return res.status(500).json({
        error: "Internal server error while publishing fest.",
      });
    }
  }
);

// PATCH archive/unarchive fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER
// When archiving a fest, all associated events are also archived
router.patch(
  "/:festId/archive",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    if (req.userInfo?.is_masteradmin || req.userInfo?.is_organiser) {
      return next();
    }
    return res.status(403).json({ error: "Access denied: Organiser privileges required" });
  },
  requireOwnership('fests', 'festId', 'auth_uuid'),
  async (req, res) => {
    try {
      const { festId } = req.params;
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

      // Archive/unarchive the fest
      const festTable = await getFestTableForDatabase(queryAll);
      const updatedFests = await update(
        festTable,
        {
          is_archived: archiveValue,
          archived_at: archiveValue ? nowIso : null,
          archived_by: archiveValue ? req.userInfo?.email || req.userId || null : null,
          updated_at: nowIso,
        },
        { fest_id: festId }
      );

      if (!updatedFests || updatedFests.length === 0) {
        return res.status(404).json({ error: "Fest not found." });
      }

      const updatedFest = updatedFests[0];

      // Also archive/unarchive all events linked to this fest.
      // We support both canonical fest_id links and legacy fest-title links.
      let allEvents = [];
      try {
        allEvents = await queryAll("events", { select: "event_id, fest_id, fest" });
      } catch (error) {
        if (isMissingRelationError(error)) {
          allEvents = [];
        } else if (isMissingColumnError(error)) {
          try {
            allEvents = await queryAll("events", { select: "event_id, fest_id" });
          } catch (fallbackError) {
            if (isMissingRelationError(fallbackError) || isMissingColumnError(fallbackError)) {
              allEvents = [];
            } else {
              throw fallbackError;
            }
          }
        } else {
          throw error;
        }
      }

      const matchKeys = new Set(
        [normalizeFestKey(festId), normalizeFestKey(updatedFest?.fest_title)].filter(Boolean)
      );

      const eventsToUpdate = (allEvents || []).filter((event) => {
        const matchesByFestId = matchKeys.has(normalizeFestKey(event?.fest_id));
        const matchesByLegacyFest = Object.prototype.hasOwnProperty.call(event || {}, "fest")
          ? matchKeys.has(normalizeFestKey(event?.fest))
          : false;

        return matchesByFestId || matchesByLegacyFest;
      });

      let eventsAffected = 0;
      if (eventsToUpdate.length > 0) {
        const buildEventArchivePayload = (includeArchivedBy = true) => ({
          is_archived: archiveValue,
          archived_at: archiveValue ? nowIso : null,
          ...(includeArchivedBy
            ? { archived_by: archiveValue ? req.userInfo?.email || req.userId || null : null }
            : {}),
          updated_at: nowIso,
        });

        for (const event of eventsToUpdate) {
          const eventId = String(event?.event_id || "").trim();
          if (!eventId) continue;

          try {
            const updatedRows = await update("events", buildEventArchivePayload(true), { event_id: eventId });
            if (Array.isArray(updatedRows) && updatedRows.length > 0) {
              eventsAffected += 1;
            }
            continue;
          } catch (error) {
            const code = String(error?.code || "");
            const message = String(error?.message || "").toLowerCase();
            const missingArchivedByColumn = code === "42703" && message.includes("archived_by");

            if (!missingArchivedByColumn) {
              throw error;
            }
          }

          const fallbackRows = await update("events", buildEventArchivePayload(false), { event_id: eventId });
          if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
            eventsAffected += 1;
          }
        }

        console.log(`✅ ${archiveValue ? "Archived" : "Unarchived"} ${eventsAffected} events for fest ${festId}`);
      }

      return res.status(200).json({
        message: archiveValue 
          ? `Fest and ${eventsAffected} associated events archived successfully.` 
          : "Fest and associated events moved back to active list.",
        fest: mapFestResponse(updatedFest),
        events_affected: eventsAffected,
      });
    } catch (error) {
      console.error("Server error PATCH /api/fests/:festId/archive:", error);
      return res.status(500).json({ error: "Internal server error while updating archive state." });
    }
  }
);

// DELETE fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.delete(
  "/:festId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),  // Master admin bypass built-in
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const { festId } = req.params;
      const existingFest = req.resource; // From ownership middleware

      // Delete associated events first (support both legacy and newer schemas)
      try {
        await remove("events", { fest_id: festId });
      } catch (eventDeleteError) {
        if (!isMissingColumnError(eventDeleteError)) {
          throw eventDeleteError;
        }
      }

      try {
        await remove("events", { fest: existingFest?.fest_title || festId });
      } catch (eventDeleteError) {
        if (!isMissingColumnError(eventDeleteError)) {
          throw eventDeleteError;
        }
      }

      // Delete fest image if exists
      if (existingFest.fest_image_url) {
        const festImagePath = getPathFromStorageUrl(existingFest.fest_image_url, "fest-images");
        if (festImagePath) {
          await deleteFileFromLocal(festImagePath, "fest-images");
        }
      }

      // Delete the fest
      const deleted = await remove(festTable, { fest_id: festId });
      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ error: "Fest not found" });
      }

      return res.status(200).json({
        message: "Fest and associated events deleted successfully"
      });

    } catch (error) {
      console.error("Error deleting fest:", error);
      return res.status(500).json({ error: "Internal server error while deleting fest." });
    }
  });

export default router;