import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type DecisionAction = "approve" | "reject" | "return";

type EventJoinRow = {
  event_id?: string | null;
  organizing_dept?: string | null;
  fest_id?: string | null;
};

type ApprovalRequestRow = {
  id?: string;
  approval_level?: string | null;
  status?: string | null;
  approver_email?: string | null;
  events?: EventJoinRow | EventJoinRow[] | null;
};

function asSingleEvent(joined: EventJoinRow | EventJoinRow[] | null | undefined): EventJoinRow | null {
  if (!joined) {
    return null;
  }

  return Array.isArray(joined) ? joined[0] || null : joined;
}

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

async function getCurrentUserProfile(supabase: any, authUser: { id: string; email?: string | null }) {
  const byAuthUuid = await supabase
    .from("users")
    .select("*")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  if (!byAuthUuid.error && byAuthUuid.data) {
    return byAuthUuid.data as Record<string, unknown>;
  }

  if (!authUser.email) {
    return null;
  }

  const byEmail = await supabase
    .from("users")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle();

  if (byEmail.error || !byEmail.data) {
    return null;
  }

  return byEmail.data as Record<string, unknown>;
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

    const userProfile = await getCurrentUserProfile(supabase, {
      id: user.id,
      email: user.email,
    });

    if (!userProfile) {
      return jsonError(403, "Unable to resolve user profile.");
    }

    const universityRole = String(userProfile.university_role || "").toLowerCase().trim();
    const isMasterAdmin = Boolean(userProfile.is_masteradmin);
    const isHodUser = Boolean(userProfile.is_hod) || universityRole === "hod";
    if (!isHodUser && !isMasterAdmin) {
      return jsonError(403, "Only HOD or Master Admin users can perform L1 actions.");
    }

    const departmentId = String(userProfile.department_id || "").trim();
    if (!departmentId && !isMasterAdmin) {
      return jsonError(403, "No department is mapped to this HOD account.");
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
      .select(
        `
          id,
          approval_level,
          status,
          approver_email,
          events:event_id (
            event_id,
            organizing_dept,
            fest_id
          )
        `
      )
      .eq("id", requestId)
      .maybeSingle();

    if (approvalError) {
      return jsonError(500, `Failed to fetch approval request: ${approvalError.message}`);
    }

    if (!approvalData) {
      return jsonError(404, "Approval request not found.");
    }

    const requestRow = approvalData as ApprovalRequestRow;
    const eventRow = asSingleEvent(requestRow.events);

    if (!eventRow) {
      return jsonError(400, "Approval request is not linked to a valid event.");
    }

    if (String(requestRow.approval_level || "") !== "L1_HOD") {
      return jsonError(400, "Only L1_HOD approval requests can be modified here.");
    }

    if (String(requestRow.status || "") !== "pending") {
      return jsonError(409, "This request is no longer pending.");
    }

    if (!isMasterAdmin && String(eventRow.organizing_dept || "") !== departmentId) {
      return jsonError(403, "This request does not belong to your department.");
    }

    if (eventRow.fest_id !== null && eventRow.fest_id !== undefined && String(eventRow.fest_id).trim() !== "") {
      return jsonError(400, "Fest-linked events bypass L1 HOD approval.");
    }

    const status = action === "approve" ? "approved" : "rejected";
    const comments =
      action === "approve"
        ? null
        : action === "return"
          ? `RETURN_FOR_REVISION: ${note}`
          : note;

    const { data: updatedData, error: updateError } = await supabase
      .from("approval_requests")
      .update({
        status,
        comments,
        approver_email: user.email || requestRow.approver_email || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id, status, comments, resolved_at")
      .maybeSingle();

    if (updateError) {
      return jsonError(500, `Failed to update approval request: ${updateError.message}`);
    }

    if (!updatedData) {
      return jsonError(409, "Approval request was already handled by another user.");
    }

    return NextResponse.json({
      success: true,
      message: "Approval request updated successfully.",
      data: updatedData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, message);
  }
}
