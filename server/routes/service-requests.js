import express from "express";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";
import { insert, queryAll, queryOne, update } from "../config/database.js";
import { ROLE_CODES, hasAnyRoleCode } from "../utils/roleAccessService.js";
import {
  sendServiceRequestApprovedEmail,
  sendServiceRequestRejectedEmail,
  sendServiceRequestToInchargeEmail,
} from "../utils/emailService.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo());

const SERVICE_TYPES = new Set([
  "it",
  "venue",
  "av",
  "catering",
  "security",
  "housekeeping",
  "photography",
  "decor",
  "transport",
  "stalls",
  "other",
]);

const EVENT_CONTEXT = Object.freeze({
  STANDALONE: "standalone",
  UNDER_FEST: "under_fest",
});

const FEST_WORKFLOW_SERVICE_READY = new Set([
  "pending_cfo",
  "pending_accounts",
  "fully_approved",
  "live",
  "approved",
  "published",
]);

const EVENT_WORKFLOW_SERVICE_READY_UNDER_FEST = new Set([
  "organiser_approved",
  "pending_cfo",
  "pending_accounts",
  "fully_approved",
  "live",
  "approved",
  "published",
]);

const EVENT_WORKFLOW_SERVICE_READY_STANDALONE = new Set([
  "auto_approved",
  "pending_cfo",
  "cfo_approved",
  "pending_accounts",
  "fully_approved",
  "live",
  "approved",
  "published",
]);

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

const isLifecycleReadyForServices = (value) => {
  const normalized = normalizeToken(value);
  return normalized === "approved" || normalized === "published";
};

const isFestReadyForServices = (fest) => {
  const workflowStatus = normalizeToken(fest?.workflow_status);
  const approvalState = normalizeToken(fest?.approval_state);
  const activationState = normalizeToken(fest?.activation_state);

  return (
    FEST_WORKFLOW_SERVICE_READY.has(workflowStatus) ||
    isLifecycleReadyForServices(fest?.status) ||
    approvalState === "approved" ||
    activationState === "active"
  );
};

const isEventReadyForServices = ({ event, context }) => {
  const workflowStatus = normalizeToken(event?.workflow_status);
  const approvalState = normalizeToken(event?.approval_state);
  const activationState = normalizeToken(event?.activation_state);
  const workflowAllowed =
    context === EVENT_CONTEXT.UNDER_FEST
      ? EVENT_WORKFLOW_SERVICE_READY_UNDER_FEST.has(workflowStatus)
      : EVENT_WORKFLOW_SERVICE_READY_STANDALONE.has(workflowStatus);

  return (
    workflowAllowed ||
    isLifecycleReadyForServices(event?.status) ||
    approvalState === "approved" ||
    activationState === "active"
  );
};

