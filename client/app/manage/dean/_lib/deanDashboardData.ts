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
  organizing_dept?: string | null;
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
  organizing_dept?: string | null;
  organizer_email?: string | null;
};

type FestDetailRow = {
  fest_id?: string | null;
  fest_title?: string | null;
  opening_date?: string | null;
  organizing_dept?: string | null;
  contact_email?: string | null;
};

type UserNameRow = {
  email?: string | null;
  name?: string | null;
};

export interface DeanDashboardData {
  queue: DeanApprovalQueueItem[];
  metrics: DeanDashboardMetrics;
  departmentKpis: DeanDepartmentBudgetKpi[];
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

function normalizeEntityType(value: unknown): string {
  return normalizeText(value).toUpperCase();
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

async function fetchFestRowsWithFallback(
  supabase: any,
  festIds: string[]
): Promise<FestDetailRow[]> {
  if (festIds.length === 0) {
    return [];
  }

  const selectClause = "fest_id, fest_title, opening_date, organizing_dept, contact_email";

  const { data: primaryData, error: primaryError } = await supabase
    .from("fests")
    .select(selectClause)
    .in("fest_id", festIds);

  if (!primaryError && Array.isArray(primaryData)) {
    return primaryData as FestDetailRow[];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("fest")
    .select(selectClause)
    .in("fest_id", festIds);

  if (!fallbackError && Array.isArray(fallbackData)) {
    return fallbackData as FestDetailRow[];
  }

  if (primaryError && fallbackError) {
    throw new Error(`Failed to load fest details: ${primaryError.message}`);
  }

  return [];
}

export async function fetchDeanDashboardData({
  supabase,
  schoolId,
  l1Threshold,
}: {
  supabase: any;
  schoolId?: string | null;
  l1Threshold: number;
}): Promise<DeanDashboardData> {
  void l1Threshold;
  const normalizedSchoolId = normalizeText(schoolId).toLowerCase();

  let pendingStepsQuery = supabase
    .from("approval_steps")
    .select(
      `
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
          organizing_dept,
          status,
          submitted_at,
          created_at
        )
      `
    )
    .eq("role_code", "DEAN")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  if (normalizedSchoolId) {
    pendingStepsQuery = pendingStepsQuery.eq("approval_requests.organizing_dept", normalizedSchoolId);
  }

  const { data: pendingStepsData, error: pendingStepsError } = await pendingStepsQuery;

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
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("event_id, title, event_date, organizing_dept, organizer_email")
      .in("event_id", eventIds);

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
        totalBudget: toNumber(budgetRow?.total_estimated_expense),
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
        departmentName:
          normalizeText(requestRow.organizing_dept) ||
          normalizeText(isFestEntity ? festRow?.organizing_dept : eventRow?.organizing_dept) ||
          "Unknown Department",
      };
    })
    .filter((row): row is DeanApprovalQueueItem => Boolean(row && row.id.length > 0));

  const pendingBudgetTotal = queue.reduce((sum, row) => sum + row.totalBudget, 0);

  let kpiStepsQuery = supabase
    .from("approval_steps")
    .select(
      `
        id,
        status,
        created_at,
        approval_requests!inner (
          id,
          entity_type,
          entity_ref,
          organizing_dept
        )
      `
    )
    .eq("role_code", "DEAN");

  if (normalizedSchoolId) {
    kpiStepsQuery = kpiStepsQuery.eq("approval_requests.organizing_dept", normalizedSchoolId);
  }

  const { data: kpiStepsData, error: kpiStepsError } = await kpiStepsQuery;

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

  const kpiEventIds = Array.from(
    new Set(
      kpiRequestRows
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

  const departmentMap = new Map<string, { requested: number; approved: number }>();

  kpiRequestRows.forEach(({ stepRow, requestRow }) => {
    const departmentName = normalizeText(requestRow.organizing_dept) || "Unknown Department";
    const entityType = normalizeEntityType(requestRow.entity_type);
    const entityRef = normalizeText(requestRow.entity_ref);
    const budgetValue =
      entityType === "FEST"
        ? 0
        : toNumber(kpiBudgetsByEventId.get(entityRef)?.total_estimated_expense);

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

  return {
    queue,
    metrics: {
      pendingL2Approvals: queue.length,
      pendingBudgetTotal,
    },
    departmentKpis,
  };
}
