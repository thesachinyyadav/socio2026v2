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
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
};

type FestScopeRow = {
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
};

type ApprovalStepRow = {
  id?: string;
  step_code?: string | null;
  status?: string | null;
};

function normalizeScope(value: unknown): string {
  return String(value || "").trim().toLowerCase();
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

function getRoleScopedDepartments(
  userProfile: Record<string, unknown>,
  roleCode: "HOD" | "DEAN"
): string[] {
  const roleAssignments = Array.isArray(userProfile.role_assignments)
    ? (userProfile.role_assignments as Array<Record<string, unknown>>)
    : [];

  const scopedDepartments = roleAssignments
    .filter(
      (assignment) =>
        String(assignment.role_code || "").trim().toUpperCase() === roleCode &&
        isAssignmentActive(assignment)
    )
    .map((assignment) => normalizeScope(assignment.department_scope))
    .filter((scope) => scope.length > 0);

  if (scopedDepartments.length > 0) {
    return Array.from(new Set(scopedDepartments));
  }

  if (roleCode === "DEAN") {
    return Array.from(
      new Set(
        [
          normalizeScope(userProfile.school_id),
          normalizeScope(userProfile.department_id),
          normalizeScope(userProfile.department),
        ].filter((scope) => scope.length > 0)
      )
    );
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

  if (roleCode === "DEAN") {
    const campus = normalizeScope(userProfile.campus);
    return campus ? [campus] : [];
  }

  return [];
}

async function resolveRequestScopeFromEntity(
  supabase: any,
  requestRow: ApprovalRequestRow
): Promise<{ schoolScope: string; campusScope: string }> {
  const entityType = String(requestRow.entity_type || "").trim().toUpperCase();
  const entityRef = String(requestRow.entity_ref || "").trim();

  let schoolScope = "";
  let campusScope = normalizeScope(requestRow.campus_hosted_at);

  if (entityType === "FEST" && entityRef) {
    const { data: festData } = await supabase
      .from("fests")
      .select("organizing_school,campus_hosted_at")
      .eq("fest_id", entityRef)
      .maybeSingle();

    const festRow = (festData as FestScopeRow | null) || null;
    schoolScope = normalizeScope(festRow?.organizing_school);
    campusScope = campusScope || normalizeScope(festRow?.campus_hosted_at);

    if (!schoolScope) {
      const { data: legacyFestData } = await supabase
        .from("fest")
        .select("organizing_school,campus_hosted_at")
        .eq("fest_id", entityRef)
        .maybeSingle();

      const legacyFestRow = (legacyFestData as FestScopeRow | null) || null;
      schoolScope = normalizeScope(legacyFestRow?.organizing_school);
      campusScope = campusScope || normalizeScope(legacyFestRow?.campus_hosted_at);
    }
  } else if (entityRef) {
    const { data: eventData } = await supabase
      .from("events")
      .select("organizing_school,campus_hosted_at")
      .eq("event_id", entityRef)
      .maybeSingle();

    const eventRow = (eventData as EventScopeRow | null) || null;
    schoolScope = normalizeScope(eventRow?.organizing_school);
    campusScope = campusScope || normalizeScope(eventRow?.campus_hosted_at);
  }

  schoolScope = schoolScope || normalizeScope(requestRow.organizing_dept);

  return {
    schoolScope,
    campusScope,
  };
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
    const isDeanUser =
      hasAnyRoleCode(userProfile, ["DEAN"]) ||
      Boolean(userProfile.is_dean);
    if (!isDeanUser && !isMasterAdmin) {
      return jsonError(403, "Only Dean or Master Admin users can perform L2 actions.");
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
      const allowedScopes = getRoleScopedDepartments(userProfile, "DEAN");
      if (allowedScopes.length === 0) {
        return jsonError(403, "No department scope is mapped to this Dean account.");
      }

      const allowedCampuses = getRoleScopedCampuses(userProfile, "DEAN");
      if (allowedCampuses.length === 0) {
        return jsonError(403, "No campus scope is mapped to this Dean account.");
      }

      const { schoolScope, campusScope } = await resolveRequestScopeFromEntity(
        supabase,
        requestRow
      );

      if (!schoolScope || !allowedScopes.includes(schoolScope)) {
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
      .eq("role_code", "DEAN")
      .eq("status", "PENDING")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingStepError) {
      return jsonError(500, `Failed to load pending Dean step: ${pendingStepError.message}`);
    }

    if (!pendingStepData) {
      return jsonError(409, "No pending Dean step exists for this request.");
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

    const upstreamResponse = await fetch(
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
      }
    );

    const upstreamPayload = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      return jsonError(
        upstreamResponse.status,
        upstreamPayload?.error || "Unable to update approval decision."
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
    return jsonError(500, message);
  }
}
