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

type FestRow = {
  fest_id?: string | null;
  fest_title?: string | null;
  opening_date?: string | null;
  organizing_dept?: string | null;
  organizing_school?: string | null;
  contact_email?: string | null;
  budget_amount?: number | string | null;
  estimated_budget_amount?: number | string | null;
  total_estimated_expense?: number | string | null;
  custom_fields?: unknown;
};

type ApprovalRequestQueueRow = {
  id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  organizing_dept?: string | null;
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
};

type ApprovalStepQueueRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
  step_code?: string | null;
  approval_request_id?: string | null;
  decided_at?: string | null;
  approval_requests?: ApprovalRequestQueueRow[] | ApprovalRequestQueueRow | null;
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

function normalizeEntityType(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function isEventEntityType(value: unknown): boolean {
  const entityType = normalizeEntityType(value);
  return ["EVENT", "STANDALONE_EVENT", "FEST_CHILD_EVENT"].includes(entityType);
}

function isSupportedFinanceEntityType(value: unknown): boolean {
  const entityType = normalizeEntityType(value);
  return entityType === "FEST" || isEventEntityType(entityType);
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

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  columnName?: string | null
): boolean {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").trim().toLowerCase();
  const normalizedColumn = String(columnName || "").trim().toLowerCase();

  if (!normalizedColumn) {
    return (
      code === "42703" ||
      code === "PGRST204" ||
      message.includes("column") ||
      message.includes("schema cache")
    );
  }

  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes(`column \"${normalizedColumn}\"`) ||
    message.includes(`${normalizedColumn} does not exist`) ||
    (message.includes("could not find") && message.includes(normalizedColumn))
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

function parseJsonArraySafely(value: unknown): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function getFestBudgetAmount(festRow: FestRow | null | undefined): number {
  const directBudget =
    toNumber(festRow?.total_estimated_expense) ||
    toNumber(festRow?.estimated_budget_amount) ||
    toNumber(festRow?.budget_amount);

  if (directBudget > 0) {
    return directBudget;
  }

  const customFields = parseJsonArraySafely(festRow?.custom_fields);
  const budgetSettings = customFields.find((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }

    return String((entry as Record<string, unknown>).key || "") === "__budget_approval__";
  }) as Record<string, unknown> | undefined;

  const value =
    budgetSettings &&
    typeof budgetSettings.value === "object" &&
    budgetSettings.value !== null &&
    !Array.isArray(budgetSettings.value)
      ? (budgetSettings.value as Record<string, unknown>)
      : null;

  const customBudget = toNumber(value?.amount);
  return customBudget > 0 ? customBudget : 0;
}

async function fetchFestRowsWithFallback(supabase: any, festIds: string[]): Promise<FestRow[]> {
  if (festIds.length === 0) {
    return [];
  }

  const fullSelect =
    "fest_id, fest_title, opening_date, organizing_dept, organizing_school, contact_email, budget_amount, estimated_budget_amount, total_estimated_expense, custom_fields";
  const minimalSelect =
    "fest_id, fest_title, opening_date, organizing_dept, organizing_school, contact_email, budget_amount, estimated_budget_amount, total_estimated_expense";

  const { data: festsData, error: festsError } = await supabase
    .from("fests")
    .select(fullSelect)
    .in("fest_id", festIds);

  if (!festsError) {
    return Array.isArray(festsData) ? (festsData as FestRow[]) : [];
  }

  if (isMissingColumnError(festsError, "custom_fields")) {
    const { data: festsFallbackData, error: festsFallbackError } = await supabase
      .from("fests")
      .select(minimalSelect)
      .in("fest_id", festIds);

    if (!festsFallbackError) {
      return Array.isArray(festsFallbackData) ? (festsFallbackData as FestRow[]) : [];
    }
  }

  const { data: festData, error: festError } = await supabase
    .from("fest")
    .select(fullSelect)
    .in("fest_id", festIds);

  if (!festError) {
    return Array.isArray(festData) ? (festData as FestRow[]) : [];
  }

  if (isMissingColumnError(festError, "custom_fields")) {
    const { data: festFallbackData, error: festFallbackError } = await supabase
      .from("fest")
      .select(minimalSelect)
      .in("fest_id", festIds);

    if (!festFallbackError) {
      return Array.isArray(festFallbackData) ? (festFallbackData as FestRow[]) : [];
    }
  }

  throw new Error(`Failed to load fest details: ${festsError.message}`);
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

  const pendingSelectWithSchool = `
    id,
    status,
    step_code,
    created_at,
    approval_requests!inner (
      id,
      entity_type,
      entity_ref,
      organizing_dept,
      organizing_school,
      submitted_at,
      created_at
    )
  `;

  const pendingSelectLegacy = `
    id,
    status,
    step_code,
    created_at,
    approval_requests!inner (
      id,
      entity_type,
      entity_ref,
      organizing_dept,
      submitted_at,
      created_at
    )
  `;

  let pendingQueryResult = await supabase
    .from("approval_steps")
    .select(pendingSelectWithSchool)
    .in("role_code", ["ACCOUNTS", "FINANCE_OFFICER"])
    .in("step_code", ["ACCOUNTS", "L4_ACCOUNTS"])
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  if (
    pendingQueryResult.error &&
    isMissingColumnError(pendingQueryResult.error, "organizing_school")
  ) {
    pendingQueryResult = await supabase
      .from("approval_steps")
      .select(pendingSelectLegacy)
      .in("role_code", ["ACCOUNTS", "FINANCE_OFFICER"])
      .in("step_code", ["ACCOUNTS", "L4_ACCOUNTS"])
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });
  }

  const { data: pendingStepsData, error: pendingStepsError } = pendingQueryResult;

  if (pendingStepsError) {
    throw new Error(`Failed to load L4 approval queue: ${pendingStepsError.message}`);
  }

  const pendingSteps = Array.isArray(pendingStepsData)
    ? (pendingStepsData as ApprovalStepQueueRow[])
    : [];

  const pendingRequestRows = pendingSteps
    .map((row) => toSingleRecord(row.approval_requests))
    .filter((row): row is ApprovalRequestQueueRow => Boolean(row))
    .filter((requestRow) => isSupportedFinanceEntityType(requestRow.entity_type));

  const approvalRequestIds = Array.from(
    new Set(
      pendingRequestRows
        .map((row) => normalizeText(row.id))
        .filter((value) => value.length > 0)
    )
  );

  const approvalEventIds = Array.from(
    new Set(
      pendingRequestRows
        .filter((row) => normalizeEntityType(row.entity_type) !== "FEST")
        .map((row) => normalizeText(row.entity_ref))
        .filter((value) => value.length > 0)
    )
  );

  const approvalFestIds = Array.from(
    new Set(
      pendingRequestRows
        .filter((row) => normalizeEntityType(row.entity_type) === "FEST")
        .map((row) => normalizeText(row.entity_ref))
        .filter((value) => value.length > 0)
    )
  );

  let approvalEventById = new Map<string, EventRow>();
  if (approvalEventIds.length > 0) {
    const { data: approvalEventRowsData, error: approvalEventRowsError } = await supabase
      .from("events")
      .select("event_id,title,event_date,organizing_dept,organizing_school,organizer_email,fest")
      .in("event_id", approvalEventIds);

    if (approvalEventRowsError) {
      throw new Error(`Failed to load event details for L4 queue: ${approvalEventRowsError.message}`);
    }

    const approvalEventRows = Array.isArray(approvalEventRowsData)
      ? (approvalEventRowsData as EventRow[])
      : [];

    approvalEventById = new Map(
      approvalEventRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  let approvalBudgetsByEventId = new Map<string, BudgetRow>();
  if (approvalEventIds.length > 0) {
    const { data: approvalBudgetRowsData, error: approvalBudgetRowsError } = await supabase
      .from("event_budgets")
      .select("id,event_id,total_estimated_expense,total_actual_expense,advance_paid,settlement_status,finance_status")
      .in("event_id", approvalEventIds);

    if (approvalBudgetRowsError) {
      throw new Error(`Failed to load L4 queue budgets: ${approvalBudgetRowsError.message}`);
    }

    const approvalBudgetRows = Array.isArray(approvalBudgetRowsData)
      ? (approvalBudgetRowsData as BudgetRow[])
      : [];

    approvalBudgetsByEventId = new Map(
      approvalBudgetRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  let approvalFestsById = new Map<string, FestRow>();
  if (approvalFestIds.length > 0) {
    const festRows = await fetchFestRowsWithFallback(supabase, approvalFestIds);
    approvalFestsById = new Map(
      festRows
        .map((row) => [normalizeText(row.fest_id), row] as const)
        .filter(([festId]) => festId.length > 0)
    );
  }

  const cfoApprovedAtByRequestId = new Map<string, string>();
  if (approvalRequestIds.length > 0) {
    const { data: cfoStepRowsData, error: cfoStepRowsError } = await supabase
      .from("approval_steps")
      .select("approval_request_id,status,decided_at,created_at")
      .in("approval_request_id", approvalRequestIds)
      .eq("role_code", "CFO")
      .in("step_code", ["CFO", "L3_CFO"])
      .eq("status", "APPROVED")
      .order("decided_at", { ascending: false });

    if (cfoStepRowsError) {
      throw new Error(`Failed to load CFO approval timestamps: ${cfoStepRowsError.message}`);
    }

    const cfoStepRows = Array.isArray(cfoStepRowsData)
      ? (cfoStepRowsData as ApprovalStepQueueRow[])
      : [];

    cfoStepRows.forEach((stepRow) => {
      const requestId = normalizeText(stepRow.approval_request_id);
      if (!requestId || cfoApprovedAtByRequestId.has(requestId)) {
        return;
      }

      cfoApprovedAtByRequestId.set(
        requestId,
        normalizeText(stepRow.decided_at) || normalizeText(stepRow.created_at)
      );
    });
  }

  const organizerEmails = Array.from(
    new Set(
      [
        ...Array.from(approvalEventById.values()).map((row) =>
          normalizeLower(row.organizer_email)
        ),
        ...Array.from(approvalFestsById.values()).map((row) =>
          normalizeLower(row.contact_email)
        ),
      ]
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

  const approvalsByRequestId = new Map<string, FinanceL4ApprovalItem>();

  pendingSteps.forEach((stepRow) => {
    const requestRow = toSingleRecord(stepRow.approval_requests);
    if (!requestRow || !isSupportedFinanceEntityType(requestRow.entity_type)) {
      return;
    }

    const entityType = normalizeEntityType(requestRow.entity_type);
    const isFestEntity = entityType === "FEST";
    const requestId = normalizeText(requestRow.id);
    const entityId = normalizeText(requestRow.entity_ref);
    if (!requestId || !entityId || approvalsByRequestId.has(requestId)) {
      return;
    }

    const eventRow = !isFestEntity ? approvalEventById.get(entityId) || null : null;
    const festRow = isFestEntity ? approvalFestsById.get(entityId) || null : null;

    if (!isFestEntity && !eventRow) {
      return;
    }

    const budgetRow = !isFestEntity
      ? approvalBudgetsByEventId.get(entityId) || null
      : null;

    const coordinatorEmail = normalizeLower(
      isFestEntity ? festRow?.contact_email : eventRow?.organizer_email
    );

    approvalsByRequestId.set(requestId, {
      id: requestId,
      eventId: entityId,
      eventName: isFestEntity
        ? normalizeText(festRow?.fest_title) || "Untitled Fest"
        : normalizeText(eventRow?.title) || "Untitled Event",
      eventDate: isFestEntity
        ? normalizeText(festRow?.opening_date) || null
        : normalizeText(eventRow?.event_date) || null,
      cfoApprovedAt: cfoApprovedAtByRequestId.get(requestId) || null,
      requestedAt:
        normalizeText(requestRow.submitted_at) ||
        normalizeText(requestRow.created_at) ||
        normalizeText(stepRow.created_at) ||
        null,
      departmentName:
        normalizeText(isFestEntity ? festRow?.organizing_dept : eventRow?.organizing_dept) ||
        normalizeText(requestRow.organizing_dept) ||
        "Unknown Department",
      schoolName:
        normalizeText(isFestEntity ? festRow?.organizing_school : eventRow?.organizing_school) ||
        normalizeText(requestRow.organizing_school) ||
        "Unknown School",
      coordinatorName: deriveCoordinatorName(
        coordinatorEmail,
        coordinatorEmail ? organizerNames.get(coordinatorEmail) : null
      ),
      totalEstimatedExpense: isFestEntity
        ? getFestBudgetAmount(festRow)
        : toNumber(budgetRow?.total_estimated_expense),
    });
  });

  const approvals: FinanceL4ApprovalItem[] = Array.from(approvalsByRequestId.values());

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
