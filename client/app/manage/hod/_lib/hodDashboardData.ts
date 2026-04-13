import "server-only";

import { HodApprovalQueueItem, HodDashboardMetrics } from "../types";

type ApprovalJoinRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
  approval_level?: string | null;
};

type EventJoinRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept?: string | null;
  fest_id?: string | null;
  organizer_email?: string | null;
  approval_request_id?: string | null;
  approval_requests?: ApprovalJoinRow[] | ApprovalJoinRow | null;
};

type ApprovalStepRow = {
  approval_request_id?: string | null;
  status?: string | null;
};

type ApprovalRequestStatusRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PendingEventRow = {
  requestId: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  organizerEmail: string | null;
  requestedAt: string | null;
};

type LegacyApprovalRequestRow = {
  id?: string;
  event_id?: string | null;
  created_at?: string | null;
  events?: EventJoinRow | EventJoinRow[] | null;
};

type LegacyEventJoinRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept?: string | null;
  fest_id?: string | null;
  organizer_email?: string | null;
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

function toSingleLegacyEventJoin(
  joined: LegacyEventJoinRow | LegacyEventJoinRow[] | null | undefined
): LegacyEventJoinRow | null {
  if (!joined) {
    return null;
  }

  if (Array.isArray(joined)) {
    return joined[0] ?? null;
  }

  return joined;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function isSchemaMismatchError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find a relationship") ||
    normalized.includes("approval_level") ||
    normalized.includes("event_id")
  );
}

function isMissingResourceError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find") ||
    normalized.includes("schema cache")
  );
}

function isPendingRequestStatus(value: unknown): boolean {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, "_");
  return normalized === "pending" || normalized === "under_review";
}

function mapLegacyPendingRows(rows: LegacyApprovalRequestRow[]): PendingEventRow[] {
  return rows
    .map((row) => {
      const event = toSingleLegacyEventJoin(row.events);
      const requestId = normalizeText(row.id);
      const eventId = normalizeText(row.event_id || event?.event_id);

      if (!requestId || !eventId) {
        return null;
      }

      return {
        requestId,
        eventId,
        eventName: normalizeText(event?.title) || "Untitled Event",
        eventDate: normalizeText(event?.event_date) || null,
        organizerEmail: normalizeText(event?.organizer_email) || null,
        requestedAt: normalizeText(row.created_at) || null,
      };
    })
    .filter((row): row is PendingEventRow => row !== null);
}

async function fetchLegacyPendingHodRows(
  supabase: any,
  normalizedDepartmentId: string
): Promise<{ rows: PendingEventRow[]; errorMessage: string | null }> {
  let pendingQuery = supabase
    .from("approval_requests")
    .select(
      `
        id,
        event_id,
        created_at,
        events:event_id (
          event_id,
          title,
          event_date,
          organizing_dept,
          fest_id,
          organizer_email
        )
      `
    )
    .eq("status", "pending")
    .eq("approval_level", "L1_HOD")
    .is("events.fest_id", null)
    .order("created_at", { ascending: true });

  if (normalizedDepartmentId) {
    pendingQuery = pendingQuery.eq("events.organizing_dept", normalizedDepartmentId);
  }

  const { data: pendingData, error: pendingError } = await pendingQuery;

  if (pendingError) {
    return {
      rows: [],
      errorMessage: pendingError.message,
    };
  }

  const pendingRows = Array.isArray(pendingData) ? (pendingData as LegacyApprovalRequestRow[]) : [];
  return {
    rows: mapLegacyPendingRows(pendingRows),
    errorMessage: null,
  };
}

