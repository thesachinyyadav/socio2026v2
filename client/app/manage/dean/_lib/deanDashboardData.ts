import "server-only";

import {
  DeanApprovalQueueItem,
  DeanDashboardMetrics,
  DeanDepartmentBudgetKpi,
} from "../types";

type ApprovalJoinRow = {
  id?: string | null;
  status?: string | null;
  created_at?: string | null;
  approval_level?: string | null;
  version?: number | string | null;
};

type BudgetJoinRow = {
  event_id?: string | null;
  total_estimated_expense?: number | string | null;
  total_actual_expense?: number | string | null;
};

type EventJoinRow = {
  event_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  organizing_dept?: string | null;
  organizing_school?: string | null;
  organizer_email?: string | null;
  fest_id?: string | null;
  approval_requests?: ApprovalJoinRow[] | ApprovalJoinRow | null;
  event_budgets?: BudgetJoinRow[] | BudgetJoinRow | null;
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

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function toTimestamp(value: unknown): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchDeanDashboardData({
  supabase,
  schoolId,
  l1Threshold,
}: {
  supabase: any;
  schoolId: string;
  l1Threshold: number;
}): Promise<DeanDashboardData> {
  const queueSelect = `
    event_id,
    title,
    event_date,
    organizing_dept,
    organizing_school,
    organizer_email,
    fest_id,
    approval_requests!inner (
      id,
      status,
      created_at,
      approval_level,
      version
    ),
    event_budgets!inner (
      event_id,
      total_estimated_expense,
      total_actual_expense
    )
  `;

  const { data: pendingEventsData, error: pendingEventsError } = await supabase
    .from("events")
    .select(queueSelect)
    .eq("organizing_school", schoolId)
    .is("fest_id", null)
    .eq("approval_requests.approval_level", "L2_DEAN")
    .eq("approval_requests.status", "pending")
    .gte("event_budgets.total_estimated_expense", l1Threshold)
    .order("created_at", {
      ascending: true,
      referencedTable: "approval_requests",
    });

  if (pendingEventsError) {
    throw new Error(`Failed to load dean approvals: ${pendingEventsError.message}`);
  }

  const pendingEvents = Array.isArray(pendingEventsData)
    ? (pendingEventsData as EventJoinRow[])
    : [];

  const organizerEmails = Array.from(
    new Set(
      pendingEvents
        .map((row) => normalizeText(row.organizer_email).toLowerCase())
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

  const queue: DeanApprovalQueueItem[] = pendingEvents
    .map((row) => {
      const approvalRow = toSingleRecord(row.approval_requests);
      const budgetRow = toSingleRecord(row.event_budgets);
      const organizerEmail = normalizeText(row.organizer_email).toLowerCase();

      return {
        id: normalizeText(approvalRow?.id),
        eventId: normalizeText(row.event_id),
        eventName: normalizeText(row.title) || "Untitled Event",
        totalBudget: toNumber(budgetRow?.total_estimated_expense),
        coordinatorName: deriveCoordinatorName(
          organizerEmail,
          organizerEmail ? userNamesByEmail.get(organizerEmail) : null
        ),
        eventDate: normalizeText(row.event_date) || null,
        requestedAt: normalizeText(approvalRow?.created_at) || null,
        departmentName: normalizeText(row.organizing_dept) || "Unknown Department",
      };
    })
    .filter((row) => row.id.length > 0);

  const pendingBudgetTotal = queue.reduce((sum, row) => sum + row.totalBudget, 0);

  const { data: kpiEventsData, error: kpiEventsError } = await supabase
    .from("events")
    .select(queueSelect)
    .eq("organizing_school", schoolId)
    .is("fest_id", null)
    .eq("approval_requests.approval_level", "L2_DEAN")
    .gte("event_budgets.total_estimated_expense", l1Threshold);

  if (kpiEventsError) {
    throw new Error(`Failed to load dean KPI data: ${kpiEventsError.message}`);
  }

  const kpiEvents = Array.isArray(kpiEventsData) ? (kpiEventsData as EventJoinRow[]) : [];

  const departmentMap = new Map<string, { requested: number; approved: number }>();

  kpiEvents.forEach((eventRow) => {
    const budgetRow = toSingleRecord(eventRow.event_budgets);
    const approvalRows = toRecordArray(eventRow.approval_requests)
      .filter((requestRow) => normalizeText(requestRow.approval_level) === "L2_DEAN")
      .sort((left, right) => {
        const versionDelta = toNumber(right.version) - toNumber(left.version);
        if (versionDelta !== 0) {
          return versionDelta;
        }
        return toTimestamp(right.created_at) - toTimestamp(left.created_at);
      });

    const latestRow = approvalRows[0] || null;
    const departmentName = normalizeText(eventRow.organizing_dept) || "Unknown Department";
    const budgetValue = toNumber(budgetRow?.total_estimated_expense);

    const existing = departmentMap.get(departmentName) || {
      requested: 0,
      approved: 0,
    };

    existing.requested += budgetValue;

    if (normalizeText(latestRow?.status).toLowerCase() === "approved") {
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
