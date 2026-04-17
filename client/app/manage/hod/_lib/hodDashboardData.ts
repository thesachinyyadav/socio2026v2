import "server-only";

import { HodApprovalQueueItem, HodDashboardMetrics } from "../types";

type ApprovalRequestJoinRow = {
  id?: string | null;
  request_id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  organizing_dept?: string | null;
  organizing_dept_id?: string | null;
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
};

type ApprovalStepQueueRow = {
  id?: string | null;
  step_code?: string | null;
  role_code?: string | null;
  status?: string | null;
  created_at?: string | null;
  approval_requests?: ApprovalRequestJoinRow[] | ApprovalRequestJoinRow | null;
};

type EventDetailRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept?: string | null;
  organizing_dept_id?: string | null;
  organizing_school?: string | null;
  organizer_email?: string | null;
  budget_amount?: number | string | null;
  estimated_budget_amount?: number | string | null;
  total_estimated_expense?: number | string | null;
};

type FestDetailRow = {
  fest_id?: string | null;
  fest_title?: string | null;
  opening_date?: string | null;
  organizing_dept?: string | null;
  organizing_dept_id?: string | null;
  organizing_school?: string | null;
  contact_email?: string | null;
  budget_amount?: number | string | null;
  estimated_budget_amount?: number | string | null;
  total_estimated_expense?: number | string | null;
  custom_fields?: unknown;
};

type BudgetRow = {
  event_id?: string | null;
  total_estimated_expense?: number | string | null;
  total_actual_expense?: number | string | null;
};

type EventScopeJoinRow = {
  event_id?: string | null;
  event_date?: string | null;
  organizing_dept_id?: string | null;
  campus_hosted_at?: string | null;
};

type YtdBudgetRow = BudgetRow & {
  events?: EventScopeJoinRow[] | EventScopeJoinRow | null;
};

type UserNameRow = {
  email?: string | null;
  name?: string | null;
};

