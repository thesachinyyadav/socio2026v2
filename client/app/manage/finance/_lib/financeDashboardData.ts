import "server-only";

import {
  FinanceAdvanceRequestItem,
  FinanceDashboardData,
  FinanceExpenseDocumentItem,
  FinanceL4ApprovalItem,
  FinanceSettlementItem,
} from "../types";

type EventRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept?: string | null;
  organizing_school?: string | null;
  organizer_email?: string | null;
  fest?: string | null;
};

type ApprovalJoinRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
  approval_level?: string | null;
  cfo_approved_at?: string | null;
  version?: number | string | null;
};

type BudgetRow = {
  id?: string | number | null;
  event_id?: string | null;
  total_estimated_expense?: number | string | null;
  total_actual_expense?: number | string | null;
  advance_paid?: number | string | boolean | null;
  settlement_status?: string | null;
  finance_status?: string | null;
  [key: string]: unknown;
};

type EventWithApprovalBudgetRow = EventRow & {
  approval_requests?: ApprovalJoinRow[] | ApprovalJoinRow | null;
  event_budgets?: BudgetRow[] | BudgetRow | null;
};

type UserNameRow = {
  email?: string | null;
  name?: string | null;
};

type GenericRow = Record<string, unknown>;

type ExpenseDocumentRow = {
  id?: string | number | null;
  event_id?: string | null;
  budget_id?: string | number | null;
  file_name?: string | null;
  file_url?: string | null;
  document_type?: string | null;
  amount?: number | string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  finance_verified?: boolean | null;
  is_verified?: boolean | null;
  [key: string]: unknown;
};

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

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
}

function toRecordArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toSingleRecord<T>(value: T[] | T | null | undefined): T | null {
  const rows = toRecordArray(value);
  return rows[0] ?? null;
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

function deriveCoordinatorName(email: string | null | undefined, displayName: string | null | undefined): string {
  const cleanName = normalizeText(displayName);
  if (cleanName) {
    return cleanName;
  }

  const cleanEmail = normalizeText(email);
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return "Coordinator";
  }

  const localPart = cleanEmail.split("@")[0];
  return localPart
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function readAmountField(row: GenericRow): number {
  const candidates = [
    "advance_amount",
    "advance_amount_requested",
    "requested_advance_amount",
    "requested_advance",
  ];

  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null) {
      const parsed = toNumber(row[key]);
      if (parsed > 0) {
        return parsed;
      }
    }
  }

  return 0;
}

function hasAdvanceFlag(row: GenericRow): boolean {
  const booleanCandidates = [
    "advance_requested",
    "is_advance_requested",
    "advance_required",
    "requires_advance",
    "request_advance",
  ];

  for (const key of booleanCandidates) {
    if (toBoolean(row[key])) {
      return true;
    }
  }

  return readAmountField(row) > 0;
}

function getVendorName(row: GenericRow): string {
  const keys = ["vendor_name", "supplier_name", "resource_name", "item_name", "name"];
  for (const key of keys) {
    const candidate = normalizeText(row[key]);
    if (candidate) {
      return candidate;
    }
  }

  return "Vendor";
}

function mathChecksOut(
  estimatedExpense: number,
  actualExpense: number,
  documents: FinanceExpenseDocumentItem[]
): boolean {
  if (!Number.isFinite(estimatedExpense) || estimatedExpense < 0) {
    return false;
  }

  if (!Number.isFinite(actualExpense) || actualExpense < 0) {
    return false;
  }

  const documentAmounts = documents
    .map((document) => document.amount)
    .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));

  if (documentAmounts.length > 0) {
    const sum = documentAmounts.reduce((total, value) => total + value, 0);
    return Math.abs(sum - actualExpense) <= 1;
  }

  return true;
}

function toDocumentItem(row: ExpenseDocumentRow): FinanceExpenseDocumentItem {
  const fileName =
    normalizeText(row.file_name) ||
    normalizeText(row.document_name) ||
    normalizeText(row.original_name) ||
    "Document";

  const fileUrl =
    normalizeText(row.file_url) ||
    normalizeText(row.document_url) ||
    normalizeText(row.storage_path) ||
    "";

  return {
    id: normalizeText(row.id),
    eventId: normalizeText(row.event_id),
    budgetId: normalizeText(row.budget_id) || null,
    fileName,
    fileUrl,
    documentType: normalizeText(row.document_type) || "invoice",
    amount: Number.isFinite(toNumber(row.amount)) ? toNumber(row.amount) : null,
    uploadedAt: normalizeText(row.uploaded_at || row.created_at) || null,
    uploadedBy: normalizeText(row.uploaded_by) || null,
    financeVerified: toBoolean(row.finance_verified ?? row.is_verified),
  };
}

