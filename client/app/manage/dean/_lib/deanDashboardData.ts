import "server-only";

import {
  DeanApprovalQueueItem,
  DeanDashboardMetrics,
  DeanDepartmentBudgetKpi,
} from "../types";

type ApprovalRequestJoinRow = {
  id?: string | null;
  request_id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  organizing_dept_id?: string | null;
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
};

type ApprovalStepQueueRow = {
  id?: string | null;
  role_code?: string | null;
  step_code?: string | null;
  status?: string | null;
  created_at?: string | null;
  approval_requests?: ApprovalRequestJoinRow[] | ApprovalRequestJoinRow | null;
};

type BudgetRow = {
  event_id?: string | null;
  total_estimated_expense?: number | string | null;
  total_actual_expense?: number | string | null;
};

type EventDetailRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept_id?: string | null;
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
  organizer_email?: string | null;
  budget_amount?: number | string | null;
  estimated_budget_amount?: number | string | null;
  total_estimated_expense?: number | string | null;
};

type FestDetailRow = {
  fest_id?: string | null;
  fest_title?: string | null;
  opening_date?: string | null;
  organizing_dept_id?: string | null;
  organizing_school?: string | null;
  campus_hosted_at?: string | null;
  contact_email?: string | null;
  budget_amount?: number | string | null;
  estimated_budget_amount?: number | string | null;
  total_estimated_expense?: number | string | null;
  custom_fields?: unknown;
};

type UserNameRow = {
  email?: string | null;
  name?: string | null;
};

