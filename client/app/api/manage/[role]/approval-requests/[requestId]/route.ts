import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getServiceRoleConfigBySlug,
  hasServiceRoleAccess,
} from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";
import { fetchWorkflowApiWithFailover } from "@/lib/workflowApiClient";

type DecisionAction = "approve" | "reject" | "return";

type ServiceRequestRow = {
  id?: string;
  service_request_id?: string | null;
  status?: string | null;
  service_role_code?: string | null;
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
  { params }: { params: Promise<{ role: string; requestId: string }> }
) {
  try {
    const { role, requestId } = await params;
    const roleConfig = getServiceRoleConfigBySlug(role);

    if (!roleConfig) {
      return jsonError(404, "Role dashboard not found.");
    }

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
    if (isMasterAdmin) {
      return jsonError(
        403,
        "Master admin can view and edit resources but cannot submit approval decisions."
      );
    }

    const canAccessRole =
      hasServiceRoleAccess(userProfile as Record<string, unknown>, roleConfig);
    if (!canAccessRole) {
      return jsonError(403, `Only ${roleConfig.label} users can perform actions.`);
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

    let serviceRequestData: ServiceRequestRow | null = null;

    const { data: byServiceRequestId, error: serviceRequestIdError } = await supabase
      .from("service_requests")
      .select("id,service_request_id,status,service_role_code")
      .eq("service_request_id", requestId)
      .maybeSingle();

    if (serviceRequestIdError) {
      return jsonError(
        500,
        `Failed to fetch ${roleConfig.label} service request: ${serviceRequestIdError.message}`
      );
    }

    serviceRequestData = (byServiceRequestId as ServiceRequestRow | null) || null;

    if (!serviceRequestData) {
      const { data: byRowId, error: rowIdError } = await supabase
        .from("service_requests")
        .select("id,service_request_id,status,service_role_code")
        .eq("id", requestId)
        .maybeSingle();

      if (rowIdError) {
        return jsonError(
          500,
          `Failed to fetch ${roleConfig.label} service request: ${rowIdError.message}`
        );
      }

      serviceRequestData = (byRowId as ServiceRequestRow | null) || null;
    }

    if (!serviceRequestData) {
      return jsonError(404, "Service request not found.");
    }

    const requestRow = serviceRequestData as ServiceRequestRow;
    const requestStatus = String(requestRow.status || "").trim().toUpperCase();
    if (!requestStatus || requestStatus === "APPROVED" || requestStatus === "REJECTED") {
      return jsonError(409, "This request is no longer pending.");
    }

    const serviceRoleCode = String(requestRow.service_role_code || "").trim().toUpperCase();

    const roleCodes = Array.isArray(roleConfig.roleCodes)
      ? roleConfig.roleCodes
          .map((code) => String(code || "").trim().toUpperCase())
          .filter((code) => code.length > 0)
      : [];

    if (roleCodes.length === 0) {
      return jsonError(500, "Role configuration is missing role code mappings.");
    }

    if (!roleCodes.includes(serviceRoleCode)) {
      return jsonError(403, `This request is not assigned to ${roleConfig.label} queue.`);
    }

    const requestIdentifier = String(requestRow.service_request_id || requestRow.id || "").trim();
    if (!requestIdentifier) {
      return jsonError(400, "Service request is missing workflow identifiers.");
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return jsonError(401, "Authentication session is unavailable. Please sign in again.");
    }

    const comments =
      action === "approve"
        ? null
        : action === "return"
          ? `RETURN_FOR_REVISION: ${note}`
          : note;

    let upstreamResponse: Response;
    try {
      const upstreamResult = await fetchWorkflowApiWithFailover(
        `/api/approvals/service-requests/${encodeURIComponent(requestIdentifier)}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            decision: action === "approve" ? "APPROVED" : "REJECTED",
            comment: comments,
          }),
        },
        20000
      );

      upstreamResponse = upstreamResult.response;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return jsonError(504, "Approval service timeout. Please try again.");
      }

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
      return jsonError(upstreamResponse.status, upstreamError);
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? `${roleConfig.label} request approved successfully.`
          : action === "return"
            ? `${roleConfig.label} request returned for revision.`
            : `${roleConfig.label} request rejected successfully.`,
      data: upstreamPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, message);
  }
}
