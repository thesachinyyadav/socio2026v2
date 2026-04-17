import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";
import { fetchWorkflowApiWithFailover } from "@/lib/workflowApiClient";

type DecisionAction = "approve" | "return" | "reject";

type ApprovalRequestRow = {
  id?: string;
  request_id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  status?: string | null;
  organizing_dept?: string | null;
  organizing_dept_id?: string | null;
  campus_hosted_at?: string | null;
};

type EventScopeRow = {
  organizing_dept?: string | null;
  organizing_dept_id?: string | null;
  campus_hosted_at?: string | null;
};

type FestScopeRow = {
  organizing_dept?: string | null;
  organizing_dept_id?: string | null;
  campus_hosted_at?: string | null;
};

type ApprovalStepRow = {
  id?: string;
  step_code?: string | null;
  status?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeScope(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeDepartmentScope(value: unknown): string {
  const normalized = normalizeScope(value);
  if (!normalized) {
    return "";
  }

  if (UUID_PATTERN.test(normalized)) {
    return normalized;
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/^department of\s+/, "")
    .replace(/^dept(?:\.)?\s+of\s+/, "")
    .replace(/^dept(?:\.)?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDepartmentScopeCandidates(value: unknown): string[] {
  const candidates = new Set<string>();
  const raw = normalizeScope(value);
  const canonical = normalizeDepartmentScope(value);

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
}

function normalizeUUID(value: unknown): string {
  const s = String(value || "").trim().toLowerCase();
  return UUID_PATTERN.test(s) ? s : "";
}

function parseAction(value: unknown): DecisionAction | null {
  if (value === "approve" || value === "return" || value === "reject") {
    return value;
  }

  return null;
}

function isAssignmentActive(assignment: Record<string, unknown>, nowDate: Date = new Date()): boolean {
  if (!assignment || assignment.is_active === false) {
    return false;
  }

  const now = nowDate.getTime();
  const validFrom = assignment.valid_from
    ? new Date(String(assignment.valid_from)).getTime()
    : null;
  const validUntil = assignment.valid_until
    ? new Date(String(assignment.valid_until)).getTime()
    : null;

  if (Number.isFinite(validFrom) && (validFrom as number) > now) {
    return false;
  }

  if (Number.isFinite(validUntil) && (validUntil as number) <= now) {
    return false;
  }

  return true;
}

function getRoleScopedDepartments(
  userProfile: Record<string, unknown>,
  roleCode: "HOD" | "DEAN"
): string[] {
  const roleAssignments = Array.isArray(userProfile.role_assignments)
    ? (userProfile.role_assignments as Array<Record<string, unknown>>)
    : [];

  const activeAssignments = roleAssignments.filter(
    (assignment) =>
      String(assignment.role_code || "").trim().toUpperCase() === roleCode &&
      isAssignmentActive(assignment)
  );

  // Collect UUID-based scopes
  const uuidScopes = activeAssignments
    .map((a) => normalizeUUID(a.department_id))
    .filter((id) => id.length > 0);

  if (uuidScopes.length > 0) {
    return Array.from(new Set(uuidScopes));
  }

  if (roleCode === "HOD") {
    const profileId = normalizeUUID(userProfile.department_id);
    if (profileId) return [profileId];
  }

  return [];
}

function getRoleScopedDepartmentTexts(
  userProfile: Record<string, unknown>,
  roleCode: "HOD" | "DEAN"
): string[] {
  const roleAssignments = Array.isArray(userProfile.role_assignments)
    ? (userProfile.role_assignments as Array<Record<string, unknown>>)
    : [];

  const activeAssignments = roleAssignments.filter(
    (assignment) =>
      String(assignment.role_code || "").trim().toUpperCase() === roleCode &&
      isAssignmentActive(assignment)
  );

  const textScopes = activeAssignments
    .map((a) => normalizeDepartmentScope(a.department_scope))
    .filter((s) => s.length > 0);

  if (textScopes.length > 0) {
    return Array.from(new Set(textScopes));
  }

  if (roleCode === "HOD") {
    const profileDept = normalizeDepartmentScope(userProfile.department);
    if (profileDept) return [profileDept];
  }

  return [];
}

function getRoleScopedCampuses(
  userProfile: Record<string, unknown>,
  roleCode: "HOD" | "DEAN"
): string[] {
  const roleAssignments = Array.isArray(userProfile.role_assignments)
    ? (userProfile.role_assignments as Array<Record<string, unknown>>)
    : [];

  const scopedCampuses = roleAssignments
    .filter(
      (assignment) =>
        String(assignment.role_code || "").trim().toUpperCase() === roleCode &&
        isAssignmentActive(assignment)
    )
    .map((assignment) => normalizeScope(assignment.campus_scope))
    .filter((scope) => scope.length > 0);

  if (scopedCampuses.length > 0) {
    return Array.from(new Set(scopedCampuses));
  }

  if (roleCode === "HOD") {
    const campus = normalizeScope(userProfile.campus);
    return campus ? [campus] : [];
  }

  return [];
}

async function resolveRequestScopeFromEntity(
  supabase: any,
  requestRow: ApprovalRequestRow
): Promise<{ departmentScope: string; departmentText: string; campusScope: string }> {
  const entityType = String(requestRow.entity_type || "").trim().toUpperCase();
  const entityRef = String(requestRow.entity_ref || "").trim();

  let departmentScope = normalizeUUID(requestRow.organizing_dept_id);
  let departmentText = normalizeDepartmentScope(requestRow.organizing_dept);
  let campusScope = normalizeScope(requestRow.campus_hosted_at);

  if (entityType === "FEST" && entityRef) {
    const { data: festData } = await supabase
      .from("fests")
      .select("organizing_dept,organizing_dept_id,campus_hosted_at")
      .eq("fest_id", entityRef)
      .maybeSingle();

    const festRow = (festData as FestScopeRow | null) || null;
    departmentScope = departmentScope || normalizeUUID(festRow?.organizing_dept_id);
    departmentText = departmentText || normalizeDepartmentScope(festRow?.organizing_dept);
    campusScope = campusScope || normalizeScope(festRow?.campus_hosted_at);
  } else if (entityRef) {
    const { data: eventData } = await supabase
      .from("events")
      .select("organizing_dept,organizing_dept_id,campus_hosted_at")
      .eq("event_id", entityRef)
      .maybeSingle();

    const eventRow = (eventData as EventScopeRow | null) || null;
    departmentScope = departmentScope || normalizeUUID(eventRow?.organizing_dept_id);
    departmentText = departmentText || normalizeDepartmentScope(eventRow?.organizing_dept);
    campusScope = campusScope || normalizeScope(eventRow?.campus_hosted_at);
  }

  return { departmentScope, departmentText, campusScope };
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

async function buildSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    if (!requestId || requestId.trim().length === 0) {
      return jsonError(400, "Missing approval request id.");
    }

    const supabase = await buildSupabaseServerClient();
    if (!supabase) {
      return jsonError(500, "Supabase is not configured on this deployment.");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError(401, "Authentication required.");
    }

    const userProfile = await getCurrentUserProfileWithRoleCodes(supabase, {
      id: user.id,
      email: user.email,
    });

    if (!userProfile) {
      return jsonError(403, "Unable to resolve user profile.");
    }

    const isMasterAdmin = Boolean(userProfile.is_masteradmin);
    const isHodUser =
      hasAnyRoleCode(userProfile, ["HOD"]) ||
      Boolean(userProfile.is_hod);
    if (!isHodUser && !isMasterAdmin) {
      return jsonError(403, "Only HOD or Master Admin users can perform L1 actions.");
    }

    const body = await request.json().catch(() => null);
    const action = parseAction(body?.action);
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!action) {
      return jsonError(400, "Invalid action. Expected approve, return, or reject.");
    }

    if ((action === "return" || action === "reject") && note.length === 0) {
      return jsonError(400, "A note is required for this action.");
    }

    const { data: approvalData, error: approvalError } = await supabase
      .from("approval_requests")
      .select("id,request_id,entity_type,entity_ref,status,organizing_dept,organizing_dept_id,campus_hosted_at")
      .eq("id", requestId)
      .maybeSingle();

    if (approvalError) {
      return jsonError(500, `Failed to fetch approval request: ${approvalError.message}`);
    }

    if (!approvalData) {
      return jsonError(404, "Approval request not found.");
    }

    const requestRow = approvalData as ApprovalRequestRow;
    const requestStatus = String(requestRow.status || "").trim().toUpperCase();
    if (!["UNDER_REVIEW", "PENDING"].includes(requestStatus)) {
      return jsonError(409, "This request is no longer pending.");
    }

    if (!isMasterAdmin) {
      const allowedUuidScopes = getRoleScopedDepartments(userProfile, "HOD");
      const allowedTextScopes = getRoleScopedDepartmentTexts(userProfile, "HOD");

      if (allowedUuidScopes.length === 0 && allowedTextScopes.length === 0) {
        return jsonError(403, "No department scope is mapped to this HOD account.");
      }

      const allowedCampuses = getRoleScopedCampuses(userProfile, "HOD");

      const { departmentScope, departmentText, campusScope } = await resolveRequestScopeFromEntity(
        supabase,
        requestRow
      );

      const uuidMatch = departmentScope.length > 0 && allowedUuidScopes.includes(departmentScope);
      const textMatch = departmentText.length > 0 && allowedTextScopes.includes(departmentText);
      const hasDepartmentMatch = uuidMatch || textMatch;

      if ((allowedUuidScopes.length > 0 || allowedTextScopes.length > 0) && !hasDepartmentMatch) {
        return jsonError(403, "This request does not belong to your department scope.");
      }

      if (campusScope && allowedCampuses.length > 0 && !allowedCampuses.includes(campusScope)) {
        return jsonError(403, "This request does not belong to your campus scope.");
      }
    }

    const approvalRequestDbId = String(requestRow.id || "").trim();
    if (!approvalRequestDbId) {
      return jsonError(400, "Approval request is missing internal identifier.");
    }

    const { data: pendingStepData, error: pendingStepError } = await supabase
      .from("approval_steps")
      .select("id,step_code,status")
      .eq("approval_request_id", approvalRequestDbId)
      .eq("role_code", "HOD")
      .eq("status", "PENDING")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingStepError) {
      return jsonError(500, `Failed to load pending HOD step: ${pendingStepError.message}`);
    }

    if (!pendingStepData) {
      return jsonError(409, "No pending HOD step exists for this request.");
    }

    const requestIdentifier = String(requestRow.request_id || "").trim();
    const stepCode = String((pendingStepData as ApprovalStepRow).step_code || "").trim();

    if (!requestIdentifier || !stepCode) {
      return jsonError(400, "Approval request is missing workflow identifiers.");
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return jsonError(401, "Authentication session is unavailable. Please sign in again.");
    }

    let upstreamResponse: Response;
    try {
      const upstreamResult = await fetchWorkflowApiWithFailover(
        `/api/approvals/requests/${encodeURIComponent(requestIdentifier)}/steps/${encodeURIComponent(stepCode)}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            decision: action === "approve" ? "APPROVED" : "REJECTED",
            comment: action === "return"
              ? `RETURN_FOR_REVISION: ${note}`
              : action === "reject"
              ? note || null
              : null,
          }),
        },
        20000
      );

      upstreamResponse = upstreamResult.response;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.error("[ManageHod] Upstream approval decision timed out", {
          requestId,
          requestIdentifier,
          stepCode,
        });
        return jsonError(504, "Approval service timeout. Please try again.");
      }

      console.error("[ManageHod] Unable to reach approval service", {
        requestId,
        requestIdentifier,
        stepCode,
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonError(502, "Unable to reach approval service. Please try again.");
    }

    let upstreamPayload: any = null;
    let upstreamText: string | null = null;

    try {
      upstreamPayload = await upstreamResponse.json();
    } catch {
      upstreamText = await upstreamResponse.text().catch(() => null);
    }

    if (!upstreamResponse.ok) {
      const upstreamError =
        upstreamPayload?.error ||
        upstreamPayload?.message ||
        upstreamText ||
        "Unable to update approval decision.";
      console.error("[ManageHod] Upstream approval decision failed", {
        requestId,
        requestIdentifier,
        stepCode,
        status: upstreamResponse.status,
        error: upstreamPayload?.error || null,
      });
      return jsonError(
        upstreamResponse.status,
        upstreamError
      );
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? "Approval request approved successfully."
          : action === "reject"
          ? "Request declined."
          : "Approval request returned for revision.",
      data: upstreamPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("[ManageHod] PATCH approval request failed", {
      error: message,
    });
    return jsonError(500, message);
  }
}
