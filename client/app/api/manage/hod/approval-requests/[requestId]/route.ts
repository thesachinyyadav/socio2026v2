import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

type DecisionAction = "approve" | "return";

type ApprovalRequestRow = {
  id?: string;
  request_id?: string | null;
  status?: string | null;
  organizing_dept?: string | null;
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

  if (roleCode === "HOD") {
    return Array.from(
      new Set(
        [
          normalizeScope(userProfile.department_id),
          normalizeScope(userProfile.department),
        ].filter((scope) => scope.length > 0)
      )
    );
  }

  return [];
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
      .select("id,request_id,status,organizing_dept")
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
      const allowedScopes = getRoleScopedDepartments(userProfile, "HOD");
      const requestScope = normalizeScope(requestRow.organizing_dept);
      if (allowedScopes.length > 0 && (!requestScope || !allowedScopes.includes(requestScope))) {
        return jsonError(403, "This request does not belong to your department scope.");
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
