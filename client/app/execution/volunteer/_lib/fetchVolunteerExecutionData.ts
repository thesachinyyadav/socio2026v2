import "server-only";

import {
  EventResourceItem,
  IncidentLogItem,
  RunsheetTaskItem,
  TaskStatus,
  VolunteerEventItem,
  VolunteerExecutionDashboardData,
} from "../types";

type GenericRow = Record<string, unknown>;

type VolunteerMatch = {
  isMember: boolean;
  isPrimary: boolean;
  label: string | null;
};

const EVENT_SELECT_CANDIDATES = [
  "event_id,title,event_date,end_date,event_time,venue,status,is_archived,volunteers",
  "event_id,title,event_date,end_date,event_time,venue,status,volunteers",
  "event_id,title,event_date,event_time,venue,volunteers",
] as const;

const ACTIVE_STATUS_SET = new Set([
  "active",
  "ongoing",
  "live",
  "in_progress",
  "inprogress",
]);

const RUNSHEET_ID_FIELDS = ["id", "runsheet_item_id", "item_id", "task_id"] as const;
const RUNSHEET_STATUS_FIELDS = ["status", "task_status", "execution_status", "state"] as const;
const RUNSHEET_RESPONSIBLE_FIELDS = [
  "responsible_person",
  "responsible_person_email",
  "responsible_email",
  "assigned_to",
  "owner_email",
] as const;

const RESOURCE_ID_FIELDS = ["id", "resource_id", "item_id"] as const;
const RESOURCE_STATUS_FIELDS = ["status", "resource_status", "state", "lifecycle_status"] as const;

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  return false;
}

function asRecord(value: unknown): GenericRow {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as GenericRow;
  }

  return {};
}

function parseJsonArray(value: unknown): unknown[] {
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

  if (value && typeof value === "object") {
    const record = value as GenericRow;
    if (Array.isArray(record.volunteers)) {
      return record.volunteers;
    }

    const nestedArrays = Object.values(record).filter((entry) => Array.isArray(entry)) as unknown[][];
    if (nestedArrays.length > 0) {
      return nestedArrays.flat();
    }
  }

  return [];
}

function firstExistingField(row: GenericRow, candidates: readonly string[]): string | null {
  for (const fieldName of candidates) {
    if (row[fieldName] !== undefined && row[fieldName] !== null && normalizeText(row[fieldName]).length > 0) {
      return fieldName;
    }
  }

  return null;
}

function isSchemaError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  const code = normalizeText(error?.code).toUpperCase();
  const message = normalizeLower(error?.message);

  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("relation")
  );
}

