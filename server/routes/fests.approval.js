import express from "express";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";
import { insert, queryAll, queryOne, update } from "../config/database.js";
import { ROLE_CODES, hasAnyRoleCode } from "../utils/roleAccessService.js";
import {
  resolveDepartmentSchoolForApprovals,
  resolveRoleMatrixApprover,
} from "../utils/roleMatrixApprover.js";
import {
  sendFestApprovedToAccountsEmail,
  sendFestApprovedToCfoEmail,
  sendFestFullyApprovedEmail,
  sendFestRejectedEmail,
} from "../utils/emailService.js";
import {
  sendBroadcastNotification,
  sendUserNotifications,
} from "./notificationRoutes.js";
import { shouldSendFinalApprovalBroadcast } from "../utils/notificationLifecycle.js";

const router = express.Router();

// Only apply auth middleware to approval-specific routes, not root GET /
// This allows festRoutes.js (mounted after) to handle public GET /
const requiresAuth = (req, res, next) => {
  // Apply auth requirement only to non-GET requests or specific approval paths
  if (req.method === 'GET' && req.path === '/') {
    return next();
  }
  if (req.path.includes('/approval-queue') || req.path.includes('-action') || req.path.includes('/activate') || req.path.includes('/submit')) {
    return authenticateUser(req, res, () => getUserInfo()(req, res, next));
  }
  // Context endpoint also requires auth
  if (req.method === 'GET' && req.path.includes('/context')) {
    return authenticateUser(req, res, () => getUserInfo()(req, res, next));
  }
  return next();
};

router.use(requiresAuth);

const FEST_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING_HOD: "pending_hod",
  HOD_APPROVED: "hod_approved",
  PENDING_DEAN: "pending_dean",
  DEAN_APPROVED: "dean_approved",
  PENDING_CFO: "pending_cfo",
  CFO_APPROVED: "cfo_approved",
  PENDING_ACCOUNTS: "pending_accounts",
  FULLY_APPROVED: "fully_approved",
  LIVE: "live",
  REJECTED: "rejected",
  FINAL_REJECTED: "final_rejected",
});

const REVIEWABLE_ACTIONS = new Set(["approved", "rejected", "returned_for_revision"]);
const REJECTION_ACTIONS = new Set(["rejected", "returned_for_revision"]);
const MIN_REVIEW_NOTE_LENGTH = 20;
const MAX_REVIEW_NOTE_LENGTH = 2000;
const BUDGET_SETTINGS_KEY = "__budget_approval__";
const API_APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.FRONTEND_URL ||
  "https://sociodev.vercel.app";

const normalizeText = (value) => String(value || "").trim();
const normalizeToken = (value) => normalizeText(value).toLowerCase();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const asBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  normalizeToken(value) === "true" ||
  normalizeToken(value) === "yes" ||
  normalizeToken(value) === "on";

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

const isMissingColumnError = (error, columnName = "") => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const normalizedColumn = String(columnName || "").toLowerCase();

  if (!normalizedColumn) {
    return code === "42703" || code === "PGRST204" || message.includes("column");
  }

  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes(`column \"${normalizedColumn}\"`) ||
    message.includes(`${normalizedColumn} does not exist`) ||
    (message.includes("could not find") && message.includes(normalizedColumn))
  );
};

const FEST_TABLE_CANDIDATES = ["fests", "fest"];

const toFestSlugCandidate = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveFestByReference = async (festReference, visited = new Set()) => {
  const normalizedReference = normalizeText(festReference);
  if (!normalizedReference) {
    return null;
  }

  const visitedKey = normalizeToken(normalizedReference);
  if (visited.has(visitedKey)) {
    return null;
  }
  visited.add(visitedKey);

  const normalizedKey = normalizeToken(normalizedReference);
  const normalizedSlug = toFestSlugCandidate(normalizedReference);

  for (const tableName of FEST_TABLE_CANDIDATES) {
    try {
      const exactFest = await queryOne(tableName, {
        where: { fest_id: normalizedReference },
      });

      if (exactFest) {
        return exactFest;
      }

      const rows = await queryAll(tableName, {
        select: "fest_id,fest_title",
      });

      const matchedFest = (rows || []).find((row) => {
        const festIdKey = normalizeToken(row?.fest_id);
        const festTitleKey = normalizeToken(row?.fest_title);
        const festIdSlug = toFestSlugCandidate(row?.fest_id);
        const festTitleSlug = toFestSlugCandidate(row?.fest_title);

        return (
          normalizedKey === festIdKey ||
          normalizedKey === festTitleKey ||
          normalizedSlug === festIdSlug ||
          normalizedSlug === festTitleSlug
        );
      });

      const resolvedFestId = normalizeText(matchedFest?.fest_id);
      if (resolvedFestId) {
        const resolvedFest = await queryOne(tableName, {
          where: { fest_id: resolvedFestId },
        });

        if (resolvedFest) {
          return resolvedFest;
        }
      }
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        continue;
      }

      throw error;
    }
  }

  // Legacy bridge: approval/entity refs may map through events.fest / events.fest_id.
  const eventSelectCandidates = [
    "event_id,fest_id,fest",
    "event_id,fest_id",
  ];

  for (const selectClause of eventSelectCandidates) {
    try {
      const eventRows = await queryAll("events", { select: selectClause });

      const matchedEvent = (eventRows || []).find((eventRow) => {
        return (
          normalizedKey === normalizeToken(eventRow?.fest_id) ||
          normalizedKey === normalizeToken(eventRow?.fest) ||
          normalizedSlug === toFestSlugCandidate(eventRow?.fest_id) ||
          normalizedSlug === toFestSlugCandidate(eventRow?.fest)
        );
      });

      const linkedFestReference = normalizeText(
        matchedEvent?.fest_id || matchedEvent?.fest
      );

      if (
        linkedFestReference &&
        normalizeToken(linkedFestReference) !== visitedKey
      ) {
        const bridgedFest = await resolveFestByReference(linkedFestReference, visited);
        if (bridgedFest) {
          return bridgedFest;
        }
      }
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        continue;
      }

      throw error;
    }
  }

  return null;
};

const parseNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getBudgetAmountFromCustomFields = (customFieldsValue) => {
  const parsedFields = parseJsonArray(customFieldsValue);
  const budgetField = parsedFields.find(
    (field) =>
      field &&
      typeof field === "object" &&
      !Array.isArray(field) &&
      normalizeText(field.key) === BUDGET_SETTINGS_KEY
  );

  if (!budgetField || typeof budgetField !== "object") {
    return { amount: 0, requiresBudgetApproval: false };
  }

  const settings = budgetField.value;
  if (!settings || typeof settings !== "object") {
    return { amount: 0, requiresBudgetApproval: false };
  }

  const requiresBudgetApproval = asBoolean(settings.requiresBudgetApproval);
  const explicitAmount =
    parseNumber(settings.amount) ||
    parseNumber(settings.totalAmount) ||
    parseNumber(settings.budget_amount) ||
    parseNumber(settings.estimated_budget_amount) ||
    parseNumber(settings.total_estimated_expense);
  const items = Array.isArray(settings.items) ? settings.items : [];

  const amountFromItems = items.reduce((sum, item) => {
    const price = parseNumber(item?.price);
    const quantity = parseNumber(item?.quantity || 1);
    const gstPercent = parseNumber(item?.gst);
    const subtotal = Math.max(0, price) * Math.max(0, quantity || 1);
    const gstAmount = subtotal * (Math.max(0, gstPercent) / 100);
    return sum + subtotal + gstAmount;
  }, 0);

  const amount = explicitAmount > 0 ? explicitAmount : amountFromItems;

  return {
    amount,
    requiresBudgetApproval,
  };
};

const getFestBudgetAmount = (festRecord) => {
  const explicitAmount =
    parseNumber(festRecord?.total_estimated_expense) ||
    parseNumber(festRecord?.estimated_budget_amount) ||
    parseNumber(festRecord?.budget_amount);

  if (explicitAmount > 0) {
    return explicitAmount;
  }

  const fromCustomFields = getBudgetAmountFromCustomFields(festRecord?.custom_fields);
  if (fromCustomFields.amount > 0) {
    return fromCustomFields.amount;
  }

  return 0;
};

const userHasRole = (userInfo, roleCode) => {
  if (!userInfo) return false;

  const roleCodes = Array.isArray(userInfo.role_codes) ? userInfo.role_codes : [];
  if (hasAnyRoleCode(roleCodes, [roleCode])) {
    return true;
  }

  if (roleCode === ROLE_CODES.HOD) {
    return asBoolean(userInfo.is_hod) || normalizeToken(userInfo.university_role) === "hod";
  }
  if (roleCode === ROLE_CODES.DEAN) {
    return asBoolean(userInfo.is_dean) || normalizeToken(userInfo.university_role) === "dean";
  }
  if (roleCode === ROLE_CODES.CFO) {
    return asBoolean(userInfo.is_cfo) || normalizeToken(userInfo.university_role) === "cfo";
  }

  if (roleCode === ROLE_CODES.ACCOUNTS || roleCode === ROLE_CODES.FINANCE_OFFICER) {
    return (
      asBoolean(userInfo.is_finance_office) ||
      asBoolean(userInfo.is_finance_officer) ||
      ["finance_officer", "accounts"].includes(normalizeToken(userInfo.university_role))
    );
  }

  return false;
};

const isMasterAdmin = (userInfo) => {
  if (!userInfo) return false;
  return asBoolean(userInfo.is_masteradmin) || userHasRole(userInfo, ROLE_CODES.MASTER_ADMIN);
};

const matchesScope = (candidate, requiredScope) => {
  if (!normalizeText(requiredScope)) return true;
  return normalizeToken(candidate) === normalizeToken(requiredScope);
};

const findApprover = async ({ roleCode, department, department_id, school, campus, excludeEmail }) =>
  resolveRoleMatrixApprover({ roleCode, department, department_id, school, campus, excludeEmail });

const resolveSchoolForFest = async (fest) => {
  const directSchool = normalizeText(fest?.organizing_school || fest?.school || fest?.school_id);
  if (directSchool) return directSchool;

  const deptId = normalizeText(fest?.organizing_dept_id);
  if (!deptId) {
    return null;
  }

  const mappedSchool = await resolveDepartmentSchoolForApprovals(deptId);
  if (mappedSchool) {
    return mappedSchool;
  }

  const hod = await findApprover({
    roleCode: ROLE_CODES.HOD,
    department_id: fest.organizing_dept_id || null,
    campus: fest.campus_hosted_at,
  });

  return normalizeText(hod?.school) || null;
};

const buildFestApprovalLink = (festId) => {
  const appOrigin = API_APP_URL.replace(/\/$/, "");
  return `${appOrigin}/approvals/fest/${encodeURIComponent(String(festId || ""))}`;
};

const buildFestApprovalActionPath = (festId) =>
  `/approvals/fest/${encodeURIComponent(String(festId || "").trim())}`;

const getFestRoleLabel = (roleCode) => {
  const normalizedRoleCode = normalizeToken(roleCode).toUpperCase();

  if (normalizedRoleCode === ROLE_CODES.HOD) return "HOD";
  if (normalizedRoleCode === ROLE_CODES.DEAN) return "Dean";
  if (normalizedRoleCode === ROLE_CODES.CFO) return "CFO";
  if (
    normalizedRoleCode === ROLE_CODES.ACCOUNTS ||
    normalizedRoleCode === ROLE_CODES.FINANCE_OFFICER
  ) {
    return "Finance Officer";
  }
  if (normalizedRoleCode === ROLE_CODES.ORGANIZER_TEACHER) return "Organizer";

  return normalizedRoleCode || "Approver";
};

const getFestOrganizerEmail = (fest, fallbackEmail = "") => {
  return normalizeEmail(
    fest?.contact_email || fest?.created_by || fallbackEmail || ""
  );
};

const sendFestBellNotification = async ({
  recipientEmails,
  fest,
  title,
  message,
  type = "info",
}) => {
  const festId = normalizeText(fest?.fest_id);
  if (!festId) return;

  const festTitle = normalizeText(fest?.fest_title) || festId;

  await sendUserNotifications({
    userEmails: recipientEmails,
    title,
    message,
    type,
    event_id: festId,
    event_title: festTitle,
    action_url: buildFestApprovalActionPath(festId),
  });
};

const notifyFestSubmissionTransition = async ({ fest, requesterEmail, nextApproverEmail }) => {
  const festTitle = normalizeText(fest?.fest_title) || "Fest";
  const organizerEmail = getFestOrganizerEmail(fest, requesterEmail);

  if (organizerEmail) {
    await sendFestBellNotification({
      recipientEmails: [organizerEmail],
      fest,
      title: "Fest sent for approval",
      message: `${festTitle} has been sent for approval. You will receive updates as reviews progress.`,
      type: "info",
    });
  }

  const approverEmail = normalizeEmail(nextApproverEmail);
  if (approverEmail) {
    await sendFestBellNotification({
      recipientEmails: [approverEmail],
      fest,
      title: `Approval required: ${festTitle}`,
      message: `${festTitle} has been submitted and is awaiting your approval.`,
      type: "warning",
    });
  }
};

