"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type {
  DeleteUserActionResult,
  DepartmentOption,
  RolesAnalytics,
  RolesPageData,
  SchoolOption,
  UpdateUserAccessActionResult,
  UserAccessPayload,
  UserRoleRow,
  VenueOption,
} from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CAMPUS_OPTIONS = [
  "Central Campus (Main)",
  "Bannerghatta Road Campus",
  "Yeshwanthpur Campus",
  "Kengeri Campus",
  "Delhi NCR Campus",
  "Pune Lavasa Campus",
];

const USER_SELECT_COLUMNS = [
  "id",
  "name",
  "email",
  "created_at",
  "is_organiser",
  "is_support",
  "is_masteradmin",
  "is_hod",
  "is_dean",
  "is_cfo",
  "is_finance_officer",
  "is_volunteer",
  "is_venue_manager",
  "department_id",
  "school_id",
  "campus",
  "venue_id",
  "university_role",
];

const ROLE_CODE_MASTER_ADMIN = "MASTER_ADMIN";
const ROLE_CODE_ORGANIZER_TEACHER = "ORGANIZER_TEACHER";
const ROLE_CODE_ORGANIZER_VOLUNTEER = "ORGANIZER_VOLUNTEER";
const ROLE_CODE_FINANCE_OFFICER = "FINANCE_OFFICER";
const ROLE_CODE_SERVICE_VENUE = "SERVICE_VENUE";

type UniversityRoleKey =
  | "masteradmin"
  | "hod"
  | "dean"
  | "cfo"
  | "finance_officer"
  | "venue_manager"
  | null;

type AssignmentFallback = {
  is_volunteer: boolean;
  is_venue_manager: boolean;
  venue_id: string | null;
};

function ensureEnvVars() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing for role management.");
  }
}

function normalizeNullableText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function coerceUserId(userId: string | number): string | number {
  if (typeof userId === "number") {
    return userId;
  }
  const trimmed = userId.trim();
  if (/^\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }
  }
  return trimmed;
}

function sameUserId(left: string | number, right: string | number): boolean {
  return String(left) === String(right);
}

function normalizeUniversityRole(value: unknown): UniversityRoleKey {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "masteradmin" ||
    normalized === "hod" ||
    normalized === "dean" ||
    normalized === "cfo" ||
    normalized === "finance_officer" ||
    normalized === "venue_manager"
  ) {
    return normalized as UniversityRoleKey;
  }
  return null;
}

