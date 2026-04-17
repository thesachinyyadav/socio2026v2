"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

export type LogisticsServiceKey = "it" | "venue" | "catering" | "stalls";
export type LogisticsDecisionAction = "approve" | "reject" | "return";

interface LogisticsServiceConfig {
  key: LogisticsServiceKey;
  label: string;
  approvalLevel: string;
  roleCodes: string[];
  fallbackUniversityRoles: string[];
  userFlagKeys: string[];
  dashboardPath: string;
}

interface LogisticsQueueField {
  label: string;
  value: string;
}

export interface LogisticsQueueItem {
  approvalRequestDbId: string;
  requestId: string;
  eventId: string;
  eventTitle: string;
  requestedByEmail: string | null;
  submittedAt: string | null;
  departmentName: string | null;
  schoolName: string | null;
  campusName: string | null;
  contextSummary: string;
  contextFields: LogisticsQueueField[];
}

export interface LogisticsDashboardData {
  service: LogisticsServiceKey;
  serviceLabel: string;
  approvalLevel: string;
  queue: LogisticsQueueItem[];
}

export interface LogisticsActionResult {
  ok: boolean;
  message: string;
  finalApprovalReached?: boolean;
}

export interface LogisticsTriggerResult {
  ok: boolean;
  message: string;
  eventId: string;
  generatedLevels: string[];
  skippedLevels: string[];
}

const LOGISTICS_SERVICE_CONFIG: Record<LogisticsServiceKey, LogisticsServiceConfig> = {
  it: {
    key: "it",
    label: "IT",
    approvalLevel: "L5_IT",
    roleCodes: ["SERVICE_IT"],
    fallbackUniversityRoles: ["service_it", "it", "it_service"],
    userFlagKeys: ["is_service_it", "is_it", "is_it_service"],
    dashboardPath: "/manage/it",
  },
  venue: {
    key: "venue",
    label: "Venue",
    approvalLevel: "L5_VENUE",
    roleCodes: ["SERVICE_VENUE"],
    fallbackUniversityRoles: ["service_venue", "venue", "venue_manager"],
    userFlagKeys: ["is_service_venue", "is_venue", "is_venue_manager"],
    dashboardPath: "/manage/venue",
  },
  catering: {
    key: "catering",
    label: "Catering",
    approvalLevel: "L5_CATERING",
    roleCodes: ["SERVICE_CATERING"],
    fallbackUniversityRoles: ["service_catering", "catering", "catering_vendors"],
    userFlagKeys: ["is_service_catering", "is_catering", "is_catering_vendor"],
    dashboardPath: "/manage/catering",
  },
  stalls: {
    key: "stalls",
    label: "Stalls",
    approvalLevel: "L5_STALLS",
    roleCodes: ["SERVICE_STALLS"],
    fallbackUniversityRoles: ["service_stalls", "stalls", "stalls_misc", "stall_misc"],
    userFlagKeys: ["is_service_stalls", "is_stalls", "is_stalls_misc", "is_stall_misc"],
    dashboardPath: "/manage/stalls",
  },
};