export async function fetchFinanceDashboardData({ supabase }: { supabase: any }): Promise<FinanceDashboardData> {
  const warnings: string[] = [];

  const approvalSelect = `
    event_id,
    title,
    event_date,
    organizing_dept,
    organizing_school,
    organizer_email,
    fest,
    approval_requests!inner (
      id,
      status,
      created_at,
      approval_level,
      cfo_approved_at,
      version
    ),
    event_budgets!inner (
      id,
      event_id,
      total_estimated_expense,
      total_actual_expense,
      advance_paid,
      settlement_status,
      finance_status
    )
  `;

  const { data: approvalEventsData, error: approvalEventsError } = await supabase
    .from("events")
    .select(approvalSelect)
    .eq("approval_requests.approval_level", "L4_ACCOUNTS")
    .eq("approval_requests.status", "pending")
    .gt("event_budgets.total_estimated_expense", 0)
    .order("created_at", {
      ascending: true,
      referencedTable: "approval_requests",
    });

  if (approvalEventsError) {
    throw new Error(`Failed to load L4 approval queue: ${approvalEventsError.message}`);
  }

  const approvalRows = Array.isArray(approvalEventsData)
    ? (approvalEventsData as EventWithApprovalBudgetRow[])
    : [];

  const organizerEmails = Array.from(
    new Set(
      approvalRows
        .map((row) => normalizeLower(row.organizer_email))
        .filter((email) => email.length > 0)
    )
  );

  let organizerNames = new Map<string, string>();
  if (organizerEmails.length > 0) {
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("email, name")
      .in("email", organizerEmails);

    if (!usersError && Array.isArray(usersData)) {
      const userRows = usersData as UserNameRow[];
      organizerNames = new Map(
        userRows
          .map((row) => [normalizeLower(row.email), normalizeText(row.name)] as const)
          .filter(([email]) => email.length > 0)
      );
    }
  }

  const approvals: FinanceL4ApprovalItem[] = approvalRows
    .map((row) => {
      const approval = toSingleRecord(row.approval_requests);
      const budget = toSingleRecord(row.event_budgets);
      const coordinatorEmail = normalizeLower(row.organizer_email);

      return {
        id: normalizeText(approval?.id),
        eventId: normalizeText(row.event_id),
        eventName: normalizeText(row.title) || "Untitled Event",
        eventDate: normalizeText(row.event_date) || null,
        cfoApprovedAt: normalizeText(approval?.cfo_approved_at) || null,
        requestedAt: normalizeText(approval?.created_at) || null,
        departmentName: normalizeText(row.organizing_dept) || "Unknown Department",
        schoolName: normalizeText(row.organizing_school) || "Unknown School",
        coordinatorName: deriveCoordinatorName(
          coordinatorEmail,
          coordinatorEmail ? organizerNames.get(coordinatorEmail) : null
        ),
        totalEstimatedExpense: toNumber(budget?.total_estimated_expense),
      };
    })
    .filter((item) => item.id.length > 0 && item.eventId.length > 0);

  const { data: budgetRowsData, error: budgetRowsError } = await supabase
    .from("event_budgets")
    .select(
      "id,event_id,total_estimated_expense,total_actual_expense,advance_paid,settlement_status,finance_status"
    )
    .gt("total_estimated_expense", 0);

  if (budgetRowsError) {
    throw new Error(`Failed to load event budgets: ${budgetRowsError.message}`);
  }

  const budgetRows = Array.isArray(budgetRowsData) ? (budgetRowsData as BudgetRow[]) : [];
  const eventIds = Array.from(
    new Set(
      budgetRows
        .map((row) => normalizeText(row.event_id))
        .filter((value) => value.length > 0)
    )
  );

  let eventDetailsById = new Map<string, EventRow>();
  if (eventIds.length > 0) {
    const { data: eventRowsData, error: eventRowsError } = await supabase
      .from("events")
      .select("event_id,title,event_date,organizing_dept,organizing_school,organizer_email,fest")
      .in("event_id", eventIds);

    if (eventRowsError) {
      throw new Error(`Failed to load event details: ${eventRowsError.message}`);
    }

    const eventRows = Array.isArray(eventRowsData) ? (eventRowsData as EventRow[]) : [];
    eventDetailsById = new Map(
      eventRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  const [cateringResult, resourcesResult, documentsResult] = await Promise.all([
    supabase.from("catering_plans").select("*").in("event_id", eventIds),
    supabase.from("event_resources").select("*").in("event_id", eventIds),
    supabase.from("expense_documents").select("*").in("event_id", eventIds),
  ]);

  const cateringRows: GenericRow[] = [];
  const resourceRows: GenericRow[] = [];
  let documentRows: ExpenseDocumentRow[] = [];

  if (cateringResult.error) {
    if (!isMissingRelationError(cateringResult.error)) {
      warnings.push(`Catering advance rows unavailable: ${cateringResult.error.message}`);
    }
  } else if (Array.isArray(cateringResult.data)) {
    cateringRows.push(...(cateringResult.data as GenericRow[]));
  }

  if (resourcesResult.error) {
    if (!isMissingRelationError(resourcesResult.error)) {
      warnings.push(`Resource advance rows unavailable: ${resourcesResult.error.message}`);
    }
  } else if (Array.isArray(resourcesResult.data)) {
    resourceRows.push(...(resourcesResult.data as GenericRow[]));
  }

  if (documentsResult.error) {
    if (!isMissingRelationError(documentsResult.error)) {
      warnings.push(`Expense documents unavailable: ${documentsResult.error.message}`);
    }
  } else if (Array.isArray(documentsResult.data)) {
    documentRows = documentsResult.data as ExpenseDocumentRow[];
  }

  const advanceRowsByEvent = new Map<string, GenericRow[]>();

  [...cateringRows, ...resourceRows].forEach((row) => {
    const eventId = normalizeText(row.event_id);
    if (!eventId) {
      return;
    }

    const existing = advanceRowsByEvent.get(eventId) || [];
    existing.push(row);
    advanceRowsByEvent.set(eventId, existing);
  });

  const documentsByEvent = new Map<string, FinanceExpenseDocumentItem[]>();
  documentRows.forEach((row) => {
    const eventId = normalizeText(row.event_id);
    if (!eventId) {
      return;
    }

    const existing = documentsByEvent.get(eventId) || [];
    existing.push(toDocumentItem(row));
    documentsByEvent.set(eventId, existing);
  });

  const advances: FinanceAdvanceRequestItem[] = budgetRows
    .map((budgetRow) => {
      const eventId = normalizeText(budgetRow.event_id);
      if (!eventId) {
        return null;
      }

      const eventRow = eventDetailsById.get(eventId);
      const sourceRows = advanceRowsByEvent.get(eventId) || [];
      const budgetAsGeneric = budgetRow as GenericRow;

      const requestedFromSources = sourceRows.reduce((sum, row) => sum + readAmountField(row), 0);
      const requestedFromBudget = readAmountField(budgetAsGeneric);
      const advanceRequestedAmount = Math.max(requestedFromSources, requestedFromBudget, 0);

      const hasRequestedAdvance = hasAdvanceFlag(budgetAsGeneric) || sourceRows.some(hasAdvanceFlag);
      if (!hasRequestedAdvance) {
        return null;
      }

      const advancePaidAmount = Math.max(toNumber(budgetRow.advance_paid), 0);
      const vendors = Array.from(new Set(sourceRows.map(getVendorName)));

      return {
        budgetId: normalizeText(budgetRow.id),
        eventId,
        eventName: normalizeText(eventRow?.title) || "Untitled Event",
        departmentName: normalizeText(eventRow?.organizing_dept) || "Unknown Department",
        totalEstimatedExpense: toNumber(budgetRow.total_estimated_expense),
        advanceRequestedAmount,
        advancePaidAmount,
        advanceRemainingAmount: Math.max(advanceRequestedAmount - advancePaidAmount, 0),
        vendors,
      };
    })
    .filter((item): item is FinanceAdvanceRequestItem => item !== null)
    .sort((left, right) => right.advanceRemainingAmount - left.advanceRemainingAmount);

  const settlements: FinanceSettlementItem[] = budgetRows
    .filter((budgetRow) => normalizeLower(budgetRow.settlement_status) === "submitted")
    .map((budgetRow) => {
      const eventId = normalizeText(budgetRow.event_id);
      const documents = (documentsByEvent.get(eventId) || []).sort((left, right) => {
        const leftTime = new Date(left.uploadedAt || 0).getTime();
        const rightTime = new Date(right.uploadedAt || 0).getTime();
        return rightTime - leftTime;
      });

      const totalEstimatedExpense = toNumber(budgetRow.total_estimated_expense);
      const totalActualExpense = toNumber(budgetRow.total_actual_expense);
      const eventRow = eventDetailsById.get(eventId);

      return {
        budgetId: normalizeText(budgetRow.id),
        eventId,
        eventName: normalizeText(eventRow?.title) || "Untitled Event",
        departmentName: normalizeText(eventRow?.organizing_dept) || "Unknown Department",
        schoolName: normalizeText(eventRow?.organizing_school) || "Unknown School",
        totalEstimatedExpense,
        totalActualExpense,
        varianceAmount: totalActualExpense - totalEstimatedExpense,
        settlementStatus: normalizeText(budgetRow.settlement_status) || "submitted",
        financeStatus: normalizeText(budgetRow.finance_status) || "pending",
        allDocumentsVerified: documents.length > 0 && documents.every((doc) => doc.financeVerified),
        mathChecksOut: mathChecksOut(totalEstimatedExpense, totalActualExpense, documents),
        documents,
      };
    })
    .sort((left, right) => {
      const leftAbsoluteVariance = Math.abs(left.varianceAmount);
      const rightAbsoluteVariance = Math.abs(right.varianceAmount);
      return rightAbsoluteVariance - leftAbsoluteVariance;
    });

  return {
    approvals,
    advances,
    settlements,
    warnings,
  };
}