function parseMissingColumnName(error: { message?: string | null; details?: string | null }): string | null {
  const text = `${error?.message || ""} ${error?.details || ""}`;
  const directMatch = text.match(/column\s+([\w."']+)\s+does not exist/i);
  if (directMatch?.[1]) {
    const cleaned = directMatch[1].replace(/['"]/g, "");
    return cleaned.split(".").pop()?.toLowerCase() || null;
  }
  const schemaCacheMatch = text.match(/could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1].toLowerCase();
  }
  return null;
}

function isMissingColumnError(error: { message?: string | null; details?: string | null }): boolean {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    text.includes("column") &&
    (text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find"))
  );
}

function isMissingRelationError(error: { message?: string | null; details?: string | null }): boolean {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return text.includes("relation") && text.includes("does not exist");
}

function normalizeRoleCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function isRoleAssignmentActive(assignment: any, nowDate = new Date()): boolean {
  if (!assignment || assignment.is_active === false) {
    return false;
  }

  const now = nowDate.getTime();
  const validFrom = assignment.valid_from ? new Date(assignment.valid_from).getTime() : null;
  const validUntil = assignment.valid_until ? new Date(assignment.valid_until).getTime() : null;

  if (Number.isFinite(validFrom) && Number(validFrom) > now) {
    return false;
  }

  if (Number.isFinite(validUntil) && Number(validUntil) <= now) {
    return false;
  }

  return true;
}

function normalizeAccessPayload(input: UserAccessPayload): UserAccessPayload {
  return {
    is_organiser: Boolean(input?.is_organiser),
    is_volunteer: Boolean(input?.is_volunteer),
    is_venue_manager: Boolean(input?.is_venue_manager),
    is_hod: Boolean(input?.is_hod),
    is_dean: Boolean(input?.is_dean),
    is_cfo: Boolean(input?.is_cfo),
    is_finance_officer: Boolean(input?.is_finance_officer),
    is_masteradmin: Boolean(input?.is_masteradmin),
    department_id: normalizeNullableText(input?.department_id),
    school_id: normalizeNullableText(input?.school_id),
    campus: normalizeNullableText(input?.campus),
    venue_id: normalizeNullableText(input?.venue_id),
  };
}

function normalizeUserRecord(row: any, fallback?: AssignmentFallback): UserRoleRow {
  const role = normalizeUniversityRole(row?.university_role);

  const isHod = Boolean(row?.is_hod) || role === "hod";
  const isDean = Boolean(row?.is_dean) || role === "dean";
  const isCfo = Boolean(row?.is_cfo) || role === "cfo";
  const isFinance = Boolean(row?.is_finance_officer) || role === "finance_officer";

  const isVolunteer =
    (typeof row?.is_volunteer === "boolean" ? row.is_volunteer : Boolean(row?.is_support)) ||
    Boolean(fallback?.is_volunteer);

  const isVenueManager =
    (typeof row?.is_venue_manager === "boolean" ? row.is_venue_manager : false) ||
    role === "venue_manager" ||
    Boolean(fallback?.is_venue_manager);

  const departmentId = isHod ? normalizeNullableText(row?.department_id) : null;
  const schoolId = isDean ? normalizeNullableText(row?.school_id) : null;
  const campus = isCfo ? normalizeNullableText(row?.campus) : null;
  const venueId = isVenueManager
    ? normalizeNullableText(row?.venue_id) || fallback?.venue_id || null
    : null;

  const access: UserAccessPayload = {
    is_organiser: Boolean(row?.is_organiser),
    is_volunteer: isVolunteer,
    is_venue_manager: isVenueManager,
    is_hod: isHod,
    is_dean: isDean,
    is_cfo: isCfo,
    is_finance_officer: isFinance,
    is_masteradmin: Boolean(row?.is_masteradmin) || role === "masteradmin",
    department_id: departmentId,
    school_id: schoolId,
    campus,
    venue_id: venueId,
  };

  return {
    id: row?.id,
    name: row?.name ?? null,
    email: String(row?.email ?? ""),
    created_at: row?.created_at ?? null,
    department_id: access.department_id,
    school_id: access.school_id,
    campus: access.campus,
    venue_id: access.venue_id,
    university_role: normalizeNullableText(row?.university_role),
    access,
  };
}

async function createCookieSupabaseClient() {
  ensureEnvVars();
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookies can be read-only in some render contexts.
        }
      },
    },
  });
}

