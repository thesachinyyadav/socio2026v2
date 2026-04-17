import {
  getActiveRoleCodesFromAssignments,
  getRoleCodes,
  mergeRoleCodes,
} from "@/lib/roleDashboards";
import { createClient } from "@supabase/supabase-js";

type AuthUserLike = {
  id: string;
  email?: string | null;
};

type RoleAssignmentRow = {
  role_code?: unknown;
  school_scope?: unknown;
  department_scope?: unknown;
  campus_scope?: unknown;
  is_active?: unknown;
  valid_from?: unknown;
  valid_until?: unknown;
};

type ActiveRoleAssignment = {
  role_code: string;
  school_scope: string | null;
  department_scope: string | null;
  campus_scope: string | null;
};

const ROLE_CODE_LABELS: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  HOD: "HOD",
  DEAN: "Dean",
  CFO: "CFO",
  ORGANIZER: "Organiser",
  ORGANIZER_STUDENT: "Student Organizer",
  ORGANIZER_VOLUNTEER: "Volunteer",
  SUPPORT: "Support",
  FINANCE_OFFICER: "Finance Officer",
  ACCOUNTS: "Accounts",
  SERVICE_IT: "IT",
  SERVICE_VENUE: "Venue",
  SERVICE_CATERING: "Catering",
  SERVICE_STALLS: "Stalls/Misc",
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeRoleCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function isAssignmentActive(
  assignment: RoleAssignmentRow,
  nowDate: Date = new Date()
): boolean {
  if (!assignment || assignment.is_active === false) {
    return false;
  }

  const now = nowDate.getTime();
  const validFrom = assignment.valid_from
    ? new Date(String(assignment.valid_from)).getTime()
    : null;
  const validUntil = assignment.valid_until
    ? new Date(String(assignment.valid_until)).getTime()
    : null;

  if (Number.isFinite(validFrom) && (validFrom as number) > now) {
    return false;
  }

  if (Number.isFinite(validUntil) && (validUntil as number) <= now) {
    return false;
  }

  return true;
}

