"use server";

import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

export interface CfoActionResult {
  ok: boolean;
  message: string;
  nextRequestId?: string | null;
  eventId?: string | null;
  alreadyProcessed?: boolean;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function fail(message: string): CfoActionResult {
  return { ok: false, message };
}

async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server actions should not mutate cookies directly.
      },
    },
  });
}

async function resolveCfoSession() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      error: "Authentication required.",
      supabase,
      user: null,
      profile: null,
    };
  }

  const profile = await getCurrentUserProfileWithRoleCodes(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!profile) {
    return {
      ok: false as const,
      error: "Unable to resolve user profile.",
      supabase,
      user,
      profile: null,
    };
  }

  const profileRecord = profile as Record<string, unknown>;
  const isMasterAdmin = Boolean(profileRecord.is_masteradmin);
  const isCfo = hasAnyRoleCode(profileRecord, ["CFO"]) || Boolean(profileRecord.is_cfo);

  if (!isMasterAdmin && !isCfo) {
    return {
      ok: false as const,
      error: "Only CFO or Master Admin users can perform this action.",
      supabase,
      user,
      profile,
    };
  }

  return {
    ok: true as const,
    error: null,
    supabase,
    user,
    profile,
  };
}

export async function processCfoApprovalAction(input: {
  requestId: string;
  note?: string;
}): Promise<CfoActionResult> {
  try {
    const requestId = normalizeText(input.requestId);
    const note = normalizeText(input.note);

    if (!requestId) {
      return fail("Approval request id is required.");
    }

    const authContext = await resolveCfoSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;

    const { data, error } = await supabase.rpc("process_cfo_approval_handoff", {
      p_l3_request_id: requestId,
      p_actor_email: user.email || null,
      p_note: note || null,
    });

    if (error) {
      return fail(`Failed to process CFO approval: ${error.message}`);
    }

    const payload = (data || {}) as Record<string, unknown>;
    const ok = payload.ok !== false;
    if (!ok) {
      return fail(normalizeText(payload.message) || "Unable to process CFO approval handoff.");
    }

    revalidatePath("/manage/cfo");
    revalidatePath("/manage/finance");

    return {
      ok: true,
      message:
        normalizeText(payload.message) ||
        "CFO approval recorded and request sent to Accounts queue.",
      nextRequestId: normalizeText(payload.l4_request_id) || null,
      eventId: normalizeText(payload.event_id) || null,
      alreadyProcessed: Boolean(payload.already_processed),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while processing CFO approval.";
    return fail(message);
  }
}