function createAdminSupabaseClient() {
  ensureEnvVars();

  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function assertMasterAdmin() {
  const cookieClient = await createCookieSupabaseClient();
  const adminClient = createAdminSupabaseClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await cookieClient.auth.getUser();

  if (authError || !authUser) {
    throw new Error("You must be signed in to manage user roles.");
  }

  const { data: byAuthUuid, error: byAuthUuidError } = await adminClient
    .from("users")
    .select("id,email,university_role,is_masteradmin")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  if (byAuthUuidError && !isMissingColumnError(byAuthUuidError)) {
    throw new Error(byAuthUuidError.message || "Failed to verify admin permissions.");
  }

  let actingUser = byAuthUuid;

  if (!actingUser && authUser.email) {
    const { data: byEmail, error: byEmailError } = await adminClient
      .from("users")
      .select("id,email,university_role,is_masteradmin")
      .eq("email", authUser.email)
      .maybeSingle();

    if (byEmailError) {
      throw new Error(byEmailError.message || "Failed to verify admin permissions.");
    }

    actingUser = byEmail;
  }

  if (!actingUser) {
    throw new Error("Unable to resolve your user profile for role checks.");
  }

  const actingRole = normalizeUniversityRole(actingUser.university_role);
  if (!Boolean(actingUser.is_masteradmin) && actingRole !== "masteradmin") {
    throw new Error("Master Admin privileges are required.");
  }

  return {
    adminClient,
    actingUser: {
      id: actingUser.id as string | number,
      email: String(actingUser.email || authUser.email || ""),
    },
  };
}
async function fetchRowsWithSelectFallback(adminClient: any, tableName: string, selectVariants: string[]) {
  for (const selectClause of selectVariants) {
    const { data, error } = await adminClient.from(tableName).select(selectClause);

    if (!error) {
      return data || [];
    }

    if (isMissingColumnError(error)) {
      continue;
    }

    if (isMissingRelationError(error)) {
      return [];
    }

    throw new Error(error.message || `Failed to query ${tableName}.`);
  }

  return [];
}

async function fetchUsersWithFallback(adminClient: any) {
  const columns = [...USER_SELECT_COLUMNS];

  while (columns.length > 0) {
    const { data, error } = await adminClient
      .from("users")
      .select(columns.join(","))
      .order("created_at", { ascending: false });

    if (!error) {
      return data || [];
    }

    const missingColumn = parseMissingColumnName(error);
    if (missingColumn && columns.includes(missingColumn)) {
      columns.splice(columns.indexOf(missingColumn), 1);
      continue;
    }

    throw new Error(error.message || "Failed to load users.");
  }

  throw new Error("Unable to load users because required role columns are missing.");
}

async function fetchSingleUserWithFallback(adminClient: any, userId: string | number) {
  const columns = [...USER_SELECT_COLUMNS];

  while (columns.length > 0) {
    const { data, error } = await adminClient
      .from("users")
      .select(columns.join(","))
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      return data;
    }

    const missingColumn = parseMissingColumnName(error);
    if (missingColumn && columns.includes(missingColumn)) {
      columns.splice(columns.indexOf(missingColumn), 1);
      continue;
    }

    throw new Error(error.message || "Failed to load updated user.");
  }

  return null;
}

async function fetchRoleAssignmentFallbacks(
  adminClient: any,
  userIds?: Array<string | number>
): Promise<Map<string, AssignmentFallback>> {
  const map = new Map<string, AssignmentFallback>();

  let query = adminClient
    .from("user_role_assignments")
    .select("user_id,role_code,department_scope,campus_scope,is_active,valid_from,valid_until")
    .in("role_code", [ROLE_CODE_ORGANIZER_VOLUNTEER, ROLE_CODE_SERVICE_VENUE]);

  if (userIds && userIds.length > 0) {
    query = query.in(
      "user_id",
      userIds.map((id) => String(id))
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      return map;
    }
    throw new Error(error.message || "Failed to load role assignment fallback.");
  }

  (data || []).forEach((row: any) => {
    if (!isRoleAssignmentActive(row)) {
      return;
    }

    const userId = String(row.user_id || "");
    if (!userId) {
      return;
    }

    if (!map.has(userId)) {
      map.set(userId, {
        is_volunteer: false,
        is_venue_manager: false,
        venue_id: null,
      });
    }

    const entry = map.get(userId)!;
    const roleCode = normalizeRoleCode(row.role_code);

    if (roleCode === ROLE_CODE_ORGANIZER_VOLUNTEER) {
      entry.is_volunteer = true;
    }

    if (roleCode === ROLE_CODE_SERVICE_VENUE) {
      entry.is_venue_manager = true;
      entry.venue_id =
        normalizeNullableText(row.department_scope) ||
        normalizeNullableText(row.campus_scope) ||
        entry.venue_id;
    }
  });

  return map;
}