const queryFestById = async (festId) => {
  const normalizedFestId = normalizeText(festId);
  if (!normalizedFestId) {
    return null;
  }

  for (const tableName of ["fests", "fest"]) {
    try {
      const fest = await queryOne(tableName, { where: { fest_id: normalizedFestId } });
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

const isMasterAdmin = (userInfo) => {
  if (!userInfo) return false;
  const roleCodes = Array.isArray(userInfo.role_codes) ? userInfo.role_codes : [];
  return asBoolean(userInfo.is_masteradmin) || hasAnyRoleCode(roleCodes, [ROLE_CODES.MASTER_ADMIN]);
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

const getEntityDisplayName = ({ entityType, entityRecord, fallbackId }) => {
  if (entityType === "fest") {
    return normalizeText(entityRecord?.fest_title) || fallbackId;
  }

  return normalizeText(entityRecord?.title) || fallbackId;
};

const matchesScope = (candidate, requiredScope) => {
  if (!normalizeText(requiredScope)) return true;
  return normalizeToken(candidate) === normalizeToken(requiredScope);
};

const findHodFallbackEmail = async ({ department, campus }) => {
  const users = await queryAll("users");

  const hod = (users || []).find((user) => {
    const isHod = asBoolean(user?.is_hod) || normalizeToken(user?.university_role) === "hod";
    if (!isHod) return false;

    if (!matchesScope(user?.department, department)) {
      return false;
    }

    if (!matchesScope(user?.campus, campus)) {
      return false;
    }

    return Boolean(normalizeEmail(user?.email));
  });

  return normalizeEmail(hod?.email) || null;
};

const getServiceInchargeEmail = async ({ serviceType, campus, department }) => {
  const rows = await queryAll("service_incharge_config", {
    where: {
      service_type: serviceType,
      campus,
      is_active: true,
    },
  });

  const configured = (rows || []).find((row) => normalizeEmail(row?.incharge_email));
  if (configured?.incharge_email) {
    return normalizeEmail(configured.incharge_email);
  }

  return findHodFallbackEmail({ department, campus });
};

const canRequesterManageFest = (fest, requester) => {
  if (!fest || !requester) return false;
  if (isMasterAdmin(requester)) return true;

  const requesterEmail = normalizeEmail(requester.email);
  return (
    normalizeEmail(fest.created_by) === requesterEmail ||
    normalizeEmail(fest.contact_email) === requesterEmail ||
    normalizeText(fest.auth_uuid) === normalizeText(requester.auth_uuid)
  );
};

const canRequesterManageEvent = async (event, requester) => {
  if (!event || !requester) return false;
  if (isMasterAdmin(requester)) return true;

  const requesterEmail = normalizeEmail(requester.email);
  const ownerMatch =
    normalizeEmail(event.created_by) === requesterEmail ||
    normalizeEmail(event.organizer_email) === requesterEmail ||
    normalizeEmail(event.organiser_email) === requesterEmail ||
    normalizeText(event.auth_uuid) === normalizeText(requester.auth_uuid);

  if (ownerMatch) {
    return true;
  }

  if (inferEventContext(event) !== EVENT_CONTEXT.UNDER_FEST) {
    return false;
  }

  const parentFest = await queryFestById(getParentFestId(event));
  if (!parentFest) return false;

  return (
    normalizeEmail(parentFest.created_by) === requesterEmail ||
    normalizeEmail(parentFest.contact_email) === requesterEmail ||
    normalizeText(parentFest.auth_uuid) === normalizeText(requester.auth_uuid)
  );
};

const validateServiceRequestDetails = ({ serviceType, details }) => {
  const safeDetails = details && typeof details === "object" && !Array.isArray(details) ? details : {};

  if (serviceType === "venue") {
    const headcount = Number(safeDetails.headcount || 0);
    if (headcount <= 0) {
      return "Venue request must include a positive headcount.";
    }

    const dateText = normalizeText(safeDetails.date);
    if (!dateText) {
      return "Venue request date is required.";
    }

    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
      return "Venue request date is invalid.";
    }

    const minDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    if (date.getTime() < minDate.getTime()) {
      return "Venue request must be at least 48 hours in advance.";
    }
  }

  if (serviceType === "it") {
    const quantityFields = ["projectors", "pa_systems", "laptops", "bandwidth"];
    for (const fieldName of quantityFields) {
      if (safeDetails[fieldName] === undefined || safeDetails[fieldName] === null || safeDetails[fieldName] === "") {
        continue;
      }

      const value = Number(safeDetails[fieldName]);
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        return `IT field '${fieldName}' must be a positive integer or zero.`;
      }
    }
  }

  if (serviceType === "catering") {
    const headcount = Number(safeDetails.headcount || safeDetails.approximateCount || 0);
    if (!Number.isFinite(headcount) || headcount <= 0) {
      return "Catering request must include a valid headcount.";
    }
  }

  return null;
};

const validateServiceActionPayload = ({ action, notes }) => {
  const normalizedAction = normalizeToken(action);
  if (!["approved", "rejected", "returned_for_revision"].includes(normalizedAction)) {
    return "Invalid action. Use approved, rejected, or returned_for_revision.";
  }

  if (normalizedAction !== "approved") {
    const normalizedNotes = normalizeText(notes);
    if (normalizedNotes.length < 20) {
      return "Notes must be at least 20 characters for rejection/revision.";
    }
  }

  return null;
};

const buildRequestLink = (requestId) => {
  const appOrigin =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    "https://sociodev.vercel.app";

  return `${appOrigin.replace(/\/$/, "")}/manage?request=${encodeURIComponent(String(requestId || ""))}`;
};

router.post("/", async (req, res) => {
  try {
    const entityType = normalizeToken(req.body?.entity_type);
    const entityId = normalizeText(req.body?.entity_id);
    const serviceType = normalizeToken(req.body?.service_type);
    const details = req.body?.details;

    if (!["fest", "event"].includes(entityType)) {
      return res.status(400).json({ error: "entity_type must be fest or event." });
    }

    if (!entityId) {
      return res.status(400).json({ error: "entity_id is required." });
    }

    if (!SERVICE_TYPES.has(serviceType)) {
      return res.status(400).json({
        error: "Unsupported service_type.",
      });
    }

    const detailsError = validateServiceRequestDetails({ serviceType, details });
    if (detailsError) {
      return res.status(400).json({ error: detailsError });
    }

    let campus = "";
    let department = "";
    let requesterAllowed = false;
    let entityRecord = null;

    if (entityType === "fest") {
      const fest = await queryFestById(entityId);
      if (!fest) {
        return res.status(404).json({ error: "Fest not found." });
      }

      if (!isFestReadyForServices(fest)) {
        return res.status(400).json({
          error: "Fest must complete initial approvals before requesting services.",
        });
      }

      requesterAllowed = canRequesterManageFest(fest, req.userInfo);
      entityRecord = fest;
      campus = normalizeText(fest.campus_hosted_at);
      department = normalizeText(fest.organizing_dept);
    } else {
      const event = await queryOne("events", { where: { event_id: entityId } });
      if (!event) {
        return res.status(404).json({ error: "Event not found." });
      }

      const context = inferEventContext(event);

      if (!isEventReadyForServices({ event, context })) {
        if (context === EVENT_CONTEXT.UNDER_FEST) {
          return res.status(400).json({
            error: "Under-fest events must complete initial approvals before requesting services.",
          });
        }

        return res.status(400).json({
          error: "Standalone events must complete approvals before requesting services.",
        });
      }

      requesterAllowed = await canRequesterManageEvent(event, req.userInfo);
      entityRecord = event;
      campus = normalizeText(event.campus_hosted_at);
      department = normalizeText(event.organizing_dept);
    }

    if (!requesterAllowed) {
      return res.status(403).json({
        error: "You are not allowed to request services for this entity.",
      });
    }

    const assignedInchargeEmail = await getServiceInchargeEmail({
      serviceType,
      campus,
      department,
    });

    if (!assignedInchargeEmail) {
      return res.status(400).json({
        error: "No service incharge configured for this request, and HOD fallback is unavailable.",
      });
    }

    const nowIso = new Date().toISOString();
    const requesterEmail = normalizeEmail(req.userInfo.email);
    const compatServiceRequestId = `SR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const inserted = await insert("service_requests", [
      {
        entity_type: entityType,
        entity_id: entityId,
        service_type: serviceType,
        details: details || {},
        assigned_incharge_email: assignedInchargeEmail,
        status: "pending",
        requester_email: requesterEmail,
        approval_notes: null,
        resubmission_count: 0,
        created_at: nowIso,
        updated_at: nowIso,
        service_request_id: compatServiceRequestId,
        event_id: entityType === "event" ? entityId : null,
        requested_by_email: requesterEmail,
      },
    ]);

    const requestRecord = Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : null;
    const requestId = requestRecord?.id || compatServiceRequestId;

    await sendServiceRequestToInchargeEmail({
      to: assignedInchargeEmail,
      serviceType,
      entityType,
      entityName: getEntityDisplayName({ entityType, entityRecord, fallbackId: entityId }),
      requesterName: req.userInfo.name,
      requesterEmail,
      submittedAt: nowIso,
      notes: JSON.stringify(details || {}),
      link: buildRequestLink(requestId),
    });

    return res.status(201).json({
      success: true,
      request: requestRecord,
    });
  } catch (error) {
    console.error("[ServiceRequests] create error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:requestId/action", async (req, res) => {
  try {
    const requestId = normalizeText(req.params.requestId);
    const action = normalizeToken(req.body?.action);
    const notes = normalizeText(req.body?.notes);

    const payloadError = validateServiceActionPayload({ action, notes });
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    let requestRecord = await queryOne("service_requests", { where: { id: requestId } });
    if (!requestRecord) {
      requestRecord = await queryOne("service_requests", { where: { service_request_id: requestId } });
    }

    if (!requestRecord) {
      return res.status(404).json({ error: "Service request not found." });
    }

    const requesterEmail = normalizeEmail(req.userInfo.email);
    const assignedEmail = normalizeEmail(requestRecord.assigned_incharge_email);
    if (requesterEmail !== assignedEmail && !isMasterAdmin(req.userInfo)) {
      return res.status(403).json({
        error: "Only the assigned incharge can take action on this request.",
      });
    }

    const currentResubmissions = Number(requestRecord.resubmission_count) || 0;
    const updates = {
      updated_at: new Date().toISOString(),
    };

    let nextStatus = "pending";
    if (action === "approved") {
      nextStatus = "approved";
      updates.status = nextStatus;
      updates.approval_notes = normalizeText(notes) || null;
    } else if (action === "returned_for_revision") {
      nextStatus = currentResubmissions >= 1 ? "final_rejected" : "returned_for_revision";
      updates.status = nextStatus;
      updates.approval_notes = notes;
    } else {
      nextStatus = currentResubmissions >= 1 ? "final_rejected" : "rejected";
      updates.status = nextStatus;
      updates.approval_notes = notes;
    }

    const updatedRows = await update("service_requests", updates, {
      id: requestRecord.id,
    });

    const updatedRequest = Array.isArray(updatedRows) && updatedRows.length > 0
      ? updatedRows[0]
      : { ...requestRecord, ...updates };

    const entityType = normalizeToken(updatedRequest.entity_type);
    const entityId = normalizeText(updatedRequest.entity_id || updatedRequest.event_id);

    let entityRecord = null;
    if (entityType === "fest") {
      entityRecord = await queryFestById(entityId);
    } else {
      entityRecord = await queryOne("events", { where: { event_id: entityId } });
    }

    const recipientEmail = normalizeEmail(updatedRequest.requester_email || updatedRequest.requested_by_email);
    if (recipientEmail) {
      if (nextStatus === "approved") {
        await sendServiceRequestApprovedEmail({
          to: recipientEmail,
          serviceType: normalizeToken(updatedRequest.service_type || updatedRequest.service_role_code),
          entityType: entityType || "event",
          entityName: getEntityDisplayName({ entityType, entityRecord, fallbackId: entityId }),
          requesterName: req.userInfo.name,
          requesterEmail: recipientEmail,
          submittedAt: updatedRequest.created_at,
          link: buildRequestLink(updatedRequest.id || requestId),
        });
      } else {
        await sendServiceRequestRejectedEmail({
          to: recipientEmail,
          serviceType: normalizeToken(updatedRequest.service_type || updatedRequest.service_role_code),
          entityType: entityType || "event",
          entityName: getEntityDisplayName({ entityType, entityRecord, fallbackId: entityId }),
          requesterName: req.userInfo.name,
          requesterEmail: recipientEmail,
          submittedAt: updatedRequest.created_at,
          notes,
          link: buildRequestLink(updatedRequest.id || requestId),
        });
      }
    }

    return res.status(200).json({
      success: true,
      status: nextStatus,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("[ServiceRequests] action error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/by-entity/:entityType/:entityId", async (req, res) => {
  try {
    const entityType = normalizeToken(req.params.entityType);
    const entityId = normalizeText(req.params.entityId);

    if (!["event", "fest"].includes(entityType)) {
      return res.status(400).json({ error: "Invalid entity type." });
    }

    const requests = await queryAll("service_requests", {
      where: {
        entity_type: entityType,
        entity_id: entityId,
      },
      order: {
        column: "created_at",
        ascending: false,
      },
    });

    return res.status(200).json(requests || []);
  } catch (error) {
    console.error("[ServiceRequests] by-entity error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-requests", async (req, res) => {
  try {
    const requesterEmail = normalizeEmail(req.userInfo.email);
    const requests = await queryAll("service_requests", {
      where: {
        requester_email: requesterEmail,
      },
      order: {
        column: "created_at",
        ascending: false,
      },
    });

    return res.status(200).json({ requests: requests || [] });
  } catch (error) {
    console.error("[ServiceRequests] my-requests error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-queue", async (req, res) => {
  try {
    const assigneeEmail = normalizeEmail(req.userInfo.email);
    const requests = await queryAll("service_requests", {
      where: {
        assigned_incharge_email: assigneeEmail,
        status: "pending",
      },
      order: {
        column: "created_at",
        ascending: false,
      },
    });

    const groupedByEntity = (requests || []).reduce((accumulator, request) => {
      const entityType = normalizeToken(request.entity_type || "event");
      const entityId = normalizeText(request.entity_id || request.event_id || "unknown");
      const groupKey = `${entityType}:${entityId}`;

      if (!accumulator[groupKey]) {
        accumulator[groupKey] = {
          entity_type: entityType,
          entity_id: entityId,
          requests: [],
        };
      }

      accumulator[groupKey].requests.push(request);
      return accumulator;
    }, {});

    return res.status(200).json({
      queue: Object.values(groupedByEntity),
      total: Array.isArray(requests) ? requests.length : 0,
    });
  } catch (error) {
    console.error("[ServiceRequests] my-queue error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