const ALL_LOGISTICS_LEVELS = Object.values(LOGISTICS_SERVICE_CONFIG).map(
  (config) => config.approvalLevel
);

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

  const normalized = normalizeLower(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingRelationError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  const code = normalizeText(error?.code).toUpperCase();
  const message = normalizeLower(error?.message);

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function normalizeUniversityRole(value: unknown): string {
  return normalizeLower(value).replace(/\s+/g, "_");
}

function firstNonEmptyValue(row: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!row) {
    return "";
  }

  for (const key of keys) {
    const value = normalizeText(row[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function firstTruthyBoolean(row: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!row) {
    return false;
  }

  return keys.some((key) => toBoolean(row[key]));
}

function compactObjectRows(rows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
}

function buildEventRequestId(eventId: string, approvalLevel: string): string {
  const safeEventId = eventId.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const safeLevel = approvalLevel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const randomToken = Math.random().toString(36).slice(2, 8);
  const timestampToken = Date.now().toString(36);
  return `AR-${safeEventId || "event"}-${safeLevel}-${timestampToken}-${randomToken}`;
}

async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server actions should not mutate cookies directly.
      },
    },
  });
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveLogisticsAuthContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      message: "Authentication required.",
      supabase,
      adminClient: createSupabaseAdminClient() || supabase,
      user: null,
      profile: null,
      isMasterAdmin: false,
    };
  }

  const profile = await getCurrentUserProfileWithRoleCodes(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!profile) {
    return {
      ok: false as const,
      message: "Unable to resolve user profile.",
      supabase,
      adminClient: createSupabaseAdminClient() || supabase,
      user,
      profile: null,
      isMasterAdmin: false,
    };
  }

  const profileRecord = profile as Record<string, unknown>;
  const isMasterAdmin =
    Boolean(profileRecord.is_masteradmin) ||
    normalizeUniversityRole(profileRecord.university_role) === "masteradmin";

  return {
    ok: true as const,
    message: "",
    supabase,
    adminClient: createSupabaseAdminClient() || supabase,
    user,
    profile: profileRecord,
    isMasterAdmin,
  };
}

function hasServiceAccess(
  profile: Record<string, unknown>,
  isMasterAdmin: boolean,
  service: LogisticsServiceKey
): boolean {
  if (isMasterAdmin) {
    return true;
  }

  const config = LOGISTICS_SERVICE_CONFIG[service];
  const hasMappedRoleCode = hasAnyRoleCode(profile, config.roleCodes);
  if (hasMappedRoleCode) {
    return true;
  }

  const role = normalizeUniversityRole(profile.university_role);
  if (config.fallbackUniversityRoles.includes(role)) {
    return true;
  }

  return config.userFlagKeys.some((flagKey) => Boolean(profile[flagKey]));
}

async function fetchRowsByEventIds(
  client: any,
  tableName: string,
  eventIds: string[]
): Promise<Array<Record<string, unknown>>> {
  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from(tableName)
    .select("*")
    .in("event_id", eventIds);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw new Error(`Failed to load ${tableName}: ${error.message}`);
  }

  return compactObjectRows(data);
}

async function fetchRowsForEvent(
  client: any,
  tableName: string,
  eventId: string
): Promise<Array<Record<string, unknown>>> {
  if (!eventId) {
    return [];
  }

  const { data, error } = await client
    .from(tableName)
    .select("*")
    .eq("event_id", eventId)
    .limit(50);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw new Error(`Failed to load ${tableName}: ${error.message}`);
  }

  return compactObjectRows(data);
}

async function hasRowsForEvent(client: any, tableName: string, eventId: string): Promise<boolean> {
  const rows = await fetchRowsForEvent(client, tableName, eventId);
  return rows.length > 0;
}

async function hasRowsForEventAcrossTables(
  client: any,
  tableNames: string[],
  eventId: string
): Promise<boolean> {
  for (const tableName of tableNames) {
    const hasRows = await hasRowsForEvent(client, tableName, eventId);
    if (hasRows) {
      return true;
    }
  }

  return false;
}

function parseAdditionalRequests(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore malformed JSON
    }
  }

  return {};
}

function groupRowsByEventId(rows: Array<Record<string, unknown>>) {
  const rowsByEventId = new Map<string, Array<Record<string, unknown>>>();

  rows.forEach((row) => {
    const eventId = normalizeText(row.event_id);
    if (!eventId) {
      return;
    }

    const existingRows = rowsByEventId.get(eventId) || [];
    existingRows.push(row);
    rowsByEventId.set(eventId, existingRows);
  });

  return rowsByEventId;
}

