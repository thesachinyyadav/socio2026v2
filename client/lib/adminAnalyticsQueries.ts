import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getUserFriendlyErrorMessage } from "@/lib/userFacingErrors";

const DEFAULT_BATCH_SIZE = 1000;
const TABLE_MAX_ROWS = {
  users: 20000,
  events: 25000,
  fests: 10000,
  registrations: 80000,
  attendance_status: 80000,
} as const;

export type AnalyticsUser = {
  email: string;
  name: string | null;
  campus: string | null;
  department: string | null;
  course: string | null;
  organization_type: "christ_member" | "outsider" | null;
  is_organiser: boolean;
  is_support: boolean;
  is_masteradmin: boolean;
  created_at: string | null;
};

export type AnalyticsEvent = {
  event_id: string;
  title: string;
  event_date: string | null;
  created_at: string | null;
  category: string | null;
  event_type: string | null;
  organizing_dept: string | null;
  campus_hosted_at: string | null;
  registration_fee: number;
  outsider_registration_fee: number;
  fest_id: string | null;
  fest: string | null;
  created_by: string | null;
};

export type AnalyticsFest = {
  fest_id: string;
  fest_title: string;
  organizing_dept: string | null;
  campus_hosted_at: string | null;
  opening_date: string | null;
  closing_date: string | null;
};

export type AnalyticsRegistration = {
  registration_id: string;
  event_id: string;
  registration_type: "individual" | "team" | null;
  participant_organization: "christ_member" | "outsider" | null;
  user_email: string | null;
  individual_email: string | null;
  team_leader_email: string | null;
  teammates: unknown[];
  created_at: string | null;
};

export type AnalyticsAttendance = {
  registration_id: string;
  event_id: string | null;
  status: "attended" | "absent" | "pending" | null;
  marked_at: string | null;
};

export type AnalyticsDataset = {
  generatedAt: string;
  users: AnalyticsUser[];
  events: AnalyticsEvent[];
  fests: AnalyticsFest[];
  registrations: AnalyticsRegistration[];
  attendance: AnalyticsAttendance[];
  meta: {
    rowCounts: {
      users: number;
      events: number;
      fests: number;
      registrations: number;
      attendance: number;
    };
    batchedFetch: true;
  };
};

type TableName = keyof typeof TABLE_MAX_ROWS;

type FetchInBatchesOptions = {
  table: TableName;
  tableOverride?: string;
  select: string;
  batchSize?: number;
  maxRows?: number;
  signal?: AbortSignal;
};

type QueryOrderColumn = string | "__none__";

function isMissingColumnError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    (normalized.includes("column") && normalized.includes("does not exist")) ||
    (normalized.includes("could not find") && normalized.includes("column")) ||
    (normalized.includes("schema cache") && normalized.includes("column"))
  );
}

function isMissingRelationError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("relation") && normalized.includes("does not exist");
}