export interface DeanDashboardData {
  queue: DeanApprovalQueueItem[];
  metrics: DeanDashboardMetrics;
  departmentKpis: DeanDepartmentBudgetKpi[];
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

function normalizeScope(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeDepartmentScope(value: unknown): string {
  const normalized = normalizeScope(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/^department of\s+/, "")
    .replace(/^dept(?:\.)?\s+of\s+/, "")
    .replace(/^dept(?:\.)?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDepartmentScopeCandidates(value: unknown): string[] {
  const candidates = new Set<string>();
  const raw = normalizeScope(value);
  const canonical = normalizeDepartmentScope(value);

  if (raw) {
    candidates.add(raw);
  }

  if (canonical) {
    candidates.add(canonical);
    candidates.add(canonical.replace(/\s+/g, "_"));
    candidates.add(`dept_${canonical.replace(/\s+/g, "_")}`);
    candidates.add(`department_${canonical.replace(/\s+/g, "_")}`);
    candidates.add(`department of ${canonical}`);
  }

  return Array.from(candidates).filter((candidate) => candidate.length > 0);
}

function normalizeEntityType(value: unknown): string {
  return normalizeText(value).toUpperCase();
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

function toRecordArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

function toSingleRecord<T>(value: T[] | T | null | undefined): T | null {
  const rows = toRecordArray(value);
  return rows[0] ?? null;
}

function deriveCoordinatorName(
  email: string | null | undefined,
  displayName: string | null | undefined
): string {
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

function toTimestamp(value: unknown): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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

async function buildDepartmentToSchoolLookup(supabase: any): Promise<Map<string, string>> {
  // Returns Map<dept_uuid, school_name> for resolving school from organizing_dept_id
  const lookup = new Map<string, string>();

  const { data: primaryRows, error: primaryError } = await supabase
    .from("departments")
    .select("id,name,school");

  if (!primaryError && Array.isArray(primaryRows)) {
    (primaryRows as any[]).forEach((row) => {
      const deptId = String(row?.id || "").trim();
      const school = normalizeScope(row?.school);
      if (deptId && school) {
        lookup.set(deptId, school);
      }
    });
    if (lookup.size > 0) {
      return lookup;
    }
  }

  // Fallback: departments_courses table uses department_name column
  const { data: fallbackRows } = await supabase
    .from("departments_courses")
    .select("id,school");

  if (Array.isArray(fallbackRows)) {
    (fallbackRows as any[]).forEach((row) => {
      const deptId = String(row?.id || "").trim();
      const school = normalizeScope(row?.school);
      if (deptId && school) {
        lookup.set(deptId, school);
      }
    });
  }

  return lookup;
}

function buildDeptNameLookup(deptToSchoolMap: Map<string, string>, supabaseDeptRows: any[]): Map<string, string> {
  // Returns Map<dept_uuid, dept_name>
  const lookup = new Map<string, string>();
  if (Array.isArray(supabaseDeptRows)) {
    supabaseDeptRows.forEach((row: any) => {
      const deptId = String(row?.id || "").trim();
      const name = String(row?.name || "").trim();
      if (deptId && name) {
        lookup.set(deptId, name);
      }
    });
  }
  return lookup;
}

function resolveSchoolFromDeptId(
  deptIdToSchoolLookup: Map<string, string>,
  deptId: unknown
): string {
  const id = String(deptId || "").trim();
  return (id && deptIdToSchoolLookup.get(id)) || "";
}

async function fetchFestRowsWithFallback(
  supabase: any,
  festIds: string[]
): Promise<FestDetailRow[]> {
  if (festIds.length === 0) {
    return [];
  }

  const selectClause =
    "fest_id, fest_title, opening_date, organizing_dept_id, organizing_school, campus_hosted_at, contact_email, budget_amount, estimated_budget_amount, total_estimated_expense, custom_fields";
  const legacySelectClause =
    "fest_id, fest_title, opening_date, organizing_dept_id, contact_email";

  const { data: primaryData, error: primaryError } = await supabase
    .from("fests")
    .select(selectClause)
    .in("fest_id", festIds);

  if (!primaryError && Array.isArray(primaryData)) {
    return primaryData as FestDetailRow[];
  }

  const shouldRetryPrimaryWithLegacySelect =
    isMissingColumnError(primaryError, "organizing_school") ||
    isMissingColumnError(primaryError, "campus_hosted_at") ||
    isMissingColumnError(primaryError, "budget_amount") ||
    isMissingColumnError(primaryError, "estimated_budget_amount") ||
    isMissingColumnError(primaryError, "total_estimated_expense") ||
    isMissingColumnError(primaryError, "custom_fields") ||
    isMissingColumnError(primaryError);

  if (primaryError && shouldRetryPrimaryWithLegacySelect) {
    const { data: legacyPrimaryData, error: legacyPrimaryError } = await supabase
      .from("fests")
      .select(legacySelectClause)
      .in("fest_id", festIds);

    if (!legacyPrimaryError && Array.isArray(legacyPrimaryData)) {
      return legacyPrimaryData as FestDetailRow[];
    }
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("fest")
    .select(selectClause)
    .in("fest_id", festIds);

  if (!fallbackError && Array.isArray(fallbackData)) {
    return fallbackData as FestDetailRow[];
  }

  const shouldRetryFallbackWithLegacySelect =
    isMissingColumnError(fallbackError, "organizing_school") ||
    isMissingColumnError(fallbackError, "campus_hosted_at") ||
    isMissingColumnError(fallbackError, "budget_amount") ||
    isMissingColumnError(fallbackError, "estimated_budget_amount") ||
    isMissingColumnError(fallbackError, "total_estimated_expense") ||
    isMissingColumnError(fallbackError, "custom_fields") ||
    isMissingColumnError(fallbackError);

  if (fallbackError && shouldRetryFallbackWithLegacySelect) {
    const { data: legacyFallbackData, error: legacyFallbackError } = await supabase
      .from("fest")
      .select(legacySelectClause)
      .in("fest_id", festIds);

    if (!legacyFallbackError && Array.isArray(legacyFallbackData)) {
      return legacyFallbackData as FestDetailRow[];
    }
  }

  if (primaryError && fallbackError) {
    throw new Error(`Failed to load fest details: ${primaryError.message}`);
  }

  return [];
}

async function fetchEventRowsById(
  supabase: any,
  eventIds: string[]
): Promise<Map<string, EventDetailRow>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const fullSelect =
    "event_id, title, event_date, organizing_dept_id, organizing_school, campus_hosted_at, organizer_email, budget_amount, estimated_budget_amount, total_estimated_expense";
  const legacySelect =
    "event_id, title, event_date, organizing_dept_id, organizing_school, campus_hosted_at, organizer_email";

  let { data, error } = await supabase
    .from("events")
    .select(fullSelect)
    .in("event_id", eventIds);

  if (
    error &&
    (isMissingColumnError(error, "budget_amount") ||
      isMissingColumnError(error, "estimated_budget_amount") ||
      isMissingColumnError(error, "total_estimated_expense") ||
      isMissingColumnError(error, "organizing_school") ||
      isMissingColumnError(error, "campus_hosted_at") ||
      isMissingColumnError(error))
  ) {
    const retry = await supabase
      .from("events")
      .select(legacySelect)
      .in("event_id", eventIds);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(`Failed to load event details: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as EventDetailRow[]) : [];
  return new Map(
    rows
      .map((row) => [normalizeText(row.event_id), row] as const)
      .filter(([eventId]) => eventId.length > 0)
  );
}

export async function fetchDeanDashboardData({
  supabase,
  schoolId,
  campusScope,
  l1Threshold,
}: {
  supabase: any;
  schoolId?: string | null;
  campusScope?: string | null;
  l1Threshold: number;
}): Promise<DeanDashboardData> {
  void l1Threshold;
  const normalizedSchoolId = normalizeText(schoolId).toLowerCase();
  const normalizedCampusScope = normalizeText(campusScope).toLowerCase();

  const pendingSelectWithSchool = `
        id,
        role_code,
        step_code,
        status,
        created_at,
        approval_requests!inner (
          id,
          request_id,
          entity_type,
          entity_ref,
          organizing_dept_id,
          organizing_school,
          campus_hosted_at,
          status,
          submitted_at,
          created_at
        )
      `;

  const pendingSelectLegacy = `
        id,
        role_code,
        step_code,
        status,
        created_at,
        approval_requests!inner (
          id,
          request_id,
          entity_type,
          entity_ref,
          organizing_dept_id,
          campus_hosted_at,
          status,
          submitted_at,
          created_at
        )
      `;

  let pendingQueryResult = await supabase
    .from("approval_steps")
    .select(pendingSelectWithSchool)
    .eq("role_code", "DEAN")
    .in("step_code", ["DEAN", "L2_DEAN"])
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  if (
    pendingQueryResult.error &&
    String(pendingQueryResult.error.message || "").toLowerCase().includes("organizing_school")
  ) {
    pendingQueryResult = await supabase
      .from("approval_steps")
      .select(pendingSelectLegacy)
      .eq("role_code", "DEAN")
      .in("step_code", ["DEAN", "L2_DEAN"])
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });
  }

  const { data: pendingStepsData, error: pendingStepsError } = pendingQueryResult;

  if (pendingStepsError) {
    throw new Error(`Failed to load dean approvals: ${pendingStepsError.message}`);
  }

  const pendingSteps = Array.isArray(pendingStepsData)
    ? (pendingStepsData as ApprovalStepQueueRow[])
    : [];

  const pendingRequestRows = pendingSteps
    .map((row) => toSingleRecord(row.approval_requests))
    .filter((row): row is ApprovalRequestJoinRow => Boolean(row));

  const eventIds = Array.from(
    new Set(
      pendingRequestRows
        .filter((requestRow) => normalizeEntityType(requestRow.entity_type) !== "FEST")
        .map((requestRow) => normalizeText(requestRow.entity_ref))
        .filter((entityRef) => entityRef.length > 0)
    )
  );

  const festIds = Array.from(
    new Set(
      pendingRequestRows
        .filter((requestRow) => normalizeEntityType(requestRow.entity_type) === "FEST")
        .map((requestRow) => normalizeText(requestRow.entity_ref))
        .filter((entityRef) => entityRef.length > 0)
    )
  );

  let eventRowsById = new Map<string, EventDetailRow>();
  if (eventIds.length > 0) {
    eventRowsById = await fetchEventRowsById(supabase, eventIds);
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

  const deptIdToSchoolLookup = await buildDepartmentToSchoolLookup(supabase);

  // Batch-fetch department names for display
  const allDeptIds = Array.from(
    new Set([
      ...pendingRequestRows.map((r) => String(r.organizing_dept_id || "")).filter(Boolean),
      ...Array.from(eventRowsById.values()).map((e) => String(e.organizing_dept_id || "")).filter(Boolean),
      ...Array.from(festRowsById.values()).map((f) => String(f.organizing_dept_id || "")).filter(Boolean),
    ])
  );
  let deptNameById = new Map<string, string>();
  if (allDeptIds.length > 0) {
    const { data: deptRows } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", allDeptIds);
    if (Array.isArray(deptRows)) {
      deptNameById = buildDeptNameLookup(deptIdToSchoolLookup, deptRows);
    }
  }

  let budgetsByEventId = new Map<string, BudgetRow>();
  if (eventIds.length > 0) {
    const { data: budgetData, error: budgetError } = await supabase
      .from("event_budgets")
      .select("event_id, total_estimated_expense, total_actual_expense")
      .in("event_id", eventIds);

    if (budgetError) {
      throw new Error(`Failed to load budget details: ${budgetError.message}`);
    }

    const budgetRows = Array.isArray(budgetData) ? (budgetData as BudgetRow[]) : [];
    budgetsByEventId = new Map(
      budgetRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  const organizerEmails = Array.from(
    new Set(
      pendingRequestRows
        .map((requestRow) => {
          const entityRef = normalizeText(requestRow.entity_ref);
          const entityType = normalizeEntityType(requestRow.entity_type);
          if (entityType === "FEST") {
            return normalizeText(festRowsById.get(entityRef)?.contact_email).toLowerCase();
          }
          return normalizeText(eventRowsById.get(entityRef)?.organizer_email).toLowerCase();
        })
        .filter((email) => email.length > 0)
    )
  );

  let userNamesByEmail = new Map<string, string>();
  if (organizerEmails.length > 0) {
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("email, name")
      .in("email", organizerEmails);

    if (!usersError && Array.isArray(usersData)) {
      const userRows = usersData as UserNameRow[];
      userNamesByEmail = new Map(
        userRows
          .map((row) => [normalizeText(row.email).toLowerCase(), normalizeText(row.name)] as const)
          .filter(([email]) => email.length > 0)
      );
    }
  }

  const queue: DeanApprovalQueueItem[] = pendingSteps
    .map((stepRow) => {
      const requestRow = toSingleRecord(stepRow.approval_requests);
      if (!requestRow) {
        return null;
      }

      const entityType = normalizeEntityType(requestRow.entity_type);
      const entityRef = normalizeText(requestRow.entity_ref);
      const isFestEntity = entityType === "FEST";

      const eventRow = !isFestEntity ? eventRowsById.get(entityRef) || null : null;
      const festRow = isFestEntity ? festRowsById.get(entityRef) || null : null;
      const budgetRow = !isFestEntity ? budgetsByEventId.get(entityRef) || null : null;

      const directSchoolScope =
        normalizeScope(isFestEntity ? festRow?.organizing_school : eventRow?.organizing_school) ||
        normalizeScope(requestRow.organizing_school);
      const deptId =
        String(requestRow.organizing_dept_id || "") ||
        String((isFestEntity ? festRow?.organizing_dept_id : eventRow?.organizing_dept_id) || "");
      const mappedSchoolScope = resolveSchoolFromDeptId(deptIdToSchoolLookup, deptId);
      const scopeCandidate = directSchoolScope || mappedSchoolScope;

      if (normalizedSchoolId && scopeCandidate !== normalizedSchoolId) {
        return null;
      }

      const campusCandidate =
        normalizeText(requestRow.campus_hosted_at).toLowerCase() ||
        normalizeText(isFestEntity ? festRow?.campus_hosted_at : eventRow?.campus_hosted_at).toLowerCase();

      if (normalizedCampusScope && campusCandidate && campusCandidate !== normalizedCampusScope) {
        return null;
      }

      const organizerEmail = normalizeText(
        isFestEntity ? festRow?.contact_email : eventRow?.organizer_email
      ).toLowerCase();

      return {
        id: normalizeText(requestRow.id),
        eventId: entityRef,
        eventName: isFestEntity
          ? normalizeText(festRow?.fest_title) || "Untitled Fest"
          : normalizeText(eventRow?.title) || "Untitled Event",
        entityType: isFestEntity ? "fest" : "event",
        totalBudget: isFestEntity
          ? getFestBudgetAmount(festRow)
          : getEventBudgetAmount(eventRow, budgetRow),
        coordinatorName: deriveCoordinatorName(
          organizerEmail,
          organizerEmail ? userNamesByEmail.get(organizerEmail) : null
        ),
        eventDate: isFestEntity
          ? normalizeText(festRow?.opening_date) || null
          : normalizeText(eventRow?.event_date) || null,
        requestedAt:
          normalizeText(requestRow.submitted_at) ||
          normalizeText(requestRow.created_at) ||
          normalizeText(stepRow.created_at) ||
          null,
        departmentName: (() => {
          const dId =
            String(requestRow.organizing_dept_id || "") ||
            String((isFestEntity ? festRow?.organizing_dept_id : eventRow?.organizing_dept_id) || "");
          return (dId && deptNameById.get(dId)) || "Unknown Department";
        })(),
      };
    })
    .filter((row): row is DeanApprovalQueueItem => Boolean(row && row.id.length > 0));

  const pendingBudgetTotal = queue.reduce((sum, row) => sum + row.totalBudget, 0);

  const kpiSelectWithSchool = `
        id,
        status,
        created_at,
        approval_requests!inner (
          id,
          entity_type,
          entity_ref,
          organizing_dept_id,
          organizing_school
        )
      `;

  const kpiSelectLegacy = `
        id,
        status,
        created_at,
        approval_requests!inner (
          id,
          entity_type,
          entity_ref,
          organizing_dept_id
        )
      `;

  const buildKpiQuery = (includeSchoolColumn: boolean) => {
    const query = supabase
      .from("approval_steps")
      .select(includeSchoolColumn ? kpiSelectWithSchool : kpiSelectLegacy)
      .eq("role_code", "DEAN")
      .in("step_code", ["DEAN", "L2_DEAN"]);
    return query;
  };

  let kpiQueryResult = await buildKpiQuery(true);

  if (
    kpiQueryResult.error &&
    String(kpiQueryResult.error.message || "").toLowerCase().includes("organizing_school")
  ) {
    kpiQueryResult = await buildKpiQuery(false);
  }

  const { data: kpiStepsData, error: kpiStepsError } = kpiQueryResult;

  if (kpiStepsError) {
    throw new Error(`Failed to load dean KPI data: ${kpiStepsError.message}`);
  }

  const kpiSteps = Array.isArray(kpiStepsData) ? (kpiStepsData as ApprovalStepQueueRow[]) : [];

  const kpiRequestRows = Array.from(
    new Map(
      kpiSteps
        .map((stepRow) => {
          const requestRow = toSingleRecord(stepRow.approval_requests);
          if (!requestRow || !normalizeText(requestRow.id)) {
            return null;
          }

          return [normalizeText(requestRow.id), { stepRow, requestRow }] as const;
        })
        .filter((entry): entry is readonly [string, { stepRow: ApprovalStepQueueRow; requestRow: ApprovalRequestJoinRow }] => Boolean(entry))
    ).values()
  );

  const filteredKpiRequestRows = kpiRequestRows.filter(({ requestRow }) => {
    if (!normalizedSchoolId) {
      return true;
    }

    const directSchoolScope = normalizeScope(requestRow.organizing_school);
    const mappedSchoolScope = resolveSchoolFromDeptId(deptIdToSchoolLookup, requestRow.organizing_dept_id);

    const scopeCandidate = directSchoolScope || mappedSchoolScope;
    return scopeCandidate === normalizedSchoolId;
  });

  const kpiEventIds = Array.from(
    new Set(
      filteredKpiRequestRows
        .filter(({ requestRow }) => normalizeEntityType(requestRow.entity_type) !== "FEST")
        .map(({ requestRow }) => normalizeText(requestRow.entity_ref))
        .filter((entityRef) => entityRef.length > 0)
    )
  );

  let kpiBudgetsByEventId = new Map<string, BudgetRow>();
  if (kpiEventIds.length > 0) {
    const { data: kpiBudgetData, error: kpiBudgetError } = await supabase
      .from("event_budgets")
      .select("event_id, total_estimated_expense, total_actual_expense")
      .in("event_id", kpiEventIds);

    if (kpiBudgetError) {
      throw new Error(`Failed to load dean KPI budgets: ${kpiBudgetError.message}`);
    }

    const kpiBudgetRows = Array.isArray(kpiBudgetData) ? (kpiBudgetData as BudgetRow[]) : [];
    kpiBudgetsByEventId = new Map(
      kpiBudgetRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  let kpiEventRowsById = new Map<string, EventDetailRow>();
  if (kpiEventIds.length > 0) {
    const missingEventIds = kpiEventIds.filter((eventId) => !eventRowsById.has(eventId));
    if (missingEventIds.length > 0) {
      const additionalRows = await fetchEventRowsById(supabase, missingEventIds);
      kpiEventRowsById = new Map([
        ...Array.from(eventRowsById.entries()),
        ...Array.from(additionalRows.entries()),
      ]);
    } else {
      kpiEventRowsById = new Map(eventRowsById);
    }
  }

    const kpiFestIds = Array.from(
      new Set(
        filteredKpiRequestRows
          .filter(({ requestRow }) => normalizeEntityType(requestRow.entity_type) === "FEST")
          .map(({ requestRow }) => normalizeText(requestRow.entity_ref))
          .filter((entityRef) => entityRef.length > 0)
      )
    );

    let kpiFestsById = new Map<string, FestDetailRow>();
    if (kpiFestIds.length > 0) {
      const kpiFestRows = await fetchFestRowsWithFallback(supabase, kpiFestIds);
      kpiFestsById = new Map(
        kpiFestRows
          .map((row) => [normalizeText(row.fest_id), row] as const)
          .filter(([festId]) => festId.length > 0)
      );
    }

  const departmentMap = new Map<string, { requested: number; approved: number }>();

  filteredKpiRequestRows.forEach(({ stepRow, requestRow }) => {
    const deptId = String(requestRow.organizing_dept_id || "").trim();
    const departmentName = (deptId && deptNameById.get(deptId)) || "Unknown Department";
    const entityType = normalizeEntityType(requestRow.entity_type);
    const entityRef = normalizeText(requestRow.entity_ref);
    const budgetValue =
      entityType === "FEST"
        ? getFestBudgetAmount(kpiFestsById.get(entityRef) || null)
        : getEventBudgetAmount(
            kpiEventRowsById.get(entityRef) || null,
            kpiBudgetsByEventId.get(entityRef) || null
          );

    const existing = departmentMap.get(departmentName) || {
      requested: 0,
      approved: 0,
    };

    existing.requested += budgetValue;

    if (normalizeText(stepRow.status).toUpperCase() === "APPROVED") {
      existing.approved += budgetValue;
    }

    departmentMap.set(departmentName, existing);
  });

  const departmentKpis: DeanDepartmentBudgetKpi[] = Array.from(departmentMap.entries())
    .map(([departmentName, values]) => ({
      departmentName,
      requestedBudget: values.requested,
      approvedBudget: values.approved,
    }))
    .sort((left, right) => left.departmentName.localeCompare(right.departmentName));

  const history = await fetchDeanDecisionHistory(supabase, normalizedSchoolId, deptIdToSchoolLookup);

  return {
    queue,
    metrics: {
      pendingL2Approvals: queue.length,
      pendingBudgetTotal,
    },
    departmentKpis,
    history,
  };
}

async function fetchDeanDecisionHistory(
  supabase: any,
  normalizedSchoolId: string,
  deptIdToSchoolLookup: Map<string, string>
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
    .in("role_code", ["DEAN"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !Array.isArray(data)) return [];

  const eventIds: string[] = [];
  const festIds: string[] = [];
  for (const row of data as any[]) {
    const req = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
    if (!req) continue;
    const entityType = String(req.entity_type || "").toUpperCase();
    const ref = String(req.entity_ref || "").trim();
    if (!ref) continue;
    if (entityType === "FEST") festIds.push(ref);
    else eventIds.push(ref);
  }

  const eventNamesById = new Map<string, string>();
  const festNamesById = new Map<string, string>();
  const deptNamesById = new Map<string, string>();

  if (eventIds.length > 0) {
    const { data: evRows } = await supabase.from("events").select("event_id,title,organizing_dept_id").in("event_id", eventIds);
    if (Array.isArray(evRows)) for (const r of evRows as any[]) eventNamesById.set(String(r.event_id || ""), String(r.title || ""));
  }
  if (festIds.length > 0) {
    const { data: fRows } = await supabase.from("fests").select("fest_id,fest_title").in("fest_id", festIds);
    if (Array.isArray(fRows)) for (const r of fRows as any[]) festNamesById.set(String(r.fest_id || ""), String(r.fest_title || ""));
  }

  const allDeptIds = Array.from(
    new Set((data as any[]).map((row) => {
      const req = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
      return String(req?.organizing_dept_id || "").trim();
    }).filter(Boolean))
  );
  if (allDeptIds.length > 0) {
    const { data: dRows } = await supabase.from("departments").select("id,name").in("id", allDeptIds);
    if (Array.isArray(dRows) && dRows.length > 0) {
      for (const r of dRows as any[]) deptNamesById.set(String(r.id), String(r.name || ""));
    } else {
      const { data: dFallback } = await supabase.from("departments_courses").select("id,department_name").in("id", allDeptIds);
      if (Array.isArray(dFallback)) for (const r of dFallback as any[]) deptNamesById.set(String(r.id), String(r.department_name || ""));
    }
  }

  const items: import("../types").ApprovalHistoryItem[] = [];

  for (const row of data as any[]) {
    const req = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
    if (!req) continue;

    const entityType = String(req.entity_type || "").toUpperCase();
    const entityRef = String(req.entity_ref || "").trim();
    if (!entityRef) continue;

    const deptId = String(req.organizing_dept_id || "").trim();
    const directSchool = normalizeScope(req.organizing_school);
    const mappedSchool = resolveSchoolFromDeptId(deptIdToSchoolLookup, deptId);
    const scopeCandidate = directSchool || mappedSchool;

    if (normalizedSchoolId && scopeCandidate && scopeCandidate !== normalizedSchoolId) continue;

    const decision = String(row.decision || "").toLowerCase();
    if (!["approved", "rejected", "returned_for_revision"].includes(decision)) continue;

    items.push({
      id: String(row.id || ""),
      requestId: String(req.id || ""),
      entityRef,
      entityType: entityType === "FEST" ? "fest" : "event",
      eventName: entityType === "FEST"
        ? festNamesById.get(entityRef) || "Untitled Fest"
        : eventNamesById.get(entityRef) || "Untitled Event",
      departmentName: (deptId && deptNamesById.get(deptId)) || "Unknown Department",
      decision: decision as "approved" | "rejected" | "returned_for_revision",
      comment: row.comment ? String(row.comment) : null,
      decidedByEmail: String(row.decided_by_email || ""),
      decidedAt: String(row.created_at || ""),
    });
  }

  return items;
}
