import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

type DecisionAction = "approve" | "return";

type ApprovalRequestRow = {
  id?: string;
  request_id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  status?: string | null;
  organizing_dept?: string | null;
  campus_hosted_at?: string | null;
};

type EventScopeRow = {
  organizing_dept?: string | null;
  campus_hosted_at?: string | null;
};

type FestScopeRow = {
  organizing_dept?: string | null;
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

async function expandDepartmentScopes(supabase: any, scopes: string[]): Promise<string[]> {
  const normalizedScopes = Array.from(
    new Set(
      scopes
        .flatMap((scope) => buildDepartmentScopeCandidates(scope))
        .filter((scope) => scope.length > 0)
    )
  );

  const uuidScopes = normalizedScopes.filter((scope) => UUID_PATTERN.test(scope));
  if (uuidScopes.length === 0) {
    return normalizedScopes;
  }

  const { data: departmentsRows, error: departmentsError } = await supabase
    .from("departments_courses")
    .select("id, department_name")
    .in("id", uuidScopes);

  if (!departmentsError && Array.isArray(departmentsRows)) {
    departmentsRows.forEach((row: any) => {
      const nameCandidates = buildDepartmentScopeCandidates(row?.department_name);
      nameCandidates.forEach((candidate) => normalizedScopes.push(candidate));
    });
  }

  return Array.from(new Set(normalizedScopes));
}

function parseAction(value: unknown): DecisionAction | null {
  if (value === "approve" || value === "return") {
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

async function getRoleScopedDepartments(
  userProfile: Record<string, unknown>,
  roleCode: "HOD" | "DEAN",
  supabase: any
): Promise<string[]> {
  const roleAssignments = Array.isArray(userProfile.role_assignments)
    ? (userProfile.role_assignments as Array<Record<string, unknown>>)
    : [];

  const scopedDepartmentsRaw = roleAssignments
    .filter(
      (assignment) =>
        String(assignment.role_code || "").trim().toUpperCase() === roleCode &&
        isAssignmentActive(assignment)
    )
    .map((assignment) => String(assignment.department_scope || "").trim())
    .filter((scope) => scope.length > 0);

  if (scopedDepartmentsRaw.length > 0) {
    return expandDepartmentScopes(supabase, scopedDepartmentsRaw);
  }

  if (roleCode === "HOD") {
    return expandDepartmentScopes(supabase, [
      String(userProfile.department_id || "").trim(),
      String(userProfile.department || "").trim(),
    ]);
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
): Promise<{ departmentScope: string; campusScope: string }> {
  const entityType = String(requestRow.entity_type || "").trim().toUpperCase();
  const entityRef = String(requestRow.entity_ref || "").trim();

  let departmentScope = normalizeDepartmentScope(requestRow.organizing_dept);
  let campusScope = normalizeScope(requestRow.campus_hosted_at);

  if (entityType === "FEST" && entityRef) {
    const { data: festData } = await supabase
      .from("fests")
      .select("organizing_dept,campus_hosted_at")
      .eq("fest_id", entityRef)
      .maybeSingle();

    const festRow = (festData as FestScopeRow | null) || null;
    departmentScope =
      departmentScope || normalizeDepartmentScope(festRow?.organizing_dept);
    campusScope = campusScope || normalizeScope(festRow?.campus_hosted_at);

    if (!departmentScope) {
      const { data: legacyFestData } = await supabase
        .from("fest")
        .select("organizing_dept,campus_hosted_at")
        .eq("fest_id", entityRef)
        .maybeSingle();

      const legacyFestRow = (legacyFestData as FestScopeRow | null) || null;
      departmentScope =
        departmentScope || normalizeDepartmentScope(legacyFestRow?.organizing_dept);
      campusScope = campusScope || normalizeScope(legacyFestRow?.campus_hosted_at);
    }
  } else if (entityRef) {
    const { data: eventData } = await supabase
      .from("events")
      .select("organizing_dept,campus_hosted_at")
      .eq("event_id", entityRef)
      .maybeSingle();

    const eventRow = (eventData as EventScopeRow | null) || null;
    departmentScope =
      departmentScope || normalizeDepartmentScope(eventRow?.organizing_dept);
    campusScope = campusScope || normalizeScope(eventRow?.campus_hosted_at);
  }

  return {
    departmentScope,
    campusScope,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
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
      return jsonError(400, "Invalid action. Expected approve or return.");
    }

    if (action === "return" && note.length === 0) {
      return jsonError(400, "Revision description is required for return action.");
    }

    const { data: approvalData, error: approvalError } = await supabase
      .from("approval_requests")
      .select("id,request_id,entity_type,entity_ref,status,organizing_dept,campus_hosted_at")
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
      const allowedScopes = await getRoleScopedDepartments(userProfile, "HOD", supabase);
      if (allowedScopes.length === 0) {
        return jsonError(403, "No department scope is mapped to this HOD account.");
      }

      const allowedCampuses = getRoleScopedCampuses(userProfile, "HOD");
      if (allowedCampuses.length === 0) {
        return jsonError(403, "No campus scope is mapped to this HOD account.");
      }

      const { departmentScope, campusScope } = await resolveRequestScopeFromEntity(
        supabase,
        requestRow
      );

      const requestDepartmentCandidates = buildDepartmentScopeCandidates(departmentScope);
      const hasDepartmentMatch =
        requestDepartmentCandidates.length > 0 &&
        allowedScopes.some((scope) => requestDepartmentCandidates.includes(scope));

      if (
        allowedScopes.length > 0 &&
        (!departmentScope || !hasDepartmentMatch)
      ) {
        return jsonError(403, "This request does not belong to your department scope.");
      }

      if (!campusScope || !allowedCampuses.includes(campusScope)) {
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

    const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
    if (!apiBaseUrl) {
      return jsonError(500, "NEXT_PUBLIC_API_URL is not configured for workflow decisions.");
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetchWithTimeout(
        `${apiBaseUrl}/api/approvals/requests/${encodeURIComponent(requestIdentifier)}/steps/${encodeURIComponent(stepCode)}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            decision: action === "approve" ? "APPROVED" : "REJECTED",
            comment: action === "return" ? `RETURN_FOR_REVISION: ${note}` : null,
          }),
          cache: "no-store",
        },
        20000
      );
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.error("[ManageHod] Upstream approval decision timed out", {
          requestId,
          requestIdentifier,
          stepCode,
        });
        return jsonError(504, "Approval service timeout. Please try again.");
      }

      throw error;
    }

    let upstreamPayload: any = null;
    let upstreamText: string | null = null;

    try {
      upstreamPayload = await upstreamResponse.json();
    } catch {
      upstreamText = await upstreamResponse.text().catch(() => null);
    }

    if (!upstreamResponse.ok) {
<<<<<<< Updated upstream
      const upstreamError =
        upstreamPayload?.error ||
        upstreamPayload?.message ||
        upstreamText ||
        "Unable to update approval decision.";

=======
      console.error("[ManageHod] Upstream approval decision failed", {
        requestId,
        requestIdentifier,
        stepCode,
        status: upstreamResponse.status,
        error: upstreamPayload?.error || null,
      });
>>>>>>> Stashed changes
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
