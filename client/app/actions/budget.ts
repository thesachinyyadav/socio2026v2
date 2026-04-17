"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export interface ExpenseItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface BudgetActionResult {
  ok: boolean;
  message: string;
  requestId?: string | null;
}

async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env vars missing.");
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Admin Supabase env vars missing.");
  return createClient(supabaseUrl, serviceRoleKey);
}

async function resolveSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Authentication required.");
  return { user };
}

/**
 * Saves a budget estimate (draft) without triggering the approval workflow.
 * - Events: upserts into event_budgets.total_estimated_expense
 * - Fests: updates fests.total_estimated_expense
 */
export async function saveBudgetEstimate(
  entityId: string,
  entityType: "event" | "fest",
  _items: ExpenseItem[],
  totalAmount: number
): Promise<BudgetActionResult> {
  try {
    await resolveSession();
    const adminClient = createAdminSupabaseClient();

    if (entityType === "event") {
      const { error } = await adminClient
        .from("event_budgets")
        .upsert(
          { event_id: entityId, total_estimated_expense: totalAmount },
          { onConflict: "event_id" }
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await adminClient
        .from("fests")
        .update({ total_estimated_expense: totalAmount })
        .eq("fest_id", entityId);
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/edit/${entityType}/${entityId}`);
    return { ok: true, message: "Budget estimate saved." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save budget.";
    return { ok: false, message: msg };
  }
}

/**
 * Submits a budget for approval:
 * 1. Saves/upserts the budget record.
 * 2. Creates an approval_request row.
 * 3. Creates the initial HOD approval_steps row.
 * 4. Advances the entity's workflow_phase to dept_approval.
 */
export async function submitBudgetForApproval(
  entityId: string,
  entityType: "event" | "fest",
  totalAmount: number,
  meta?: {
    organizingDept?: string;
    organizingSchool?: string;
    campusHostedAt?: string;
  }
): Promise<BudgetActionResult> {
  try {
    const { user } = await resolveSession();
    const adminClient = createAdminSupabaseClient();

    if (totalAmount <= 0) {
      return { ok: false, message: "Budget total must be greater than zero to submit." };
    }

    // 1. Upsert budget record for events
    if (entityType === "event") {
      const { error: budgetError } = await adminClient
        .from("event_budgets")
        .upsert(
          { event_id: entityId, total_estimated_expense: totalAmount },
          { onConflict: "event_id" }
        );
      if (budgetError) throw new Error(budgetError.message);
    }

    const requestId = `REQ-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const entityTypeLabel = entityType === "event" ? "STANDALONE_EVENT" : "FEST";

    // 2. Insert approval_request
    const { data: approvalReq, error: approvalError } = await adminClient
      .from("approval_requests")
      .insert({
        request_id: requestId,
        entity_type: entityTypeLabel,
        entity_ref: entityId,
        event_id: entityType === "event" ? entityId : null,
        requested_by_email: user.email,
        requested_by_user_id: user.id,
        is_budget_related: true,
        status: "UNDER_REVIEW",
        organizing_dept: meta?.organizingDept ?? null,
        organizing_school: meta?.organizingSchool ?? null,
        campus_hosted_at: meta?.campusHostedAt ?? null,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (approvalError) throw new Error(approvalError.message);

    // 3. Create initial HOD approval step
    const { error: stepError } = await adminClient.from("approval_steps").insert({
      approval_request_id: approvalReq.id,
      step_code: "HOD_REVIEW",
      role_code: "HOD",
      step_group: 1,
      sequence_order: 1,
      required_count: 1,
      status: "PENDING",
    });
    if (stepError) throw new Error(stepError.message);

    // 4. Advance entity to dept_approval phase
    const table = entityType === "event" ? "events" : "fests";
    const idField = entityType === "event" ? "event_id" : "fest_id";

    const { error: entityError } = await adminClient
      .from(table)
      .update({
        workflow_phase: "dept_approval",
        status: "pending_approvals",
        approval_request_id: approvalReq.id,
        is_budget_related: true,
      })
      .eq(idField, entityId);

    if (entityError) throw new Error(entityError.message);

    revalidatePath(`/edit/${entityType}/${entityId}`);
    return { ok: true, message: "Submitted for approval.", requestId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit for approval.";
    return { ok: false, message: msg };
  }
}