const notifyFestDecisionTransition = async ({
  fest,
  requesterEmail,
  actorRoleCode,
  action,
  notes,
  status,
  nextApproverEmail,
  nextRoleCode,
}) => {
  const festTitle = normalizeText(fest?.fest_title) || "Fest";
  const organizerEmail = getFestOrganizerEmail(fest, requesterEmail);
  const normalizedAction = normalizeToken(action);
  const actorLabel = getFestRoleLabel(actorRoleCode);
  const normalizedStatus = normalizeToken(status);

  if (organizerEmail) {
    let organizerTitle = "Fest approval update";
    let organizerMessage = `${festTitle} has a new approval update.`;
    let organizerType = "info";

    if (normalizedAction === "approved") {
      if (normalizedStatus === FEST_STATUS.FULLY_APPROVED) {
        organizerTitle = "Fest fully approved";
        organizerMessage = `${festTitle} has been fully approved. You can now publish it.`;
        organizerType = "success";
      } else {
        const nextLabel = getFestRoleLabel(nextRoleCode);
        organizerTitle = `Fest approved by ${actorLabel}`;
        organizerMessage = `${festTitle} was approved by ${actorLabel} and routed to ${nextLabel} for the next review step.`;
        organizerType = "info";
      }
    } else if (normalizedAction === "rejected" || normalizedAction === "returned_for_revision") {
      const isFinal = normalizedStatus === FEST_STATUS.FINAL_REJECTED;
      organizerTitle = isFinal
        ? `Fest final rejected by ${actorLabel}`
        : `Fest rejected by ${actorLabel}`;
      organizerMessage = notes
        ? `${festTitle} was ${isFinal ? "final rejected" : "rejected"} by ${actorLabel}. Note: ${notes}`
        : `${festTitle} was ${isFinal ? "final rejected" : "rejected"} by ${actorLabel}.`;
      organizerType = "error";
    }

    await sendFestBellNotification({
      recipientEmails: [organizerEmail],
      fest,
      title: organizerTitle,
      message: organizerMessage,
      type: organizerType,
    });
  }

  if (normalizedAction === "approved") {
    const approverEmail = normalizeEmail(nextApproverEmail);
    if (approverEmail) {
      const nextLabel = getFestRoleLabel(nextRoleCode);
      await sendFestBellNotification({
        recipientEmails: [approverEmail],
        fest,
        title: `Approval required: ${festTitle}`,
        message: `${festTitle} has been routed to you for ${nextLabel} approval.`,
        type: "warning",
      });
    }
  }
};

const validateReviewActionPayload = ({ action, notes }) => {
  const normalizedAction = normalizeToken(action);
  if (!REVIEWABLE_ACTIONS.has(normalizedAction)) {
    return "Invalid action. Use approved, rejected, or returned_for_revision.";
  }

  if (REJECTION_ACTIONS.has(normalizedAction)) {
    const normalizedNotes = normalizeText(notes);
    if (normalizedNotes.length < MIN_REVIEW_NOTE_LENGTH) {
      return `Notes must be at least ${MIN_REVIEW_NOTE_LENGTH} characters for rejection/revision.`;
    }

    if (normalizedNotes.length > MAX_REVIEW_NOTE_LENGTH) {
      return `Notes must be ${MAX_REVIEW_NOTE_LENGTH} characters or fewer.`;
    }
  }

  return null;
};

const logApprovalAction = async ({
  entityType,
  entityId,
  step,
  action,
  actorEmail,
  actorRole,
  notes,
  version,
}) => {
  try {
    await insert("approval_chain_log", [
      {
        entity_type: entityType,
        entity_id: entityId,
        step,
        action,
        actor_email: normalizeEmail(actorEmail),
        actor_role: normalizeToken(actorRole),
        notes: normalizeText(notes) || null,
        version: Number.isFinite(Number(version)) ? Number(version) : 1,
      },
    ]);
  } catch (error) {
    console.warn("[FestApproval] Unable to insert approval chain log:", error?.message || error);
  }
};

const countStepRejections = async ({ entityId, step, version }) => {
  try {
    const rows = await queryAll("approval_chain_log", {
      where: {
        entity_type: "fest",
        entity_id: entityId,
        step,
        version,
      },
    });

    return (rows || []).filter((row) => REJECTION_ACTIONS.has(normalizeToken(row?.action))).length;
  } catch {
    return 0;
  }
};

const canUserManageFest = (fest, userInfo, userId) => {
  if (!fest || !userInfo) return false;
  if (isMasterAdmin(userInfo)) return true;

  const requesterEmail = normalizeEmail(userInfo.email);
  return (
    normalizeText(fest.auth_uuid) === normalizeText(userId) ||
    normalizeEmail(fest.created_by) === requesterEmail ||
    normalizeEmail(fest.contact_email) === requesterEmail
  );
};

const updateFestWorkflow = async (festId, workflowStatus, extraUpdates = {}) => {
  const updates = {
    workflow_status: workflowStatus,
    ...extraUpdates,
  };

  const updatedRows = await update("fests", updates, { fest_id: festId });
  const updatedFest =
    Array.isArray(updatedRows) && updatedRows.length > 0
      ? updatedRows[0]
      : await queryOne("fests", { where: { fest_id: festId } });

  if (
    normalizeToken(workflowStatus) === FEST_STATUS.FULLY_APPROVED &&
    updatedFest?.fest_id
  ) {
    const festTitle = normalizeText(updatedFest?.fest_title) || updatedFest.fest_id;
    const shouldBroadcast = shouldSendFinalApprovalBroadcast({
      record: {
        ...updatedFest,
        status: updatedFest?.status || "approved",
        activation_state: updatedFest?.activation_state || "ACTIVE",
        is_draft: updatedFest?.is_draft ?? false,
      },
      defaultSendNotifications: true,
      requireLiveRecord: false,
    });

    if (shouldBroadcast) {
      sendBroadcastNotification({
        title: "Fest Approved",
        message: `${festTitle} has been approved.`,
        type: "info",
        event_id: updatedFest.fest_id,
        event_title: festTitle,
        action_url: `/fest/${encodeURIComponent(updatedFest.fest_id)}`,
      }).catch((broadcastError) => {
        console.error("[FestApprovalBroadcast] final-approval broadcast error:", broadcastError);
      });
    }
  }

  return updatedFest;
};

