import { queryAll } from "../config/database.js";
import { ROLE_CODES, isRoleAssignmentActive, normalizeRoleCode } from "./roleAccessService.js";

const SUPPORTED_PRIMARY_APPROVER_ROLES = new Set([ROLE_CODES.HOD, ROLE_CODES.DEAN]);

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

export const normalizeDepartmentScope = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeRoleAssignmentRows = (assignmentRows, roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return (Array.isArray(assignmentRows) ? assignmentRows : []).filter((assignment) => {
    if (!assignment || normalizeRoleCode(assignment.role_code) !== normalizedRoleCode) {
      return false;
    }

    return isRoleAssignmentActive(assignment);
  });
};

export const resolveDepartmentApproverRole = async ({ organizingDept }) => {
  const normalizedDepartmentScope = normalizeDepartmentScope(organizingDept);

  if (!normalizedDepartmentScope) {
    return {
      ok: false,
      errorMessage: "Organizing department is required for approval routing.",
      reason: "missing_department",
    };
  }

  let routingRows;
  try {
    routingRows = await queryAll("department_approval_routing", {
      where: { is_active: true },
      order: { column: "created_at", ascending: true },
    });
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "department_scope")) {
      return {
        ok: false,
        errorMessage:
          "Department approval routing is not configured yet. Run migration 018_department_approval_routing.sql.",
        reason: "routing_table_missing",
      };
    }

    throw error;
  }

  const matchedRoutingRow = (routingRows || []).find(
    (row) => normalizeDepartmentScope(row?.department_scope) === normalizedDepartmentScope
  );

  if (!matchedRoutingRow) {
    return {
      ok: false,
      errorMessage:
        `No active approver routing is configured for department '${organizingDept}'. Contact admin.`,
      reason: "routing_missing",
    };
  }

  const approverRoleCode = normalizeRoleCode(matchedRoutingRow.approver_role_code);

  if (!SUPPORTED_PRIMARY_APPROVER_ROLES.has(approverRoleCode)) {
    return {
      ok: false,
      errorMessage:
        `Unsupported approver role '${matchedRoutingRow.approver_role_code}' for department '${organizingDept}'.`,
      reason: "invalid_role",
    };
  }

  let roleAssignments;
  try {
    roleAssignments = await queryAll("user_role_assignments", {
      where: {
        role_code: approverRoleCode,
        is_active: true,
      },
    });
  } catch (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error, "department_scope")) {
      return {
        ok: false,
        errorMessage:
          "Role assignments table is not available. Run RBAC workflow migrations before routing approvals.",
        reason: "assignment_table_missing",
      };
    }

    throw error;
  }

  const activeAssignments = normalizeRoleAssignmentRows(roleAssignments, approverRoleCode);
  const hasScopedAssignee = activeAssignments.some(
    (assignment) =>
      normalizeDepartmentScope(assignment?.department_scope) === normalizedDepartmentScope
  );

  if (!hasScopedAssignee) {
    return {
      ok: false,
      errorMessage:
        `No active ${approverRoleCode} assignee is mapped to department '${organizingDept}'. Contact admin.`,
      reason: "assignee_missing",
    };
  }

  return {
    ok: true,
    approverRoleCode,
    departmentScope: normalizedDepartmentScope,
    routingRow: matchedRoutingRow,
  };
};