function mapVenueContext(rows: Array<Record<string, unknown>>) {
  const row = rows[0] || null;
  const venueId =
    firstNonEmptyValue(row, ["venue_id", "venue", "room_id", "hall_id", "venue_name"]) ||
    "Not specified";
  const startTime =
    firstNonEmptyValue(row, ["start_time", "slot_start", "from_time", "booking_start", "starts_at"]) ||
    "Not specified";
  const endTime =
    firstNonEmptyValue(row, ["end_time", "slot_end", "to_time", "booking_end", "ends_at"]) ||
    "Not specified";

  return {
    summary: `${venueId} (${startTime} - ${endTime})`,
    fields: [
      { label: "Venue ID", value: venueId },
      { label: "Start Time", value: startTime },
      { label: "End Time", value: endTime },
    ],
  };
}

function mapItContext(rows: Array<Record<string, unknown>>) {
  const equipmentCounts = new Map<string, number>();

  rows.forEach((row) => {
    const equipmentName =
      firstNonEmptyValue(row, ["resource_name", "item_name", "name", "title", "resource_type", "category"]) ||
      "Equipment";
    const quantityRaw =
      firstNonEmptyValue(row, ["quantity", "qty", "count", "units_requested", "requested_quantity"]);
    const quantity = Math.max(toNumber(quantityRaw), 1);

    equipmentCounts.set(equipmentName, (equipmentCounts.get(equipmentName) || 0) + quantity);
  });

  const parts = Array.from(equipmentCounts.entries()).map(
    ([name, quantity]) => `${quantity} ${name}`
  );
  const equipmentList = parts.length > 0 ? parts.join(", ") : "No equipment listed";

  return {
    summary: equipmentList,
    fields: [{ label: "Equipment List", value: equipmentList }],
  };
}

function mapCateringContext(rows: Array<Record<string, unknown>>) {
  const menuNotes = Array.from(
    new Set(
      rows
        .map((row) =>
          firstNonEmptyValue(row, [
            "menu_requirements",
            "menu",
            "meal_plan",
            "requirements",
            "food_requirements",
            "notes",
          ])
        )
        .filter((value) => value.length > 0)
    )
  );

  const totalHeadcount = rows.reduce((total, row) => {
    const countText = firstNonEmptyValue(row, [
      "total_headcount",
      "headcount",
      "expected_headcount",
      "participants_count",
      "count",
    ]);
    return total + Math.max(toNumber(countText), 0);
  }, 0);

  const menuSummary = menuNotes.length > 0 ? menuNotes.join(" | ") : "Menu not provided";
  const headcountSummary = totalHeadcount > 0 ? String(totalHeadcount) : "Not specified";

  return {
    summary: `${menuSummary} (Headcount: ${headcountSummary})`,
    fields: [
      { label: "Menu Requirements", value: menuSummary },
      { label: "Total Headcount", value: headcountSummary },
    ],
  };
}

function mapStallsContext(
  eventRow: Record<string, unknown> | null,
  stallsRows: Array<Record<string, unknown>>
) {
  const stallCount =
    firstNonEmptyValue(eventRow, [
      "stall_count",
      "stalls_count",
      "required_stall_count",
      "number_of_stalls",
    ]) ||
    firstNonEmptyValue(stallsRows[0], ["stall_count", "count", "number_of_stalls", "required_stalls"]) ||
    "Not specified";

  const setupLocation =
    firstNonEmptyValue(eventRow, [
      "stall_setup_location",
      "setup_location",
      "stall_location",
      "stalls_location",
      "venue",
    ]) ||
    firstNonEmptyValue(stallsRows[0], ["setup_location", "stall_location", "location", "venue"]) ||
    "Not specified";

  return {
    summary: `${stallCount} stalls at ${setupLocation}`,
    fields: [
      { label: "Stall Count", value: stallCount },
      { label: "Setup Location", value: setupLocation },
    ],
  };
}

function resolveEventIdFromRequestRow(requestRow: Record<string, unknown>): string {
  return normalizeText(requestRow.event_id) || normalizeText(requestRow.entity_ref);
}

