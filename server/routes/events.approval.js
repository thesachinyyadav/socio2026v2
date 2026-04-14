import express from "express";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";
import { insert, queryAll, queryOne, update } from "../config/database.js";
import { ROLE_CODES, hasAnyRoleCode } from "../utils/roleAccessService.js";
import {
  sendFinalRejectionEmail,
  sendReturnedForRevisionEmail,
  sendStandaloneEventAutoApprovedEmail,
  sendStandaloneEventToAccountsEmail,
  sendStandaloneEventToCfoEmail,
  sendStandaloneEventToDeanEmail,
  sendStandaloneEventToHodEmail,
  sendUnderFestEventApprovedEmail,
  sendUnderFestEventToOrganiserEmail,
} from "../utils/emailService.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo());

const EVENT_STATUS = Object.freeze({
  DRAFT: "draft",
  AUTO_APPROVED: "auto_approved",
  PENDING_HOD: "pending_hod",
  HOD_APPROVED: "hod_approved",
  PENDING_DEAN: "pending_dean",
  DEPT_APPROVED: "dept_approved",
  PENDING_CFO: "pending_cfo",
  CFO_APPROVED: "cfo_approved",
  PENDING_ACCOUNTS: "pending_accounts",
  FULLY_APPROVED: "fully_approved",
  PENDING_ORGANISER: "pending_organiser",
  ORGANISER_APPROVED: "organiser_approved",
  LIVE: "live",
  REJECTED: "rejected",
  FINAL_REJECTED: "final_rejected",
});

const EVENT_CONTEXT = Object.freeze({
  STANDALONE: "standalone",
  UNDER_FEST: "under_fest",
});

const REJECTION_ACTIONS = new Set(["rejected", "returned_for_revision"]);
const REVIEWABLE_ACTIONS = new Set(["approved", "rejected", "returned_for_revision"]);
const MIN_REVIEW_NOTE_LENGTH = 20;
const MAX_REVIEW_NOTE_LENGTH = 2000;
const DEFAULT_BUDGET_L3_THRESHOLD = 25000;
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

const parseNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
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

const inferEventContext = (eventRecord) => {
  if (normalizeToken(eventRecord?.event_context) === EVENT_CONTEXT.UNDER_FEST) {
    return EVENT_CONTEXT.UNDER_FEST;
  }

  if (normalizeText(eventRecord?.parent_fest_id || eventRecord?.fest_id || eventRecord?.fest)) {
    return EVENT_CONTEXT.UNDER_FEST;
  }

  return EVENT_CONTEXT.STANDALONE;
};

const getParentFestId = (eventRecord) =>
  normalizeText(eventRecord?.parent_fest_id || eventRecord?.fest_id || eventRecord?.fest);

const getCampusThresholdMap = () => {
  const raw =
    process.env.MODULE11_CAMPUS_L3_THRESHOLDS_JSON ||
    process.env.CAMPUS_L3_THRESHOLDS_JSON ||
    "";

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const map = {};
    for (const [campus, value] of Object.entries(parsed)) {
      const normalizedCampus = normalizeToken(campus);
      const threshold = parseNumber(value);
      if (normalizedCampus) {
        map[normalizedCampus] = threshold > 0 ? threshold : DEFAULT_BUDGET_L3_THRESHOLD;
      }
    }

    return map;
  } catch {
    return {};
  }
};

const CAMPUS_THRESHOLD_MAP = getCampusThresholdMap();

const getCampusBudgetThreshold = (campus) => {
  const normalizedCampus = normalizeToken(campus);
  return CAMPUS_THRESHOLD_MAP[normalizedCampus] || DEFAULT_BUDGET_L3_THRESHOLD;
};

const getEventBudgetAmount = (eventRecord) => {
  const directAmount =
    parseNumber(eventRecord?.budget_amount) ||
    parseNumber(eventRecord?.estimated_budget_amount) ||
    parseNumber(eventRecord?.total_estimated_expense) ||
    parseNumber(eventRecord?.budget);

  if (directAmount > 0) {
    return directAmount;
  }

  return asBoolean(eventRecord?.needs_budget_approval) || asBoolean(eventRecord?.claims_applicable)
    ? 1
    : 0;
};

const findApprover = async ({ roleCode, department, school, campus, excludeEmail }) => {
  const users = await queryAll("users");
  const normalizedExclude = normalizeEmail(excludeEmail);

  const roleFiltered = (users || []).filter((user) => {
    if (!normalizeEmail(user?.email)) return false;

    if (roleCode === ROLE_CODES.HOD) {
      return userHasRole(user, ROLE_CODES.HOD);
    }

    if (roleCode === ROLE_CODES.DEAN) {
      return userHasRole(user, ROLE_CODES.DEAN);
    }

    if (roleCode === ROLE_CODES.CFO) {
      return userHasRole(user, ROLE_CODES.CFO);
    }

    if (roleCode === ROLE_CODES.ACCOUNTS || roleCode === ROLE_CODES.FINANCE_OFFICER) {
      return userHasRole(user, ROLE_CODES.ACCOUNTS) || userHasRole(user, ROLE_CODES.FINANCE_OFFICER);
    }

    return false;
  });

  const scoped = roleFiltered.filter((user) => {
    if (normalizedExclude && normalizeEmail(user.email) === normalizedExclude) {
      return false;
    }

    if (!matchesScope(user.department, department)) return false;
    if (!matchesScope(user.school, school)) return false;
    if (!matchesScope(user.campus, campus)) return false;

    return true;
  });

  if (scoped.length > 0) {
    return scoped[0];
  }

  return (
    roleFiltered.find((user) => {
      if (normalizedExclude && normalizeEmail(user.email) === normalizedExclude) {
        return false;
      }

      if (department && !matchesScope(user.department, department)) {
        return false;
      }

      if (school && !matchesScope(user.school, school)) {
        return false;
      }

      return true;
    }) || null
  );
};

