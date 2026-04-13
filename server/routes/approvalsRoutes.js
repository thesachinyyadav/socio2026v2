// Helper: fetch approval request for a given event_id
const getApprovalRequestForEvent = async (eventId) => {
  if (!eventId) return null;
  const event = await queryOne("events", { where: { event_id: eventId } });
  if (!event || !event.approval_request_id) return null;
  return await queryOne("approval_requests", { where: { id: event.approval_request_id } });
};

// Endpoint: GET /requests/by-event/:eventId
router.get("/requests/by-event/:eventId", async (req, res) => {
  try {
    const eventId = String(req.params.eventId || "").trim();
    if (!eventId) return res.status(400).json({ error: "Missing eventId" });
    const approvalRequest = await getApprovalRequestForEvent(eventId);
    if (!approvalRequest) return res.status(404).json({ error: "Approval request not found for event" });
    return res.status(200).json({ approval_request: approvalRequest });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({ error: "Approval workflow schema is not available yet. Run latest migrations first." });
    }
    console.error("Error fetching approval request for event:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
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

    if (statuses.some((status) => status === "PENDING")) {
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
    const serviceApprovalState = await recomputeEventServiceApprovalState(eventId);

    const updates = {
      approval_state: normalizedRequestStatus,
      service_approval_state: serviceApprovalState,
      activation_state: resolveActivationState(normalizedRequestStatus, serviceApprovalState),
      is_draft:
        resolveActivationState(normalizedRequestStatus, serviceApprovalState) !== "ACTIVE",
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
      updates.rejected_at = nowIso;
      updates.rejected_by = decidedByEmail || null;
      updates.rejection_reason = comment || "Rejected in approval workflow";
      updates.approved_at = null;
      updates.approved_by = null;
    }

    await update("events", updates, { event_id: eventId });
  } catch (error) {
    if (
      isMissingRelationError(error) ||
      isMissingColumnError(error, "approval_state") ||
      isMissingColumnError(error, "activation_state") ||
      isMissingColumnError(error, "service_approval_state") ||
      isMissingColumnError(error, "is_draft")
    ) {
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
  const updates = {
    approval_state: normalizedRequestStatus,
    activation_state: normalizedRequestStatus === "APPROVED" ? "ACTIVE" : normalizedRequestStatus === "REJECTED" ? "REJECTED" : "PENDING",
    is_draft:
      (normalizedRequestStatus === "APPROVED" ? "ACTIVE" : normalizedRequestStatus === "REJECTED" ? "REJECTED" : "PENDING") !== "ACTIVE",
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
    updates.rejected_at = nowIso;
    updates.rejected_by = decidedByEmail || null;
    updates.rejection_reason = comment || "Rejected in approval workflow";
    updates.approved_at = null;
    updates.approved_by = null;
  }

  for (const tableName of ["fests", "fest"]) {
    try {
      const festRecord = await queryOne(tableName, {
        where: { fest_id: festId },
      });

      if (!festRecord) {
        continue;
      }

      await update(tableName, updates, { fest_id: festId });
      return;
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      if (
        isMissingColumnError(error, "approval_state") ||
        isMissingColumnError(error, "activation_state") ||
        isMissingColumnError(error, "is_draft")
      ) {
        return;
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

    const updates = {
      service_approval_state: serviceApprovalState,
      activation_state: resolveActivationState(currentApprovalState, serviceApprovalState),
      is_draft:
        resolveActivationState(currentApprovalState, serviceApprovalState) !== "ACTIVE",
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

    await update("events", updates, { event_id: eventId });
  } catch (error) {
    if (
      isMissingRelationError(error) ||
      isMissingColumnError(error, "service_approval_state") ||
      isMissingColumnError(error, "activation_state") ||
      isMissingColumnError(error, "is_draft")
    ) {
      return;
    }

    throw error;
  }
};

const normalizeDecision = (decision) => String(decision || "").trim().toUpperCase();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeDepartmentScopeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

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

const resolveDepartmentLabelsFromIds = async (departmentIds) => {
  const labels = new Set();

  for (const departmentId of departmentIds) {
    const normalizedId = String(departmentId || "").trim();
    if (!normalizedId) {
      continue;
    }

    labels.add(normalizeDepartmentScopeValue(normalizedId));

    try {
      const departmentRow = await queryOne("departments_courses", {
        where: { id: normalizedId },
        select: "id,department_name",
      });

      if (departmentRow?.department_name) {
        labels.add(normalizeDepartmentScopeValue(departmentRow.department_name));
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      throw error;
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
        select: "department_scope,is_active,valid_from,valid_until",
      });

      for (const assignment of assignments || []) {
        if (!isRoleAssignmentActive(assignment)) {
          continue;
        }

        const departmentScopeValue = String(assignment.department_scope || "").trim();
        if (!departmentScopeValue) {
          continue;
        }

        addScopeValue(departmentScopeValue);
        if (UUID_REGEX.test(departmentScopeValue)) {
          departmentIdCandidates.add(departmentScopeValue);
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

const canHodAccessApprovalRequest = async (req, approvalRequest) => {
  if (isMasterAdminRequest(req)) {
    return true;
  }

  const departmentScope = await resolveHodDepartmentScope(req);
  if (departmentScope.size === 0) {
    return false;
  }

  const requestDepartment = normalizeDepartmentScopeValue(
    approvalRequest?.organizing_dept
  );

  if (!requestDepartment) {
    return false;
  }

  return departmentScope.has(requestDepartment);
};

const getUserRoleCodes = (req) => {
  return Array.isArray(req.userInfo?.role_codes) ? req.userInfo.role_codes : [];
};

const isMasterAdminRequest = (req) => {
  return Boolean(req.userInfo?.is_masteradmin) || hasAnyRoleCode(getUserRoleCodes(req), [ROLE_CODES.MASTER_ADMIN]);
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

  if (!hasAnyRoleCode(getUserRoleCodes(req), [normalizedRoleCode])) {
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

  return true;
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

router.get("/queues/:roleCode", async (req, res) => {
  try {
    const roleCode = normalizeRoleCode(req.params.roleCode);

    if (!(await ensureQueueAccess(req, res, roleCode))) {
      return;
    }

    const hodDepartmentScope =
      roleCode === ROLE_CODES.HOD ? await resolveHodDepartmentScope(req) : null;

    const queueSteps = await queryAll("approval_steps", {
      where: { role_code: roleCode, status: "PENDING" },
      order: { column: "created_at", ascending: true },
    });

    const items = [];
    for (const step of queueSteps || []) {
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

      items.push({
        request_id: approvalRequest.request_id,
        status: approvalRequest.status,
        entity_type: approvalRequest.entity_type,
        entity_ref: approvalRequest.entity_ref,
        organizing_dept: approvalRequest.organizing_dept,
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

    return res.status(200).json({
      role_code: roleCode,
      pending_count: (serviceQueue || []).length,
      items: serviceQueue || [],
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
    if (isMasterAdminRequest(req)) {
      return res.status(403).json({
        error: "Master admin can view and edit resources but cannot submit approval decisions.",
      });
    }

    const { requestId, stepCode } = req.params;
    const decision = normalizeDecision(req.body?.decision);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
    }

    const approvalRequest = await queryOne("approval_requests", {
      where: { request_id: requestId },
    });

    if (!approvalRequest) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const approvalStep = await queryOne("approval_steps", {
      where: {
        approval_request_id: approvalRequest.id,
        step_code: stepCode,
      },
    });

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

    const stepRoleCode = normalizeRoleCode(approvalStep.role_code);

    if (!(await ensureQueueAccess(req, res, stepRoleCode, approvalRequest))) {
      return;
    }

    const nowIso = new Date().toISOString();

    await update(
      "approval_steps",
      {
        status: decision,
        decided_at: nowIso,
        updated_at: nowIso,
      },
      { id: approvalStep.id }
    );

    await insert("approval_decisions", [{
      approval_request_id: approvalRequest.id,
      approval_step_id: approvalStep.id,
      decided_by_user_id: req.userInfo?.id || null,
      decided_by_email: req.userInfo?.email || null,
      role_code: stepRoleCode,
      decision,
      comment,
    }]);

    if (decision === "REJECTED") {
      await update(
        "approval_steps",
        { status: "SKIPPED", updated_at: nowIso },
        { approval_request_id: approvalRequest.id, status: "PENDING" }
      );
    }

    const requestStatus = await recomputeApprovalRequestStatus(approvalRequest.id);
    await syncApprovalOutcomeToEntity({
      approvalRequest,
      requestStatus,
      decidedByEmail: req.userInfo?.email || null,
      comment,
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
    if (isMasterAdminRequest(req)) {
      return res.status(403).json({
        error: "Master admin can view and edit resources but cannot submit service decisions.",
      });
    }

    const { serviceRequestId } = req.params;
    const decision = normalizeDecision(req.body?.decision);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
    }

    const serviceRequest = await queryOne("service_requests", {
      where: { service_request_id: serviceRequestId },
    });

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