async function syncRoleAssignment(
  adminClient: any,
  params: {
    userId: string | number;
    roleCode: string;
    enabled: boolean;
    assignedBy: string;
    departmentScope?: string | null;
  }
) {
  const nowIso = new Date().toISOString();

  const disableResult = await adminClient
    .from("user_role_assignments")
    .update({
      is_active: false,
      valid_until: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", params.userId)
    .eq("role_code", params.roleCode)
    .eq("is_active", true);

  if (disableResult.error) {
    if (isMissingRelationError(disableResult.error) || isMissingColumnError(disableResult.error)) {
      return;
    }
    throw new Error(disableResult.error.message || "Failed to disable role assignment.");
  }

  if (!params.enabled) {
    return;
  }

  const insertResult = await adminClient.from("user_role_assignments").insert({
    user_id: params.userId,
    role_code: params.roleCode,
    department_scope: normalizeNullableText(params.departmentScope),
    is_active: true,
    valid_from: nowIso,
    assigned_by: params.assignedBy,
    assigned_reason: "Master Admin role matrix update",
  });

  if (insertResult.error) {
    const message = String(insertResult.error.message || "").toLowerCase();
    if (
      isMissingRelationError(insertResult.error) ||
      isMissingColumnError(insertResult.error) ||
      message.includes("foreign key") ||
      message.includes("violates")
    ) {
      return;
    }

    throw new Error(insertResult.error.message || "Failed to create role assignment.");
  }
}

async function applyUsersUpdateWithFallback(
  adminClient: any,
  userId: string | number,
  updates: Record<string, unknown>
) {
  const payload = { ...updates };

  while (Object.keys(payload).length > 0) {
    const { error } = await adminClient.from("users").update(payload).eq("id", userId);
    if (!error) {
      return;
    }

    const missingColumn = parseMissingColumnName(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn];
      continue;
    }

    throw new Error(error.message || "Failed to update user access.");
  }

  throw new Error("User update payload did not contain writable columns.");
}

function buildVenueOptions(eventRows: any[], festRows: any[], usersRows: any[]): VenueOption[] {
  const map = new Map<string, VenueOption>();

  const addVenue = (rawVenue: unknown, rawCampus: unknown) => {
    const venue = normalizeNullableText(rawVenue);
    if (!venue) {
      return;
    }

    const key = venue.toLowerCase();
    const campus = normalizeNullableText(rawCampus);
    if (!map.has(key)) {
      map.set(key, {
        id: venue,
        name: venue,
        campus,
      });
      return;
    }

    const current = map.get(key)!;
    if (!current.campus && campus) {
      current.campus = campus;
    }
  };

  eventRows.forEach((row: any) => addVenue(row?.venue, row?.campus_hosted_at));
  festRows.forEach((row: any) => addVenue(row?.venue, row?.campus_hosted_at));
  usersRows.forEach((row: any) => addVenue(row?.venue_id, row?.campus));

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function toMonthBucket(value: unknown): string | null {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function toMonthLabel(bucket: string): string {
  const [yearPart, monthPart] = bucket.split("-");
  const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 1));
  if (Number.isNaN(date.getTime())) {
    return bucket;
  }

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function emptyAnalytics(): RolesAnalytics {
  return {
    totalEstimatedRevenue: 0,
    venueUtilizationRate: 0,
    averageApprovalSlaHours: 0,
    revenueByMonth: [],
    venueUsage: [],
    approvalSlaByMonth: [],
  };
}

async function buildRolesAnalytics(adminClient: any): Promise<RolesAnalytics> {
  try {
    const eventRows = await fetchRowsWithSelectFallback(adminClient, "events", [
      "event_id,event_date,registration_fee,total_participants,venue",
      "event_id,event_date,registration_fee,venue",
      "event_id,event_date,venue",
    ]);

    const registrationRows = await fetchRowsWithSelectFallback(adminClient, "registrations", ["event_id"]);

    const approvalRows = await fetchRowsWithSelectFallback(adminClient, "approval_requests", [
      "submitted_at,decided_at,status",
      "created_at,decided_at,status",
    ]);

    const registrationCountByEvent = new Map<string, number>();
    registrationRows.forEach((row: any) => {
      const eventId = normalizeNullableText(row?.event_id);
      if (!eventId) {
        return;
      }
      registrationCountByEvent.set(eventId, (registrationCountByEvent.get(eventId) || 0) + 1);
    });

    const revenueByMonth = new Map<string, number>();
    const venueCounts = new Map<string, number>();

    let totalRevenue = 0;
    let eventsWithVenue = 0;

    eventRows.forEach((row: any) => {
      const eventId = normalizeNullableText(row?.event_id);
      const monthBucket = toMonthBucket(row?.event_date);

      const registrationFee = Math.max(0, safeNumber(row?.registration_fee));
      const totalParticipants = Math.max(
        0,
        safeNumber(row?.total_participants) || (eventId ? registrationCountByEvent.get(eventId) || 0 : 0)
      );

      const revenue = registrationFee * totalParticipants;
      totalRevenue += revenue;

      if (monthBucket) {
        revenueByMonth.set(monthBucket, (revenueByMonth.get(monthBucket) || 0) + revenue);
      }

      const venue = normalizeNullableText(row?.venue);
      if (venue) {
        eventsWithVenue += 1;
        venueCounts.set(venue, (venueCounts.get(venue) || 0) + 1);
      }
    });

    const slaByMonthStats = new Map<string, { totalHours: number; samples: number }>();
    let totalSlaHours = 0;
    let totalSlaSamples = 0;

    approvalRows.forEach((row: any) => {
      const submittedValue = normalizeNullableText(row?.submitted_at) || normalizeNullableText(row?.created_at);
      const decidedValue = normalizeNullableText(row?.decided_at);
      if (!submittedValue || !decidedValue) {
        return;
      }

      const submitted = new Date(submittedValue).getTime();
      const decided = new Date(decidedValue).getTime();
      if (!Number.isFinite(submitted) || !Number.isFinite(decided) || decided < submitted) {
        return;
      }

      const hours = (decided - submitted) / (1000 * 60 * 60);
      totalSlaHours += hours;
      totalSlaSamples += 1;

      const monthBucket = toMonthBucket(submittedValue);
      if (!monthBucket) {
        return;
      }

      const existing = slaByMonthStats.get(monthBucket) || { totalHours: 0, samples: 0 };
      existing.totalHours += hours;
      existing.samples += 1;
      slaByMonthStats.set(monthBucket, existing);
    });

    const revenueByMonthData = Array.from(revenueByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => ({
        month: toMonthLabel(month),
        revenue: Number(revenue.toFixed(2)),
      }));

    const venueUsage = Array.from(venueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([venue, events]) => ({
        venue,
        events,
      }));

    const approvalSlaByMonth = Array.from(slaByMonthStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month: toMonthLabel(month),
        hours: Number((stats.totalHours / Math.max(stats.samples, 1)).toFixed(2)),
      }));

    return {
      totalEstimatedRevenue: Number(totalRevenue.toFixed(2)),
      venueUtilizationRate:
        eventRows.length > 0 ? Number(((eventsWithVenue / eventRows.length) * 100).toFixed(2)) : 0,
      averageApprovalSlaHours:
        totalSlaSamples > 0 ? Number((totalSlaHours / totalSlaSamples).toFixed(2)) : 0,
      revenueByMonth: revenueByMonthData,
      venueUsage,
      approvalSlaByMonth,
    };
  } catch {
    return emptyAnalytics();
  }
}