const submitToHod = async ({ fest, requester }) => {
  const hod = await findApprover({
    roleCode: ROLE_CODES.HOD,
    department_id: fest.organizing_dept_id || null,
    campus: fest.campus_hosted_at,
    excludeEmail: fest.contact_email,
  });

  const hodAvailable = hod?.email && normalizeEmail(hod.email) !== normalizeEmail(requester.email);

  if (!hodAvailable) {
    // No HOD assigned — route directly to Dean if available
    const school = await resolveSchoolForFest(fest);
    const dean = await findApprover({
      roleCode: ROLE_CODES.DEAN,
      school,
      campus: fest.campus_hosted_at,
      excludeEmail: fest.contact_email,
    });

    if (dean?.email && normalizeEmail(dean.email) !== normalizeEmail(requester.email)) {
      const currentVersion = Number(fest.workflow_version) || 1;
      const nextVersion = normalizeToken(fest.workflow_status) === FEST_STATUS.REJECTED
        ? currentVersion + 1 : currentVersion;

      const updatedFest = await updateFestWorkflow(fest.fest_id, FEST_STATUS.PENDING_DEAN, {
        workflow_version: nextVersion,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityType: "fest",
        entityId: fest.fest_id,
        step: "dean_review",
        action: "submitted",
        actorEmail: requester.email,
        actorRole: "organizer",
        notes: "No HOD assigned; routed directly to Dean.",
        version: nextVersion,
      });

      return { updatedFest, dean, routedToDean: true };
    }

    // No HOD or Dean for this scope — skip dept approval.
    // If the fest is budget-related, route straight to CFO; otherwise mark fully approved.
    const currentVersion = Number(fest.workflow_version) || 1;
    const nextVersion = normalizeToken(fest.workflow_status) === FEST_STATUS.REJECTED
      ? currentVersion + 1 : currentVersion;

    const budgetAmount = getFestBudgetAmount(fest);
    if (budgetAmount > 0) {
      const cfo = await findApprover({
        roleCode: ROLE_CODES.CFO,
        campus: fest.campus_hosted_at,
        excludeEmail: fest.contact_email,
      });

      if (cfo?.email && normalizeEmail(cfo.email) !== normalizeEmail(requester.email)) {
        const updatedFest = await updateFestWorkflow(fest.fest_id, FEST_STATUS.PENDING_CFO, {
          workflow_version: nextVersion,
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        });

        await logApprovalAction({
          entityType: "fest",
          entityId: fest.fest_id,
          step: "cfo_review",
          action: "submitted",
          actorEmail: requester.email,
          actorRole: "organizer",
          notes: "No HOD or Dean assigned for this scope; routed to CFO.",
          version: nextVersion,
        });

        return { updatedFest, cfo, routedToCfo: true };
      }
    }

    const updatedFest = await updateFestWorkflow(fest.fest_id, FEST_STATUS.FULLY_APPROVED, {
      workflow_version: nextVersion,
      approved_at: new Date().toISOString(),
      approved_by: normalizeEmail(requester.email),
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
    });

    await logApprovalAction({
      entityType: "fest",
      entityId: fest.fest_id,
      step: "auto_approval",
      action: "auto_approved",
      actorEmail: requester.email,
      actorRole: "system",
      notes: "No HOD or Dean assigned for this scope; fest auto-approved.",
      version: nextVersion,
    });

    return { updatedFest, hod: null, autoApproved: true };
  }

  if (normalizeEmail(hod.email) === normalizeEmail(requester.email)) {
    return { error: "You cannot submit a fest to yourself for approval." };
  }

  const currentVersion = Number(fest.workflow_version) || 1;
  const nextVersion = normalizeToken(fest.workflow_status) === FEST_STATUS.REJECTED
    ? currentVersion + 1
    : currentVersion;

  const updatedFest = await updateFestWorkflow(fest.fest_id, FEST_STATUS.PENDING_HOD, {
    workflow_version: nextVersion,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
  });

  await logApprovalAction({
    entityType: "fest",
    entityId: fest.fest_id,
    step: "hod_review",
    action: "submitted",
    actorEmail: requester.email,
    actorRole: "organizer",
    notes: null,
    version: nextVersion,
  });

  return { updatedFest, hod };
};

const ensureScopedApproverForFest = ({ fest, requester, roleCode }) => {
  if (isMasterAdmin(requester)) return null;

  if (roleCode === ROLE_CODES.HOD) {
    const deptMatch =
      !fest.organizing_dept_id ||
      (requester.department_id && fest.organizing_dept_id &&
        requester.department_id === fest.organizing_dept_id);
    if (!deptMatch) {
      return "Only the HOD of the fest department can take this action.";
    }
  }

  if (roleCode === ROLE_CODES.CFO && !matchesScope(requester.campus, fest.campus_hosted_at)) {
    return "Only the campus CFO can take this action.";
  }

  return null;
};

const ensureDeanScope = async ({ fest, requester }) => {
  if (isMasterAdmin(requester)) return null;

  const festSchool = await resolveSchoolForFest(fest);
  if (!festSchool) {
    return "School mapping for this fest is missing. Unable to validate Dean scope.";
  }

  if (!matchesScope(requester.school || requester.school_id, festSchool)) {
    return "Only the Dean of this school can take this action.";
  }

  return null;
};

const notifyFestRejection = async ({ fest, step, notes, requester }) => {
  const organizerEmail = normalizeEmail(fest.contact_email || fest.created_by || requester?.email);
  if (!organizerEmail) return;

  await sendFestRejectedEmail({
    to: organizerEmail,
    festName: fest.fest_title || fest.fest_id,
    requesterName: normalizeText(fest.created_by),
    requesterEmail: organizerEmail,
    submittedAt: fest.created_at,
    step,
    notes,
    link: `${API_APP_URL.replace(/\/$/, "")}/edit/fest/${encodeURIComponent(fest.fest_id)}`,
  });
};


const canAccessFestApprovalContext = async ({ fest, requester, userId }) => {
  if (isMasterAdmin(requester)) return true;

  if (canUserManageFest(fest, requester, userId)) {
    return true;
  }

  if (userHasRole(requester, ROLE_CODES.HOD)) {
    const hodDeptMatch =
      !fest?.organizing_dept_id ||
      (requester?.department_id && fest?.organizing_dept_id &&
        requester.department_id === fest.organizing_dept_id);
    if (hodDeptMatch && matchesScope(requester?.campus, fest?.campus_hosted_at)) {
      return true;
    }
  }

  if (userHasRole(requester, ROLE_CODES.DEAN)) {
    const school = await resolveSchoolForFest(fest);
    if (
      matchesScope(requester?.school || requester?.school_id, school) &&
      matchesScope(requester?.campus, fest?.campus_hosted_at)
    ) {
      return true;
    }
  }

  if (userHasRole(requester, ROLE_CODES.CFO)) {
    if (matchesScope(requester?.campus, fest?.campus_hosted_at)) {
      return true;
    }
  }

  if (
    userHasRole(requester, ROLE_CODES.ACCOUNTS) ||
    userHasRole(requester, ROLE_CODES.FINANCE_OFFICER)
  ) {
    if (matchesScope(requester?.campus, fest?.campus_hosted_at)) {
      return true;
    }
  }

  return false;
};