export interface HodDashboardData {
  queue: HodApprovalQueueItem[];
  metrics: HodDashboardMetrics;
  history: import("../types").ApprovalHistoryItem[];
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function toFestSlugCandidate(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function festReferenceMatches(reference: unknown, candidate: unknown): boolean {
  const referenceKey = normalizeText(reference).toLowerCase();
  const candidateKey = normalizeText(candidate).toLowerCase();

  if (!referenceKey || !candidateKey) {
    return false;
  }

  if (referenceKey === candidateKey) {
    return true;
  }

  const referenceSlug = toFestSlugCandidate(reference);
  const candidateSlug = toFestSlugCandidate(candidate);
  return Boolean(referenceSlug && candidateSlug && referenceSlug === candidateSlug);
}

function resolveFestRowByReference(
  festRowsById: Map<string, FestDetailRow>,
  reference: unknown
): FestDetailRow | null {
  const normalizedReference = normalizeText(reference);
  if (!normalizedReference) {
    return null;
  }

  const directMatch = festRowsById.get(normalizedReference);
  if (directMatch) {
    return directMatch;
  }

  for (const festRow of festRowsById.values()) {
    if (
      festReferenceMatches(normalizedReference, festRow?.fest_id) ||
      festReferenceMatches(normalizedReference, festRow?.fest_title)
    ) {
      return festRow;
    }
  }

  return null;
}

function normalizeEntityType(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function normalizeScope(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeDepartmentScope(value: unknown): string {
  const normalized = normalizeScope(value);
  if (!normalized) {
    return "";
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return normalized;
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/^department of\s+/, "")
    .replace(/^dept(?:\.)?\s+of\s+/, "")
    .replace(/^dept(?:\.)?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingRelationError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  relationName: string
): boolean {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").trim().toLowerCase();
  const normalizedRelation = String(relationName || "").trim().toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("could not find") &&
      (normalizedRelation ? message.includes(normalizedRelation) : true)) ||
    (message.includes("relation") && message.includes("does not exist"))
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

async function fetchFestRowsFromTableWithFallback(
  supabase: any,
  tableName: string,
  festIds: string[]
): Promise<{
  rows: FestDetailRow[];
  error: { code?: string | null; message?: string | null } | null;
}> {
  const selectClauseWithBudget =
    "fest_id, fest_title, opening_date, organizing_dept, organizing_dept_id, organizing_school, contact_email, budget_amount, estimated_budget_amount, total_estimated_expense, custom_fields";
  const selectClauseLegacy =
    "fest_id, fest_title, opening_date, organizing_dept, organizing_dept_id, organizing_school, contact_email, custom_fields";

  const { data: primaryData, error: primaryError } = await supabase
    .from(tableName)
    .select(selectClauseWithBudget)
    .in("fest_id", festIds);

  if (!primaryError && Array.isArray(primaryData)) {
    return { rows: primaryData as FestDetailRow[], error: null };
  }

  if (primaryError && isMissingRelationError(primaryError, tableName)) {
    return { rows: [], error: primaryError };
  }

  const shouldRetryWithLegacySelect =
    isMissingColumnError(primaryError, "budget_amount") ||
    isMissingColumnError(primaryError, "estimated_budget_amount") ||
    isMissingColumnError(primaryError, "total_estimated_expense") ||
    isMissingColumnError(primaryError);

  if (!shouldRetryWithLegacySelect) {
    return {
      rows: [],
      error:
        (primaryError as { code?: string | null; message?: string | null } | null) ||
        null,
    };
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from(tableName)
    .select(selectClauseLegacy)
    .in("fest_id", festIds);

  if (!legacyError && Array.isArray(legacyData)) {
    return { rows: legacyData as FestDetailRow[], error: null };
  }

  return {
    rows: [],
    error:
      (legacyError as { code?: string | null; message?: string | null } | null) ||
      (primaryError as { code?: string | null; message?: string | null } | null) ||
      null,
  };
}

async function fetchAllFestRowsFromTableWithFallback(
  supabase: any,
  tableName: string
): Promise<FestDetailRow[]> {
  const selectClauseWithBudget =
    "fest_id, fest_title, opening_date, organizing_dept, organizing_dept_id, organizing_school, contact_email, budget_amount, estimated_budget_amount, total_estimated_expense, custom_fields";
  const selectClauseLegacy =
    "fest_id, fest_title, opening_date, organizing_dept, organizing_dept_id, organizing_school, contact_email, custom_fields";

  const { data: primaryData, error: primaryError } = await supabase
    .from(tableName)
    .select(selectClauseWithBudget);

  if (!primaryError && Array.isArray(primaryData)) {
    return primaryData as FestDetailRow[];
  }

  if (primaryError && isMissingRelationError(primaryError, tableName)) {
    return [];
  }

  const shouldRetryWithLegacySelect =
    isMissingColumnError(primaryError, "budget_amount") ||
    isMissingColumnError(primaryError, "estimated_budget_amount") ||
    isMissingColumnError(primaryError, "total_estimated_expense") ||
    isMissingColumnError(primaryError);

  if (!shouldRetryWithLegacySelect) {
    return [];
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from(tableName)
    .select(selectClauseLegacy);

  if (legacyError || !Array.isArray(legacyData)) {
    return [];
  }

  return legacyData as FestDetailRow[];
}

function toSingleRecord<T>(joined: T | T[] | null | undefined): T | null {
  if (!joined) {
    return null;
  }

  if (Array.isArray(joined)) {
    return joined[0] ?? null;
  }

  return joined;
}

function deriveCoordinatorName(email: string | null | undefined, displayName: string | null | undefined): string {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }

  if (!email || !email.includes("@")) {
    return "Coordinator";
  }

  const localPart = email.split("@")[0];
  return localPart
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function getYearDateBounds(now: Date): { startDate: string; endDate: string } {
  const year = now.getUTCFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
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

function getEventBudgetAmount(
  eventRow: EventDetailRow | null | undefined,
  budgetRow: BudgetRow | null | undefined
): number {
  const directBudget =
    toNumber(eventRow?.total_estimated_expense) ||
    toNumber(eventRow?.estimated_budget_amount) ||
    toNumber(eventRow?.budget_amount);

  if (directBudget > 0) {
    return directBudget;
  }

  return toNumber(budgetRow?.total_estimated_expense);
}

function getFestBudgetAmount(festRow: FestDetailRow | null | undefined): number {
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

async function fetchFestRowsWithFallback(
  supabase: any,
  festIds: string[]
): Promise<FestDetailRow[]> {
  if (festIds.length === 0) {
    return [];
  }

  const {
    rows: primaryData,
    error: primaryError,
  } = await fetchFestRowsFromTableWithFallback(supabase, "fests", festIds);

  const mergedByFestId = new Map<string, FestDetailRow>();
  if (!primaryError && Array.isArray(primaryData)) {
    (primaryData as FestDetailRow[]).forEach((row) => {
      const key = normalizeText(row?.fest_id);
      if (key) {
        mergedByFestId.set(key, row);
      }
    });
  }

  const {
    rows: fallbackData,
    error: fallbackError,
  } = await fetchFestRowsFromTableWithFallback(supabase, "fest", festIds);

  if (!fallbackError && Array.isArray(fallbackData)) {
    (fallbackData as FestDetailRow[]).forEach((row) => {
      const key = normalizeText(row?.fest_id);
      if (key && !mergedByFestId.has(key)) {
        mergedByFestId.set(key, row);
      }
    });
  }

  const unresolvedRefs = festIds.filter((reference) => {
    const normalizedReference = normalizeText(reference);
    if (!normalizedReference) {
      return false;
    }

    return !Array.from(mergedByFestId.values()).some((row) =>
      festReferenceMatches(normalizedReference, row?.fest_id)
    );
  });

  if (unresolvedRefs.length > 0) {
    const tableNames = ["fests", "fest"];
    for (const tableName of tableNames) {
      const allRowsData = await fetchAllFestRowsFromTableWithFallback(
        supabase,
        tableName
      );

      if (!Array.isArray(allRowsData)) {
        continue;
      }

      (allRowsData as FestDetailRow[]).forEach((row) => {
        const rowFestId = normalizeText(row?.fest_id);
        if (!rowFestId || mergedByFestId.has(rowFestId)) {
          return;
        }

        const matchesAnyUnresolvedReference = unresolvedRefs.some(
          (reference) =>
            festReferenceMatches(reference, row?.fest_id) ||
            festReferenceMatches(reference, row?.fest_title)
        );

        if (matchesAnyUnresolvedReference) {
          mergedByFestId.set(rowFestId, row);
        }
      });
    }
  }

  if (mergedByFestId.size > 0) {
    return Array.from(mergedByFestId.values());
  }

  if (primaryError && fallbackError) {
    throw new Error(`Failed to load fest details: ${primaryError.message}`);
  }

  return [];
}

export async function fetchHodDashboardData({
  supabase,
  departmentId,
  departmentScopes,
  campusScope,
}: {
  supabase: any;
  departmentId?: string | null;
  departmentScopes?: string[] | null;
  campusScope?: string | null;
}): Promise<HodDashboardData> {
  const normalizedDepartmentScopes = Array.from(
    new Set(
      [
        ...(Array.isArray(departmentScopes) ? departmentScopes : []),
        normalizeText(departmentId),
      ]
        .map((scope) => normalizeDepartmentScope(scope))
        .filter((scope) => scope.length > 0)
    )
  );
  const normalizedCampusScope = normalizeScope(campusScope);

  let pendingQuery = supabase
    .from("approval_steps")
    .select(
      `
        id,
        step_code,
        role_code,
        status,
        created_at,
        approval_requests!inner (
          id,
          request_id,
          entity_type,
          entity_ref,
          organizing_dept,
          organizing_dept_id,
          campus_hosted_at,
          status,
          submitted_at,
          created_at
        )
      `
    )
    .eq("role_code", "HOD")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  const { data: pendingData, error: pendingError } = await pendingQuery;

  if (pendingError) {
    throw new Error(`Failed to load HOD approvals: ${pendingError.message}`);
  }

  const pendingRows = Array.isArray(pendingData) ? (pendingData as ApprovalStepQueueRow[]) : [];

  const requestRows = pendingRows
    .map((row) => toSingleRecord(row.approval_requests))
    .filter((row): row is ApprovalRequestJoinRow => Boolean(row));

  const eventIds = Array.from(
    new Set(
      requestRows
        .filter((requestRow) => normalizeEntityType(requestRow.entity_type) !== "FEST")
        .map((requestRow) => normalizeText(requestRow.entity_ref))
        .filter((entityRef) => entityRef.length > 0)
    )
  );

  const festIds = Array.from(
    new Set(
      requestRows
        .filter((requestRow) => normalizeEntityType(requestRow.entity_type) === "FEST")
        .map((requestRow) => normalizeText(requestRow.entity_ref))
        .filter((entityRef) => entityRef.length > 0)
    )
  );

  let eventRowsById = new Map<string, EventDetailRow>();
  if (eventIds.length > 0) {
    const fullSelect =
      "event_id, title, event_date, organizing_dept, organizing_dept_id, organizing_school, organizer_email, budget_amount, estimated_budget_amount, total_estimated_expense";
    const legacySelect = "event_id, title, event_date, organizing_dept, organizing_dept_id, organizing_school, organizer_email";

    let { data: eventData, error: eventError } = await supabase
      .from("events")
      .select(fullSelect)
      .in("event_id", eventIds);

    if (
      eventError &&
      (isMissingColumnError(eventError, "budget_amount") ||
        isMissingColumnError(eventError, "estimated_budget_amount") ||
        isMissingColumnError(eventError, "total_estimated_expense") ||
        isMissingColumnError(eventError))
    ) {
      const retry = await supabase
        .from("events")
        .select(legacySelect)
        .in("event_id", eventIds);
      eventData = retry.data;
      eventError = retry.error;
    }

    if (eventError) {
      throw new Error(`Failed to load event details: ${eventError.message}`);
    }

    const eventRows = Array.isArray(eventData) ? (eventData as EventDetailRow[]) : [];
    eventRowsById = new Map(
      eventRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  let festRowsById = new Map<string, FestDetailRow>();
  if (festIds.length > 0) {
    const festRows = await fetchFestRowsWithFallback(supabase, festIds);
    festRowsById = new Map(
      festRows
        .map((row) => [normalizeText(row.fest_id), row] as const)
        .filter(([festId]) => festId.length > 0)
    );
  }

  // Batch-fetch department names for display and scope matching
  const allDeptIds = Array.from(
    new Set([
      ...requestRows.map((r) => normalizeText(r.organizing_dept_id)).filter(Boolean),
      ...Array.from(eventRowsById.values()).map((e) => normalizeText(e.organizing_dept_id)).filter(Boolean),
      ...Array.from(festRowsById.values()).map((f) => normalizeText(f.organizing_dept_id)).filter(Boolean),
    ])
  );
  let deptNameById = new Map<string, string>();
  if (allDeptIds.length > 0) {
    const { data: primaryDeptRows, error: primaryDeptError } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", allDeptIds);
    if (!primaryDeptError && Array.isArray(primaryDeptRows)) {
      deptNameById = new Map(
        (primaryDeptRows as Array<{ id: string; name: string }>).map((r) => [String(r.id), String(r.name || "")])
      );
    } else {
      // Fallback: departments_courses uses department_name column
      const { data: fallbackRows } = await supabase
        .from("departments_courses")
        .select("id, department_name")
        .in("id", allDeptIds);
      if (Array.isArray(fallbackRows)) {
        deptNameById = new Map(
          (fallbackRows as Array<{ id: string; department_name: string }>).map((r) => [
            String(r.id),
            String(r.department_name || ""),
          ])
        );
      }
    }
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const scopedPendingRows = pendingRows.filter((stepRow) => {
    const requestRow = toSingleRecord(stepRow.approval_requests);
    if (!requestRow) {
      return false;
    }

    const entityType = normalizeEntityType(requestRow.entity_type);
    const entityRef = normalizeText(requestRow.entity_ref);
    const isFestEntity = entityType === "FEST";
    const festRow = isFestEntity
      ? resolveFestRowByReference(festRowsById, entityRef)
      : null;

    const requestDeptId = normalizeText(requestRow.organizing_dept_id);
    const fallbackDeptId = normalizeText(
      isFestEntity
        ? festRow?.organizing_dept_id
        : eventRowsById.get(entityRef)?.organizing_dept_id
    );
    const effectiveDeptId = requestDeptId || fallbackDeptId;

    // Text-based department name as fallback when UUID is absent
    const requestDeptText = normalizeScope(requestRow.organizing_dept);
    const entityDeptText = normalizeScope(
      isFestEntity
        ? festRow?.organizing_dept
        : eventRowsById.get(entityRef)?.organizing_dept
    );
    const effectiveDeptText = requestDeptText || entityDeptText;

    if (normalizedDepartmentScopes.length > 0) {
      // UUID scopes: compare directly
      const uuidMatch = normalizedDepartmentScopes.some(
        (scope) => uuidPattern.test(scope) && scope === effectiveDeptId.toLowerCase()
      );
      // Text scopes via DB name lookup: UUID → dept name from departments table
      const resolvedDeptName = normalizeDepartmentScope(deptNameById.get(effectiveDeptId) || "");
      const nameMatch =
        resolvedDeptName.length > 0 &&
        normalizedDepartmentScopes.some(
          (scope) => !uuidPattern.test(scope) && normalizeDepartmentScope(scope) === resolvedDeptName
        );
      // Text fallback: compare normalized organizing_dept text against all scopes
      const normalizedEffectiveDeptText = normalizeDepartmentScope(effectiveDeptText);
      const textMatch =
        normalizedEffectiveDeptText.length > 0 &&
        normalizedDepartmentScopes.some(
          (scope) => normalizeDepartmentScope(scope) === normalizedEffectiveDeptText
        );

      if (!uuidMatch && !nameMatch && !textMatch) {
        return false;
      }
    }

    const requestCampusScope = normalizeScope(requestRow.campus_hosted_at);
    if (
      normalizedCampusScope &&
      requestCampusScope &&
      requestCampusScope !== normalizedCampusScope
    ) {
      return false;
    }

    return true;
  });

  const scopedRequestRows = scopedPendingRows
    .map((row) => toSingleRecord(row.approval_requests))
    .filter((row): row is ApprovalRequestJoinRow => Boolean(row));

  let budgetsByEventId = new Map<string, BudgetRow>();
  if (eventIds.length > 0) {
    const { data: budgetsData, error: budgetsError } = await supabase
      .from("event_budgets")
      .select("event_id, total_estimated_expense, total_actual_expense")
      .in("event_id", eventIds);

    if (budgetsError) {
      if (!isMissingRelationError(budgetsError, "event_budgets")) {
        throw new Error(`Failed to load event budget details: ${budgetsError.message}`);
      }
    } else {
      const budgetRows = Array.isArray(budgetsData) ? (budgetsData as BudgetRow[]) : [];
      budgetsByEventId = new Map(
        budgetRows
          .map((row) => [String(row.event_id || ""), row] as const)
          .filter(([eventId]) => eventId.length > 0)
      );
    }
  }

  const organizerEmails = Array.from(
    new Set(
      scopedRequestRows
        .map((requestRow) => {
          const entityRef = normalizeText(requestRow.entity_ref);
          const entityType = normalizeEntityType(requestRow.entity_type);

          if (entityType === "FEST") {
            return normalizeText(
              resolveFestRowByReference(festRowsById, entityRef)?.contact_email
            ).toLowerCase();
          }

          return normalizeText(eventRowsById.get(entityRef)?.organizer_email).toLowerCase();
        })
        .filter((email) => email.length > 0)
    )
  );

  let userNamesByEmail = new Map<string, string>();
  if (organizerEmails.length > 0) {
    const { data: userRowsData, error: userRowsError } = await supabase
      .from("users")
      .select("email, name")
      .in("email", organizerEmails);

    if (!userRowsError && Array.isArray(userRowsData)) {
      const userRows = userRowsData as UserNameRow[];
      const userNameEntries = userRows.reduce<Array<[string, string]>>((entries, row) => {
        const email = String(row.email || "").trim().toLowerCase();
        if (!email) {
          return entries;
        }

        entries.push([email, String(row.name || "")]);
        return entries;
      }, []);

      userNamesByEmail = new Map(userNameEntries);
    }
  }

  const queue: HodApprovalQueueItem[] = scopedPendingRows
    .map((stepRow) => {
      const requestRow = toSingleRecord(stepRow.approval_requests);
      if (!requestRow) {
        return null;
      }

      const entityType = normalizeEntityType(requestRow.entity_type);
      const entityRef = normalizeText(requestRow.entity_ref);
      const isFestEntity = entityType === "FEST";

      const eventRow = !isFestEntity ? eventRowsById.get(entityRef) || null : null;
      const festRow = isFestEntity
        ? resolveFestRowByReference(festRowsById, entityRef)
        : null;

      const organizerEmail = normalizeText(
        isFestEntity ? festRow?.contact_email : eventRow?.organizer_email
      ).toLowerCase();

      const coordinatorName = deriveCoordinatorName(
        organizerEmail,
        organizerEmail ? userNamesByEmail.get(organizerEmail) : null
      );

      const eventBudget = !isFestEntity ? budgetsByEventId.get(entityRef) || null : null;
      const festBudget = isFestEntity ? getFestBudgetAmount(festRow) : 0;
      const displayName = isFestEntity
        ? normalizeText(festRow?.fest_title) || "Untitled Fest"
        : normalizeText(eventRow?.title) || "Untitled Event";

      const displayDate = isFestEntity
        ? normalizeText(festRow?.opening_date) || null
        : normalizeText(eventRow?.event_date) || null;

      const resolvedEntityId = isFestEntity
        ? normalizeText(festRow?.fest_id) || entityRef
        : entityRef;

      const deptId =
        normalizeText(requestRow.organizing_dept_id) ||
        normalizeText(isFestEntity ? festRow?.organizing_dept_id : eventRow?.organizing_dept_id);
      const schoolFallback =
        normalizeText(isFestEntity ? festRow?.organizing_school : eventRow?.organizing_school);
      const departmentName = (deptId && deptNameById.get(deptId)) || schoolFallback || "Unknown Department";

      return {
        id: normalizeText(requestRow.id),
        eventId: resolvedEntityId,
        eventName: displayName,
        entityType: isFestEntity ? "fest" : "event",
        totalBudget: isFestEntity
          ? festBudget
          : getEventBudgetAmount(eventRow, eventBudget),
        coordinatorName,
        departmentName,
        eventDate: displayDate,
        requestedAt:
          normalizeText(requestRow.submitted_at) ||
          normalizeText(requestRow.created_at) ||
          normalizeText(stepRow.created_at) ||
          null,
      } as HodApprovalQueueItem;
    })
    .filter((row): row is HodApprovalQueueItem => Boolean(row && row.id.length > 0));

  const { startDate, endDate } = getYearDateBounds(new Date());

  let ytdBudgetQuery = supabase
    .from("event_budgets")
    .select(
      `
        event_id,
        total_actual_expense,
        total_estimated_expense,
        events!inner (
          event_id,
          event_date,
          organizing_dept_id,
          campus_hosted_at
        )
      `
    )
    .gte("events.event_date", startDate)
    .lte("events.event_date", endDate);

  const { data: ytdBudgetData, error: ytdBudgetError } = await ytdBudgetQuery;

  if (ytdBudgetError && !isMissingRelationError(ytdBudgetError, "event_budgets")) {
    throw new Error(`Failed to load YTD department budget: ${ytdBudgetError.message}`);
  }

  const ytdRows =
    ytdBudgetError || !Array.isArray(ytdBudgetData)
      ? []
      : (ytdBudgetData as YtdBudgetRow[]);

  const filteredYtdRows = ytdRows.filter((row) => {
    const eventScopeRow = toSingleRecord(row.events);

    if (normalizedDepartmentScopes.length > 0) {
      const eventDeptId = normalizeText(eventScopeRow?.organizing_dept_id);
      if (!normalizedDepartmentScopes.includes(eventDeptId)) {
        return false;
      }
    }

    if (normalizedCampusScope) {
      const eventCampusScope = normalizeScope(eventScopeRow?.campus_hosted_at);
      if (eventCampusScope && eventCampusScope !== normalizedCampusScope) {
        return false;
      }
    }

    return true;
  });

  const deptBudgetUsedYtd = filteredYtdRows.reduce((sum, row) => {
    const actual = toNumber(row.total_actual_expense);
    const estimated = toNumber(row.total_estimated_expense);
    return sum + (actual > 0 ? actual : estimated);
  }, 0);

  // Fetch decision history for HOD role
  const history = await fetchDecisionHistory(
    supabase,
    ["HOD"],
    normalizedDepartmentScopes,
    deptNameById,
    uuidPattern
  );

  return {
    queue,
    metrics: {
      deptBudgetUsedYtd,
      pendingL1Approvals: queue.length,
    },
    history,
  };
}

async function fetchDecisionHistory(
  supabase: any,
  roleCodes: string[],
  departmentScopes: string[],
  deptNameById: Map<string, string>,
  uuidPattern: RegExp
): Promise<import("../types").ApprovalHistoryItem[]> {
  const { data, error } = await supabase
    .from("approval_decisions")
    .select(`
      id,
      decision,
      comment,
      decided_by_email,
      role_code,
      created_at,
      approval_requests!inner (
        id,
        entity_type,
        entity_ref,
        organizing_dept_id,
        organizing_school
      )
    `)
    .in("role_code", roleCodes)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !Array.isArray(data)) {
    return [];
  }

  // Collect entity ids to resolve names
  const eventIds: string[] = [];
  const festIds: string[] = [];
  for (const row of data as any[]) {
    const req = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
    if (!req) continue;
    const entityType = String(req.entity_type || "").toUpperCase();
    const entityRef = String(req.entity_ref || "").trim();
    if (!entityRef) continue;
    if (entityType === "FEST") festIds.push(entityRef);
    else eventIds.push(entityRef);
  }

  const eventNamesById = new Map<string, string>();
  const festNamesById = new Map<string, string>();

  if (eventIds.length > 0) {
    const { data: evRows } = await supabase.from("events").select("event_id,title").in("event_id", eventIds);
    if (Array.isArray(evRows)) {
      for (const r of evRows as any[]) eventNamesById.set(String(r.event_id || ""), String(r.title || ""));
    }
  }
  if (festIds.length > 0) {
    const { data: fRows } = await supabase.from("fests").select("fest_id,fest_title").in("fest_id", festIds);
    if (Array.isArray(fRows)) {
      for (const r of fRows as any[]) festNamesById.set(String(r.fest_id || ""), String(r.fest_title || ""));
    }
  }

  // Also fetch dept names for any dept ids not already in deptNameById
  const allDeptIds = Array.from(
    new Set(
      (data as any[]).map((row) => {
        const req = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
        return String(req?.organizing_dept_id || "").trim();
      }).filter(Boolean)
    )
  );
  const missingDeptIds = allDeptIds.filter((id) => !deptNameById.has(id));
  if (missingDeptIds.length > 0) {
    const { data: dRows } = await supabase.from("departments").select("id,name").in("id", missingDeptIds);
    if (Array.isArray(dRows) && dRows.length > 0) {
      for (const r of dRows as any[]) deptNameById.set(String(r.id), String(r.name || ""));
    } else {
      const { data: dFallback } = await supabase.from("departments_courses").select("id,department_name").in("id", missingDeptIds);
      if (Array.isArray(dFallback)) {
        for (const r of dFallback as any[]) deptNameById.set(String(r.id), String(r.department_name || ""));
      }
    }
  }

  const items: import("../types").ApprovalHistoryItem[] = [];

  for (const row of data as any[]) {
    const req = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
    if (!req) continue;

    const entityType = String(req.entity_type || "").toUpperCase();
    const entityRef = String(req.entity_ref || "").trim();
    if (!entityRef) continue;

    const isFest = entityType === "FEST";
    const deptId = String(req.organizing_dept_id || "").trim();
    const schoolFallback = String(req.organizing_school || "").trim();
    const deptName = (deptId && deptNameById.get(deptId)) || schoolFallback || "Unknown Department";

    // Apply department scope filter (same logic as queue filter)
    if (departmentScopes.length > 0) {
      const uuidMatch = departmentScopes.some(
        (s) => uuidPattern.test(s) && s === deptId.toLowerCase()
      );
      const resolvedDeptName = normalizeDepartmentScope(deptNameById.get(deptId) || "");
      const nameMatch =
        resolvedDeptName.length > 0 &&
        departmentScopes.some(
          (s) => !uuidPattern.test(s) && normalizeDepartmentScope(s) === resolvedDeptName
        );
      if (!uuidMatch && !nameMatch) continue;
    }

    const decision = String(row.decision || "").toLowerCase();
    if (!["approved", "rejected", "returned_for_revision"].includes(decision)) continue;

    items.push({
      id: String(row.id || ""),
      requestId: String(req.id || ""),
      entityRef,
      entityType: isFest ? "fest" : "event",
      eventName: isFest
        ? festNamesById.get(entityRef) || "Untitled Fest"
        : eventNamesById.get(entityRef) || "Untitled Event",
      departmentName: deptName,
      decision: decision as "approved" | "rejected" | "returned_for_revision",
      comment: row.comment ? String(row.comment) : null,
      decidedByEmail: String(row.decided_by_email || ""),
      decidedAt: String(row.created_at || ""),
    });
  }

  return items;
}