const resolveSchoolForEvent = async (eventRecord) => {
  const directSchool = normalizeText(eventRecord?.organizing_school || eventRecord?.school);
  if (directSchool) return directSchool;

  const hod = await findApprover({
    roleCode: ROLE_CODES.HOD,
    department: eventRecord?.organizing_dept,
    campus: eventRecord?.campus_hosted_at,
  });

  return normalizeText(hod?.school) || null;
};

const getEventOwnerEmail = (eventRecord) =>
  normalizeEmail(eventRecord?.organizer_email || eventRecord?.organiser_email || eventRecord?.created_by);

const canUserManageEvent = (eventRecord, userInfo, userId) => {
  if (!eventRecord || !userInfo) return false;
  if (isMasterAdmin(userInfo)) return true;

  const requesterEmail = normalizeEmail(userInfo.email);
  return (
    normalizeText(eventRecord.auth_uuid) === normalizeText(userId) ||
    normalizeEmail(eventRecord.created_by) === requesterEmail ||
    normalizeEmail(eventRecord.organizer_email) === requesterEmail ||
    normalizeEmail(eventRecord.organiser_email) === requesterEmail
  );
};

const validateReviewPayload = ({ action, notes }) => {
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
        entity_type: "event",
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
    console.warn("[EventApproval] Unable to insert approval chain log:", error?.message || error);
  }
};

