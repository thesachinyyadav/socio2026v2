"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type {
  AssignRoleMatrixActionResult,
  DeleteUserActionResult,
  DepartmentOption,
  RoleMatrixAssignableRole,
  RoleMatrixAssignPayload,
  RoleMatrixAssignment,
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

const PRIMARY_CAMPUS = "Central Campus (Main)";

const EXCLUDED_CAMPUS_VALUES = new Set([
  "unknown campus",
  "unknown",
  "not specified",
  "n/a",
  "na",
  "none",
]);

const FALLBACK_SCHOOL_NAMES = [
  "SCHOOL OF BUSINESS AND MANAGEMENT",
  "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY",
  "SCHOOL OF HUMANITIES AND PERFORMING ARTS",
  "SCHOOL OF LAW",
  "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK",
  "SCHOOL OF SCIENCES",
  "SCHOOL OF SOCIAL SCIENCES",
];

const FALLBACK_DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { id: "all_departments", department_name: "All Departments", school: null },
  {
    id: "dept_business_management_bba",
    department_name: "Department of Business and Management (BBA)",
    school: "SCHOOL OF BUSINESS AND MANAGEMENT",
  },
  {
    id: "dept_business_management_mba",
    department_name: "Department of Business and Management (MBA)",
    school: "SCHOOL OF BUSINESS AND MANAGEMENT",
  },
  {
    id: "dept_hotel_management",
    department_name: "Department of Hotel Management",
    school: "SCHOOL OF BUSINESS AND MANAGEMENT",
  },
  {
    id: "dept_commerce",
    department_name: "Department of Commerce",
    school: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY",
  },
  {
    id: "dept_professional_studies",
    department_name: "Department of Professional Studies",
    school: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY",
  },
  {
    id: "dept_english_cultural_studies",
    department_name: "Department of English and Cultural Studies",
    school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS",
  },
  {
    id: "dept_music",
    department_name: "Department of Music",
    school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS",
  },
  {
    id: "dept_performing_arts",
    department_name: "Department of Performing Arts",
    school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS",
  },
  {
    id: "dept_philosophy_theology",
    department_name: "Department of Philosophy and Theology",
    school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS",
  },
  {
    id: "dept_theatre_studies",
    department_name: "Department of Theatre Studies",
    school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS",
  },
  {
    id: "dept_school_of_law",
    department_name: "Department of School of Law",
    school: "SCHOOL OF LAW",
  },
  {
    id: "dept_psychology",
    department_name: "Department of Psychology",
    school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK",
  },
  {
    id: "dept_school_of_education",
    department_name: "Department of School of Education",
    school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK",
  },
  {
    id: "dept_social_work",
    department_name: "Department of Social Work",
    school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK",
  },
  {
    id: "dept_chemistry",
    department_name: "Department of Chemistry",
    school: "SCHOOL OF SCIENCES",
  },
  {
    id: "dept_computer_science",
    department_name: "Department of Computer Science",
    school: "SCHOOL OF SCIENCES",
  },
  {
    id: "dept_life_sciences",
    department_name: "Department of Life Sciences",
    school: "SCHOOL OF SCIENCES",
  },
  {
    id: "dept_mathematics",
    department_name: "Department of Mathematics",
    school: "SCHOOL OF SCIENCES",
  },
  {
    id: "dept_physics_electronics",
    department_name: "Department of Physics and Electronics",
    school: "SCHOOL OF SCIENCES",
  },
  {
    id: "dept_statistics_data_science",
    department_name: "Department of Statistics and Data Science",
    school: "SCHOOL OF SCIENCES",
  },
  {
    id: "dept_economics",
    department_name: "Department of Economics",
    school: "SCHOOL OF SOCIAL SCIENCES",
  },
  {
    id: "dept_international_studies_political_science_history",
    department_name: "Department of International Studies, Political Science and History",
    school: "SCHOOL OF SOCIAL SCIENCES",
  },
  {
    id: "dept_media_studies",
    department_name: "Department of Media Studies",
    school: "SCHOOL OF SOCIAL SCIENCES",
  },
];

