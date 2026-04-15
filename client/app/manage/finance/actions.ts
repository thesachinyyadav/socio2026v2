"use server";

import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

import { FinanceActionResult, FinanceApprovalAction } from "./types";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return 0;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  return false;
}

function parseApprovalAction(value: unknown): FinanceApprovalAction | null {
  if (value === "approve" || value === "reject" || value === "return") {
    return value;
  }

  return null;
}

function isMissingRelationError(error: { code?: string | null; message?: string | null }) {
  const code = normalizeText(error?.code).toUpperCase();
  const message = normalizeLower(error?.message);

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
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

async function resolveFinanceSession() {
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
  const isFinanceOfficer =
    hasAnyRoleCode(profileRecord, ["ACCOUNTS"]) ||
    Boolean(profileRecord.is_finance_officer);
  if (!isFinanceOfficer && !isMasterAdmin) {
    return {
      ok: false as const,
      error: "Only Finance Officer or Master Admin users can perform this action.",
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

async function logFinanceAudit(
  supabase: any,
  payload: {
    eventId: string | null;
    budgetId: string | null;
    action: string;
    amount?: number | null;
    notes?: string | null;
    actedByEmail: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const insertPayload = {
    event_id: payload.eventId,
    budget_id: payload.budgetId,
    action: payload.action,
    amount: payload.amount ?? null,
    notes: payload.notes ?? null,
    acted_by_email: payload.actedByEmail,
    metadata: payload.metadata ?? {},
    acted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("finance_audit_log").insert(insertPayload);
  if (error && !isMissingRelationError(error)) {
    throw new Error(`Failed to write finance audit log: ${error.message}`);
  }
}

function fail(message: string): FinanceActionResult {
  return { ok: false, message };
}

function success(message: string): FinanceActionResult {
  return { ok: true, message };
}

export async function processAccountsApprovalAction(input: {
  requestId: string;
  note?: string;
}): Promise<FinanceActionResult> {
  try {
    const requestId = normalizeText(input.requestId);
    const note = normalizeText(input.note);

    if (!requestId) {
      return fail("Approval request id is required.");
    }

    const authContext = await resolveFinanceSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "process_accounts_approval_route_logistics",
      {
        p_l4_request_id: requestId,
        p_actor_email: user.email || null,
        p_note: note || null,
      }
    );

    if (rpcError) {
      return fail(`Failed to route L4 approval to logistics: ${rpcError.message}`);
    }

    const payload = (rpcData || {}) as Record<string, unknown>;
    if (payload.ok === false) {
      return fail(normalizeText(payload.message) || "Unable to process L4 approval.");
    }

    const eventId = normalizeText(payload.event_id);
    const createdServiceRequests = toNumber(payload.created_service_requests);
    const promotedQueuedRequests = toNumber(payload.promoted_queued_requests);
    const pendingServiceRequests = toNumber(payload.pending_service_requests);
    const workflowPhase = normalizeText(payload.workflow_phase) || "logistics_approval";

    await logFinanceAudit(supabase, {
      eventId: eventId || null,
      budgetId: null,
      action: "L4_APPROVED_LOGISTICS_ROUTED",
      notes: note || null,
      actedByEmail: user.email || null,
      metadata: {
        approval_request_db_id: requestId,
        created_service_requests: createdServiceRequests,
        promoted_queued_requests: promotedQueuedRequests,
        pending_service_requests: pendingServiceRequests,
        workflow_phase: workflowPhase,
      },
    });

    revalidatePath("/manage/finance");
    revalidatePath("/manage/cfo");

    const baseMessage =
      normalizeText(payload.message) ||
      "L4 approval recorded and routed to logistics workflow.";

    return success(
      `${baseMessage} (${createdServiceRequests} new logistics requests, ${promotedQueuedRequests} queued promoted.)`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while processing L4 approval.";
    return fail(message);
  }
}

export async function submitFinanceApprovalDecisionAction(input: {
  requestId: string;
  action: FinanceApprovalAction;
  note?: string;
}): Promise<FinanceActionResult> {
  try {
    const requestId = normalizeText(input.requestId);
    const action = parseApprovalAction(input.action);
    const note = normalizeText(input.note);

    if (!requestId) {
      return fail("Approval request id is required.");
    }

    if (!action) {
      return fail("Invalid action. Use approve, reject, or return.");
    }

    if ((action === "reject" || action === "return") && note.length < 20) {
      return fail("Reject/Return note must be at least 20 characters.");
    }

    if (action === "approve") {
      return processAccountsApprovalAction({
        requestId,
        note,
      });
    }

    const authContext = await resolveFinanceSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;

    const { data: approvalRow, error: approvalError } = await supabase
      .from("approval_requests")
      .select("id,request_id,event_id,entity_ref,status,approval_level")
      .eq("id", requestId)
      .maybeSingle();

    if (approvalError) {
      return fail(`Failed to load approval request: ${approvalError.message}`);
    }

    if (!approvalRow) {
      return fail("Approval request not found.");
    }

    const requestStatus = normalizeLower(approvalRow.status);
    if (!requestStatus || requestStatus === "approved" || requestStatus === "rejected") {
      return fail("This approval request is no longer pending.");
    }

    const approvalRequestDbId = normalizeText(approvalRow.id);
    const requestIdentifier = normalizeText(approvalRow.request_id);

    if (!approvalRequestDbId || !requestIdentifier) {
      return fail("Approval request is missing workflow identifiers.");
    }

    const { data: pendingStepRow, error: pendingStepError } = await supabase
      .from("approval_steps")
      .select("step_code,status")
      .eq("approval_request_id", approvalRequestDbId)
      .eq("role_code", "ACCOUNTS")
      .eq("status", "PENDING")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingStepError) {
      return fail(`Failed to load pending Accounts step: ${pendingStepError.message}`);
    }

    if (!pendingStepRow) {
      return fail("No pending Accounts step exists for this request.");
    }

    const comments =
      action === "return"
        ? `RETURN_FOR_REVISION: ${note}`
        : note;

    const stepCode = normalizeText((pendingStepRow as Record<string, unknown>).step_code);
    if (!stepCode) {
      return fail("Approval request is missing step identifiers.");
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return fail("Authentication session is unavailable. Please sign in again.");
    }

    const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
    if (!apiBaseUrl) {
      return fail("NEXT_PUBLIC_API_URL is not configured for workflow decisions.");
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
          decision: "REJECTED",
          comment: comments,
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
      return fail(upstreamError);
    }

    const eventId = normalizeText(approvalRow.event_id || approvalRow.entity_ref);

    await logFinanceAudit(supabase, {
      eventId: eventId || null,
      budgetId: null,
      action: action === "return" ? "L4_RETURNED" : "L4_REJECTED",
      notes: comments,
      actedByEmail: user.email || null,
      metadata: {
        approval_request_db_id: requestId,
        request_id: requestIdentifier,
        step_code: stepCode,
        upstream_request_status: upstreamPayload?.request_status || null,
      },
    });

    revalidatePath("/manage/finance");
    return success("L4 finance decision recorded successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while saving decision.";
    return fail(message);
  }
}

export async function recordAdvancePaidAction(input: {
  budgetId: string;
  eventId: string;
  amount: number;
  note?: string;
}): Promise<FinanceActionResult> {
  try {
    const budgetId = normalizeText(input.budgetId);
    const eventId = normalizeText(input.eventId);
    const amount = toNumber(input.amount);
    const note = normalizeText(input.note);

    if (!budgetId || !eventId) {
      return fail("Budget id and event id are required.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Advance amount must be greater than 0.");
    }

    const authContext = await resolveFinanceSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;

    const { data: budgetRow, error: budgetError } = await supabase
      .from("event_budgets")
      .select("id,event_id,advance_paid")
      .eq("id", budgetId)
      .maybeSingle();

    if (budgetError) {
      return fail(`Failed to load budget row: ${budgetError.message}`);
    }

    if (!budgetRow) {
      return fail("Budget row not found.");
    }

    if (normalizeText(budgetRow.event_id) !== eventId) {
      return fail("Budget row does not belong to the selected event.");
    }

    const nextAdvancePaid = Math.max(toNumber(budgetRow.advance_paid), 0) + amount;

    const { error: updateError } = await supabase
      .from("event_budgets")
      .update({
        advance_paid: nextAdvancePaid,
      })
      .eq("id", budgetId);

    if (updateError) {
      return fail(`Failed to record advance payment: ${updateError.message}`);
    }

    await logFinanceAudit(supabase, {
      eventId,
      budgetId,
      action: "ADVANCE_PAID",
      amount,
      notes: note || null,
      actedByEmail: user.email || null,
      metadata: {
        cumulative_advance_paid: nextAdvancePaid,
      },
    });

    revalidatePath("/manage/finance");
    return success("Advance payment recorded successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while recording advance.";
    return fail(message);
  }
}

export async function toggleExpenseDocumentVerificationAction(input: {
  documentId: string;
  eventId: string;
  verified: boolean;
}): Promise<FinanceActionResult> {
  try {
    const documentId = normalizeText(input.documentId);
    const eventId = normalizeText(input.eventId);

    if (!documentId || !eventId) {
      return fail("Document id and event id are required.");
    }

    const authContext = await resolveFinanceSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;
    const verified = Boolean(input.verified);
    const nowIso = new Date().toISOString();

    const { error: primaryUpdateError } = await supabase
      .from("expense_documents")
      .update({
        finance_verified: verified,
        finance_verified_by: user.email || null,
        finance_verified_at: verified ? nowIso : null,
      })
      .eq("id", documentId);

    if (primaryUpdateError) {
      const { error: fallbackUpdateError } = await supabase
        .from("expense_documents")
        .update({
          is_verified: verified,
        })
        .eq("id", documentId);

      if (fallbackUpdateError) {
        return fail(`Failed to update document verification: ${fallbackUpdateError.message}`);
      }
    }

    await logFinanceAudit(supabase, {
      eventId,
      budgetId: null,
      action: verified ? "DOCUMENT_VERIFIED" : "DOCUMENT_UNVERIFIED",
      actedByEmail: user.email || null,
      metadata: {
        document_id: documentId,
      },
    });

    revalidatePath("/manage/finance");
    return success(verified ? "Document marked as verified." : "Document marked as unverified.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while toggling document verification.";
    return fail(message);
  }
}

export async function closeSettlementAction(input: {
  budgetId: string;
  eventId: string;
}): Promise<FinanceActionResult> {
  try {
    const budgetId = normalizeText(input.budgetId);
    const eventId = normalizeText(input.eventId);

    if (!budgetId || !eventId) {
      return fail("Budget id and event id are required.");
    }

    const authContext = await resolveFinanceSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;

    const { data: budgetRow, error: budgetError } = await supabase
      .from("event_budgets")
      .select("id,event_id,total_estimated_expense,total_actual_expense")
      .eq("id", budgetId)
      .maybeSingle();

    if (budgetError) {
      return fail(`Failed to load budget row: ${budgetError.message}`);
    }

    if (!budgetRow) {
      return fail("Budget row not found.");
    }

    if (normalizeText(budgetRow.event_id) !== eventId) {
      return fail("Budget row does not belong to the selected event.");
    }

    const { data: documentRows, error: documentsError } = await supabase
      .from("expense_documents")
      .select("id,amount,finance_verified,is_verified")
      .eq("event_id", eventId);

    if (documentsError) {
      return fail(`Failed to load expense documents: ${documentsError.message}`);
    }

    const docs = Array.isArray(documentRows) ? documentRows : [];
    if (docs.length === 0) {
      return fail("At least one expense document is required before settlement.");
    }

    const allVerified = docs.every((documentRow) =>
      toBoolean((documentRow as Record<string, unknown>).finance_verified) ||
      toBoolean((documentRow as Record<string, unknown>).is_verified)
    );

    if (!allVerified) {
      return fail("Verify all expense documents before closing settlement.");
    }

    const estimatedExpense = toNumber(budgetRow.total_estimated_expense);
    const actualExpense = toNumber(budgetRow.total_actual_expense);
    if (!Number.isFinite(actualExpense) || actualExpense < 0) {
      return fail("Total actual expense must be a valid non-negative number.");
    }

    const documentAmounts = docs
      .map((documentRow) => toNumber((documentRow as Record<string, unknown>).amount))
      .filter((amount) => Number.isFinite(amount) && amount > 0);

    if (documentAmounts.length > 0) {
      const totalDocumentAmount = documentAmounts.reduce((sum, value) => sum + value, 0);
      if (Math.abs(totalDocumentAmount - actualExpense) > 1) {
        return fail("Actual expense does not match verified document totals.");
      }
    }

    const { error: updateError } = await supabase
      .from("event_budgets")
      .update({
        finance_status: "settled",
        settlement_status: "settled",
      })
      .eq("id", budgetId);

    if (updateError) {
      return fail(`Failed to close settlement: ${updateError.message}`);
    }

    await logFinanceAudit(supabase, {
      eventId,
      budgetId,
      action: "SETTLEMENT_CLOSED",
      amount: actualExpense,
      notes: `Variance: ${actualExpense - estimatedExpense}`,
      actedByEmail: user.email || null,
      metadata: {
        estimated_expense: estimatedExpense,
        actual_expense: actualExpense,
      },
    });

    revalidatePath("/manage/finance");
    return success("Event settlement closed successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while closing settlement.";
    return fail(message);
  }
}