const countStepRejections = async ({ entityId, step, version }) => {
  try {
    const rows = await queryAll("approval_chain_log", {
      where: {
        entity_type: "event",
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

const buildHodDeanLink = (eventId) => {
  const origin = API_APP_URL.replace(/\/$/, "");
  return `${origin}/approvals/hod-dean/${encodeURIComponent(String(eventId || ""))}`;
};

const buildOrganiserLink = (eventId) => {
  const origin = API_APP_URL.replace(/\/$/, "");
  return `${origin}/approvals/organiser/${encodeURIComponent(String(eventId || ""))}`;
};

const updateEventWorkflow = async (eventId, workflowStatus, extraUpdates = {}) => {
  const payload = {
    workflow_status: workflowStatus,
    ...extraUpdates,
  };

  const updatedRows = await update("events", payload, { event_id: eventId });
  if (Array.isArray(updatedRows) && updatedRows.length > 0) {
    return updatedRows[0];
  }

  return queryOne("events", { where: { event_id: eventId } });
};

const ensureSubheadForFest = async ({ festId, requesterEmail }) => {
  try {
    const subhead = await queryOne("fest_subheads", {
      where: {
        fest_id: festId,
        user_email: normalizeEmail(requesterEmail),
      },
    });

    return Boolean(subhead && asBoolean(subhead.is_active !== false));
  } catch {
    return false;
  }
};

const routeStandaloneBudgetStep = async ({
  event,
  requester,
  eventId,
  version,
}) => {
  const budgetAmount = getEventBudgetAmount(event);
  const threshold = getCampusBudgetThreshold(event?.campus_hosted_at);

  if (budgetAmount <= 0) {
    const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.FULLY_APPROVED, {
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
    });

    await logApprovalAction({
      entityId: eventId,
      step: "budget_review",
      action: "auto_approved",
      actorEmail: requester.email,
      actorRole: "system",
      notes: "No budget amount configured; budget step auto-cleared.",
      version,
    });

    return {
      status: EVENT_STATUS.FULLY_APPROVED,
      routedTo: null,
      updatedEvent,
    };
  }

  if (budgetAmount > threshold) {
    const cfo = await findApprover({
      roleCode: ROLE_CODES.CFO,
      campus: event?.campus_hosted_at,
      excludeEmail: getEventOwnerEmail(event),
    });

    if (!cfo?.email) {
      return {
        error: "No campus CFO configured for budget approval.",
      };
    }

    const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.PENDING_CFO, {
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
    });

    await sendStandaloneEventToCfoEmail({
      to: cfo.email,
      eventName: event.title || eventId,
      requesterName: requester.name,
      requesterEmail: requester.email,
      submittedAt: new Date().toISOString(),
      amount: budgetAmount,
      link: buildHodDeanLink(eventId),
    });

    return {
      status: EVENT_STATUS.PENDING_CFO,
      routedTo: {
        role: "cfo",
        name: cfo.name || null,
        email: cfo.email,
      },
      updatedEvent,
    };
  }

  const accounts = await findApprover({
    roleCode: ROLE_CODES.ACCOUNTS,
    campus: event?.campus_hosted_at,
    excludeEmail: getEventOwnerEmail(event),
  });

  if (!accounts?.email) {
    return {
      error: "No finance officer configured for budget approval.",
    };
  }

  const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.PENDING_ACCOUNTS, {
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
  });

  await sendStandaloneEventToAccountsEmail({
    to: accounts.email,
    eventName: event.title || eventId,
    requesterName: requester.name,
    requesterEmail: requester.email,
    submittedAt: new Date().toISOString(),
    link: buildHodDeanLink(eventId),
  });

  return {
    status: EVENT_STATUS.PENDING_ACCOUNTS,
    routedTo: {
      role: "finance_officer",
      name: accounts.name || null,
      email: accounts.email,
    },
    updatedEvent,
  };
};

const notifyEventRejection = async ({ event, stepLabel, notes, reviewer }) => {
  const ownerEmail = getEventOwnerEmail(event);
  if (!ownerEmail) return;

  const commonPayload = {
    organizerEmail: ownerEmail,
    entityType: "event",
    entityTitle: event.title || event.event_id,
    reviewerRole: stepLabel,
  };

  if (stepLabel.includes("final")) {
    await sendFinalRejectionEmail({
      ...commonPayload,
      rejectionReason: notes,
    });
    return;
  }

  await sendReturnedForRevisionEmail({
    ...commonPayload,
    revisionNote: notes,
  });
};

const canAccessStandaloneApprovalContext = async ({ eventRecord, userInfo }) => {
  if (userHasRole(userInfo, ROLE_CODES.HOD)) {
    if (
      matchesScope(userInfo?.department, eventRecord?.organizing_dept) &&
      matchesScope(userInfo?.campus, eventRecord?.campus_hosted_at)
    ) {
      return true;
    }
  }

  if (userHasRole(userInfo, ROLE_CODES.DEAN)) {
    const school = await resolveSchoolForEvent(eventRecord);
    if (
      matchesScope(userInfo?.school, school) &&
      matchesScope(userInfo?.campus, eventRecord?.campus_hosted_at)
    ) {
      return true;
    }
  }

  if (userHasRole(userInfo, ROLE_CODES.CFO)) {
    if (matchesScope(userInfo?.campus, eventRecord?.campus_hosted_at)) {
      return true;
    }
  }

  if (
    userHasRole(userInfo, ROLE_CODES.ACCOUNTS) ||
    userHasRole(userInfo, ROLE_CODES.FINANCE_OFFICER)
  ) {
    if (matchesScope(userInfo?.campus, eventRecord?.campus_hosted_at)) {
      return true;
    }
  }

  return false;
};

router.get("/:eventId/context", async (req, res) => {
  try {
    const eventId = normalizeText(req.params.eventId);
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required." });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Event not found." });
    }

    const context = inferEventContext(event);
    const requesterEmail = normalizeEmail(req.userInfo?.email);
    const organizerAccess = canUserManageEvent(event, req.userInfo, req.userId);

    let parentFest = null;
    let organiserAccess = false;
    if (context === EVENT_CONTEXT.UNDER_FEST) {
      const parentFestId = getParentFestId(event);
      if (parentFestId) {
        parentFest = await queryOne("fests", { where: { fest_id: parentFestId } });
        if (parentFest) {
          organiserAccess =
            normalizeText(parentFest.auth_uuid) === normalizeText(req.userId) ||
            requesterEmail === normalizeEmail(parentFest.created_by) ||
            requesterEmail === normalizeEmail(parentFest.contact_email);
        }
      }
    }

    const standaloneApproverAccess =
      context === EVENT_CONTEXT.STANDALONE
        ? await canAccessStandaloneApprovalContext({
            eventRecord: event,
            userInfo: req.userInfo,
          })
        : false;

    const allowed =
      isMasterAdmin(req.userInfo) ||
      organizerAccess ||
      organiserAccess ||
      standaloneApproverAccess;

    if (!allowed) {
      return res.status(403).json({ error: "You are not authorized to view this approval context." });
    }

    let logs = [];
    try {
      logs =
        (await queryAll("approval_chain_log", {
          where: {
            entity_type: "event",
            entity_id: eventId,
          },
          order: { column: "created_at", ascending: true },
        })) || [];
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }

    const school = await resolveSchoolForEvent(event);
    const [hod, dean, cfo, accounts] = await Promise.all([
      findApprover({
        roleCode: ROLE_CODES.HOD,
        department: event.organizing_dept,
        campus: event.campus_hosted_at,
      }),
      findApprover({
        roleCode: ROLE_CODES.DEAN,
        school,
        campus: event.campus_hosted_at,
      }),
      findApprover({
        roleCode: ROLE_CODES.CFO,
        campus: event.campus_hosted_at,
      }),
      findApprover({
        roleCode: ROLE_CODES.ACCOUNTS,
        campus: event.campus_hosted_at,
      }),
    ]);

    return res.status(200).json({
      event,
      parent_fest: parentFest,
      context,
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
      logs,
      permissions: {
        can_manage: organizerAccess || organiserAccess || isMasterAdmin(req.userInfo),
      },
    });
  } catch (error) {
    console.error("[EventApproval] context error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:eventId/submit", async (req, res) => {
  try {
    const eventId = normalizeText(req.params.eventId);
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required." });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Event not found." });
    }

    const currentStatus = normalizeToken(event.workflow_status || EVENT_STATUS.DRAFT);
    if (![EVENT_STATUS.DRAFT, EVENT_STATUS.REJECTED].includes(currentStatus)) {
      return res.status(400).json({
        error: `Event cannot be submitted from status '${currentStatus}'.`,
      });
    }

    if (currentStatus === EVENT_STATUS.FINAL_REJECTED) {
      return res.status(400).json({
        error: "Event is final rejected. Master admin intervention is required.",
      });
    }

    const eventContext = inferEventContext(event);
    const ownerEmail = getEventOwnerEmail(event);
    const requesterEmail = normalizeEmail(req.userInfo.email);
    const currentVersion = Number(event.workflow_version) || 1;
    const nextVersion = currentStatus === EVENT_STATUS.REJECTED ? currentVersion + 1 : currentVersion;

    if (eventContext === EVENT_CONTEXT.UNDER_FEST) {
      const parentFestId = getParentFestId(event);
      if (!parentFestId) {
        return res.status(400).json({ error: "Parent fest is missing for under-fest event." });
      }

      const parentFest = await queryOne("fests", { where: { fest_id: parentFestId } });
      if (!parentFest) {
        return res.status(400).json({ error: "Parent fest not found." });
      }

      const parentStatus = normalizeToken(parentFest.workflow_status);
      if (![EVENT_STATUS.FULLY_APPROVED, EVENT_STATUS.LIVE].includes(parentStatus)) {
        return res.status(400).json({
          error: "Parent fest is not yet approved. Events can only be created once the fest is fully approved.",
        });
      }

      const isSubhead = await ensureSubheadForFest({
        festId: parentFestId,
        requesterEmail,
      });

      if (!isSubhead && !isMasterAdmin(req.userInfo)) {
        return res.status(403).json({
          error: "Only approved fest subheads can submit events under this fest.",
        });
      }

      const parentOrganizerEmail =
        normalizeEmail(parentFest.contact_email || parentFest.created_by) ||
        normalizeEmail((await queryOne("users", { where: { auth_uuid: parentFest.auth_uuid } }))?.email);

      if (!parentOrganizerEmail) {
        return res.status(400).json({
          error: "Parent fest organizer account is missing. Cannot route organiser approval.",
        });
      }

      const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.PENDING_ORGANISER, {
        event_context: EVENT_CONTEXT.UNDER_FEST,
        parent_fest_id: parentFestId,
        created_by_subhead: true,
        workflow_version: nextVersion,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "organiser_review",
        action: "submitted",
        actorEmail: requesterEmail,
        actorRole: "student_organiser",
        notes: null,
        version: nextVersion,
      });

      await sendUnderFestEventToOrganiserEmail({
        to: parentOrganizerEmail,
        eventName: event.title || eventId,
        subOrganiserName: req.userInfo.name,
        requesterEmail,
        submittedAt: new Date().toISOString(),
        link: buildOrganiserLink(eventId),
      });

      return res.status(200).json({
        success: true,
        status: EVENT_STATUS.PENDING_ORGANISER,
        routed_to: {
          role: "organiser",
          email: parentOrganizerEmail,
        },
        event: updatedEvent,
      });
    }

    if (!canUserManageEvent(event, req.userInfo, req.userId)) {
      return res.status(403).json({ error: "Only the organizer can submit this standalone event." });
    }

    const needsHodDean = asBoolean(event.needs_hod_dean_approval);
    const needsBudget = asBoolean(event.needs_budget_approval) || asBoolean(event.claims_applicable);

    if (!needsHodDean && !needsBudget) {
      const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.AUTO_APPROVED, {
        event_context: EVENT_CONTEXT.STANDALONE,
        created_by_subhead: false,
        workflow_version: nextVersion,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "auto_approval",
        action: "auto_approved",
        actorEmail: requesterEmail,
        actorRole: "system",
        notes: "No explicit approval requirement selected.",
        version: nextVersion,
      });

      if (ownerEmail) {
        await sendStandaloneEventAutoApprovedEmail({
          to: ownerEmail,
          eventName: event.title || eventId,
          requesterName: req.userInfo.name,
          requesterEmail,
          submittedAt: new Date().toISOString(),
          link: `${API_APP_URL.replace(/\/$/, "")}/event/${encodeURIComponent(eventId)}`,
        });
      }

      return res.status(200).json({
        success: true,
        status: EVENT_STATUS.AUTO_APPROVED,
        next: "service_requests",
        event: updatedEvent,
      });
    }

    if (needsHodDean) {
      const hod = await findApprover({
        roleCode: ROLE_CODES.HOD,
        department: event.organizing_dept,
        campus: event.campus_hosted_at,
        excludeEmail: ownerEmail,
      });

      if (!hod?.email) {
        return res.status(400).json({
          error: "Unable to route approval. No HOD assigned for this department/campus.",
        });
      }

      if (normalizeEmail(hod.email) === ownerEmail) {
        return res.status(400).json({
          error: "Approver cannot approve their own submission.",
        });
      }

      const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.PENDING_HOD, {
        event_context: EVENT_CONTEXT.STANDALONE,
        created_by_subhead: false,
        workflow_version: nextVersion,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "hod_review",
        action: "submitted",
        actorEmail: requesterEmail,
        actorRole: "organizer",
        notes: null,
        version: nextVersion,
      });

      await sendStandaloneEventToHodEmail({
        to: hod.email,
        eventName: event.title || eventId,
        requesterName: req.userInfo.name,
        requesterEmail,
        submittedAt: new Date().toISOString(),
        link: buildHodDeanLink(eventId),
      });

      return res.status(200).json({
        success: true,
        status: EVENT_STATUS.PENDING_HOD,
        routed_to: {
          role: "hod",
          name: hod.name || null,
          email: hod.email,
        },
        event: updatedEvent,
      });
    }

    const budgetRouting = await routeStandaloneBudgetStep({
      event: {
        ...event,
        needs_budget_approval: true,
      },
      requester: req.userInfo,
      eventId,
      version: nextVersion,
    });

    if (budgetRouting.error) {
      return res.status(400).json({ error: budgetRouting.error });
    }

    await logApprovalAction({
      entityId: eventId,
      step: budgetRouting.status === EVENT_STATUS.PENDING_CFO ? "cfo_review" : "accounts_review",
      action: "submitted",
      actorEmail: requesterEmail,
      actorRole: "organizer",
      notes: null,
      version: nextVersion,
    });

    return res.status(200).json({
      success: true,
      status: budgetRouting.status,
      routed_to: budgetRouting.routedTo,
      event: budgetRouting.updatedEvent,
    });
  } catch (error) {
    console.error("[EventApproval] submit error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:eventId/organiser-action", async (req, res) => {
  try {
    const eventId = normalizeText(req.params.eventId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    if (inferEventContext(event) !== EVENT_CONTEXT.UNDER_FEST) {
      return res.status(400).json({ error: "Organiser action applies only to events under a fest." });
    }

    if (normalizeToken(event.workflow_status) !== EVENT_STATUS.PENDING_ORGANISER) {
      return res.status(400).json({ error: "Event is not pending organiser approval." });
    }

    const parentFestId = getParentFestId(event);
    const parentFest = await queryOne("fests", { where: { fest_id: parentFestId } });
    if (!parentFest) {
      return res.status(400).json({ error: "Parent fest not found." });
    }

    const requesterEmail = normalizeEmail(req.userInfo.email);
    const isParentOrganizer =
      normalizeText(parentFest.auth_uuid) === normalizeText(req.userId) ||
      requesterEmail === normalizeEmail(parentFest.created_by) ||
      requesterEmail === normalizeEmail(parentFest.contact_email);

    if (!isParentOrganizer && !isMasterAdmin(req.userInfo)) {
      return res.status(403).json({ error: "Only the parent fest organizer can take this action." });
    }

    const version = Number(event.workflow_version) || 1;

    if (action === "approved") {
      const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.ORGANISER_APPROVED, {
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "organiser_review",
        action,
        actorEmail: requesterEmail,
        actorRole: "organiser",
        notes,
        version,
      });

      const subOrganiserEmail = getEventOwnerEmail(event);
      if (subOrganiserEmail) {
        await sendUnderFestEventApprovedEmail({
          to: subOrganiserEmail,
          eventName: event.title || eventId,
          requesterName: req.userInfo.name,
          requesterEmail,
          submittedAt: event.created_at,
          link: `${API_APP_URL.replace(/\/$/, "")}/event/${encodeURIComponent(eventId)}`,
        });
      }

      return res.status(200).json({ success: true, status: EVENT_STATUS.ORGANISER_APPROVED, event: updatedEvent });
    }

    const rejectionCount = await countStepRejections({ entityId: eventId, step: "organiser_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? EVENT_STATUS.FINAL_REJECTED : EVENT_STATUS.REJECTED;

    const updatedEvent = await updateEventWorkflow(eventId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: requesterEmail,
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityId: eventId,
      step: "organiser_review",
      action,
      actorEmail: requesterEmail,
      actorRole: "organiser",
      notes,
      version,
    });

    await notifyEventRejection({
      event,
      stepLabel: isFinal ? "organiser final" : "organiser",
      notes,
      reviewer: req.userInfo,
    });

    return res.status(200).json({ success: true, status, event: updatedEvent });
  } catch (error) {
    console.error("[EventApproval] organiser-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:eventId/hod-dean-action", async (req, res) => {
  try {
    const eventId = normalizeText(req.params.eventId);
    const hodAction = normalizeToken(req.body?.hod_action);
    const hodNotes = normalizeText(req.body?.hod_notes);
    const deanAction = normalizeToken(req.body?.dean_action);
    const deanNotes = normalizeText(req.body?.dean_notes);

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    if (inferEventContext(event) !== EVENT_CONTEXT.STANDALONE) {
      return res.status(400).json({ error: "HOD/Dean action applies only to standalone events." });
    }

    const needsHodDean = asBoolean(event.needs_hod_dean_approval);
    if (!needsHodDean) {
      return res.status(400).json({ error: "This event does not require HOD/Dean approval." });
    }

    const ownerEmail = getEventOwnerEmail(event);
    const version = Number(event.workflow_version) || 1;

    if (hodAction) {
      const payloadError = validateReviewPayload({ action: hodAction, notes: hodNotes });
      if (payloadError) {
        return res.status(400).json({ error: payloadError });
      }

      if (!userHasRole(req.userInfo, ROLE_CODES.HOD) && !isMasterAdmin(req.userInfo)) {
        return res.status(403).json({ error: "Only HOD can submit hod_action." });
      }

      if (normalizeToken(event.workflow_status) !== EVENT_STATUS.PENDING_HOD) {
        return res.status(400).json({ error: "Event is not pending HOD review." });
      }

      if (!isMasterAdmin(req.userInfo)) {
        if (!matchesScope(req.userInfo.department, event.organizing_dept)) {
          return res.status(403).json({ error: "Only the HOD of this department can act." });
        }

        if (!matchesScope(req.userInfo.campus, event.campus_hosted_at)) {
          return res.status(403).json({ error: "Only the HOD of this campus can act." });
        }
      }

      if (normalizeEmail(req.userInfo.email) === ownerEmail) {
        return res.status(400).json({ error: "Approver cannot approve their own submission." });
      }

      if (hodAction === "approved") {
        await logApprovalAction({
          entityId: eventId,
          step: "hod_review",
          action: hodAction,
          actorEmail: req.userInfo.email,
          actorRole: "hod",
          notes: hodNotes,
          version,
        });

        const school = await resolveSchoolForEvent(event);
        const dean = await findApprover({
          roleCode: ROLE_CODES.DEAN,
          school,
          campus: event.campus_hosted_at,
          excludeEmail: ownerEmail,
        });

        if (dean?.email && normalizeEmail(dean.email) !== normalizeEmail(req.userInfo.email)) {
          const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.PENDING_DEAN, {
            rejected_at: null,
            rejected_by: null,
            rejection_reason: null,
          });

          await sendStandaloneEventToDeanEmail({
            to: dean.email,
            eventName: event.title || eventId,
            requesterName: req.userInfo.name,
            requesterEmail: req.userInfo.email,
            submittedAt: new Date().toISOString(),
            hodNotes,
            link: buildHodDeanLink(eventId),
          });

          return res.status(200).json({
            success: true,
            status: EVENT_STATUS.PENDING_DEAN,
            routed_to: {
              role: "dean",
              name: dean.name || null,
              email: dean.email,
            },
            event: updatedEvent,
          });
        }

        await logApprovalAction({
          entityId: eventId,
          step: "dean_review",
          action: "hod_dean_combined",
          actorEmail: req.userInfo.email,
          actorRole: "hod_dean",
          notes: hodNotes,
          version,
        });

        if (asBoolean(event.needs_budget_approval) || asBoolean(event.claims_applicable)) {
          const budgetRouting = await routeStandaloneBudgetStep({
            event,
            requester: req.userInfo,
            eventId,
            version,
          });

          if (budgetRouting.error) {
            return res.status(400).json({ error: budgetRouting.error });
          }

          return res.status(200).json({
            success: true,
            status: budgetRouting.status,
            routed_to: budgetRouting.routedTo,
            event: budgetRouting.updatedEvent,
          });
        }

        const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.FULLY_APPROVED, {
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        });

        return res.status(200).json({ success: true, status: EVENT_STATUS.FULLY_APPROVED, event: updatedEvent });
      }

      const rejectionCount = await countStepRejections({ entityId: eventId, step: "hod_review", version });
      const isFinal = rejectionCount >= 1;
      const status = isFinal ? EVENT_STATUS.FINAL_REJECTED : EVENT_STATUS.REJECTED;

      const updatedEvent = await updateEventWorkflow(eventId, status, {
        rejected_at: new Date().toISOString(),
        rejected_by: normalizeEmail(req.userInfo.email),
        rejection_reason: hodNotes,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "hod_review",
        action: hodAction,
        actorEmail: req.userInfo.email,
        actorRole: "hod",
        notes: hodNotes,
        version,
      });

      await notifyEventRejection({
        event,
        stepLabel: isFinal ? "hod final" : "hod",
        notes: hodNotes,
        reviewer: req.userInfo,
      });

      return res.status(200).json({ success: true, status, event: updatedEvent });
    }

    if (deanAction) {
      const payloadError = validateReviewPayload({ action: deanAction, notes: deanNotes });
      if (payloadError) {
        return res.status(400).json({ error: payloadError });
      }

      if (!userHasRole(req.userInfo, ROLE_CODES.DEAN) && !isMasterAdmin(req.userInfo)) {
        return res.status(403).json({ error: "Only Dean can submit dean_action." });
      }

      if (normalizeToken(event.workflow_status) !== EVENT_STATUS.PENDING_DEAN) {
        return res.status(400).json({ error: "Event is not pending Dean review." });
      }

      const school = await resolveSchoolForEvent(event);
      if (!isMasterAdmin(req.userInfo)) {
        if (!matchesScope(req.userInfo.school, school)) {
          return res.status(403).json({ error: "Only the Dean of this school can act." });
        }

        if (!matchesScope(req.userInfo.campus, event.campus_hosted_at)) {
          return res.status(403).json({ error: "Only the Dean of this campus can act." });
        }
      }

      if (normalizeEmail(req.userInfo.email) === ownerEmail) {
        return res.status(400).json({ error: "Approver cannot approve their own submission." });
      }

      if (deanAction === "approved") {
        await logApprovalAction({
          entityId: eventId,
          step: "dean_review",
          action: deanAction,
          actorEmail: req.userInfo.email,
          actorRole: "dean",
          notes: deanNotes,
          version,
        });

        if (asBoolean(event.needs_budget_approval) || asBoolean(event.claims_applicable)) {
          const budgetRouting = await routeStandaloneBudgetStep({
            event,
            requester: req.userInfo,
            eventId,
            version,
          });

          if (budgetRouting.error) {
            return res.status(400).json({ error: budgetRouting.error });
          }

          return res.status(200).json({
            success: true,
            status: budgetRouting.status,
            routed_to: budgetRouting.routedTo,
            event: budgetRouting.updatedEvent,
          });
        }

        const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.FULLY_APPROVED, {
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        });

        return res.status(200).json({ success: true, status: EVENT_STATUS.FULLY_APPROVED, event: updatedEvent });
      }

      const rejectionCount = await countStepRejections({ entityId: eventId, step: "dean_review", version });
      const isFinal = rejectionCount >= 1;
      const status = isFinal ? EVENT_STATUS.FINAL_REJECTED : EVENT_STATUS.REJECTED;

      const updatedEvent = await updateEventWorkflow(eventId, status, {
        rejected_at: new Date().toISOString(),
        rejected_by: normalizeEmail(req.userInfo.email),
        rejection_reason: deanNotes,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "dean_review",
        action: deanAction,
        actorEmail: req.userInfo.email,
        actorRole: "dean",
        notes: deanNotes,
        version,
      });

      await notifyEventRejection({
        event,
        stepLabel: isFinal ? "dean final" : "dean",
        notes: deanNotes,
        reviewer: req.userInfo,
      });

      return res.status(200).json({ success: true, status, event: updatedEvent });
    }

    return res.status(400).json({
      error: "Provide either hod_action or dean_action.",
    });
  } catch (error) {
    console.error("[EventApproval] hod-dean-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:eventId/cfo-action", async (req, res) => {
  try {
    if (!userHasRole(req.userInfo, ROLE_CODES.CFO) && !isMasterAdmin(req.userInfo)) {
      return res.status(403).json({ error: "Only CFO can perform this action." });
    }

    const eventId = normalizeText(req.params.eventId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    if (normalizeToken(event.workflow_status) !== EVENT_STATUS.PENDING_CFO) {
      return res.status(400).json({ error: "Event is not pending CFO review." });
    }

    if (!isMasterAdmin(req.userInfo) && !matchesScope(req.userInfo.campus, event.campus_hosted_at)) {
      return res.status(403).json({ error: "Only the campus CFO can act." });
    }

    const version = Number(event.workflow_version) || 1;

    if (action === "approved") {
      const accounts = await findApprover({
        roleCode: ROLE_CODES.ACCOUNTS,
        campus: event.campus_hosted_at,
        excludeEmail: getEventOwnerEmail(event),
      });

      if (!accounts?.email) {
        return res.status(400).json({ error: "No finance officer configured for this campus." });
      }

      const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.PENDING_ACCOUNTS, {
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "cfo_review",
        action,
        actorEmail: req.userInfo.email,
        actorRole: "cfo",
        notes,
        version,
      });

      await sendStandaloneEventToAccountsEmail({
        to: accounts.email,
        eventName: event.title || eventId,
        requesterName: req.userInfo.name,
        requesterEmail: req.userInfo.email,
        submittedAt: new Date().toISOString(),
        link: buildHodDeanLink(eventId),
      });

      return res.status(200).json({
        success: true,
        status: EVENT_STATUS.PENDING_ACCOUNTS,
        routed_to: {
          role: "finance_officer",
          name: accounts.name || null,
          email: accounts.email,
        },
        event: updatedEvent,
      });
    }

    const rejectionCount = await countStepRejections({ entityId: eventId, step: "cfo_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? EVENT_STATUS.FINAL_REJECTED : EVENT_STATUS.REJECTED;

    const updatedEvent = await updateEventWorkflow(eventId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: normalizeEmail(req.userInfo.email),
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityId: eventId,
      step: "cfo_review",
      action,
      actorEmail: req.userInfo.email,
      actorRole: "cfo",
      notes,
      version,
    });

    await notifyEventRejection({
      event,
      stepLabel: isFinal ? "cfo final" : "cfo",
      notes,
      reviewer: req.userInfo,
    });

    return res.status(200).json({ success: true, status, event: updatedEvent });
  } catch (error) {
    console.error("[EventApproval] cfo-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:eventId/accounts-action", async (req, res) => {
  try {
    const canReview =
      userHasRole(req.userInfo, ROLE_CODES.ACCOUNTS) ||
      userHasRole(req.userInfo, ROLE_CODES.FINANCE_OFFICER) ||
      isMasterAdmin(req.userInfo);

    if (!canReview) {
      return res.status(403).json({ error: "Only Finance Officer can perform this action." });
    }

    const eventId = normalizeText(req.params.eventId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateReviewPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    if (normalizeToken(event.workflow_status) !== EVENT_STATUS.PENDING_ACCOUNTS) {
      return res.status(400).json({ error: "Event is not pending Accounts review." });
    }

    const version = Number(event.workflow_version) || 1;

    if (action === "approved") {
      const updatedEvent = await updateEventWorkflow(eventId, EVENT_STATUS.FULLY_APPROVED, {
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      });

      await logApprovalAction({
        entityId: eventId,
        step: "accounts_review",
        action,
        actorEmail: req.userInfo.email,
        actorRole: "finance_officer",
        notes,
        version,
      });

      return res.status(200).json({ success: true, status: EVENT_STATUS.FULLY_APPROVED, event: updatedEvent });
    }

    const rejectionCount = await countStepRejections({ entityId: eventId, step: "accounts_review", version });
    const isFinal = rejectionCount >= 1;
    const status = isFinal ? EVENT_STATUS.FINAL_REJECTED : EVENT_STATUS.REJECTED;

    const updatedEvent = await updateEventWorkflow(eventId, status, {
      rejected_at: new Date().toISOString(),
      rejected_by: normalizeEmail(req.userInfo.email),
      rejection_reason: notes,
    });

    await logApprovalAction({
      entityId: eventId,
      step: "accounts_review",
      action,
      actorEmail: req.userInfo.email,
      actorRole: "finance_officer",
      notes,
      version,
    });

    await notifyEventRejection({
      event,
      stepLabel: isFinal ? "accounts final" : "accounts",
      notes,
      reviewer: req.userInfo,
    });

    return res.status(200).json({ success: true, status, event: updatedEvent });
  } catch (error) {
    console.error("[EventApproval] accounts-action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/approval-queue", async (req, res) => {
  try {
    const roleCodes = Array.isArray(req.userInfo?.role_codes) ? req.userInfo.role_codes : [];
    const canViewAll = isMasterAdmin(req.userInfo);
    const requesterEmail = normalizeEmail(req.userInfo.email);

    const [events, fests] = await Promise.all([
      queryAll("events", { order: { column: "created_at", ascending: false } }),
      queryAll("fests"),
    ]);

    const festById = new Map((fests || []).map((fest) => [normalizeText(fest.fest_id), fest]));

    const filtered = (events || []).filter((event) => {
      const status = normalizeToken(event.workflow_status);
      const context = inferEventContext(event);
      const deptMatches = matchesScope(req.userInfo?.department, event.organizing_dept);
      const campusMatches = matchesScope(req.userInfo?.campus, event.campus_hosted_at);
      const schoolMatches = matchesScope(req.userInfo?.school, event.organizing_school || event.school);

      if (canViewAll) {
        return [
          EVENT_STATUS.PENDING_HOD,
          EVENT_STATUS.PENDING_DEAN,
          EVENT_STATUS.PENDING_CFO,
          EVENT_STATUS.PENDING_ACCOUNTS,
          EVENT_STATUS.PENDING_ORGANISER,
        ].includes(status);
      }

      if ((hasAnyRoleCode(roleCodes, [ROLE_CODES.HOD]) || asBoolean(req.userInfo?.is_hod)) && context === EVENT_CONTEXT.STANDALONE) {
        if (status === EVENT_STATUS.PENDING_HOD && deptMatches && campusMatches) {
          return true;
        }
      }

      if ((hasAnyRoleCode(roleCodes, [ROLE_CODES.DEAN]) || asBoolean(req.userInfo?.is_dean)) && context === EVENT_CONTEXT.STANDALONE) {
        if (status === EVENT_STATUS.PENDING_DEAN && schoolMatches && campusMatches) {
          return true;
        }
      }

      if ((hasAnyRoleCode(roleCodes, [ROLE_CODES.CFO]) || asBoolean(req.userInfo?.is_cfo)) && context === EVENT_CONTEXT.STANDALONE) {
        if (status === EVENT_STATUS.PENDING_CFO && campusMatches) {
          return true;
        }
      }

      if (
        (hasAnyRoleCode(roleCodes, [ROLE_CODES.ACCOUNTS, ROLE_CODES.FINANCE_OFFICER]) ||
          asBoolean(req.userInfo?.is_finance_office) ||
          asBoolean(req.userInfo?.is_finance_officer)) &&
        context === EVENT_CONTEXT.STANDALONE
      ) {
        if (status === EVENT_STATUS.PENDING_ACCOUNTS && campusMatches) {
          return true;
        }
      }

      const isOrganizerRole =
        hasAnyRoleCode(roleCodes, [ROLE_CODES.ORGANIZER_TEACHER]) ||
        asBoolean(req.userInfo?.is_organiser);

      if (isOrganizerRole && context === EVENT_CONTEXT.UNDER_FEST && status === EVENT_STATUS.PENDING_ORGANISER) {
        const parentFestId = getParentFestId(event);
        const fest = festById.get(parentFestId);
        if (!fest) return false;

        const festOrganizerEmail = normalizeEmail(fest.created_by || fest.contact_email);
        const festOrganizerAuthUuid = normalizeText(fest.auth_uuid);
        return festOrganizerEmail === requesterEmail || festOrganizerAuthUuid === normalizeText(req.userId);
      }

      return false;
    });

    return res.status(200).json({ events: filtered });
  } catch (error) {
    console.error("[EventApproval] approval-queue error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
