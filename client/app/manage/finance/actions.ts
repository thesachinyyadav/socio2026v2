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

    const authContext = await resolveFinanceSession();
    if (!authContext.ok) {
      return fail(authContext.error);
    }

    const { supabase, user } = authContext;

    const { data: approvalRow, error: approvalError } = await supabase
      .from("approval_requests")
      .select("id,event_id,entity_ref,status,approval_level")
      .eq("id", requestId)
      .maybeSingle();

    if (approvalError) {
      return fail(`Failed to load approval request: ${approvalError.message}`);
    }

    if (!approvalRow) {
      return fail("Approval request not found.");
    }

    if (normalizeText(approvalRow.approval_level) !== "L4_ACCOUNTS") {
      return fail("Only L4_ACCOUNTS requests can be handled here.");
    }

    if (normalizeLower(approvalRow.status) !== "pending") {
      return fail("This approval request is no longer pending.");
    }

    const eventId = normalizeText(approvalRow.event_id || approvalRow.entity_ref);
    if (!eventId) {
      return fail("Request is missing event linkage.");
    }

    const { data: budgetRow, error: budgetError } = await supabase
      .from("event_budgets")
      .select("event_id,total_estimated_expense")
      .eq("event_id", eventId)
      .maybeSingle();

    if (budgetError) {
      return fail(`Failed to load event budget: ${budgetError.message}`);
    }

    const estimatedExpense = toNumber(budgetRow?.total_estimated_expense);
    if (!Number.isFinite(estimatedExpense) || estimatedExpense <= 0) {
      return fail("Only events with estimated budget greater than 0 require L4 approval.");
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    const comments =
      action === "approve"
        ? null
        : action === "return"
          ? `RETURN_FOR_REVISION: ${note}`
          : note;

    const { data: updatedRow, error: updateError } = await supabase
      .from("approval_requests")
      .update({
        status: nextStatus,
        comments,
        approver_email: user.email || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return fail(`Failed to update approval request: ${updateError.message}`);
    }

    if (!updatedRow) {
      return fail("Approval request was already handled by another user.");
    }

    await logFinanceAudit(supabase, {
      eventId,
      budgetId: null,
      action: action === "approve" ? "L4_APPROVED" : action === "return" ? "L4_RETURNED" : "L4_REJECTED",
      notes: comments,
      actedByEmail: user.email || null,
      metadata: {
        request_id: requestId,
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