function extractMissingColumnName(errorMessage: string): string | null {
  const patterns = [
    /column\s+["']?(?:[a-z0-9_]+\.)?([a-z0-9_]+)["']?\s+does not exist/i,
    /could not find the\s+["']([a-z0-9_]+)["']\s+column/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

function getOrderCandidates(tableName: string): QueryOrderColumn[] {
  switch (tableName) {
    case "users":
      return ["__none__", "id", "created_at", "email"];
    case "events":
      return ["__none__", "id", "event_id", "created_at"];
    case "fests":
    case "fest":
      return ["__none__", "id", "fest_id", "created_at"];
    case "registrations":
      return ["__none__", "id", "registration_id", "created_at"];
    case "attendance_status":
      return ["__none__", "id", "registration_id", "marked_at"];
    default:
      return ["__none__", "id", "created_at"];
  }
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asOrganizationType(value: unknown): AnalyticsUser["organization_type"] {
  if (value === "christ_member" || value === "outsider") {
    return value;
  }
  return null;
}

function asRegistrationType(value: unknown): AnalyticsRegistration["registration_type"] {
  if (value === "individual" || value === "team") {
    return value;
  }
  return null;
}

function asParticipantOrganization(value: unknown): AnalyticsRegistration["participant_organization"] {
  if (value === "christ_member" || value === "outsider") {
    return value;
  }
  return null;
}

function asAttendanceStatus(value: unknown): AnalyticsAttendance["status"] {
  if (value === "attended" || value === "absent" || value === "pending") {
    return value;
  }
  return null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)
  );
}

function mapUsers(rawUsers: Record<string, unknown>[]): AnalyticsUser[] {
  return rawUsers
    .map((row) => ({
      email: asStringOrNull(row.email) ?? "",
      name: asStringOrNull(row.name),
      campus: asStringOrNull(row.campus),
      department: asStringOrNull(row.department),
      course: asStringOrNull(row.course),
      organization_type: asOrganizationType(row.organization_type),
      is_organiser: Boolean(row.is_organiser),
      is_support: Boolean(row.is_support),
      is_masteradmin: Boolean(row.is_masteradmin),
      created_at: asStringOrNull(row.created_at),
    }))
    .filter((user) => user.email !== "");
}

function mapEvents(rawEvents: Record<string, unknown>[]): AnalyticsEvent[] {
  return rawEvents
    .map((row) => ({
      event_id: asStringOrNull(row.event_id) ?? "",
      title: asStringOrNull(row.title) ?? "Untitled Event",
      event_date: asStringOrNull(row.event_date),
      created_at: asStringOrNull(row.created_at),
      category: asStringOrNull(row.category),
      event_type: asStringOrNull(row.event_type),
      organizing_dept: asStringOrNull(row.organizing_dept),
      campus_hosted_at: asStringOrNull(row.campus_hosted_at),
      registration_fee: toNumber(row.registration_fee),
      outsider_registration_fee: toNumber(row.outsider_registration_fee),
      fest_id: asStringOrNull(row.fest_id),
      fest: asStringOrNull(row.fest),
      created_by: asStringOrNull(row.created_by),
    }))
    .filter((event) => event.event_id !== "");
}

function mapFests(rawFests: Record<string, unknown>[]): AnalyticsFest[] {
  return rawFests
    .map((row) => ({
      fest_id: asStringOrNull(row.fest_id) ?? "",
      fest_title: asStringOrNull(row.fest_title) ?? "Untitled Fest",
      organizing_dept: asStringOrNull(row.organizing_dept),
      campus_hosted_at: asStringOrNull(row.campus_hosted_at),
      opening_date: asStringOrNull(row.opening_date),
      closing_date: asStringOrNull(row.closing_date),
    }))
    .filter((fest) => fest.fest_id !== "");
}

function mapRegistrations(rawRegistrations: Record<string, unknown>[]): AnalyticsRegistration[] {
  return rawRegistrations
    .map((row) => ({
      registration_id: asStringOrNull(row.registration_id) ?? "",
      event_id: asStringOrNull(row.event_id) ?? "",
      registration_type: asRegistrationType(row.registration_type),
      participant_organization: asParticipantOrganization(row.participant_organization),
      user_email: asStringOrNull(row.user_email),
      individual_email: asStringOrNull(row.individual_email),
      team_leader_email: asStringOrNull(row.team_leader_email),
      teammates: Array.isArray(row.teammates) ? row.teammates : [],
      created_at: asStringOrNull(row.created_at),
    }))
    .filter((registration) => registration.registration_id !== "" && registration.event_id !== "");
}

function mapAttendance(rawAttendance: Record<string, unknown>[]): AnalyticsAttendance[] {
  return rawAttendance
    .map((row) => ({
      registration_id: asStringOrNull(row.registration_id) ?? "",
      event_id: asStringOrNull(row.event_id),
      status: asAttendanceStatus(row.status),
      marked_at: asStringOrNull(row.marked_at),
    }))
    .filter((entry) => entry.registration_id !== "");
}

function buildDataset(
  rawUsers: Record<string, unknown>[],
  rawEvents: Record<string, unknown>[],
  rawFests: Record<string, unknown>[],
  rawRegistrations: Record<string, unknown>[],
  rawAttendance: Record<string, unknown>[],
  generatedAt?: string | null
): AnalyticsDataset {
  const users = mapUsers(rawUsers);
  const events = mapEvents(rawEvents);
  const fests = mapFests(rawFests);
  const registrations = mapRegistrations(rawRegistrations);
  const attendance = mapAttendance(rawAttendance);

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    users,
    events,
    fests,
    registrations,
    attendance,
    meta: {
      rowCounts: {
        users: users.length,
        events: events.length,
        fests: fests.length,
        registrations: registrations.length,
        attendance: attendance.length,
      },
      batchedFetch: true,
    },
  };
}

async function fetchInBatches<T extends Record<string, unknown>>(
  client: SupabaseClient,
  options: FetchInBatchesOptions
): Promise<T[]> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxRows = options.maxRows ?? TABLE_MAX_ROWS[options.table];
  const rows: T[] = [];
  let from = 0;
  const fromTable = options.tableOverride ?? options.table;
  const orderCandidates = getOrderCandidates(fromTable);
  let currentOrderIndex = 0;

  for (;;) {
    let data: unknown[] | null = null;
    let lastError: { code?: string; message: string } | null = null;
    let resolved = false;

    for (let index = currentOrderIndex; index < orderCandidates.length; index += 1) {
      const orderBy = orderCandidates[index];

      let query = client
        .from(fromTable)
        .select(options.select)
        .range(from, from + batchSize - 1);

      if (orderBy !== "__none__") {
        query = query.order(orderBy, { ascending: true });
      }

      if (options.signal) {
        query = query.abortSignal(options.signal);
      }

      const result = await query;

      if (!result.error) {
        data = (result.data ?? []) as unknown[];
        currentOrderIndex = index;
        resolved = true;
        break;
      }

      lastError = {
        code: typeof result.error.code === "string" ? result.error.code : undefined,
        message: result.error.message,
      };

      const composedError = `${lastError.code ? `${lastError.code} ` : ""}${lastError.message}`;
      const missingColumn = extractMissingColumnName(composedError);

      if (isMissingColumnError(composedError) && index < orderCandidates.length - 1) {
        const shouldRetryWithNextOrder =
          Boolean(missingColumn) &&
          orderBy !== "__none__" &&
          missingColumn === orderBy.toLowerCase();

        if (shouldRetryWithNextOrder) {
          continue;
        }
      }

      break;
    }

    if (!resolved) {
      const errorCode = lastError?.code ? `${lastError.code} ` : "";
      const errorMessage = lastError?.message ?? "Unknown query error";
      throw new Error(`[${fromTable}] ${errorCode}${errorMessage}`);
    }

    const chunk = ((data ?? []) as unknown) as T[];

    if (chunk.length === 0) {
      break;
    }

    rows.push(...chunk);

    if (rows.length > maxRows) {
      throw new Error(
        `[${options.table}] Row limit exceeded (${rows.length} > ${maxRows}). Narrow your scope or add aggregate RPCs.`
      );
    }

    if (chunk.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return rows;
}

async function fetchWithSelectFallback<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: TableName,
  selectCandidates: string[],
  signal?: AbortSignal
): Promise<T[]> {
  let lastError: Error | null = null;
  const tableCandidates = (() => {
    switch (table) {
      case "fests":
        return ["fests", "fest"];
      case "events":
        return ["events", "event"];
      case "users":
        return ["users", "user"];
      default:
        return [table];
    }
  })();

  for (const tableCandidate of tableCandidates) {
    let shouldTryNextTable = false;

    for (const select of selectCandidates) {
      try {
        const rows = await fetchInBatches<T>(client, {
          table,
          tableOverride: tableCandidate,
          select,
          signal,
        });
        return rows;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(message);

        if (isMissingColumnError(message)) {
          continue;
        }

        if (isMissingRelationError(message)) {
          shouldTryNextTable = true;
          break;
        }

        throw lastError;
      }
    }

    if (!shouldTryNextTable) {
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function ensureMasterAdminSession(client: SupabaseClient): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError) {
    throw new Error(getUserFriendlyErrorMessage(sessionError, "Please sign in again."));
  }

  if (!session?.user?.email) {
    throw new Error("Authenticated admin session is required for analytics.");
  }

  const email = session.user.email;
  const { data, error } = await client
    .from("users")
    .select("is_masteradmin")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(getUserFriendlyErrorMessage(error, "You do not have permission to view analytics."));
  }

  if (!data?.is_masteradmin) {
    throw new Error("You do not have permission to view analytics.");
  }
}

async function tryFetchDatasetFromRpc(
  client: SupabaseClient,
  signal?: AbortSignal
): Promise<AnalyticsDataset | null> {
  try {
    let query = client.rpc("get_admin_analytics_dataset_v1", {});

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;

    if (error) {
      return null;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const payload = data as Record<string, unknown>;

    return buildDataset(
      asRecordArray(payload.users),
      asRecordArray(payload.events),
      asRecordArray(payload.fests),
      asRecordArray(payload.registrations),
      asRecordArray(payload.attendance),
      asStringOrNull(payload.generatedAt)
    );
  } catch {
    return null;
  }
}

export async function fetchAdminAnalyticsDataset(signal?: AbortSignal): Promise<AnalyticsDataset> {
  await ensureMasterAdminSession(supabase);

  const rpcDataset = await tryFetchDatasetFromRpc(supabase, signal);
  if (rpcDataset) {
    return rpcDataset;
  }

  const [usersResult, eventsResult, festsResult, registrationsResult, attendanceResult] = await Promise.allSettled([
    fetchWithSelectFallback<Record<string, unknown>>(
      supabase,
      "users",
      [
        "email,name,created_at",
        "email,name,is_organiser,is_support,is_masteradmin,created_at",
        "email,name,campus,department,course,is_organiser,is_support,is_masteradmin,created_at",
        "email,name,campus,department,course,organization_type,is_organiser,is_support,is_masteradmin,created_at",
        "email,name,course,organization_type,is_organiser,is_support,is_masteradmin,created_at",
        "email,name,course,is_organiser,is_support,is_masteradmin,created_at",
      ],
      signal
    ),
    fetchWithSelectFallback<Record<string, unknown>>(
      supabase,
      "events",
      [
        "event_id,title,event_date,created_at,category",
        "event_id,title,event_date,created_at,category,organizing_dept,fest",
        "event_id,title,event_date,created_at,category,organizing_dept,registration_fee,fest,created_by",
        "event_id,title,event_date,created_at,category,event_type,organizing_dept,campus_hosted_at,registration_fee,outsider_registration_fee,fest_id,fest,created_by",
        "event_id,title,event_date,created_at,category,event_type,organizing_dept,campus_hosted_at,registration_fee,outsider_registration_fee,fest,created_by",
        "event_id,title,event_date,created_at,category,organizing_dept,campus_hosted_at,registration_fee,outsider_registration_fee,fest,created_by",
        "event_id,title,event_date,created_at,category,organizing_dept,registration_fee,fest,created_by",
        "event_id,title,event_date,created_at,category,organizing_dept,registration_fee,created_by",
        "event_id,title,event_date,created_at,category,organizing_dept,registration_fee,fest",
        "event_id,title,event_date,created_at,category,organizing_dept,fest",
        "event_id,title,event_date,created_at,category,organizing_dept",
        "event_id,title,event_date,created_at,category",
        "event_id,title,event_date,created_at",
      ],
      signal
    ),
    fetchWithSelectFallback<Record<string, unknown>>(
      supabase,
      "fests",
      [
        "fest_id,fest_title,organizing_dept,opening_date,closing_date",
        "fest_id,fest_title,organizing_dept,campus_hosted_at,opening_date,closing_date",
      ],
      signal
    ),
    fetchWithSelectFallback<Record<string, unknown>>(
      supabase,
      "registrations",
      [
        "registration_id,event_id,registration_type,user_email,individual_email,team_leader_email,teammates,created_at",
        "registration_id,event_id,registration_type,participant_organization,user_email,individual_email,team_leader_email,teammates,created_at",
      ],
      signal
    ),
    fetchWithSelectFallback<Record<string, unknown>>(
      supabase,
      "attendance_status",
      ["registration_id,event_id,status,marked_at"],
      signal
    ),
  ]);

  const rawUsers = usersResult.status === "fulfilled" ? usersResult.value : [];
  const rawEvents = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const rawFests = festsResult.status === "fulfilled" ? festsResult.value : [];
  const rawRegistrations = registrationsResult.status === "fulfilled" ? registrationsResult.value : [];
  const rawAttendance = attendanceResult.status === "fulfilled" ? attendanceResult.value : [];

  return buildDataset(rawUsers, rawEvents, rawFests, rawRegistrations, rawAttendance);
}