const USER_SELECT_COLUMNS = [
  "id",
  "name",
  "email",
  "created_at",
  "is_organiser",
  "is_student_organiser",
  "is_student_organizer",
  "is_it_service",
  "is_it",
  "is_catering_vendors",
  "is_catering_vendor",
  "is_stalls_misc",
  "is_stall_misc",
  "is_stalls",
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
const ROLE_CODE_HOD = "HOD";
const ROLE_CODE_DEAN = "DEAN";
const ROLE_CODE_CFO = "CFO";
const ROLE_CODE_ORGANIZER_TEACHER = "ORGANIZER_TEACHER";
const ROLE_CODE_ORGANIZER_STUDENT = "ORGANIZER_STUDENT";
const ROLE_CODE_ORGANIZER_VOLUNTEER = "ORGANIZER_VOLUNTEER";
const ROLE_CODE_SUPPORT = "SUPPORT";
const ROLE_CODE_FINANCE_OFFICER = "FINANCE_OFFICER";
const ROLE_CODE_ACCOUNTS = "ACCOUNTS";
const ROLE_CODE_SERVICE_IT = "SERVICE_IT";
const ROLE_CODE_SERVICE_VENUE = "SERVICE_VENUE";
const ROLE_CODE_SERVICE_CATERING = "SERVICE_CATERING";
const ROLE_CODE_SERVICE_STALLS = "SERVICE_STALLS";

const ROLE_MATRIX_ROLE_TO_CODE: Record<RoleMatrixAssignableRole, string> = {
  hod: ROLE_CODE_HOD,
  dean: ROLE_CODE_DEAN,
  cfo: ROLE_CODE_CFO,
  organiser: ROLE_CODE_ORGANIZER_TEACHER,
  student_organiser: ROLE_CODE_ORGANIZER_STUDENT,
  volunteer: ROLE_CODE_ORGANIZER_VOLUNTEER,
  support: ROLE_CODE_SUPPORT,
  finance_officer: ROLE_CODE_FINANCE_OFFICER,
  master_admin: ROLE_CODE_MASTER_ADMIN,
  it_service: ROLE_CODE_SERVICE_IT,
  venue_service: ROLE_CODE_SERVICE_VENUE,
  catering_service: ROLE_CODE_SERVICE_CATERING,
  stalls_service: ROLE_CODE_SERVICE_STALLS,
};

const ROLE_MATRIX_ROLE_LABELS: Record<RoleMatrixAssignableRole, string> = {
  hod: "HOD",
  dean: "Dean",
  cfo: "CFO",
  organiser: "Organiser",
  student_organiser: "Student Organizer",
  volunteer: "Volunteer",
  support: "Support",
  finance_officer: "Finance Officer",
  master_admin: "Master Admin",
  it_service: "IT",
  venue_service: "Venue",
  catering_service: "Catering",
  stalls_service: "Stall",
};

const DOMAIN_EXCLUSIVE_MATRIX_ROLES = new Set<RoleMatrixAssignableRole>([
  "hod",
  "dean",
  "cfo",
  "venue_service",
]);

type UniversityRoleKey =
  | "masteradmin"
  | "hod"
  | "dean"
  | "cfo"
  | "finance_officer"
  | "venue_manager"
  | null;

type AssignmentFallback = {
  is_masteradmin: boolean;
  is_hod: boolean;
  is_dean: boolean;
  is_cfo: boolean;
  is_finance_officer: boolean;
  is_organiser: boolean;
  is_student_organiser: boolean;
  is_volunteer: boolean;
  is_support: boolean;
  is_venue_manager: boolean;
  is_it_service: boolean;
  is_catering_vendors: boolean;
  is_stalls_misc: boolean;
  department_id: string | null;
  school_id: string | null;
  campus: string | null;
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

function isExcludedCampusValue(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return EXCLUDED_CAMPUS_VALUES.has(value.trim().toLowerCase());
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

function isMissingRelationError(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): boolean {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (text.includes("relation") && text.includes("does not exist")) {
    return true;
  }

  if (text.includes("could not find the table") && text.includes("schema cache")) {
    return true;
  }

  if ((error?.code || "").toUpperCase() === "PGRST205") {
    return true;
  }

  return false;
}

function normalizeRoleCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function readBooleanFlag(record: any, keys: string[]): boolean {
  for (const key of keys) {
    const rawValue = record?.[key];
    if (typeof rawValue === "boolean") {
      return rawValue;
    }
    if (rawValue !== null && rawValue !== undefined) {
      return Boolean(rawValue);
    }
  }

  return false;
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
    is_student_organiser: Boolean(input?.is_student_organiser),
    is_volunteer: Boolean(input?.is_volunteer),
    is_support: Boolean(input?.is_support),
    is_venue_manager: Boolean(input?.is_venue_manager),
    is_it_service: Boolean(input?.is_it_service),
    is_catering_vendors: Boolean(input?.is_catering_vendors),
    is_stalls_misc: Boolean(input?.is_stalls_misc),
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

function deriveUniversityRoleFromAccess(access: UserAccessPayload): UniversityRoleKey {
  if (access.is_hod) {
    return "hod";
  }
  if (access.is_dean) {
    return "dean";
  }
  if (access.is_cfo) {
    return "cfo";
  }
  if (access.is_venue_manager) {
    return "venue_manager";
  }
  if (access.is_finance_officer) {
    return "finance_officer";
  }
  if (access.is_masteradmin) {
    return "masteradmin";
  }
  return null;
}

function isRoleMatrixAssignableRole(value: unknown): value is RoleMatrixAssignableRole {
  return typeof value === "string" && value in ROLE_MATRIX_ROLE_TO_CODE;
}

function readDetailCandidate(details: unknown, keys: string[]): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const detailRecord = details as Record<string, unknown>;
  for (const key of keys) {
    const candidate = normalizeNullableText(detailRecord[key]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function normalizeUserRecord(row: any, fallback?: AssignmentFallback): UserRoleRow {
  const role = normalizeUniversityRole(row?.university_role);

  const isHod = Boolean(row?.is_hod) || role === "hod" || Boolean(fallback?.is_hod);
  const isDean = Boolean(row?.is_dean) || role === "dean" || Boolean(fallback?.is_dean);
  const isCfo = Boolean(row?.is_cfo) || role === "cfo" || Boolean(fallback?.is_cfo);
  const isFinance =
    Boolean(row?.is_finance_officer) ||
    Boolean(row?.is_finance_office) ||
    role === "finance_officer" ||
    Boolean(fallback?.is_finance_officer);

  const isStudentOrganiser =
    readBooleanFlag(row, ["is_student_organiser", "is_student_organizer"]) ||
    Boolean(fallback?.is_student_organiser);

  const isVolunteer =
    (typeof row?.is_volunteer === "boolean" ? row.is_volunteer : false) ||
    Boolean(fallback?.is_volunteer);

  const isSupport = Boolean(row?.is_support) || Boolean(fallback?.is_support);

  const isVenueManager =
    (typeof row?.is_venue_manager === "boolean" ? row.is_venue_manager : false) ||
    role === "venue_manager" ||
    Boolean(fallback?.is_venue_manager);

  const isItService = readBooleanFlag(row, ["is_it_service", "is_it"]) || Boolean(fallback?.is_it_service);

  const isCateringVendors =
    readBooleanFlag(row, ["is_catering_vendors", "is_catering_vendor"]) ||
    Boolean(fallback?.is_catering_vendors);

  const isStallsMisc =
    readBooleanFlag(row, ["is_stalls_misc", "is_stall_misc", "is_stalls"]) ||
    Boolean(fallback?.is_stalls_misc);

  const departmentId = isHod
    ? normalizeNullableText(row?.department_id) || fallback?.department_id || null
    : null;
  const schoolId = isDean
    ? normalizeNullableText(row?.school_id) || fallback?.school_id || null
    : null;
  const campus = isCfo
    ? normalizeNullableText(row?.campus) || fallback?.campus || null
    : null;
  const venueId = isVenueManager
    ? normalizeNullableText(row?.venue_id) || fallback?.venue_id || null
    : null;

  const access: UserAccessPayload = {
    is_organiser: Boolean(row?.is_organiser) || Boolean(fallback?.is_organiser),
    is_student_organiser: isStudentOrganiser,
    is_volunteer: isVolunteer,
    is_support: isSupport,
    is_venue_manager: isVenueManager,
    is_it_service: isItService,
    is_catering_vendors: isCateringVendors,
    is_stalls_misc: isStallsMisc,
    is_hod: isHod,
    is_dean: isDean,
    is_cfo: isCfo,
    is_finance_officer: isFinance,
    is_masteradmin: Boolean(row?.is_masteradmin) || role === "masteradmin" || Boolean(fallback?.is_masteradmin),
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

  let actingUser = await fetchSingleUserByAuthUuidWithFallback(adminClient, authUser.id);

  if (!actingUser && authUser.email) {
    actingUser = await fetchSingleUserByEmailWithFallback(adminClient, authUser.email);
  }

  if (!actingUser) {
    throw new Error("Unable to resolve your user profile for role checks.");
  }

  const actingRole = normalizeUniversityRole(actingUser.university_role);
  const hasMasterAdminAssignment = await hasActiveRoleAssignment(
    adminClient,
    actingUser.id,
    [ROLE_CODE_MASTER_ADMIN]
  );

  if (!Boolean(actingUser.is_masteradmin) && actingRole !== "masteradmin" && !hasMasterAdminAssignment) {
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

async function hasActiveRoleAssignment(
  adminClient: any,
  userId: string | number,
  roleCodes: string[]
): Promise<boolean> {
  if (!roleCodes.length) {
    return false;
  }

  const { data, error } = await adminClient
    .from("user_role_assignments")
    .select("role_code,is_active,valid_from,valid_until")
    .eq("user_id", userId)
    .in("role_code", roleCodes.map((code) => normalizeRoleCode(code)));

  if (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      return false;
    }

    throw new Error(error.message || "Failed to verify role assignments.");
  }

  return (data || []).some((assignment: any) => isRoleAssignmentActive(assignment));
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

async function fetchSingleUserByEmailWithFallback(adminClient: any, email: string) {
  const columns = [...USER_SELECT_COLUMNS];

  while (columns.length > 0) {
    const { data, error } = await adminClient
      .from("users")
      .select(columns.join(","))
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data;
    }

    const missingColumn = parseMissingColumnName(error);
    if (missingColumn && columns.includes(missingColumn)) {
      columns.splice(columns.indexOf(missingColumn), 1);
      continue;
    }

    throw new Error(error.message || "Failed to load user by email.");
  }

  return null;
}

async function fetchSingleUserByAuthUuidWithFallback(adminClient: any, authUuid: string) {
  const columns = [...USER_SELECT_COLUMNS];

  while (columns.length > 0) {
    const { data, error } = await adminClient
      .from("users")
      .select(columns.join(","))
      .eq("auth_uuid", authUuid)
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data;
    }

    const missingColumn = parseMissingColumnName(error);
    if (missingColumn === "auth_uuid") {
      return null;
    }

    if (missingColumn && columns.includes(missingColumn)) {
      columns.splice(columns.indexOf(missingColumn), 1);
      continue;
    }

    throw new Error(error.message || "Failed to load user by auth UUID.");
  }

  return null;
}

function createEmptyAssignmentFallback(): AssignmentFallback {
  return {
    is_masteradmin: false,
    is_hod: false,
    is_dean: false,
    is_cfo: false,
    is_finance_officer: false,
    is_organiser: false,
    is_student_organiser: false,
    is_volunteer: false,
    is_support: false,
    is_venue_manager: false,
    is_it_service: false,
    is_catering_vendors: false,
    is_stalls_misc: false,
    department_id: null,
    school_id: null,
    campus: null,
    venue_id: null,
  };
}

function buildAssignmentFallbackMap(
  assignments: RoleMatrixAssignment[],
  userIds?: Array<string | number>
): Map<string, AssignmentFallback> {
  const map = new Map<string, AssignmentFallback>();
  const userIdFilter =
    userIds && userIds.length > 0 ? new Set(userIds.map((id) => String(id))) : null;

  assignments.forEach((assignment: RoleMatrixAssignment) => {
    if (!isRoleAssignmentActive(assignment)) {
      return;
    }

    const userId = String(assignment.user_id || "");
    if (!userId) {
      return;
    }

    if (userIdFilter && !userIdFilter.has(userId)) {
      return;
    }

    if (!map.has(userId)) {
      map.set(userId, createEmptyAssignmentFallback());
    }

    const entry = map.get(userId)!;
    const roleCode = normalizeRoleCode(assignment.role_code);

    if (roleCode === ROLE_CODE_ORGANIZER_STUDENT) {
      entry.is_student_organiser = true;
    }

    if (roleCode === ROLE_CODE_MASTER_ADMIN) {
      entry.is_masteradmin = true;
    }

    if (roleCode === ROLE_CODE_HOD) {
      entry.is_hod = true;
      entry.department_id = normalizeNullableText(assignment.department_scope) || entry.department_id;
      entry.campus = normalizeNullableText(assignment.campus_scope) || entry.campus;
    }

    if (roleCode === ROLE_CODE_DEAN) {
      entry.is_dean = true;
      entry.school_id = normalizeNullableText(assignment.department_scope) || entry.school_id;
      entry.campus = normalizeNullableText(assignment.campus_scope) || entry.campus;
    }

    if (roleCode === ROLE_CODE_CFO) {
      entry.is_cfo = true;
      entry.campus =
        normalizeNullableText(assignment.campus_scope) ||
        normalizeNullableText(assignment.department_scope) ||
        entry.campus;
    }

    if (roleCode === ROLE_CODE_ORGANIZER_TEACHER) {
      entry.is_organiser = true;
    }

    if (roleCode === ROLE_CODE_ORGANIZER_VOLUNTEER) {
      entry.is_volunteer = true;
    }

    if (roleCode === ROLE_CODE_SUPPORT) {
      entry.is_support = true;
    }

    if (roleCode === ROLE_CODE_FINANCE_OFFICER || roleCode === ROLE_CODE_ACCOUNTS) {
      entry.is_finance_officer = true;
    }

    if (roleCode === ROLE_CODE_SERVICE_IT) {
      entry.is_it_service = true;
    }

    if (roleCode === ROLE_CODE_SERVICE_VENUE) {
      entry.is_venue_manager = true;
      entry.venue_id =
        normalizeNullableText(assignment.department_scope) ||
        normalizeNullableText(assignment.campus_scope) ||
        entry.venue_id;
    }

    if (roleCode === ROLE_CODE_SERVICE_CATERING) {
      entry.is_catering_vendors = true;
    }

    if (roleCode === ROLE_CODE_SERVICE_STALLS) {
      entry.is_stalls_misc = true;
    }
  });

  return map;
}

async function fetchRoleAssignmentFallbacks(
  adminClient: any,
  userIds?: Array<string | number>
): Promise<Map<string, AssignmentFallback>> {
  let query = adminClient
    .from("user_role_assignments")
    .select("user_id,role_code,department_scope,campus_scope,is_active,valid_from,valid_until")
    .in("role_code", [
      ROLE_CODE_MASTER_ADMIN,
      ROLE_CODE_HOD,
      ROLE_CODE_DEAN,
      ROLE_CODE_CFO,
      ROLE_CODE_ORGANIZER_TEACHER,
      ROLE_CODE_ORGANIZER_STUDENT,
      ROLE_CODE_ORGANIZER_VOLUNTEER,
      ROLE_CODE_SUPPORT,
      ROLE_CODE_FINANCE_OFFICER,
      ROLE_CODE_ACCOUNTS,
      ROLE_CODE_SERVICE_IT,
      ROLE_CODE_SERVICE_VENUE,
      ROLE_CODE_SERVICE_CATERING,
      ROLE_CODE_SERVICE_STALLS,
    ]);

  if (userIds && userIds.length > 0) {
    query = query.in(
      "user_id",
      userIds.map((id) => String(id))
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      return new Map<string, AssignmentFallback>();
    }
    throw new Error(error.message || "Failed to load role assignment fallback.");
  }

  const assignments = (data || []).map((row: any) => ({
    user_id: String(row?.user_id || ""),
    role_code: normalizeRoleCode(row?.role_code),
    department_scope: normalizeNullableText(row?.department_scope),
    campus_scope: normalizeNullableText(row?.campus_scope),
    is_active: row?.is_active !== false,
    valid_from: normalizeNullableText(row?.valid_from),
    valid_until: normalizeNullableText(row?.valid_until),
  }));

  return buildAssignmentFallbackMap(assignments, userIds);
}

async function fetchRoleAssignments(adminClient: any): Promise<RoleMatrixAssignment[]> {
  const { data, error } = await adminClient
    .from("user_role_assignments")
    .select("user_id,role_code,department_scope,campus_scope,is_active,valid_from,valid_until");

  if (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      return [];
    }
    throw new Error(error.message || "Failed to load role matrix assignments.");
  }

  return (data || []).map((row: any) => ({
    user_id: String(row?.user_id || ""),
    role_code: normalizeRoleCode(row?.role_code),
    department_scope: normalizeNullableText(row?.department_scope),
    campus_scope: normalizeNullableText(row?.campus_scope),
    is_active: row?.is_active !== false,
    valid_from: normalizeNullableText(row?.valid_from),
    valid_until: normalizeNullableText(row?.valid_until),
  }));
}

function buildServiceScopeOptions(assignments: RoleMatrixAssignment[], serviceRows: any[]) {
  const cateringShops = new Set<string>();
  const stallsScopes = new Set<string>();

  assignments.forEach((assignment: RoleMatrixAssignment) => {
    if (!isRoleAssignmentActive(assignment)) {
      return;
    }

    const scope = normalizeNullableText(assignment.department_scope);
    if (!scope) {
      return;
    }

    const roleCode = normalizeRoleCode(assignment.role_code);
    if (roleCode === ROLE_CODE_SERVICE_CATERING) {
      cateringShops.add(scope);
    }

    if (roleCode === ROLE_CODE_SERVICE_STALLS) {
      stallsScopes.add(scope);
    }
  });

  serviceRows.forEach((row: any) => {
    const roleCode = normalizeRoleCode(row?.service_role_code);

    if (roleCode === ROLE_CODE_SERVICE_CATERING) {
      const candidate = readDetailCandidate(row?.details, [
        "shop_name",
        "vendor_name",
        "supplier_name",
        "resource_name",
        "item_name",
        "name",
      ]);

      if (candidate) {
        cateringShops.add(candidate);
      }
    }

    if (roleCode === ROLE_CODE_SERVICE_STALLS) {
      const candidate = readDetailCandidate(row?.details, [
        "stall_name",
        "stall",
        "scope",
        "resource_name",
        "name",
      ]);

      if (candidate) {
        stallsScopes.add(candidate);
      }
    }
  });

  return {
    cateringShops: Array.from(cateringShops.values()).sort((a, b) => a.localeCompare(b)),
    stallsScopes: Array.from(stallsScopes.values()).sort((a, b) => a.localeCompare(b)),
  };
}

function roleRequiresScope(role: RoleMatrixAssignableRole): boolean {
  return role === "hod" || role === "dean" || role === "venue_service" || role === "catering_service" || role === "stalls_service";
}

async function syncRoleAssignment(
  adminClient: any,
  params: {
    userId: string | number;
    roleCode: string;
    enabled: boolean;
    assignedBy: string;
    departmentScope?: string | null;
    campusScope?: string | null;
    assignedReason?: string;
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
    campus_scope: normalizeNullableText(params.campusScope),
    is_active: true,
    valid_from: nowIso,
    assigned_by: params.assignedBy,
    assigned_reason: params.assignedReason || "Master Admin role matrix update",
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

  const [usersRows, roleAssignments, departmentRows, eventVenueRows, festVenueRows, serviceRows] =
    await Promise.all([
      fetchUsersWithFallback(adminClient),
      fetchRoleAssignments(adminClient),
      fetchRowsWithSelectFallback(adminClient, "departments_courses", [
        "id,department_name,school",
        "id,department_name",
        "id",
      ]),
      fetchRowsWithSelectFallback(adminClient, "events", ["venue,campus_hosted_at", "venue"]),
      fetchRowsWithSelectFallback(adminClient, "fests", ["venue,campus_hosted_at", "venue"]),
      fetchRowsWithSelectFallback(adminClient, "service_requests", [
        "service_role_code,details",
        "service_role_code",
      ]),
    ]);

  const assignmentFallbackMap = buildAssignmentFallbackMap(
    roleAssignments,
    usersRows.map((row: any) => row.id)
  );

  const resolvedDepartmentRows =
    Array.isArray(departmentRows) && departmentRows.length > 0 ? departmentRows : FALLBACK_DEPARTMENT_OPTIONS;

  const departments: DepartmentOption[] = resolvedDepartmentRows
    .map((row: any) => ({
      id: String(row.id),
      department_name: String(row.department_name || "Unnamed Department"),
      school: row.school ? String(row.school) : null,
    }))
    .sort((left: DepartmentOption, right: DepartmentOption) =>
      left.department_name.localeCompare(right.department_name)
    );

  const schoolMap = new Map<string, SchoolOption>();
  FALLBACK_SCHOOL_NAMES.forEach((schoolName) => {
    schoolMap.set(schoolName, {
      id: schoolName,
      name: schoolName,
    });
  });

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

  const venues = buildVenueOptions(eventVenueRows, festVenueRows, usersRows);

  const campusesSet = new Set<string>(CAMPUS_OPTIONS);
  usersRows.forEach((row: any) => {
    const campus = normalizeNullableText(row?.campus);
    if (campus && !isExcludedCampusValue(campus)) {
      campusesSet.add(campus);
    }
  });
  eventVenueRows.forEach((row: any) => {
    const campus = normalizeNullableText(row?.campus_hosted_at);
    if (campus && !isExcludedCampusValue(campus)) {
      campusesSet.add(campus);
    }
  });
  festVenueRows.forEach((row: any) => {
    const campus = normalizeNullableText(row?.campus_hosted_at);
    if (campus && !isExcludedCampusValue(campus)) {
      campusesSet.add(campus);
    }
  });

  const { cateringShops, stallsScopes } = buildServiceScopeOptions(roleAssignments, serviceRows);

  return {
    users: usersRows.map((row: any) => normalizeUserRecord(row, assignmentFallbackMap.get(String(row.id)))),
    departments,
    schools: Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    campuses: Array.from(campusesSet.values())
      .filter((campus) => !isExcludedCampusValue(campus))
      .sort((a, b) => {
        if (a === PRIMARY_CAMPUS && b !== PRIMARY_CAMPUS) {
          return -1;
        }
        if (b === PRIMARY_CAMPUS && a !== PRIMARY_CAMPUS) {
          return 1;
        }
        return a.localeCompare(b);
      }),
    venues,
    cateringShops,
    stallsScopes,
    roleAssignments,
    analytics: emptyAnalytics(),
  };
}

export async function getRolesAnalyticsData(): Promise<RolesAnalytics> {
  const { adminClient } = await assertMasterAdmin();
  return buildRolesAnalytics(adminClient);
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
        if (isMissingRelationError(error) || isMissingColumnError(error)) {
          // Catalog table missing in this environment; allow scoped value without strict lookup.
        } else {
          return { ok: false, error: error.message || "Failed to validate department." };
        }
      } else if (!data) {
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
        if (isMissingRelationError(error) || isMissingColumnError(error)) {
          // Catalog table missing in this environment; allow scoped value without strict lookup.
        } else {
          return { ok: false, error: error.message || "Failed to validate school." };
        }
      } else if (!Array.isArray(data) || data.length === 0) {
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
      is_student_organiser: payload.is_student_organiser,
      is_student_organizer: payload.is_student_organiser,
      is_support: payload.is_support,
      is_masteradmin: payload.is_masteradmin,
      is_hod: payload.is_hod,
      is_dean: payload.is_dean,
      is_cfo: payload.is_cfo,
      is_finance_officer: payload.is_finance_officer,
      is_volunteer: payload.is_volunteer,
      is_venue_manager: payload.is_venue_manager,
      is_it_service: payload.is_it_service,
      is_it: payload.is_it_service,
      is_catering_vendors: payload.is_catering_vendors,
      is_catering_vendor: payload.is_catering_vendors,
      is_stalls_misc: payload.is_stalls_misc,
      is_stall_misc: payload.is_stalls_misc,
      is_stalls: payload.is_stalls_misc,
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
        roleCode: ROLE_CODE_HOD,
        enabled: payload.is_hod,
        assignedBy: actingUser.email,
        departmentScope: strictDepartmentId,
        campusScope: payload.campus,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_DEAN,
        enabled: payload.is_dean,
        assignedBy: actingUser.email,
        departmentScope: strictSchoolId,
        campusScope: payload.campus,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_CFO,
        enabled: payload.is_cfo,
        assignedBy: actingUser.email,
        campusScope: strictCampus,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_ORGANIZER_TEACHER,
        enabled: payload.is_organiser,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_ORGANIZER_STUDENT,
        enabled: payload.is_student_organiser,
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
        roleCode: ROLE_CODE_SUPPORT,
        enabled: payload.is_support,
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
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_SERVICE_IT,
        enabled: payload.is_it_service,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_SERVICE_CATERING,
        enabled: payload.is_catering_vendors,
        assignedBy: actingUser.email,
      }),
      syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode: ROLE_CODE_SERVICE_STALLS,
        enabled: payload.is_stalls_misc,
        assignedBy: actingUser.email,
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

export async function assignRoleMatrixEntry(
  assignmentPayload: RoleMatrixAssignPayload
): Promise<AssignRoleMatrixActionResult> {
  try {
    const { adminClient, actingUser } = await assertMasterAdmin();

    const email = String(assignmentPayload?.email || "").trim();
    const campus = normalizeNullableText(assignmentPayload?.campus);
    const roleValue = assignmentPayload?.role;
    const scopeValue = normalizeNullableText(assignmentPayload?.scopeValue);

    if (!email) {
      return { ok: false, error: "Enter a user email to assign a role." };
    }

    if (!campus) {
      return { ok: false, error: "Select a campus before assigning a role." };
    }

    if (!isRoleMatrixAssignableRole(roleValue)) {
      return { ok: false, error: "Invalid role selected for assignment." };
    }

    if (roleRequiresScope(roleValue) && !scopeValue) {
      return { ok: false, error: "Select the required role scope before assigning." };
    }

    let selectedDepartmentLabel: string | null = null;
    let selectedDepartmentSchool: string | null = null;

    if (roleValue === "hod") {
      const { data, error } = await adminClient
        .from("departments_courses")
        .select("id,department_name,school")
        .eq("id", scopeValue)
        .maybeSingle();

      if (error) {
        if (!(isMissingRelationError(error) || isMissingColumnError(error))) {
          return { ok: false, error: error.message || "Failed to validate the selected department." };
        }
      }

      if (!error && !data) {
        return { ok: false, error: "Selected department does not exist." };
      }

      if (!error && data) {
        selectedDepartmentLabel = normalizeNullableText((data as any).department_name) || scopeValue;
        selectedDepartmentSchool = normalizeNullableText((data as any).school);
      }
    }

    if (roleValue === "dean") {
      const { data, error } = await adminClient
        .from("departments_courses")
        .select("id")
        .eq("school", scopeValue)
        .limit(1);

      if (error) {
        if (!(isMissingRelationError(error) || isMissingColumnError(error))) {
          return { ok: false, error: error.message || "Failed to validate the selected school." };
        }
      }

      if (!error && (!Array.isArray(data) || data.length === 0)) {
        return { ok: false, error: "Selected school does not exist." };
      }
    }

    const targetUserRow = await fetchSingleUserByEmailWithFallback(adminClient, email);
    if (!targetUserRow) {
      return { ok: false, error: "No user found for the provided email." };
    }

    const targetUserId = coerceUserId(targetUserRow.id);
    const assignmentFallbackMap = await fetchRoleAssignmentFallbacks(adminClient, [targetUserId]);
    const normalizedTarget = normalizeUserRecord(
      targetUserRow,
      assignmentFallbackMap.get(String(targetUserId))
    );

    const nextAccess: UserAccessPayload = {
      ...normalizedTarget.access,
    };

    const usersUpdatePayload: Record<string, unknown> = {};

    if (roleValue === "organiser") {
      nextAccess.is_organiser = true;
      usersUpdatePayload.is_organiser = true;
    }

    if (roleValue === "student_organiser") {
      nextAccess.is_student_organiser = true;
      usersUpdatePayload.is_student_organiser = true;
      usersUpdatePayload.is_student_organizer = true;
    }

    if (roleValue === "volunteer") {
      nextAccess.is_volunteer = true;
      usersUpdatePayload.is_volunteer = true;
    }

    if (roleValue === "support") {
      nextAccess.is_support = true;
      usersUpdatePayload.is_support = true;
    }

    if (roleValue === "it_service") {
      nextAccess.is_it_service = true;
      usersUpdatePayload.is_it_service = true;
      usersUpdatePayload.is_it = true;
    }

    if (roleValue === "catering_service") {
      nextAccess.is_catering_vendors = true;
      usersUpdatePayload.is_catering_vendors = true;
      usersUpdatePayload.is_catering_vendor = true;
    }

    if (roleValue === "stalls_service") {
      nextAccess.is_stalls_misc = true;
      usersUpdatePayload.is_stalls_misc = true;
      usersUpdatePayload.is_stall_misc = true;
      usersUpdatePayload.is_stalls = true;
    }

    if (roleValue === "finance_officer") {
      nextAccess.is_finance_officer = true;
      usersUpdatePayload.is_finance_officer = true;
    }

    if (roleValue === "master_admin") {
      nextAccess.is_masteradmin = true;
      usersUpdatePayload.is_masteradmin = true;
    }

    if (DOMAIN_EXCLUSIVE_MATRIX_ROLES.has(roleValue)) {
      nextAccess.is_hod = roleValue === "hod";
      nextAccess.is_dean = roleValue === "dean";
      nextAccess.is_cfo = roleValue === "cfo";
      nextAccess.is_venue_manager = roleValue === "venue_service";

      usersUpdatePayload.is_hod = roleValue === "hod";
      usersUpdatePayload.is_dean = roleValue === "dean";
      usersUpdatePayload.is_cfo = roleValue === "cfo";
      usersUpdatePayload.is_venue_manager = roleValue === "venue_service";

      usersUpdatePayload.department_id = roleValue === "hod" ? scopeValue : null;
      usersUpdatePayload.school_id = roleValue === "dean" ? scopeValue : null;
      usersUpdatePayload.campus = campus;
      usersUpdatePayload.venue_id = roleValue === "venue_service" ? scopeValue : null;

      if (roleValue === "hod") {
        usersUpdatePayload.department = selectedDepartmentLabel || scopeValue;
        usersUpdatePayload.school = selectedDepartmentSchool;
      }

      if (roleValue === "dean") {
        usersUpdatePayload.school = scopeValue;
        usersUpdatePayload.department = scopeValue;
      }
    }

    if (Object.keys(usersUpdatePayload).length > 0) {
      usersUpdatePayload.university_role = deriveUniversityRoleFromAccess(nextAccess);
      await applyUsersUpdateWithFallback(adminClient, targetUserId, usersUpdatePayload);
    }

    if (DOMAIN_EXCLUSIVE_MATRIX_ROLES.has(roleValue)) {
      await Promise.all([
        syncRoleAssignment(adminClient, {
          userId: targetUserId,
          roleCode: ROLE_CODE_HOD,
          enabled: roleValue === "hod",
          assignedBy: actingUser.email,
          departmentScope: roleValue === "hod" ? scopeValue : null,
          campusScope: roleValue === "hod" ? campus : null,
          assignedReason: "Role Matrix assignment",
        }),
        syncRoleAssignment(adminClient, {
          userId: targetUserId,
          roleCode: ROLE_CODE_DEAN,
          enabled: roleValue === "dean",
          assignedBy: actingUser.email,
          departmentScope: roleValue === "dean" ? scopeValue : null,
          campusScope: roleValue === "dean" ? campus : null,
          assignedReason: "Role Matrix assignment",
        }),
        syncRoleAssignment(adminClient, {
          userId: targetUserId,
          roleCode: ROLE_CODE_CFO,
          enabled: roleValue === "cfo",
          assignedBy: actingUser.email,
          campusScope: roleValue === "cfo" ? campus : null,
          assignedReason: "Role Matrix assignment",
        }),
        syncRoleAssignment(adminClient, {
          userId: targetUserId,
          roleCode: ROLE_CODE_SERVICE_VENUE,
          enabled: roleValue === "venue_service",
          assignedBy: actingUser.email,
          departmentScope: roleValue === "venue_service" ? scopeValue : null,
          campusScope: roleValue === "venue_service" ? campus : null,
          assignedReason: "Role Matrix assignment",
        }),
      ]);
    } else {
      const roleCode = ROLE_MATRIX_ROLE_TO_CODE[roleValue];

      await syncRoleAssignment(adminClient, {
        userId: targetUserId,
        roleCode,
        enabled: true,
        assignedBy: actingUser.email,
        departmentScope: roleRequiresScope(roleValue) ? scopeValue : null,
        campusScope: campus,
        assignedReason: "Role Matrix assignment",
      });
    }

    revalidatePath("/masteradmin");
    revalidatePath("/masteradmin/roles");
    revalidatePath("/manage");
    revalidatePath("/execution");

    return {
      ok: true,
      data: await getRolesTableData(),
      message: `${ROLE_MATRIX_ROLE_LABELS[roleValue]} assigned to ${normalizedTarget.email}.`,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Failed to assign role matrix entry.",
    };
  }
}

export async function deleteUserAccount(
  userId: string | number
): Promise<DeleteUserActionResult> {
  try {
    const { adminClient, actingUser } = await assertMasterAdmin();
    const targetUserId = coerceUserId(userId);

    const existingUser = await fetchSingleUserWithFallback(adminClient, targetUserId);

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
