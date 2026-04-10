import "server-only";

import { HodApprovalQueueItem, HodDashboardMetrics } from "../types";

type EventJoinRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept?: string | null;
  fest_id?: string | null;
  organizer_email?: string | null;
};

type ApprovalRequestRow = {
  id?: string;
  event_id?: string | null;
  created_at?: string | null;
  events?: EventJoinRow | EventJoinRow[] | null;
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

function toSingleEventJoin(joined: EventJoinRow | EventJoinRow[] | null | undefined): EventJoinRow | null {
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

export async function fetchHodDashboardData({
  supabase,
  departmentId,
}: {
  supabase: any;
  departmentId: string;
}): Promise<HodDashboardData> {
  const { data: pendingData, error: pendingError } = await supabase
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
    .eq("events.organizing_dept", departmentId)
    .is("events.fest_id", null)
    .order("created_at", { ascending: true });

  if (pendingError) {
    throw new Error(`Failed to load HOD approvals: ${pendingError.message}`);
  }

  const pendingRows = Array.isArray(pendingData) ? (pendingData as ApprovalRequestRow[]) : [];
  const eventIds = pendingRows
    .map((row) => String(row.event_id || "").trim())
    .filter((id) => id.length > 0);

  const uniqueEventIds = Array.from(new Set(eventIds));

  let budgetsByEventId = new Map<string, BudgetRow>();
  if (uniqueEventIds.length > 0) {
    const { data: budgetsData, error: budgetsError } = await supabase
      .from("event_budgets")
      .select("event_id, total_estimated_expense, total_actual_expense")
      .in("event_id", uniqueEventIds);

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
      pendingRows
        .map((row) => toSingleEventJoin(row.events)?.organizer_email)
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
      userNamesByEmail = new Map(
        userRows
          .map((row) => [String(row.email || ""), String(row.name || "")])
          .filter(([email]) => email.length > 0)
      );
    }
  }

  const queue: HodApprovalQueueItem[] = pendingRows.map((row) => {
    const event = toSingleEventJoin(row.events);
    const eventId = String(row.event_id || event?.event_id || "").trim();
    const eventBudget = budgetsByEventId.get(eventId);
    const organizerEmail = String(event?.organizer_email || "").trim();
    const coordinatorName = deriveCoordinatorName(
      organizerEmail,
      organizerEmail ? userNamesByEmail.get(organizerEmail) : null
    );

    return {
      id: String(row.id || ""),
      eventId,
      eventName: String(event?.title || "Untitled Event"),
      totalBudget: toNumber(eventBudget?.total_estimated_expense),
      coordinatorName,
      eventDate: event?.event_date ? String(event.event_date) : null,
      requestedAt: row.created_at ? String(row.created_at) : null,
    };
  });

  const { startDate, endDate } = getYearDateBounds(new Date());

  const { data: ytdBudgetData, error: ytdBudgetError } = await supabase
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
    .eq("events.organizing_dept", departmentId)
    .gte("events.event_date", startDate)
    .lte("events.event_date", endDate);

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