async function fetchWorkflowPendingHodRows(
  supabase: any,
  normalizedDepartmentId: string
): Promise<PendingEventRow[]> {
  const { data: stepData, error: stepError } = await supabase
    .from("approval_steps")
    .select("approval_request_id, status")
    .eq("role_code", "HOD")
    .eq("status", "PENDING");

  if (stepError) {
    throw new Error(`Failed to load HOD approvals: ${stepError.message}`);
  }

  const stepRows = Array.isArray(stepData) ? (stepData as ApprovalStepRow[]) : [];
  const requestIds = Array.from(
    new Set(
      stepRows
        .map((row) => normalizeText(row.approval_request_id))
        .filter((id) => id.length > 0)
    )
  );

  if (requestIds.length === 0) {
    return [];
  }

  const { data: requestData, error: requestError } = await supabase
    .from("approval_requests")
    .select("id, status, created_at")
    .in("id", requestIds);

  if (requestError) {
    throw new Error(`Failed to load HOD approvals: ${requestError.message}`);
  }

  const requestRows = Array.isArray(requestData) ? (requestData as ApprovalRequestStatusRow[]) : [];
  const activeRequestRows = requestRows.filter((row) => isPendingRequestStatus(row.status));
  const activeRequestIds = activeRequestRows
    .map((row) => normalizeText(row.id))
    .filter((id) => id.length > 0);

  if (activeRequestIds.length === 0) {
    return [];
  }

  const requestById = new Map(
    activeRequestRows
      .map((row) => [normalizeText(row.id), row] as const)
      .filter(([id]) => id.length > 0)
  );

  let eventsQuery = supabase
    .from("events")
    .select("event_id, title, event_date, organizing_dept, fest_id, organizer_email, approval_request_id")
    .in("approval_request_id", activeRequestIds)
    .is("fest_id", null)
    .order("created_at", { ascending: true });

  if (normalizedDepartmentId) {
    eventsQuery = eventsQuery.eq("organizing_dept", normalizedDepartmentId);
  }

  const { data: eventsData, error: eventsError } = await eventsQuery;

  if (eventsError) {
    throw new Error(`Failed to load HOD approvals: ${eventsError.message}`);
  }

  const eventRows = Array.isArray(eventsData) ? (eventsData as EventJoinRow[]) : [];
  return eventRows
    .map((row) => {
      const requestId = normalizeText(row.approval_request_id);
      const eventId = normalizeText(row.event_id);

      if (!requestId || !eventId) {
        return null;
      }

      const requestRow = requestById.get(requestId) || null;

      return {
        requestId,
        eventId,
        eventName: normalizeText(row.title) || "Untitled Event",
        eventDate: normalizeText(row.event_date) || null,
        organizerEmail: normalizeText(row.organizer_email) || null,
        requestedAt: normalizeText(requestRow?.created_at) || null,
      };
    })
    .filter((row): row is PendingEventRow => row !== null);
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

export async function fetchHodDashboardData({
  supabase,
  departmentId,
}: {
  supabase: any;
  departmentId?: string | null;
}): Promise<HodDashboardData> {
  const normalizedDepartmentId = String(departmentId || "").trim();

  const {
    rows: legacyPendingRows,
    errorMessage: legacyErrorMessage,
  } = await fetchLegacyPendingHodRows(supabase, normalizedDepartmentId);

  let pendingRows = legacyPendingRows;

  if (legacyErrorMessage) {
    if (isSchemaMismatchError(legacyErrorMessage)) {
      pendingRows = await fetchWorkflowPendingHodRows(supabase, normalizedDepartmentId);
    } else {
      throw new Error(`Failed to load HOD approvals: ${legacyErrorMessage}`);
    }
  }

  const eventIds = pendingRows
    .map((row) => row.eventId)
    .filter((id) => id.length > 0);

  const uniqueEventIds = Array.from(new Set(eventIds));

  let budgetsByEventId = new Map<string, BudgetRow>();
  if (uniqueEventIds.length > 0) {
    const { data: budgetsData, error: budgetsError } = await supabase
      .from("event_budgets")
      .select("event_id, total_estimated_expense, total_actual_expense")
      .in("event_id", uniqueEventIds);

    if (budgetsError) {
      if (!isMissingResourceError(budgetsError.message)) {
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
      pendingRows
        .map((row) => row.organizerEmail)
        .map((email) => (typeof email === "string" ? email.trim() : ""))
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
        const email = String(row.email || "").trim();
        if (!email) {
          return entries;
        }

        entries.push([email, String(row.name || "")]);
        return entries;
      }, []);

      userNamesByEmail = new Map(userNameEntries);
    }
  }

  const queue: HodApprovalQueueItem[] = pendingRows.map((row) => {
    const eventId = row.eventId;
    const eventBudget = budgetsByEventId.get(eventId);
    const organizerEmail = String(row.organizerEmail || "").trim();
    const coordinatorName = deriveCoordinatorName(
      organizerEmail,
      organizerEmail ? userNamesByEmail.get(organizerEmail) : null
    );

    return {
      id: row.requestId,
      eventId,
      eventName: row.eventName,
      totalBudget: toNumber(eventBudget?.total_estimated_expense),
      coordinatorName,
      eventDate: row.eventDate,
      requestedAt: row.requestedAt,
    };
  });

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
          organizing_dept
        )
      `
    )
    .gte("events.event_date", startDate)
    .lte("events.event_date", endDate);

  if (normalizedDepartmentId) {
    ytdBudgetQuery = ytdBudgetQuery.eq("events.organizing_dept", normalizedDepartmentId);
  }

  const { data: ytdBudgetData, error: ytdBudgetError } = await ytdBudgetQuery;

  if (ytdBudgetError && !isMissingResourceError(ytdBudgetError.message)) {
    throw new Error(`Failed to load YTD department budget: ${ytdBudgetError.message}`);
  }

  const ytdRows = ytdBudgetError
    ? []
    : Array.isArray(ytdBudgetData)
      ? (ytdBudgetData as BudgetRow[])
      : [];
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