function roleCodeToFallbackLabel(roleCode: string): string {
  if (ROLE_CODE_LABELS[roleCode]) {
    return ROLE_CODE_LABELS[roleCode];
  }

  return roleCode
    .toLowerCase()
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRoleLookupClient(defaultClient: any): any {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return defaultClient;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getCurrentUserProfileWithRoleCodes(
  supabase: any,
  authUser: AuthUserLike
): Promise<Record<string, unknown> | null> {
  const roleLookupClient = buildRoleLookupClient(supabase);

  const byAuthUuid = await roleLookupClient
    .from("users")
    .select("*")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  let profile =
    !byAuthUuid.error && byAuthUuid.data
      ? (byAuthUuid.data as Record<string, unknown>)
      : null;

  if (!profile && authUser.email) {
    const byEmail = await roleLookupClient
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();

    if (!byEmail.error && byEmail.data) {
      profile = byEmail.data as Record<string, unknown>;
    }
  }

  if (!profile) {
    return null;
  }

  const userId = String(profile.id || "").trim();
  if (!userId) {
    return profile;
  }

  let assignmentQuery = await roleLookupClient
    .from("user_role_assignments")
    .select("id,role_code,school_scope,department_scope,campus_scope,is_active,valid_from,valid_until")
    .eq("user_id", userId);

  if (
    assignmentQuery.error &&
    String(assignmentQuery.error.message || "").toLowerCase().includes("school_scope")
  ) {
    assignmentQuery = await roleLookupClient
      .from("user_role_assignments")
      .select("id,role_code,department_scope,campus_scope,is_active,valid_from,valid_until")
      .eq("user_id", userId);
  }

  const { data: assignmentRows, error: assignmentError } = assignmentQuery;

  const normalizedAssignments: RoleAssignmentRow[] =
    !assignmentError && Array.isArray(assignmentRows)
      ? (assignmentRows as RoleAssignmentRow[]).filter((assignment) =>
          isAssignmentActive(assignment)
        )
      : [];

  const activeAssignments: ActiveRoleAssignment[] = normalizedAssignments
    .map((assignment) => ({
      role_code: normalizeRoleCode(assignment.role_code),
      school_scope: normalizeNullableText(assignment.school_scope),
      department_scope: normalizeNullableText(assignment.department_scope),
      campus_scope: normalizeNullableText(assignment.campus_scope),
    }))
    .filter((assignment) => assignment.role_code.length > 0);

  const activeRoleCodes = Array.from(
    new Set(activeAssignments.map((assignment) => assignment.role_code))
  );

  const roleNameByCode = new Map<string, string>();
  if (activeRoleCodes.length > 0) {
    const { data: roleCatalogRows, error: roleCatalogError } = await roleLookupClient
      .from("role_catalog")
      .select("role_code,role_name")
      .in("role_code", activeRoleCodes);

    if (!roleCatalogError && Array.isArray(roleCatalogRows)) {
      roleCatalogRows.forEach((row: any) => {
        const roleCode = normalizeRoleCode(row?.role_code);
        const roleName = normalizeText(row?.role_name);
        if (roleCode && roleName) {
          roleNameByCode.set(roleCode, roleName);
        }
      });
    }
  }

  const departmentScopeIds = Array.from(
    new Set(
      activeAssignments
        .map((assignment) => normalizeNullableText(assignment.department_scope))
        .filter(
          (departmentScope): departmentScope is string => Boolean(departmentScope)
        )
    )
  );

  const departmentNameById = new Map<string, string>();
  if (departmentScopeIds.length > 0) {
    const { data: departmentRows, error: departmentError } = await roleLookupClient
      .from("departments_courses")
      .select("id,department_name")
      .in("id", departmentScopeIds);

    if (!departmentError && Array.isArray(departmentRows)) {
      departmentRows.forEach((row: any) => {
        const departmentId = normalizeText(row?.id);
        const departmentName = normalizeText(row?.department_name);
        if (departmentId && departmentName) {
          departmentNameById.set(departmentId, departmentName);
        }
      });
    }
  }

  const uniqueRoleMatrixAssignments = Array.from(
    new Map(
      activeAssignments.map((assignment) => {
        const departmentLabel = assignment.department_scope
          ? departmentNameById.get(assignment.department_scope) ||
            assignment.department_scope
          : null;
        const roleTag =
          roleNameByCode.get(assignment.role_code) ||
          roleCodeToFallbackLabel(assignment.role_code);

        const roleAssignmentSummary = {
          role_code: assignment.role_code,
          role_tag: roleTag,
          department_scope: assignment.department_scope,
          department_label: departmentLabel,
          campus_scope: assignment.campus_scope,
        };

        const key = `${assignment.role_code}|${
          assignment.department_scope || ""
        }|${assignment.campus_scope || ""}`;
        return [key, roleAssignmentSummary] as const;
      })
    ).values()
  );

  const roleMatrixTags = Array.from(
    new Set(
      uniqueRoleMatrixAssignments
        .map((assignment) => normalizeText(assignment.role_tag))
        .filter((assignment) => assignment.length > 0)
    )
  );

  const roleMatrixDepartment =
    uniqueRoleMatrixAssignments
      .map(
        (assignment) =>
          normalizeNullableText(assignment.department_label) ||
          normalizeNullableText(assignment.department_scope)
      )
      .find((department): department is string => Boolean(department)) || null;

  const roleCodes = mergeRoleCodes(
    getRoleCodes(profile),
    getActiveRoleCodesFromAssignments(
      normalizedAssignments as Array<Record<string, unknown>>
    )
  );

  const hodScope = normalizedAssignments.find(
    (assignment) => normalizeRoleCode(assignment.role_code) === "HOD"
  );
  const deanScope = normalizedAssignments.find(
    (assignment) => normalizeRoleCode(assignment.role_code) === "DEAN"
  );
  const campusScope = normalizedAssignments.find((assignment) =>
    normalizeText(assignment.campus_scope)
  );

  const normalizedEmail = normalizeText(profile.email).toLowerCase();

  const subheadFestIds: string[] = [];
  if (normalizedEmail) {
    const { data: subheadRows, error: subheadError } = await roleLookupClient
      .from("fest_subheads")
      .select("fest_id,is_active")
      .eq("user_email", normalizedEmail)
      .eq("is_active", true);

    if (!subheadError && Array.isArray(subheadRows)) {
      for (const row of subheadRows as Array<{ fest_id?: unknown }>) {
        const festId = normalizeText(row?.fest_id);
        if (festId) subheadFestIds.push(festId);
      }
    }
  }

  const ownedFestIds: string[] = [];
  if (normalizedEmail) {
    const { data: ownedRows, error: ownedError } = await roleLookupClient
      .from("fests")
      .select("fest_id,created_by,contact_email")
      .or(
        `created_by.eq.${normalizedEmail},contact_email.eq.${normalizedEmail}`
      );

    if (!ownedError && Array.isArray(ownedRows)) {
      for (const row of ownedRows as Array<{ fest_id?: unknown }>) {
        const festId = normalizeText(row?.fest_id);
        if (festId) ownedFestIds.push(festId);
      }
    }
  }

  const enrichedProfile: Record<string, unknown> = {
    ...profile,
    role_assignments: normalizedAssignments,
    role_codes: roleCodes,
    department_id:
      normalizeNullableText(hodScope?.department_scope) ||
      normalizeNullableText(profile.department_id) ||
      null,
    school_id:
      normalizeNullableText(deanScope?.school_scope) ||
      normalizeNullableText(deanScope?.department_scope) ||
      normalizeNullableText(profile.school_id) ||
      null,
    campus:
      normalizeNullableText(campusScope?.campus_scope) ||
      normalizeNullableText(profile.campus) ||
      null,
    subhead_fest_ids: Array.from(new Set(subheadFestIds)),
    owned_fest_ids: Array.from(new Set(ownedFestIds)),
  };

  if (uniqueRoleMatrixAssignments.length > 0) {
    enrichedProfile.role_matrix_assignments = uniqueRoleMatrixAssignments;
    enrichedProfile.role_matrix_tags = roleMatrixTags;
    enrichedProfile.role_matrix_department = roleMatrixDepartment;
  }

  return enrichedProfile;
}