export async function getRolesTableData(): Promise<RolesPageData> {
  const { adminClient } = await assertMasterAdmin();

  const usersRows = await fetchUsersWithFallback(adminClient);
  const assignmentFallbackMap = await fetchRoleAssignmentFallbacks(
    adminClient,
    usersRows.map((row: any) => row.id)
  );

  const { data: departmentRows, error: departmentError } = await adminClient
    .from("departments_courses")
    .select("id,department_name,school")
    .order("department_name", { ascending: true });

  if (departmentError) {
    throw new Error(departmentError.message || "Failed to load departments.");
  }

  const departments: DepartmentOption[] = (departmentRows || []).map((row: any) => ({
    id: String(row.id),
    department_name: String(row.department_name || "Unnamed Department"),
    school: row.school ? String(row.school) : null,
  }));

  const schoolMap = new Map<string, SchoolOption>();
  departments.forEach((department) => {
    const schoolName = normalizeNullableText(department.school);
    if (!schoolName) {
      return;
    }

    if (!schoolMap.has(schoolName)) {
      schoolMap.set(schoolName, {
        id: schoolName,
        name: schoolName,
      });
    }
  });

  const eventVenueRows = await fetchRowsWithSelectFallback(adminClient, "events", [
    "venue,campus_hosted_at",
    "venue",
  ]);
  const festVenueRows = await fetchRowsWithSelectFallback(adminClient, "fests", [
    "venue,campus_hosted_at",
    "venue",
  ]);

  const venues = buildVenueOptions(eventVenueRows, festVenueRows, usersRows);

  const campusesSet = new Set<string>(CAMPUS_OPTIONS);
  usersRows.forEach((row: any) => {
    const campus = normalizeNullableText(row?.campus);
    if (campus) {
      campusesSet.add(campus);
    }
  });
  eventVenueRows.forEach((row: any) => {
    const campus = normalizeNullableText(row?.campus_hosted_at);
    if (campus) {
      campusesSet.add(campus);
    }
  });
  festVenueRows.forEach((row: any) => {
    const campus = normalizeNullableText(row?.campus_hosted_at);
    if (campus) {
      campusesSet.add(campus);
    }
  });

  return {
    users: usersRows.map((row: any) => normalizeUserRecord(row, assignmentFallbackMap.get(String(row.id)))),
    departments,
    schools: Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    campuses: Array.from(campusesSet.values()).sort((a, b) => a.localeCompare(b)),
    venues,
    analytics: await buildRolesAnalytics(adminClient),
  };
}
export async function updateUserAccess(
  userId: string | number,
  rolePayload: UserAccessPayload
): Promise<UpdateUserAccessActionResult> {
  try {
    const { adminClient, actingUser } = await assertMasterAdmin();
    const targetUserId = coerceUserId(userId);
    const payload = normalizeAccessPayload(rolePayload);

    const enabledDomainRoleCount = [payload.is_hod, payload.is_dean, payload.is_cfo, payload.is_venue_manager].filter(
      Boolean
    ).length;

    if (enabledDomainRoleCount > 1) {
      return {
        ok: false,
        error: "HOD, Dean, CFO, and Venue Manager are mutually exclusive domain roles.",
      };
    }

    if (payload.is_hod && !payload.department_id) {
      return { ok: false, error: "Select a department before enabling HOD." };
    }
    if (payload.is_dean && !payload.school_id) {
      return { ok: false, error: "Select a school before enabling Dean." };
    }
    if (payload.is_cfo && !payload.campus) {
      return { ok: false, error: "Select a campus before enabling CFO." };
    }
    if (payload.is_cfo && payload.campus && !CAMPUS_OPTIONS.includes(payload.campus)) {
      return { ok: false, error: "Invalid campus selection." };
    }
    if (payload.is_venue_manager && !payload.venue_id) {
      return { ok: false, error: "Select a venue before enabling Venue Manager." };
    }

    if (payload.is_hod) {
      const { data, error } = await adminClient
        .from("departments_courses")
        .select("id")
        .eq("id", payload.department_id)
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message || "Failed to validate department." };
      }
      if (!data) {
        return { ok: false, error: "Selected department does not exist." };
      }
    }

    if (payload.is_dean) {
      const { data, error } = await adminClient
        .from("departments_courses")
        .select("id")
        .eq("school", payload.school_id)
        .limit(1);
      if (error) {
        return { ok: false, error: error.message || "Failed to validate school." };
      }
      if (!Array.isArray(data) || data.length === 0) {
        return { ok: false, error: "Selected school does not exist." };
      }
    }

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id,email,is_masteradmin,university_role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (existingUserError) {
      return { ok: false, error: existingUserError.message || "Failed to find user." };
    }
    if (!existingUser) {
      return { ok: false, error: "User not found." };
    }

    const isExistingMasterAdmin =
      Boolean(existingUser.is_masteradmin) || normalizeUniversityRole(existingUser.university_role) === "masteradmin";

    if (isExistingMasterAdmin && !payload.is_masteradmin && sameUserId(existingUser.id, actingUser.id)) {
      return { ok: false, error: "You cannot remove your own Master Admin access." };
    }

    if (isExistingMasterAdmin && !payload.is_masteradmin) {
      const { count, error } = await adminClient
        .from("users")
        .select("id", { head: true, count: "exact" })
        .eq("is_masteradmin", true);

      if (error) {
        return { ok: false, error: error.message || "Failed to validate master admin count." };
      }
      if ((count || 0) <= 1) {
        return { ok: false, error: "Cannot remove the last Master Admin." };
      }
    }

    const strictDepartmentId = payload.is_hod ? payload.department_id : null;
    const strictSchoolId = payload.is_dean ? payload.school_id : null;
    const strictCampus = payload.is_cfo ? payload.campus : null;
    const strictVenueId = payload.is_venue_manager ? payload.venue_id : null;

    const nextUniversityRole: UniversityRoleKey = payload.is_hod
      ? "hod"
      : payload.is_dean
        ? "dean"
        : payload.is_cfo
          ? "cfo"
          : payload.is_venue_manager
            ? "venue_manager"
            : payload.is_finance_officer
              ? "finance_officer"
              : payload.is_masteradmin
                ? "masteradmin"
                : null;

    await applyUsersUpdateWithFallback(adminClient, targetUserId, {
      is_organiser: payload.is_organiser,
      is_support: payload.is_volunteer,
      is_masteradmin: payload.is_masteradmin,
      is_hod: payload.is_hod,
      is_dean: payload.is_dean,
      is_cfo: payload.is_cfo,
      is_finance_officer: payload.is_finance_officer,
      is_volunteer: payload.is_volunteer,
      is_venue_manager: payload.is_venue_manager,
      department_id: strictDepartmentId,
      school_id: strictSchoolId,
      campus: strictCampus,
      venue_id: strictVenueId,
      university_role: nextUniversityRole,
    });

    await Promise.all([
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_MASTER_ADMIN,
        enabled: payload.is_masteradmin,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_ORGANIZER_TEACHER,
        enabled: payload.is_organiser,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_ORGANIZER_VOLUNTEER,
        enabled: payload.is_volunteer,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_FINANCE_OFFICER,
        enabled: payload.is_finance_officer,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_SERVICE_VENUE,
        enabled: payload.is_venue_manager,
        assignedBy: actingUser.email,
        departmentScope: strictVenueId,
      }),
    ]);

    const [updatedRow, assignmentFallbackMap] = await Promise.all([
      fetchSingleUserWithFallback(adminClient, targetUserId),
      fetchRoleAssignmentFallbacks(adminClient, [targetUserId]),
    ]);

    if (!updatedRow) {
      return { ok: false, error: "User was updated but could not be reloaded." };
    }

    revalidatePath("/masteradmin");
    revalidatePath("/masteradmin/roles");
    revalidatePath("/manage");

    return {
      ok: true,
      user: normalizeUserRecord(updatedRow, assignmentFallbackMap.get(String(targetUserId))),
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Failed to update user access.",
    };
  }
}

