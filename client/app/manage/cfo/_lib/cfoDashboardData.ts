import "server-only";

import { CfoApprovalQueueItem, CfoDashboardMetrics } from "../types";

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
  campus_hosted_at?: string | null;
  approval_requests?: ApprovalJoinRow[] | ApprovalJoinRow | null;
  event_budgets?: BudgetJoinRow[] | BudgetJoinRow | null;
};

type UserNameRow = {
  email?: string | null;
  name?: string | null;
};

type DepartmentLookupRow = {
  id?: string | null;
  department_name?: string | null;
  school?: string | null;
};

export interface CfoDashboardData {
  queue: CfoApprovalQueueItem[];
  metrics: CfoDashboardMetrics;
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

function getYearDateBounds(now: Date): { startDate: string; endDate: string } {
  const year = now.getUTCFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function isLikelyUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function resolveDepartmentName(
  eventRow: EventJoinRow,
  departmentLookup: DepartmentLookupRow | null
): string {
  const directDepartment = normalizeText(eventRow.organizing_dept);
  const mappedDepartment = normalizeText(departmentLookup?.department_name);

  if (mappedDepartment) {
    return mappedDepartment;
  }

  return directDepartment || "Unknown Department";
}

function resolveSchoolName(
  eventRow: EventJoinRow,
  departmentLookup: DepartmentLookupRow | null
): string {
  const directSchool = normalizeText(eventRow.organizing_school);
  const mappedSchool = normalizeText(departmentLookup?.school);

  if (directSchool && !isLikelyUuid(directSchool)) {
    return directSchool;
  }

  if (mappedSchool) {
    return mappedSchool;
  }

  return directSchool || "Unknown School";
}

export async function fetchCfoDashboardData({
  supabase,
  campus,
  l2Threshold,
}: {
  supabase: any;
  campus: string;
  l2Threshold: number;
}): Promise<CfoDashboardData> {
  const normalizedCampus = String(campus || "").trim();
  const normalizedThreshold = Number.isFinite(l2Threshold) && l2Threshold > 0 ? l2Threshold : 100000;

  if (!normalizedCampus) {
    return {
      queue: [],
      metrics: {
        campusRequestedBudgetYtd: 0,
        campusApprovedBudgetYtd: 0,
        highValuePendingRequests: 0,
        highValuePendingBudget: 0,
        l2Threshold: normalizedThreshold,
      },
    };
  }

  const queueSelect = `
    event_id,
    title,
    event_date,
    organizing_dept,
    organizing_school,
    organizer_email,
    fest_id,
    campus_hosted_at,
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

  const pendingEventsQuery = supabase
    .from("events")
    .select(queueSelect)
    .eq("campus_hosted_at", normalizedCampus)
    .is("fest_id", null)
    .eq("approval_requests.approval_level", "L3_CFO")
    .eq("approval_requests.status", "pending")
    .gt("event_budgets.total_estimated_expense", normalizedThreshold)
    .order("created_at", {
      ascending: true,
      referencedTable: "approval_requests",
    });

  const { data: pendingEventsData, error: pendingEventsError } = await pendingEventsQuery;

  if (pendingEventsError) {
    throw new Error(`Failed to load CFO approvals: ${pendingEventsError.message}`);
  }

  const pendingEvents = Array.isArray(pendingEventsData)
    ? (pendingEventsData as EventJoinRow[])
    : [];

  const departmentIdCandidates = Array.from(
    new Set(
      pendingEvents
        .map((row) => normalizeText(row.organizing_dept))
        .filter((value) => value.length > 0)
    )
  );

  const departmentIds = departmentIdCandidates.filter((value) => isLikelyUuid(value));
  const departmentById = new Map<string, DepartmentLookupRow>();

  if (departmentIds.length > 0) {
    const { data: departmentRows, error: departmentError } = await supabase
      .from("departments_courses")
      .select("id, department_name, school")
      .in("id", departmentIds);

    if (departmentError) {
      throw new Error(`Failed to load department references: ${departmentError.message}`);
    }

    if (Array.isArray(departmentRows)) {
      (departmentRows as DepartmentLookupRow[]).forEach((row) => {
        const id = normalizeText(row.id);
        if (!id) {
          return;
        }

        departmentById.set(id, row);
      });
    }
  }

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

  const queue: CfoApprovalQueueItem[] = pendingEvents
    .map((row) => {
      const approvalRow = toSingleRecord(row.approval_requests);
      const budgetRow = toSingleRecord(row.event_budgets);
      const organizerEmail = normalizeText(row.organizer_email).toLowerCase();
      const departmentId = normalizeText(row.organizing_dept);
      const schoolId = normalizeText(row.organizing_school);
      const departmentLookup = departmentById.get(departmentId) || null;

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
        schoolId: schoolId || resolveSchoolName(row, departmentLookup),
        schoolName: resolveSchoolName(row, departmentLookup),
        departmentId,
        departmentName: resolveDepartmentName(row, departmentLookup),
      };
    })
    .filter((row) => row.id.length > 0);

  const highValuePendingBudget = queue.reduce((sum, row) => sum + row.totalBudget, 0);

  const { startDate, endDate } = getYearDateBounds(new Date());

  const ytdEventsQuery = supabase
    .from("events")
    .select(queueSelect)
    .eq("campus_hosted_at", normalizedCampus)
    .is("fest_id", null)
    .eq("approval_requests.approval_level", "L3_CFO")
    .gt("event_budgets.total_estimated_expense", normalizedThreshold)
    .gte("event_date", startDate)
    .lte("event_date", endDate);

  const { data: ytdEventsData, error: ytdEventsError } = await ytdEventsQuery;

  if (ytdEventsError) {
    throw new Error(`Failed to load CFO KPI data: ${ytdEventsError.message}`);
  }

  const ytdEvents = Array.isArray(ytdEventsData) ? (ytdEventsData as EventJoinRow[]) : [];

  const ytdTotals = ytdEvents.reduce(
    (acc, eventRow) => {
      const budgetRow = toSingleRecord(eventRow.event_budgets);
      const budgetValue = toNumber(budgetRow?.total_estimated_expense);

      const approvalRows = toRecordArray(eventRow.approval_requests)
        .filter((requestRow) => normalizeText(requestRow.approval_level) === "L3_CFO")
        .sort((left, right) => {
          const versionDelta = toNumber(right.version) - toNumber(left.version);
          if (versionDelta !== 0) {
            return versionDelta;
          }
          return toTimestamp(right.created_at) - toTimestamp(left.created_at);
        });

      const latestRow = approvalRows[0] || null;
      const latestStatus = normalizeText(latestRow?.status).toLowerCase();

      acc.requested += budgetValue;
      if (latestStatus === "approved") {
        acc.approved += budgetValue;
      }

      return acc;
    },
    { requested: 0, approved: 0 }
  );

  return {
    queue,
    metrics: {
      campusRequestedBudgetYtd: ytdTotals.requested,
      campusApprovedBudgetYtd: ytdTotals.approved,
      highValuePendingRequests: queue.length,
      highValuePendingBudget,
      l2Threshold: normalizedThreshold,
    },
  };
}
