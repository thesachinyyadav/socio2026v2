import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

type DecisionAction = "approve" | "reject" | "return";

type ApprovalRequestRow = {
  id?: string;
  request_id?: string | null;
  status?: string | null;
};

type ApprovalStepRow = {
  step_code?: string | null;
  status?: string | null;
};

function parseAction(value: unknown): DecisionAction | null {
  if (value === "approve" || value === "reject" || value === "return") {
    return value;
  }

  return null;
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
    const isCfo =
      hasAnyRoleCode(userProfile, ["CFO"]) ||
      Boolean(userProfile.is_cfo);
    if (!isMasterAdmin && !isCfo) {
      return jsonError(403, "Only CFO or Master Admin users can perform L3 actions.");
    }

    const body = await request.json().catch(() => null);
    const action = parseAction(body?.action);
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!action) {
      return jsonError(400, "Invalid action. Expected approve, reject, or return.");
    }

    if ((action === "reject" || action === "return") && note.length < 20) {
      return jsonError(400, "A rejection note of at least 20 characters is required.");
    }

    const { data: approvalData, error: approvalError } = await supabase
      .from("approval_requests")
      .select("id,request_id,status")
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
    if (!requestStatus || requestStatus === "APPROVED" || requestStatus === "REJECTED") {
      return jsonError(409, "This request is no longer pending.");
    }

    const approvalRequestDbId = String(requestRow.id || "").trim();
    const requestIdentifier = String(requestRow.request_id || "").trim();

    if (!approvalRequestDbId || !requestIdentifier) {
      return jsonError(400, "Approval request is missing workflow identifiers.");
    }

    const { data: pendingStepData, error: pendingStepError } = await supabase
      .from("approval_steps")
      .select("step_code,status")
      .eq("approval_request_id", approvalRequestDbId)
      .eq("role_code", "CFO")
      .eq("status", "PENDING")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingStepError) {
      return jsonError(500, `Failed to load pending CFO step: ${pendingStepError.message}`);
    }

    if (!pendingStepData) {
      return jsonError(409, "No pending CFO step exists for this request.");
    }

    const stepCode = String((pendingStepData as ApprovalStepRow).step_code || "").trim();
    if (!stepCode) {
      return jsonError(400, "Approval request is missing step identifiers.");
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
          comment: action === "return" ? `RETURN_FOR_REVISION: ${note}` : action === "reject" ? note : null,
        }),
        cache: "no-store",
      }
    );

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
      return jsonError(upstreamResponse.status, upstreamError);
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? "Approval request approved successfully."
          : action === "return"
            ? "Approval request returned for revision."
            : "Approval request rejected successfully.",
      data: upstreamPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, message);
  }
}