function buildContextForService(params: {
  service: LogisticsServiceKey;
  eventRow: Record<string, unknown> | null;
  serviceRowsByEventId: Map<string, Array<Record<string, unknown>>>;
  eventId: string;
}) {
  const { service, eventRow, serviceRowsByEventId, eventId } = params;
  const serviceRows = serviceRowsByEventId.get(eventId) || [];

  if (service === "venue") {
    return mapVenueContext(serviceRows);
  }

  if (service === "it") {
    return mapItContext(serviceRows);
  }

  if (service === "catering") {
    return mapCateringContext(serviceRows);
  }

  return mapStallsContext(eventRow, serviceRows);
}

function isClosedDecisionStatus(status: string): boolean {
  const normalized = normalizeLower(status);
  return (
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "revision_requested" ||
    normalized === "returned_for_revision"
  );
}

async function getEventRowById(client: any, eventId: string) {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load event ${eventId}: ${error.message}`);
  }

  return (data as Record<string, unknown> | null) || null;
}

function eventRequiresStalls(eventRow: Record<string, unknown> | null): boolean {
  return firstTruthyBoolean(eventRow, [
    "requires_stalls",
    "stalls_required",
    "needs_stalls",
    "has_stalls",
    "request_stalls",
  ]);
}

function resolveDecisionStatus(action: LogisticsDecisionAction): string {
  if (action === "approve") {
    return "approved";
  }

  if (action === "return") {
    return "revision_requested";
  }

  return "rejected";
}

function normalizeDecisionNote(action: LogisticsDecisionAction, note: string): string | null {
  if (!note) {
    return null;
  }

  if (action === "return") {
    return `RETURN_FOR_REVISION: ${note}`;
  }

  return note;
}

function canTriggerLogisticsGeneration(
  profile: Record<string, unknown>,
  isMasterAdmin: boolean
): boolean {
  if (isMasterAdmin) {
    return true;
  }

  if (hasAnyRoleCode(profile, ["ACCOUNTS", "FINANCE_OFFICER", "CFO", "ORGANIZER"])) {
    return true;
  }

  const role = normalizeUniversityRole(profile.university_role);
  return (
    role === "accounts" ||
    role === "finance_officer" ||
    role === "cfo" ||
    role === "organizer" ||
    role === "organizer_teacher"
  );
}

function computeRequestedServiceFlags(params: {
  hasVenueRows: boolean;
  hasItRows: boolean;
  hasCateringRows: boolean;
  hasStallsRows: boolean;
}) {
  return {
    L5_VENUE: params.hasVenueRows,
    L5_IT: params.hasItRows,
    L5_CATERING: params.hasCateringRows,
    L5_STALLS: params.hasStallsRows,
  } as const;
}

export async function triggerLogisticsApprovals(eventIdInput: string): Promise<LogisticsTriggerResult> {
  // This action is called when an event enters logistics phase after L4 approval.
  // It reads the real service-demand source tables and creates only the needed L5 approvals.
  const eventId = normalizeText(eventIdInput);
  if (!eventId) {
    return {
      ok: false,
      message: "Event id is required.",
      eventId: "",
      generatedLevels: [],
      skippedLevels: [],
    };
  }

  const authContext = await resolveLogisticsAuthContext();
  if (!authContext.ok || !authContext.profile) {
    return {
      ok: false,
      message: authContext.message || "Authentication required.",
      eventId,
      generatedLevels: [],
      skippedLevels: [],
    };
  }

  if (!canTriggerLogisticsGeneration(authContext.profile, authContext.isMasterAdmin)) {
    return {
      ok: false,
      message: "Only Organizer Teachers, Accounts/Finance/CFO, or Master Admin can trigger logistics approvals.",
      eventId,
      generatedLevels: [],
      skippedLevels: [],
    };
  }

  const adminClient = authContext.adminClient;
  const eventRow = await getEventRowById(adminClient, eventId);
  if (!eventRow) {
    return {
      ok: false,
      message: `Event ${eventId} was not found.`,
      eventId,
      generatedLevels: [],
      skippedLevels: [],
    };
  }

  // Primary service detection: read from events.additional_requests JSON.
  // The event form stores service selections as { it: { enabled }, venue: { enabled }, catering: { enabled }, stalls: { enabled } }.
  // Fall back to dedicated service tables for backwards compatibility.
  const additionalRequests = parseAdditionalRequests(eventRow.additional_requests);
  const arIt = (additionalRequests.it as Record<string, unknown> | null | undefined) || {};
  const arVenue = (additionalRequests.venue as Record<string, unknown> | null | undefined) || {};
  const arCatering = (additionalRequests.catering as Record<string, unknown> | null | undefined) || {};
  const arStalls = (additionalRequests.stalls as Record<string, unknown> | null | undefined) || {};

  const hasItFromAr = toBoolean(arIt.enabled);
  const hasVenueFromAr = toBoolean(arVenue.enabled);
  const hasCateringFromAr = toBoolean(arCatering.enabled);
  const hasStallsFromAr = toBoolean(arStalls.enabled);

  // Secondary check: dedicated service tables (legacy / integration path).
  const [hasVenueRows, hasItRows, hasCateringRows, hasStallsRowsFromTable] = await Promise.all([
    hasVenueFromAr ? Promise.resolve(true) : hasRowsForEvent(adminClient, "venue_bookings", eventId),
    hasItFromAr ? Promise.resolve(true) : hasRowsForEvent(adminClient, "event_resources", eventId),
    hasCateringFromAr ? Promise.resolve(true) : hasRowsForEvent(adminClient, "catering_plans", eventId),
    hasStallsFromAr ? Promise.resolve(true) : hasRowsForEventAcrossTables(adminClient, ["stall_requests", "stall_plans", "stalls_requests"], eventId),
  ]);

  const hasStallsRows = hasStallsFromAr || eventRequiresStalls(eventRow) || hasStallsRowsFromTable;
  const requestedFlags = computeRequestedServiceFlags({
    hasVenueRows,
    hasItRows,
    hasCateringRows,
    hasStallsRows,
  });

  const { data: existingRowsData, error: existingRowsError } = await adminClient
    .from("approval_requests")
    .select("approval_level,status")
    .eq("event_id", eventId)
    .in("approval_level", ALL_LOGISTICS_LEVELS);

  if (existingRowsError) {
    return {
      ok: false,
      message: `Failed to inspect existing logistics approvals: ${existingRowsError.message}`,
      eventId,
      generatedLevels: [],
      skippedLevels: [],
    };
  }

  const existingRows = compactObjectRows(existingRowsData);
  const activeByLevel = new Map<string, boolean>();

  existingRows.forEach((row) => {
    const level = normalizeText(row.approval_level).toUpperCase();
    const status = normalizeLower(row.status);
    if (!level) {
      return;
    }

    if (status === "pending" || status === "under_review" || status === "approved") {
      activeByLevel.set(level, true);
    }
  });

  const nowIso = new Date().toISOString();
  const organizerEmail =
    firstNonEmptyValue(eventRow, ["organizer_email", "organiser_email", "requested_by_email"]) ||
    normalizeText(authContext.user?.email);

  const department = firstNonEmptyValue(eventRow, ["department", "dept"]);
  const school = firstNonEmptyValue(eventRow, ["organizing_school", "school"]);
  const campus = firstNonEmptyValue(eventRow, ["campus_hosted_at", "campus"]);

  const rowsToInsert: Array<Record<string, unknown>> = [];
  const generatedLevels: string[] = [];
  const skippedLevels: string[] = [];

  Object.values(LOGISTICS_SERVICE_CONFIG).forEach((serviceConfig) => {
    const level = serviceConfig.approvalLevel;
    const isRequested = requestedFlags[level as keyof typeof requestedFlags];

    if (!isRequested) {
      skippedLevels.push(level);
      return;
    }

    if (activeByLevel.get(level.toUpperCase())) {
      skippedLevels.push(level);
      return;
    }

    rowsToInsert.push({
      request_id: buildEventRequestId(eventId, level),
      entity_type: "EVENT",
      entity_ref: eventId,
      event_id: eventId,
      approval_level: level,
      status: "pending",
      requested_by_email: organizerEmail || null,
      organizing_school: school || null,
      campus_hosted_at: campus || null,
      is_budget_related: false,
      submitted_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
      latest_comment: `Auto-generated logistics approval for ${serviceConfig.label}.`,
    });

    generatedLevels.push(level);
  });

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await adminClient.from("approval_requests").insert(rowsToInsert);
    if (insertError) {
      return {
        ok: false,
        message: `Failed to create logistics approvals: ${insertError.message}`,
        eventId,
        generatedLevels: [],
        skippedLevels,
      };
    }

    await adminClient
      .from("events")
      .update({
        workflow_phase: "logistics_approval",
        workflow_status: "pending_logistics",
        status: "draft",
        is_draft: true,
        updated_at: nowIso,
      })
      .eq("event_id", eventId);
  }

  revalidatePath("/manage/it");
  revalidatePath("/manage/venue");
  revalidatePath("/manage/catering");
  revalidatePath("/manage/stalls");
  revalidatePath("/manage/finance");

  return {
    ok: true,
    message:
      rowsToInsert.length > 0
        ? `Generated ${rowsToInsert.length} logistics approval request(s).`
        : "No new logistics approvals needed for this event.",
    eventId,
    generatedLevels,
    skippedLevels,
  };
}

export async function fetchLogisticsDashboardData(
  service: LogisticsServiceKey
): Promise<LogisticsDashboardData> {
  const config = LOGISTICS_SERVICE_CONFIG[service];
  const authContext = await resolveLogisticsAuthContext();

  if (!authContext.ok || !authContext.profile) {
    throw new Error(authContext.message || "Authentication required.");
  }

  if (!hasServiceAccess(authContext.profile, authContext.isMasterAdmin, service)) {
    throw new Error("You do not have access to this dashboard.");
  }

  const client = authContext.adminClient;

  // Phase 2 queue source: approval_requests filtered by approval_level + pending status.
  const { data: requestRowsData, error: requestRowsError } = await client
    .from("approval_requests")
    .select(
      "id,request_id,event_id,entity_ref,approval_level,status,submitted_at,created_at,requested_by_email,organizing_school,campus_hosted_at"
    )
    .eq("approval_level", config.approvalLevel)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (requestRowsError) {
    throw new Error(`Failed to load ${config.label} queue: ${requestRowsError.message}`);
  }

  const requestRows = compactObjectRows(requestRowsData);
  const eventIds = Array.from(
    new Set(
      requestRows
        .map((row) => resolveEventIdFromRequestRow(row))
        .filter((id) => id.length > 0)
    )
  );

  let eventRowsById = new Map<string, Record<string, unknown>>();
  if (eventIds.length > 0) {
    const { data: eventRowsData, error: eventRowsError } = await client
      .from("events")
      .select("*")
      .in("event_id", eventIds);

    if (eventRowsError) {
      throw new Error(`Failed to load event context for ${config.label}: ${eventRowsError.message}`);
    }

    const eventRows = compactObjectRows(eventRowsData);
    eventRowsById = new Map(
      eventRows
        .map((row) => [normalizeText(row.event_id), row] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
  }

  let serviceRows: Array<Record<string, unknown>> = [];
  if (service === "venue") {
    serviceRows = await fetchRowsByEventIds(client, "venue_bookings", eventIds);
  } else if (service === "it") {
    serviceRows = await fetchRowsByEventIds(client, "event_resources", eventIds);
  } else if (service === "catering") {
    serviceRows = await fetchRowsByEventIds(client, "catering_plans", eventIds);
  } else {
    const rowsFromStallRequests = await fetchRowsByEventIds(client, "stall_requests", eventIds);
    if (rowsFromStallRequests.length > 0) {
      serviceRows = rowsFromStallRequests;
    } else {
      serviceRows = await fetchRowsByEventIds(client, "stall_plans", eventIds);
    }
  }

  const serviceRowsByEventId = groupRowsByEventId(serviceRows);

  const queue: LogisticsQueueItem[] = requestRows
    .map((requestRow) => {
      const eventId = resolveEventIdFromRequestRow(requestRow);
      if (!eventId) {
        return null;
      }

      const eventRow = eventRowsById.get(eventId) || null;
      const context = buildContextForService({
        service,
        eventRow,
        serviceRowsByEventId,
        eventId,
      });

      return {
        approvalRequestDbId: normalizeText(requestRow.id),
        requestId: normalizeText(requestRow.request_id) || normalizeText(requestRow.id),
        eventId,
        eventTitle:
          firstNonEmptyValue(eventRow, ["title", "event_name", "name"]) || `Event ${eventId}`,
        requestedByEmail: normalizeText(requestRow.requested_by_email) || null,
        submittedAt: normalizeText(requestRow.submitted_at || requestRow.created_at) || null,
        departmentName:
          firstNonEmptyValue(eventRow, ["department"]) ||
          null,
        schoolName:
          firstNonEmptyValue(eventRow, ["organizing_school", "school"]) ||
          normalizeText(requestRow.organizing_school) ||
          null,
        campusName:
          firstNonEmptyValue(eventRow, ["campus_hosted_at", "campus"]) ||
          normalizeText(requestRow.campus_hosted_at) ||
          null,
        contextSummary: context.summary,
        contextFields: context.fields,
      } satisfies LogisticsQueueItem;
    })
    .filter((item): item is LogisticsQueueItem => Boolean(item));

  return {
    service,
    serviceLabel: config.label,
    approvalLevel: config.approvalLevel,
    queue,
  };
}

export async function checkFinalApproval(eventIdInput: string): Promise<{
  ok: boolean;
  allApproved: boolean;
  message: string;
}> {
  // Phase 4 finalizer: if all generated L5 requests are approved, promote event to published.
  const eventId = normalizeText(eventIdInput);
  if (!eventId) {
    return {
      ok: false,
      allApproved: false,
      message: "Event id is required.",
    };
  }

  const authContext = await resolveLogisticsAuthContext();
  if (!authContext.ok) {
    return {
      ok: false,
      allApproved: false,
      message: authContext.message || "Authentication required.",
    };
  }

  const client = authContext.adminClient;

  const { data: rowsData, error: rowsError } = await client
    .from("approval_requests")
    .select("id,status,approval_level")
    .eq("event_id", eventId)
    .in("approval_level", ALL_LOGISTICS_LEVELS);

  if (rowsError) {
    return {
      ok: false,
      allApproved: false,
      message: `Failed to evaluate logistics approvals: ${rowsError.message}`,
    };
  }

  const rows = compactObjectRows(rowsData);
  if (rows.length === 0) {
    return {
      ok: true,
      allApproved: false,
      message: "No generated logistics approvals were found for this event.",
    };
  }

  const allApproved = rows.every((row) => normalizeLower(row.status) === "approved");
  if (!allApproved) {
    return {
      ok: true,
      allApproved: false,
      message: "Logistics approvals are still pending.",
    };
  }

  const nowIso = new Date().toISOString();
  const { error: eventUpdateError } = await client
    .from("events")
    .update({
      workflow_phase: "approved",
      workflow_status: "fully_approved",
      status: "published",
      is_draft: false,
      service_approval_state: "APPROVED",
      activation_state: "ACTIVE",
      updated_at: nowIso,
    })
    .eq("event_id", eventId);

  if (eventUpdateError) {
    return {
      ok: false,
      allApproved: false,
      message: `Failed to finalize event state: ${eventUpdateError.message}`,
    };
  }

  revalidatePath("/manage/it");
  revalidatePath("/manage/venue");
  revalidatePath("/manage/catering");
  revalidatePath("/manage/stalls");
  revalidatePath("/manage");

  return {
    ok: true,
    allApproved: true,
    message: "All logistics approvals are complete. Event is now published.",
  };
}

export async function submitLogisticsDecisionAction(input: {
  service: LogisticsServiceKey;
  requestId: string;
  action: LogisticsDecisionAction;
  note?: string;
}): Promise<LogisticsActionResult> {
  const service = input.service;
  const config = LOGISTICS_SERVICE_CONFIG[service];
  const requestId = normalizeText(input.requestId);
  const note = normalizeText(input.note);

  if (!requestId) {
    return { ok: false, message: "Approval request id is required." };
  }

  if (input.action !== "approve" && input.action !== "reject" && input.action !== "return") {
    return { ok: false, message: "Invalid action. Use approve, reject, or return." };
  }

  if ((input.action === "reject" || input.action === "return") && note.length < 20) {
    return {
      ok: false,
      message: "Reject/Return note must be at least 20 characters.",
    };
  }

  const authContext = await resolveLogisticsAuthContext();
  if (!authContext.ok || !authContext.profile) {
    return {
      ok: false,
      message: authContext.message || "Authentication required.",
    };
  }

  if (!hasServiceAccess(authContext.profile, authContext.isMasterAdmin, service)) {
    return {
      ok: false,
      message: `Only ${config.label} service users or Master Admin can perform this action.`,
    };
  }

  const client = authContext.adminClient;

  const { data: requestRowData, error: requestRowError } = await client
    .from("approval_requests")
    .select("id,event_id,entity_ref,approval_level,status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestRowError) {
    return {
      ok: false,
      message: `Failed to load approval request: ${requestRowError.message}`,
    };
  }

  const requestRow = (requestRowData as Record<string, unknown> | null) || null;
  if (!requestRow) {
    return { ok: false, message: "Approval request not found." };
  }

  const approvalLevel = normalizeText(requestRow.approval_level).toUpperCase();
  if (approvalLevel !== config.approvalLevel) {
    return {
      ok: false,
      message: `This request does not belong to the ${config.label} queue.`,
    };
  }

  const currentStatus = normalizeText(requestRow.status);
  if (!currentStatus || isClosedDecisionStatus(currentStatus)) {
    return {
      ok: false,
      message: "This request is no longer pending.",
    };
  }

  const nextStatus = resolveDecisionStatus(input.action);
  const nowIso = new Date().toISOString();
  const latestComment = normalizeDecisionNote(input.action, note);

  const { error: updateError } = await client
    .from("approval_requests")
    .update({
      status: nextStatus,
      decided_at: nowIso,
      latest_comment: latestComment,
      updated_at: nowIso,
    })
    .eq("id", requestId);

  if (updateError) {
    return {
      ok: false,
      message: `Failed to update request status: ${updateError.message}`,
    };
  }

  const eventId = resolveEventIdFromRequestRow(requestRow);

  let finalApprovalReached = false;
  if (input.action === "approve" && eventId) {
    const finalCheck = await checkFinalApproval(eventId);
    finalApprovalReached = finalCheck.ok && finalCheck.allApproved;
  }

  revalidatePath(config.dashboardPath);

  return {
    ok: true,
    message:
      input.action === "approve"
        ? finalApprovalReached
          ? `${config.label} request approved. Event has been finalized and published.`
          : `${config.label} request approved successfully.`
        : input.action === "return"
        ? `${config.label} request returned for revision.`
        : `${config.label} request rejected successfully.`,
    finalApprovalReached,
  };
}

export async function submitLogisticsDecisionFormAction(
  service: LogisticsServiceKey,
  formData: FormData
): Promise<void> {
  const requestId = normalizeText(formData.get("requestId"));
  const actionValue = normalizeText(formData.get("action")).toLowerCase();
  const note = normalizeText(formData.get("note"));

  const action: LogisticsDecisionAction =
    actionValue === "approve" || actionValue === "reject" || actionValue === "return"
      ? (actionValue as LogisticsDecisionAction)
      : "approve";

  const result = await submitLogisticsDecisionAction({
    service,
    requestId,
    action,
    note,
  });

  if (!result.ok) {
    throw new Error(result.message || "Unable to submit logistics decision.");
  }
}