export async function deleteUserAccount(
  userId: string | number
): Promise<DeleteUserActionResult> {
  try {
    const { adminClient, actingUser } = await assertMasterAdmin();
    const targetUserId = coerceUserId(userId);

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id,email,is_masteradmin,university_role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (existingUserError) {
      return {
        ok: false,
        error: existingUserError.message || "Failed to find user.",
      };
    }

    if (!existingUser) {
      return {
        ok: false,
        error: "User not found.",
      };
    }

    if (sameUserId(existingUser.id, actingUser.id)) {
      return {
        ok: false,
        error: "You cannot delete your own account.",
      };
    }

    const isExistingMasterAdmin =
      Boolean(existingUser.is_masteradmin) || normalizeUniversityRole(existingUser.university_role) === "masteradmin";

    if (isExistingMasterAdmin) {
      const { count, error: countError } = await adminClient
        .from("users")
        .select("id", { head: true, count: "exact" })
        .eq("is_masteradmin", true);

      if (countError) {
        return {
          ok: false,
          error: countError.message || "Failed to validate master admin count.",
        };
      }

      if ((count || 0) <= 1) {
        return {
          ok: false,
          error: "Cannot delete the last Master Admin.",
        };
      }
    }

    const { error: deleteError } = await adminClient.from("users").delete().eq("id", targetUserId);

    if (deleteError) {
      return {
        ok: false,
        error: deleteError.message || "Failed to delete user.",
      };
    }

    revalidatePath("/masteradmin");
    revalidatePath("/masteradmin/roles");

    return {
      ok: true,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Failed to delete user.",
    };
  }
}
