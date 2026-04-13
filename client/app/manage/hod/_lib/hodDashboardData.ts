import "server-only";

import { HodApprovalQueueItem, HodDashboardMetrics } from "../types";

type ApprovalRequestJoinRow = {
  id?: string | null;
  request_id?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  organizing_dept?: string | null;
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
  organizer_email?: string | null;
};

type FestDetailRow = {
  fest_id?: string | null;
  fest_title?: string | null;
  opening_date?: string | null;
  organizing_dept?: string | null;
  contact_email?: string | null;
};

type BudgetRow = {
  event_id?: string | null;
  total_estimated_expense?: number | string | null;
  total_actual_expense?: number | string | null;
};

type UserNameRow = {
  email?: string | null;
  name?: string | null;
};

export interface HodDashboardData {
  queue: HodApprovalQueueItem[];
  metrics: HodDashboardMetrics;
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

export async function fetchHodDashboardData({
  supabase,
  departmentId,
  campusScope,
}: {
  supabase: any;
  departmentId?: string | null;
  campusScope?: string | null;
}): Promise<HodDashboardData> {
  const normalizedDepartmentId = normalizeText(departmentId).toLowerCase();
  const normalizedCampusScope = normalizeText(campusScope).toLowerCase();

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

  if (normalizedDepartmentId) {
    pendingQuery = pendingQuery.eq("approval_requests.organizing_dept", normalizedDepartmentId);
  }

  if (normalizedCampusScope) {
    pendingQuery = pendingQuery.eq("approval_requests.campus_hosted_at", normalizedCampusScope);
  }

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
    const { data: budgetsData, error: budgetsError } = await supabase
      .from("event_budgets")
      .select("event_id, total_estimated_expense, total_actual_expense")
      .in("event_id", eventIds);

    if (budgetsError) {
      throw new Error(`Failed to load event budget details: ${budgetsError.message}`);
    }

    const budgetRows = Array.isArray(budgetsData) ? (budgetsData as BudgetRow[]) : [];
    budgetsByEventId = new Map(
      budgetRows
        .map((row) => [String(row.event_id || ""), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  const organizerEmails = Array.from(
    new Set(
      requestRows
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

  const queue: HodApprovalQueueItem[] = pendingRows
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

      const organizerEmail = normalizeText(
        isFestEntity ? festRow?.contact_email : eventRow?.organizer_email
      ).toLowerCase();

      const coordinatorName = deriveCoordinatorName(
        organizerEmail,
        organizerEmail ? userNamesByEmail.get(organizerEmail) : null
      );

      const eventBudget = !isFestEntity ? budgetsByEventId.get(entityRef) : null;
      const displayName = isFestEntity
        ? normalizeText(festRow?.fest_title) || "Untitled Fest"
        : normalizeText(eventRow?.title) || "Untitled Event";

      const displayDate = isFestEntity
        ? normalizeText(festRow?.opening_date) || null
        : normalizeText(eventRow?.event_date) || null;

      const departmentName =
        normalizeText(requestRow.organizing_dept) ||
        normalizeText(isFestEntity ? festRow?.organizing_dept : eventRow?.organizing_dept) ||
        "Unknown Department";

      return {
        id: normalizeText(requestRow.id),
        eventId: entityRef,
        eventName: displayName,
        entityType: isFestEntity ? "fest" : "event",
        totalBudget: toNumber(eventBudget?.total_estimated_expense),
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
          organizing_dept,
          campus_hosted_at
        )
      `
    )
    .gte("events.event_date", startDate)
    .lte("events.event_date", endDate);

  if (normalizedDepartmentId) {
    ytdBudgetQuery = ytdBudgetQuery.eq("events.organizing_dept", normalizedDepartmentId);
  }

  if (normalizedCampusScope) {
    ytdBudgetQuery = ytdBudgetQuery.eq("events.campus_hosted_at", normalizedCampusScope);
  }

  const { data: ytdBudgetData, error: ytdBudgetError } = await ytdBudgetQuery;

  if (ytdBudgetError) {
    throw new Error(`Failed to load YTD department budget: ${ytdBudgetError.message}`);
  }

  const ytdRows = Array.isArray(ytdBudgetData) ? (ytdBudgetData as BudgetRow[]) : [];
  const deptBudgetUsedYtd = ytdRows.reduce((sum, row) => {
    const actual = toNumber(row.total_actual_expense);
    const estimated = toNumber(row.total_estimated_expense);
    return sum + (actual > 0 ? actual : estimated);
  }, 0);

  return {
    queue,
    metrics: {
      deptBudgetUsedYtd,
      pendingL1Approvals: queue.length,
    },
  };
}