router.get("/:festId/context", async (req, res) => {
  try {
    let festId = normalizeText(req.params.festId);
    if (!festId) {
      return res.status(400).json({ error: "Fest ID is required." });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) {
      return res.status(404).json({ error: "Fest not found." });
    }

    festId = normalizeText(fest?.fest_id) || festId;

    const allowed = await canAccessFestApprovalContext({
      fest,
      requester: req.userInfo,
      userId: req.userId,
    });

    if (!allowed) {
      return res.status(403).json({
        error: "You are not authorized to view this fest approval context.",
      });
    }

    let logs = [];
    try {
      logs =
        (await queryAll("approval_chain_log", {
          where: {
            entity_type: "fest",
            entity_id: festId,
          },
          order: { column: "created_at", ascending: true },
        })) || [];
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }

    const school = await resolveSchoolForFest(fest);
    const [hod, dean, cfo, accounts] = await Promise.all([
      findApprover({
        roleCode: ROLE_CODES.HOD,
        department_id: fest.organizing_dept_id || null,
        campus: fest.campus_hosted_at,
      }),
      findApprover({
        roleCode: ROLE_CODES.DEAN,
        school,
        campus: fest.campus_hosted_at,
      }),
      findApprover({
        roleCode: ROLE_CODES.CFO,
        campus: fest.campus_hosted_at,
      }),
      findApprover({
        roleCode: ROLE_CODES.ACCOUNTS,
        campus: fest.campus_hosted_at,
      }),
    ]);

    const resolvedBudgetAmount = getFestBudgetAmount(fest);
    const festForContext = {
      ...fest,
      budget_amount:
        parseNumber(fest?.budget_amount) > 0
          ? parseNumber(fest?.budget_amount)
          : resolvedBudgetAmount || null,
      estimated_budget_amount:
        parseNumber(fest?.estimated_budget_amount) > 0
          ? parseNumber(fest?.estimated_budget_amount)
          : resolvedBudgetAmount || null,
      total_estimated_expense:
        parseNumber(fest?.total_estimated_expense) > 0
          ? parseNumber(fest?.total_estimated_expense)
          : resolvedBudgetAmount || null,
    };

    return res.status(200).json({
      fest: festForContext,
      logs,
      approvers: {
        hod: hod
          ? { name: hod.name || null, email: normalizeEmail(hod.email), department: hod.department || null }
          : null,
        dean: dean
          ? { name: dean.name || null, email: normalizeEmail(dean.email), school: dean.school || null }
          : null,
        cfo: cfo ? { name: cfo.name || null, email: normalizeEmail(cfo.email) } : null,
        accounts: accounts
          ? { name: accounts.name || null, email: normalizeEmail(accounts.email) }
          : null,
      },
      permissions: {
        can_manage: canUserManageFest(fest, req.userInfo, req.userId) || isMasterAdmin(req.userInfo),
      },
    });
  } catch (error) {
    console.error("[FestApproval] context error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/:festId/submit", async (req, res) => {
  try {
    let festId = normalizeText(req.params.festId);
    if (!festId) {
      return res.status(400).json({ error: "Fest ID is required." });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) {
      return res.status(404).json({ error: "Fest not found." });
    }

    festId = normalizeText(fest?.fest_id) || festId;

    if (!canUserManageFest(fest, req.userInfo, req.userId)) {
      return res.status(403).json({ error: "Only the fest organizer can submit this fest." });
    }

    const currentStatus = normalizeToken(fest.workflow_status || FEST_STATUS.DRAFT);
    if (![FEST_STATUS.DRAFT, FEST_STATUS.REJECTED].includes(currentStatus)) {
      return res.status(400).json({
        error: `Fest cannot be submitted from status '${currentStatus}'.`,
      });
    }

    if (currentStatus === FEST_STATUS.FINAL_REJECTED) {
      return res.status(400).json({
        error: "Fest is final rejected. Master admin intervention is required.",
      });
    }

    const submission = await submitToHod({
      fest,
      requester: req.userInfo,
    });

    if (submission.error) {
      return res.status(400).json({ error: submission.error });
    }

    const nextRole = submission.routedToDean ? "dean" : "hod";
    const nextApprover = submission.routedToDean ? submission.dean : submission.hod;
    const nextStatus = submission.routedToDean ? FEST_STATUS.PENDING_DEAN : FEST_STATUS.PENDING_HOD;

    notifyFestSubmissionTransition({
      fest: submission.updatedFest || fest,
      requesterEmail: req.userInfo?.email,
      nextApproverEmail: nextApprover?.email || null,
    }).catch((notificationError) => {
      console.error("[FestApprovalNotify] submit notification error:", notificationError);
    });

    return res.status(200).json({
      success: true,
      status: nextStatus,
      routed_to: {
        role: nextRole,
        name: nextApprover?.name || null,
        email: nextApprover?.email || null,
      },
      fest: submission.updatedFest,
    });
  } catch (error) {
    console.error("[FestApproval] submit error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:festId/hod-action", async (req, res) => {
  try {
    if (!userHasRole(req.userInfo, ROLE_CODES.HOD) && !isMasterAdmin(req.userInfo)) {
      return res.status(403).json({ error: "Only HOD can perform this action." });
    }

    let festId = normalizeText(req.params.festId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewActionPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) {
      return res.status(404).json({ error: "Fest not found." });
    }

    festId = normalizeText(fest?.fest_id) || festId;

    if (normalizeToken(fest.workflow_status) !== FEST_STATUS.PENDING_HOD) {
      return res.status(400).json({ error: "Fest is not pending HOD approval." });
    }

    const scopeError = ensureScopedApproverForFest({ fest, requester: req.userInfo, roleCode: ROLE_CODES.HOD });
    if (scopeError) {
      return res.status(403).json({ error: scopeError });
    }

    if (normalizeEmail(fest.contact_email) === normalizeEmail(req.userInfo.email)) {
      return res.status(400).json({ error: "Approver cannot approve their own submission." });
    }

    const version = Number(fest.workflow_version) || 1;

    if (action === "approved") {
      const school = await resolveSchoolForFest(fest);
      const dean = await findApprover({
        roleCode: ROLE_CODES.DEAN,
        school,
        campus: fest.campus_hosted_at,
        excludeEmail: fest.contact_email,
      });

      await logApprovalAction({
        entityType: "fest",
        entityId: festId,
        step: "hod_review",
        action,
        actorEmail: req.userInfo.email,
        actorRole: "hod",
        notes,
        version,
      });

      if (dean?.email && normalizeEmail(dean.email) !== normalizeEmail(req.userInfo.email)) {
        const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.PENDING_DEAN, {
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        });

        notifyFestDecisionTransition({
          fest: updatedFest || fest,
          requesterEmail: req.userInfo?.email,
          actorRoleCode: ROLE_CODES.HOD,
          action,
          notes,
          status: FEST_STATUS.PENDING_DEAN,
          nextApproverEmail: dean.email,
          nextRoleCode: ROLE_CODES.DEAN,
        }).catch((notificationError) => {
          console.error("[FestApprovalNotify] hod-action dean-route notification error:", notificationError);
        });

        return res.status(200).json({
          success: true,
          status: FEST_STATUS.PENDING_DEAN,
          routed_to: {
            role: "dean",
            name: dean.name || null,
            email: dean.email,
          },
          fest: updatedFest,
        });
      }

      await logApprovalAction({
        entityType: "fest",
        entityId: festId,
        step: "dean_review",
        action: "hod_dean_combined",
        actorEmail: req.userInfo.email,
        actorRole: "hod_dean",
        notes,
        version,
      });

      const budgetAmount = getFestBudgetAmount(fest);
      if (budgetAmount > 0) {
        const cfo = await findApprover({
          roleCode: ROLE_CODES.CFO,
          campus: fest.campus_hosted_at,
          excludeEmail: fest.contact_email,
        });

        if (!cfo?.email) {
          return res.status(400).json({
            error: "No campus CFO configured for this fest. Cannot continue budget approval flow.",
          });
        }

        const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.PENDING_CFO, {
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        });

        await sendFestApprovedToCfoEmail({
          to: cfo.email,
          festName: fest.fest_title || festId,
          requesterName: req.userInfo.name,
          requesterEmail: req.userInfo.email,
          submittedAt: new Date().toISOString(),
          amount: budgetAmount,
          link: buildFestApprovalLink(festId),
        });

        notifyFestDecisionTransition({
          fest: updatedFest || fest,
          requesterEmail: req.userInfo?.email,
          actorRoleCode: ROLE_CODES.HOD,
          action,
          notes,
          status: FEST_STATUS.PENDING_CFO,
          nextApproverEmail: cfo.email,
          nextRoleCode: ROLE_CODES.CFO,
        }).catch((notificationError) => {
          console.error("[FestApprovalNotify] hod-action cfo-route notification error:", notificationError);
        });

        return res.status(200).json({
          success: true,
          status: FEST_STATUS.PENDING_CFO,
          routed_to: {
            role: "cfo",
            name: cfo.name || null,
            email: cfo.email,
          },
          fest: updatedFest,
        });
      }

      const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.FULLY_APPROVED, {
        approved_at: new Date().toISOString(),
        approved_by: normalizeEmail(req.userInfo.email),
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await sendFestFullyApprovedEmail({
        to: normalizeEmail(fest.contact_email || fest.created_by),
        festName: fest.fest_title || festId,
        requesterName: req.userInfo.name,
        requesterEmail: req.userInfo.email,
        submittedAt: fest.created_at,
        link: `${API_APP_URL.replace(/\/$/, "")}/fest/${encodeURIComponent(festId)}`,
      });

      notifyFestDecisionTransition({
        fest: updatedFest || fest,
        requesterEmail: req.userInfo?.email,
        actorRoleCode: ROLE_CODES.HOD,
        action,
        notes,
        status: FEST_STATUS.FULLY_APPROVED,
      }).catch((notificationError) => {
        console.error("[FestApprovalNotify] hod-action final-approval notification error:", notificationError);
      });

      return res.status(200).json({ success: true, status: FEST_STATUS.FULLY_APPROVED, fest: updatedFest });
    }

    const rejectionCount = await countStepRejections({ entityId: festId, step: "hod_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? FEST_STATUS.FINAL_REJECTED : FEST_STATUS.REJECTED;

    const updatedFest = await updateFestWorkflow(festId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: normalizeEmail(req.userInfo.email),
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityType: "fest",
      entityId: festId,
      step: "hod_review",
      action,
      actorEmail: req.userInfo.email,
      actorRole: "hod",
      notes,
      version,
    });

    await notifyFestRejection({ fest, step: "HOD", notes, requester: req.userInfo });

    notifyFestDecisionTransition({
      fest: updatedFest || fest,
      requesterEmail: req.userInfo?.email,
      actorRoleCode: ROLE_CODES.HOD,
      action,
      notes,
      status,
    }).catch((notificationError) => {
      console.error("[FestApprovalNotify] hod-action rejection notification error:", notificationError);
    });

    return res.status(200).json({ success: true, status, fest: updatedFest });
  } catch (error) {
    console.error("[FestApproval] hod-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:festId/dean-action", async (req, res) => {
  try {
    if (!userHasRole(req.userInfo, ROLE_CODES.DEAN) && !isMasterAdmin(req.userInfo)) {
      return res.status(403).json({ error: "Only Dean can perform this action." });
    }

    let festId = normalizeText(req.params.festId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewActionPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) return res.status(404).json({ error: "Fest not found." });

    festId = normalizeText(fest?.fest_id) || festId;

    if (normalizeToken(fest.workflow_status) !== FEST_STATUS.PENDING_DEAN) {
      return res.status(400).json({ error: "Fest is not pending Dean approval." });
    }

    const deanScopeError = await ensureDeanScope({ fest, requester: req.userInfo });
    if (deanScopeError) {
      return res.status(403).json({ error: deanScopeError });
    }

    if (normalizeEmail(fest.contact_email) === normalizeEmail(req.userInfo.email)) {
      return res.status(400).json({ error: "Approver cannot approve their own submission." });
    }

    const version = Number(fest.workflow_version) || 1;

    if (action === "approved") {
      await logApprovalAction({
        entityType: "fest",
        entityId: festId,
        step: "dean_review",
        action,
        actorEmail: req.userInfo.email,
        actorRole: "dean",
        notes,
        version,
      });

      const budgetAmount = getFestBudgetAmount(fest);
      if (budgetAmount > 0) {
        const cfo = await findApprover({
          roleCode: ROLE_CODES.CFO,
          campus: fest.campus_hosted_at,
          excludeEmail: fest.contact_email,
        });

        if (!cfo?.email) {
          return res.status(400).json({
            error: "No campus CFO configured for this fest. Cannot continue budget approval flow.",
          });
        }

        const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.PENDING_CFO, {
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        });

        await sendFestApprovedToCfoEmail({
          to: cfo.email,
          festName: fest.fest_title || festId,
          requesterName: req.userInfo.name,
          requesterEmail: req.userInfo.email,
          submittedAt: new Date().toISOString(),
          amount: budgetAmount,
          link: buildFestApprovalLink(festId),
        });

        notifyFestDecisionTransition({
          fest: updatedFest || fest,
          requesterEmail: req.userInfo?.email,
          actorRoleCode: ROLE_CODES.DEAN,
          action,
          notes,
          status: FEST_STATUS.PENDING_CFO,
          nextApproverEmail: cfo.email,
          nextRoleCode: ROLE_CODES.CFO,
        }).catch((notificationError) => {
          console.error("[FestApprovalNotify] dean-action cfo-route notification error:", notificationError);
        });

        return res.status(200).json({
          success: true,
          status: FEST_STATUS.PENDING_CFO,
          routed_to: {
            role: "cfo",
            name: cfo.name || null,
            email: cfo.email,
          },
          fest: updatedFest,
        });
      }

      const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.FULLY_APPROVED, {
        approved_at: new Date().toISOString(),
        approved_by: normalizeEmail(req.userInfo.email),
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await sendFestFullyApprovedEmail({
        to: normalizeEmail(fest.contact_email || fest.created_by),
        festName: fest.fest_title || festId,
        requesterName: req.userInfo.name,
        requesterEmail: req.userInfo.email,
        submittedAt: fest.created_at,
        link: `${API_APP_URL.replace(/\/$/, "")}/fest/${encodeURIComponent(festId)}`,
      });

      notifyFestDecisionTransition({
        fest: updatedFest || fest,
        requesterEmail: req.userInfo?.email,
        actorRoleCode: ROLE_CODES.DEAN,
        action,
        notes,
        status: FEST_STATUS.FULLY_APPROVED,
      }).catch((notificationError) => {
        console.error("[FestApprovalNotify] dean-action final-approval notification error:", notificationError);
      });

      return res.status(200).json({ success: true, status: FEST_STATUS.FULLY_APPROVED, fest: updatedFest });
    }

    const rejectionCount = await countStepRejections({ entityId: festId, step: "dean_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? FEST_STATUS.FINAL_REJECTED : FEST_STATUS.REJECTED;

    const updatedFest = await updateFestWorkflow(festId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: normalizeEmail(req.userInfo.email),
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityType: "fest",
      entityId: festId,
      step: "dean_review",
      action,
      actorEmail: req.userInfo.email,
      actorRole: "dean",
      notes,
      version,
    });

    await notifyFestRejection({ fest, step: "Dean", notes, requester: req.userInfo });

    notifyFestDecisionTransition({
      fest: updatedFest || fest,
      requesterEmail: req.userInfo?.email,
      actorRoleCode: ROLE_CODES.DEAN,
      action,
      notes,
      status,
    }).catch((notificationError) => {
      console.error("[FestApprovalNotify] dean-action rejection notification error:", notificationError);
    });

    return res.status(200).json({ success: true, status, fest: updatedFest });
  } catch (error) {
    console.error("[FestApproval] dean-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:festId/cfo-action", async (req, res) => {
  try {
    if (!userHasRole(req.userInfo, ROLE_CODES.CFO) && !isMasterAdmin(req.userInfo)) {
      return res.status(403).json({ error: "Only CFO can perform this action." });
    }

    let festId = normalizeText(req.params.festId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewActionPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) return res.status(404).json({ error: "Fest not found." });

    festId = normalizeText(fest?.fest_id) || festId;

    if (normalizeToken(fest.workflow_status) !== FEST_STATUS.PENDING_CFO) {
      return res.status(400).json({ error: "Fest is not pending CFO approval." });
    }

    const cfoScopeError = ensureScopedApproverForFest({ fest, requester: req.userInfo, roleCode: ROLE_CODES.CFO });
    if (cfoScopeError) {
      return res.status(403).json({ error: cfoScopeError });
    }

    const version = Number(fest.workflow_version) || 1;

    if (action === "approved") {
      await logApprovalAction({
        entityType: "fest",
        entityId: festId,
        step: "cfo_review",
        action,
        actorEmail: req.userInfo.email,
        actorRole: "cfo",
        notes,
        version,
      });

      const accounts = await findApprover({
        roleCode: ROLE_CODES.ACCOUNTS,
        campus: fest.campus_hosted_at,
        excludeEmail: fest.contact_email,
      });

      if (!accounts?.email) {
        return res.status(400).json({ error: "No finance officer configured for this campus." });
      }

      const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.PENDING_ACCOUNTS, {
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await sendFestApprovedToAccountsEmail({
        to: accounts.email,
        festName: fest.fest_title || festId,
        requesterName: req.userInfo.name,
        requesterEmail: req.userInfo.email,
        submittedAt: new Date().toISOString(),
        link: buildFestApprovalLink(festId),
      });

      notifyFestDecisionTransition({
        fest: updatedFest || fest,
        requesterEmail: req.userInfo?.email,
        actorRoleCode: ROLE_CODES.CFO,
        action,
        notes,
        status: FEST_STATUS.PENDING_ACCOUNTS,
        nextApproverEmail: accounts.email,
        nextRoleCode: ROLE_CODES.ACCOUNTS,
      }).catch((notificationError) => {
        console.error("[FestApprovalNotify] cfo-action accounts-route notification error:", notificationError);
      });

      return res.status(200).json({
        success: true,
        status: FEST_STATUS.PENDING_ACCOUNTS,
        routed_to: {
          role: "finance_officer",
          name: accounts.name || null,
          email: accounts.email,
        },
        fest: updatedFest,
      });
    }

    const rejectionCount = await countStepRejections({ entityId: festId, step: "cfo_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? FEST_STATUS.FINAL_REJECTED : FEST_STATUS.REJECTED;

    const updatedFest = await updateFestWorkflow(festId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: normalizeEmail(req.userInfo.email),
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityType: "fest",
      entityId: festId,
      step: "cfo_review",
      action,
      actorEmail: req.userInfo.email,
      actorRole: "cfo",
      notes,
      version,
    });

    await notifyFestRejection({ fest, step: "CFO", notes, requester: req.userInfo });

    notifyFestDecisionTransition({
      fest: updatedFest || fest,
      requesterEmail: req.userInfo?.email,
      actorRoleCode: ROLE_CODES.CFO,
      action,
      notes,
      status,
    }).catch((notificationError) => {
      console.error("[FestApprovalNotify] cfo-action rejection notification error:", notificationError);
    });

    return res.status(200).json({ success: true, status, fest: updatedFest });
  } catch (error) {
    console.error("[FestApproval] cfo-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:festId/accounts-action", async (req, res) => {
  try {
    const canReview =
      userHasRole(req.userInfo, ROLE_CODES.ACCOUNTS) ||
      userHasRole(req.userInfo, ROLE_CODES.FINANCE_OFFICER) ||
      isMasterAdmin(req.userInfo);

    if (!canReview) {
      return res.status(403).json({ error: "Only Finance Officer can perform this action." });
    }

    let festId = normalizeText(req.params.festId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewActionPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) return res.status(404).json({ error: "Fest not found." });

    festId = normalizeText(fest?.fest_id) || festId;

    if (normalizeToken(fest.workflow_status) !== FEST_STATUS.PENDING_ACCOUNTS) {
      return res.status(400).json({ error: "Fest is not pending Accounts approval." });
    }

    const version = Number(fest.workflow_version) || 1;

    if (action === "approved") {
      const updatedFest = await updateFestWorkflow(festId, FEST_STATUS.FULLY_APPROVED, {
        approved_at: new Date().toISOString(),
        approved_by: normalizeEmail(req.userInfo.email),
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityType: "fest",
        entityId: festId,
        step: "accounts_review",
        action,
        actorEmail: req.userInfo.email,
        actorRole: "finance_officer",
        notes,
        version,
      });

      await sendFestFullyApprovedEmail({
        to: normalizeEmail(fest.contact_email || fest.created_by),
        festName: fest.fest_title || festId,
        requesterName: req.userInfo.name,
        requesterEmail: req.userInfo.email,
        submittedAt: fest.created_at,
        link: `${API_APP_URL.replace(/\/$/, "")}/fest/${encodeURIComponent(festId)}`,
      });

      notifyFestDecisionTransition({
        fest: updatedFest || fest,
        requesterEmail: req.userInfo?.email,
        actorRoleCode: ROLE_CODES.ACCOUNTS,
        action,
        notes,
        status: FEST_STATUS.FULLY_APPROVED,
      }).catch((notificationError) => {
        console.error("[FestApprovalNotify] accounts-action final-approval notification error:", notificationError);
      });

      return res.status(200).json({ success: true, status: FEST_STATUS.FULLY_APPROVED, fest: updatedFest });
    }

    const rejectionCount = await countStepRejections({ entityId: festId, step: "accounts_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? FEST_STATUS.FINAL_REJECTED : FEST_STATUS.REJECTED;

    const updatedFest = await updateFestWorkflow(festId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: normalizeEmail(req.userInfo.email),
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityType: "fest",
      entityId: festId,
      step: "accounts_review",
      action,
      actorEmail: req.userInfo.email,
      actorRole: "finance_officer",
      notes,
      version,
    });

    await notifyFestRejection({ fest, step: "Accounts", notes, requester: req.userInfo });

    notifyFestDecisionTransition({
      fest: updatedFest || fest,
      requesterEmail: req.userInfo?.email,
      actorRoleCode: ROLE_CODES.ACCOUNTS,
      action,
      notes,
      status,
    }).catch((notificationError) => {
      console.error("[FestApprovalNotify] accounts-action rejection notification error:", notificationError);
    });

    return res.status(200).json({ success: true, status, fest: updatedFest });
  } catch (error) {
    console.error("[FestApproval] accounts-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:festId/activate", async (req, res) => {
  try {
    let festId = normalizeText(req.params.festId);
    if (!festId) {
      return res.status(400).json({ error: "Fest ID is required." });
    }

    const fest = await resolveFestByReference(festId);
    if (!fest) {
      return res.status(404).json({ error: "Fest not found." });
    }

    festId = normalizeText(fest?.fest_id) || festId;

    if (!canUserManageFest(fest, req.userInfo, req.userId)) {
      return res.status(403).json({ error: "Only the fest organizer can activate this fest." });
    }

    if (normalizeToken(fest.workflow_status) !== FEST_STATUS.FULLY_APPROVED) {
      return res.status(400).json({
        error: "Fest must be fully approved before activation.",
      });
    }

    await updateFestWorkflow(festId, FEST_STATUS.LIVE, {
      activated_at: new Date().toISOString(),
      activated_by: normalizeEmail(req.userInfo.email),
    });

    return res.status(200).json({ success: true, status: FEST_STATUS.LIVE });
  } catch (error) {
    console.error("[FestApproval] activate error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/approval-queue", async (req, res) => {
  try {
    const roleCodes = Array.isArray(req.userInfo?.role_codes) ? req.userInfo.role_codes : [];
    const canViewAll = isMasterAdmin(req.userInfo);

    const fests = await queryAll("fests", {
      order: { column: "created_at", ascending: false },
    });

    const filtered = (fests || []).filter((fest) => {
      const status = normalizeToken(fest.workflow_status);
      const deptMatches =
        !fest.organizing_dept_id ||
        (req.userInfo?.department_id && fest.organizing_dept_id &&
          req.userInfo.department_id === fest.organizing_dept_id);
      const campusMatches = matchesScope(req.userInfo?.campus, fest.campus_hosted_at);
      const schoolMatches = matchesScope(req.userInfo?.school, fest.organizing_school || fest.school);

      if (canViewAll) {
        return [
          FEST_STATUS.PENDING_HOD,
          FEST_STATUS.PENDING_DEAN,
          FEST_STATUS.PENDING_CFO,
          FEST_STATUS.PENDING_ACCOUNTS,
        ].includes(status);
      }

      if (hasAnyRoleCode(roleCodes, [ROLE_CODES.HOD]) || asBoolean(req.userInfo?.is_hod)) {
        if (status === FEST_STATUS.PENDING_HOD && deptMatches && campusMatches) {
          return true;
        }
      }

      if (hasAnyRoleCode(roleCodes, [ROLE_CODES.DEAN]) || asBoolean(req.userInfo?.is_dean)) {
        if (status === FEST_STATUS.PENDING_DEAN && schoolMatches && campusMatches) {
          return true;
        }
      }

      if (hasAnyRoleCode(roleCodes, [ROLE_CODES.CFO]) || asBoolean(req.userInfo?.is_cfo)) {
        if (status === FEST_STATUS.PENDING_CFO && campusMatches) {
          return true;
        }
      }

      if (
        hasAnyRoleCode(roleCodes, [ROLE_CODES.ACCOUNTS, ROLE_CODES.FINANCE_OFFICER]) ||
        asBoolean(req.userInfo?.is_finance_office) ||
        asBoolean(req.userInfo?.is_finance_officer)
      ) {
        if (status === FEST_STATUS.PENDING_ACCOUNTS && campusMatches) {
          return true;
        }
      }

      return false;
    });

    return res.status(200).json({ fests: filtered });
  } catch (error) {
    console.error("[FestApproval] approval-queue error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
