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