function toIsoDateString(dateLike: Date): string {
  const year = dateLike.getFullYear();
  const month = String(dateLike.getMonth() + 1).padStart(2, "0");
  const day = String(dateLike.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateToken(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  if (raw.length >= 10) {
    return raw.slice(0, 10);
  }

  return raw;
}

function eventIsActive(row: GenericRow, today: string): boolean {
  if (toBoolean(row.is_archived)) {
    return false;
  }

  const statusKey = normalizeLower(row.status).replace(/[\s-]+/g, "_");
  if (ACTIVE_STATUS_SET.has(statusKey)) {
    return true;
  }

  const eventDate = normalizeDateToken(row.event_date);
  if (!eventDate) {
    return false;
  }

  const endDate = normalizeDateToken(row.end_date) || eventDate;
  return eventDate <= today && today <= endDate;
}

function isPrimaryVolunteerEntry(record: GenericRow): boolean {
  if (toBoolean(record.is_primary)) {
    return true;
  }

  if (toBoolean(record.primary)) {
    return true;
  }

  const role = normalizeLower(record.role);
  const volunteerType = normalizeLower(record.type || record.volunteer_type);

  return role === "primary" || volunteerType === "primary";
}

function matchVolunteerMembership(volunteersRaw: unknown, userEmail: string): VolunteerMatch {
  const volunteers = parseJsonArray(volunteersRaw);
  const normalizedUserEmail = normalizeLower(userEmail);

  for (const entry of volunteers) {
    if (typeof entry === "string") {
      if (normalizeLower(entry) === normalizedUserEmail) {
        return { isMember: true, isPrimary: false, label: null };
      }
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as GenericRow;
    const emailCandidates = [record.email, record.user_email, record.volunteer_email, record.mail];
    const matched = emailCandidates.some((candidate) => normalizeLower(candidate) === normalizedUserEmail);

    if (matched) {
      const label = normalizeText(record.name || record.full_name || record.label) || null;
      return {
        isMember: true,
        isPrimary: isPrimaryVolunteerEntry(record),
        label,
      };
    }
  }

  return {
    isMember: false,
    isPrimary: false,
    label: null,
  };
}

function toTaskStatus(value: unknown): TaskStatus {
  const normalized = normalizeLower(value).replace(/[\s-]+/g, "_");

  if (normalized === "in_progress" || normalized === "inprogress" || normalized === "ongoing") {
    return "in_progress";
  }

  if (normalized === "done" || normalized === "complete" || normalized === "completed") {
    return "done";
  }

  return "pending";
}

function taskStatusLabel(status: TaskStatus): string {
  if (status === "in_progress") {
    return "In-Progress";
  }

  if (status === "done") {
    return "Done";
  }

  return "Pending";
}

function toResourceStatus(value: unknown): "allocated" | "in_use" | "returned" {
  const normalized = normalizeLower(value).replace(/[\s-]+/g, "_");

  if (normalized === "in_use" || normalized === "inuse") {
    return "in_use";
  }

  if (normalized === "returned") {
    return "returned";
  }

  return "allocated";
}

function resourceStatusLabel(status: "allocated" | "in_use" | "returned"): string {
  if (status === "in_use") {
    return "In-Use";
  }

  if (status === "returned") {
    return "Returned";
  }

  return "Allocated";
}

function mapRunsheetItem(row: GenericRow, fallbackIndex: number): RunsheetTaskItem | null {
  const idField = firstExistingField(row, RUNSHEET_ID_FIELDS) || "id";
  const idValue = normalizeText(row[idField]);
  const eventId = normalizeText(row.event_id);

  if (!eventId) {
    return null;
  }

  const title =
    normalizeText(row.title) ||
    normalizeText(row.task) ||
    normalizeText(row.task_name) ||
    normalizeText(row.activity) ||
    normalizeText(row.name);

  if (!title) {
    return null;
  }

  const statusField = firstExistingField(row, RUNSHEET_STATUS_FIELDS) || "status";
  const responsibleField = firstExistingField(row, RUNSHEET_RESPONSIBLE_FIELDS);
  const responsibleEmail = responsibleField ? normalizeLower(row[responsibleField]) : null;

  const status = toTaskStatus(row[statusField]);

  return {
    id: idValue || `${eventId}-task-${fallbackIndex + 1}`,
    eventId,
    title,
    description: normalizeText(row.description || row.details || row.notes) || null,
    scheduledTime:
      normalizeText(row.scheduled_time || row.time_slot || row.time || row.start_time) || null,
    status,
    statusLabel: taskStatusLabel(status),
    responsiblePersonEmail: responsibleEmail || null,
    responsiblePersonLabel:
      normalizeText(row.responsible_person_name || row.responsible_person || row.assigned_to) ||
      (responsibleEmail || null),
    idField,
    statusField,
    canMutate: idValue.length > 0,
  };
}

function mapResourceItem(row: GenericRow, fallbackIndex: number): EventResourceItem | null {
  const idField = firstExistingField(row, RESOURCE_ID_FIELDS) || "id";
  const idValue = normalizeText(row[idField]);
  const eventId = normalizeText(row.event_id);

  if (!eventId) {
    return null;
  }

  const name =
    normalizeText(row.resource_name) ||
    normalizeText(row.item_name) ||
    normalizeText(row.name) ||
    normalizeText(row.title);

  if (!name) {
    return null;
  }

  const statusField = firstExistingField(row, RESOURCE_STATUS_FIELDS) || "status";
  const status = toResourceStatus(row[statusField]);

  const quantityRaw = normalizeText(row.quantity);
  const quantityUnit = normalizeText(row.unit);

  return {
    id: idValue || `${eventId}-resource-${fallbackIndex + 1}`,
    eventId,
    name,
    category: normalizeText(row.category || row.resource_type || row.type) || null,
    quantityLabel: quantityRaw ? `${quantityRaw}${quantityUnit ? ` ${quantityUnit}` : ""}` : null,
    status,
    statusLabel: resourceStatusLabel(status),
    notes: normalizeText(row.notes || row.description) || null,
    idField,
    statusField,
    canMutate: idValue.length > 0,
  };
}

function toIncidentSeverity(value: unknown): "low" | "medium" | "high" | "critical" {
  const normalized = normalizeLower(value);
  if (normalized === "critical") {
    return "critical";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "low") {
    return "low";
  }

  return "medium";
}

function mapIncidentItem(row: GenericRow, fallbackIndex: number): IncidentLogItem | null {
  const eventId = normalizeText(row.event_id);
  if (!eventId) {
    return null;
  }

  const description = normalizeText(row.description || row.details || row.message);
  if (!description) {
    return null;
  }

  return {
    id:
      normalizeText(row.id || row.incident_id || row.log_id) ||
      `${eventId}-incident-${fallbackIndex + 1}`,
    eventId,
    severity: toIncidentSeverity(row.severity),
    category: normalizeText(row.category) || "General",
    description,
    reportedBy:
      normalizeText(row.reported_by || row.reported_by_email || row.created_by) || null,
    createdAt: normalizeText(row.created_at || row.reported_at) || null,
  };
}

export async function fetchVolunteerExecutionData({
  supabase,
  userEmail,
}: {
  supabase: any;
  userEmail: string;
}): Promise<VolunteerExecutionDashboardData> {
  const warnings: string[] = [];
  const normalizedEmail = normalizeLower(userEmail);
  const today = toIsoDateString(new Date());

  let eventRows: GenericRow[] = [];

  for (const selectClause of EVENT_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from("events")
      .select(selectClause)
      .not("volunteers", "is", null);

    if (!error) {
      eventRows = Array.isArray(data) ? (data as GenericRow[]) : [];
      break;
    }

    if (!isSchemaError(error)) {
      throw new Error(`Failed to load volunteer event scope: ${error.message}`);
    }
  }

  if (eventRows.length === 0) {
    return {
      events: [],
      runsheetByEventId: {},
      resourcesByEventId: {},
      incidentsByEventId: {},
      warnings,
      hasAccess: false,
    };
  }

  const authorizedEvents: VolunteerEventItem[] = [];
  const authorizedEventIds: string[] = [];

  eventRows.forEach((row) => {
    const eventId = normalizeText(row.event_id);
    if (!eventId) {
      return;
    }

    if (!eventIsActive(row, today)) {
      return;
    }

    const membership = matchVolunteerMembership(row.volunteers, normalizedEmail);
    if (!membership.isMember) {
      return;
    }

    authorizedEventIds.push(eventId);
    authorizedEvents.push({
      eventId,
      title: normalizeText(row.title) || "Untitled Event",
      eventDate: normalizeText(row.event_date) || null,
      eventTime: normalizeText(row.event_time) || null,
      venue: normalizeText(row.venue) || null,
      isPrimaryVolunteer: membership.isPrimary,
      volunteerLabel: membership.label,
    });
  });

  if (authorizedEvents.length === 0) {
    return {
      events: [],
      runsheetByEventId: {},
      resourcesByEventId: {},
      incidentsByEventId: {},
      warnings,
      hasAccess: false,
    };
  }

  const [runsheetResult, resourcesResult, incidentsResult] = await Promise.all([
    supabase.from("runsheet_items").select("*").in("event_id", authorizedEventIds),
    supabase.from("event_resources").select("*").in("event_id", authorizedEventIds),
    supabase.from("incident_logs").select("*").in("event_id", authorizedEventIds),
  ]);

  const runsheetByEventId: Record<string, RunsheetTaskItem[]> = {};
  const resourcesByEventId: Record<string, EventResourceItem[]> = {};
  const incidentsByEventId: Record<string, IncidentLogItem[]> = {};

  if (runsheetResult.error) {
    if (!isSchemaError(runsheetResult.error)) {
      warnings.push(`Runsheet items unavailable: ${runsheetResult.error.message}`);
    }
  } else {
    const rows = Array.isArray(runsheetResult.data) ? (runsheetResult.data as GenericRow[]) : [];
    rows.forEach((row, index) => {
      const mapped = mapRunsheetItem(row, index);
      if (!mapped) {
        return;
      }

      if (!runsheetByEventId[mapped.eventId]) {
        runsheetByEventId[mapped.eventId] = [];
      }

      runsheetByEventId[mapped.eventId].push(mapped);
    });

    Object.keys(runsheetByEventId).forEach((eventId) => {
      runsheetByEventId[eventId] = runsheetByEventId[eventId].sort((left, right) => {
        const leftToken = normalizeText(left.scheduledTime || "99:99");
        const rightToken = normalizeText(right.scheduledTime || "99:99");
        return leftToken.localeCompare(rightToken);
      });
    });
  }

  if (resourcesResult.error) {
    if (!isSchemaError(resourcesResult.error)) {
      warnings.push(`Resource tracker unavailable: ${resourcesResult.error.message}`);
    }
  } else {
    const rows = Array.isArray(resourcesResult.data) ? (resourcesResult.data as GenericRow[]) : [];
    rows.forEach((row, index) => {
      const mapped = mapResourceItem(row, index);
      if (!mapped) {
        return;
      }

      if (!resourcesByEventId[mapped.eventId]) {
        resourcesByEventId[mapped.eventId] = [];
      }

      resourcesByEventId[mapped.eventId].push(mapped);
    });
  }

  if (incidentsResult.error) {
    if (!isSchemaError(incidentsResult.error)) {
      warnings.push(`Incident log unavailable: ${incidentsResult.error.message}`);
    }
  } else {
    const rows = Array.isArray(incidentsResult.data) ? (incidentsResult.data as GenericRow[]) : [];
    rows.forEach((row, index) => {
      const mapped = mapIncidentItem(row, index);
      if (!mapped) {
        return;
      }

      if (!incidentsByEventId[mapped.eventId]) {
        incidentsByEventId[mapped.eventId] = [];
      }

      incidentsByEventId[mapped.eventId].push(mapped);
    });

    Object.keys(incidentsByEventId).forEach((eventId) => {
      incidentsByEventId[eventId] = incidentsByEventId[eventId].sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime();
        const rightTime = new Date(right.createdAt || 0).getTime();
        return rightTime - leftTime;
      });
    });
  }

  const sortedEvents = authorizedEvents.sort((left, right) => {
    const leftDate = normalizeText(left.eventDate || "9999-12-31");
    const rightDate = normalizeText(right.eventDate || "9999-12-31");
    return leftDate.localeCompare(rightDate);
  });

  return {
    events: sortedEvents,
    runsheetByEventId,
    resourcesByEventId,
    incidentsByEventId,
    warnings,
    hasAccess: true,
  };
}
