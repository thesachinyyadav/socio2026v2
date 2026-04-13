import {
  getActiveRoleCodesFromAssignments,
  getRoleCodes,
  mergeRoleCodes,
} from "@/lib/roleDashboards";

type AuthUserLike = {
  id: string;
  email?: string | null;
};

type RoleAssignmentRow = {
  role_code?: unknown;
  department_scope?: unknown;
  campus_scope?: unknown;
  is_active?: unknown;
  valid_from?: unknown;
  valid_until?: unknown;
};

type ActiveRoleAssignment = {
  role_code: string;
  department_scope: string | null;
  campus_scope: string | null;
};

const ROLE_CODE_LABELS: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  HOD: "HOD",
  DEAN: "Dean",
  CFO: "CFO",
  ORGANIZER_TEACHER: "Organiser",
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

function firstNonEmptyText(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeNullableText(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function isRoleAssignmentActive(assignment: RoleAssignmentRow, nowDate: Date = new Date()): boolean {
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

export async function getCurrentUserProfileWithRoleCodes(
  supabase: any,
  authUser: AuthUserLike
): Promise<Record<string, unknown> | null> {
  const byAuthUuid = await supabase
    .from("users")
    .select("*")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  let profile = !byAuthUuid.error && byAuthUuid.data
    ? (byAuthUuid.data as Record<string, unknown>)
    : null;

  if (!profile && authUser.email) {
    const byEmail = await supabase
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

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("user_role_assignments")
    .select("role_code,department_scope,campus_scope,is_active,valid_from,valid_until")
    .eq("user_id", userId);

  const assignmentRowsSafe: RoleAssignmentRow[] =
    !assignmentError && Array.isArray(assignmentRows)
      ? (assignmentRows as RoleAssignmentRow[])
      : [];

  const activeAssignments: ActiveRoleAssignment[] = assignmentRowsSafe
    .filter((assignment) => isRoleAssignmentActive(assignment))
    .map((assignment) => ({
      role_code: normalizeRoleCode(assignment.role_code),
      department_scope: normalizeNullableText(assignment.department_scope),
      campus_scope: normalizeNullableText(assignment.campus_scope),
    }))
    .filter((assignment) => assignment.role_code.length > 0);

  const activeRoleCodes = Array.from(
    new Set(activeAssignments.map((assignment) => assignment.role_code))
  );
  const profileDepartmentId = normalizeNullableText(profile.department_id);

  const roleNameByCode = new Map<string, string>();
  if (activeRoleCodes.length > 0) {
    const { data: roleCatalogRows, error: roleCatalogError } = await supabase
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

  const departmentLookupIds = Array.from(
    new Set([
      ...activeAssignments
        .map((assignment) => normalizeNullableText(assignment.department_scope))
        .filter((departmentScope): departmentScope is string => Boolean(departmentScope)),
      ...(profileDepartmentId ? [profileDepartmentId] : []),
    ])
  );

  const departmentNameById = new Map<string, string>();
  const schoolByDepartmentId = new Map<string, string>();
  if (departmentLookupIds.length > 0) {
    const { data: departmentRows, error: departmentError } = await supabase
      .from("departments_courses")
      .select("id,department_name,school")
      .in("id", departmentLookupIds);

    if (!departmentError && Array.isArray(departmentRows)) {
      departmentRows.forEach((row: any) => {
        const departmentId = normalizeText(row?.id);
        const departmentName = normalizeText(row?.department_name);
        const schoolName = normalizeText(row?.school);
        if (departmentId && departmentName) {
          departmentNameById.set(departmentId, departmentName);
        }
        if (departmentId && schoolName) {
          schoolByDepartmentId.set(departmentId, schoolName);
        }
      });
    }
  }

  const uniqueRoleMatrixAssignments = Array.from(
    new Map(
      activeAssignments.map((assignment) => {
        const departmentLabel = assignment.department_scope
          ? departmentNameById.get(assignment.department_scope) || assignment.department_scope
          : null;
        const roleTag =
          roleNameByCode.get(assignment.role_code) || roleCodeToFallbackLabel(assignment.role_code);

        const roleAssignmentSummary = {
          role_code: assignment.role_code,
          role_tag: roleTag,
          department_scope: assignment.department_scope,
          department_label: departmentLabel,
          campus_scope: assignment.campus_scope,
        };

        const key = `${assignment.role_code}|${assignment.department_scope || ""}|${assignment.campus_scope || ""}`;
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
      .map((assignment) =>
        normalizeNullableText(assignment.department_label) ||
        normalizeNullableText(assignment.department_scope)
      )
      .find((department): department is string => Boolean(department)) || null;

  const fallbackDepartmentByProfileId = profileDepartmentId
    ? departmentNameById.get(profileDepartmentId) || null
    : null;
  const fallbackSchoolByProfileId = profileDepartmentId
    ? schoolByDepartmentId.get(profileDepartmentId) || null
    : null;
  const resolvedDepartment = firstNonEmptyText(
    roleMatrixDepartment,
    fallbackDepartmentByProfileId,
    profile.department
  );
  const resolvedSchool = firstNonEmptyText(fallbackSchoolByProfileId, profile.school);

  const roleCodes = mergeRoleCodes(
    getRoleCodes(profile),
    getActiveRoleCodesFromAssignments(assignmentRowsSafe as Array<Record<string, unknown>>)
  );

  const hasRoleEnrichment =
    roleCodes.length > 0 || uniqueRoleMatrixAssignments.length > 0;
  const hasDepartmentEnrichment = Boolean(resolvedDepartment || resolvedSchool);

  if (!hasRoleEnrichment && !hasDepartmentEnrichment) {
    return profile;
  }

  const enrichedProfile: Record<string, unknown> = {
    ...profile,
  };

  if (resolvedDepartment) {
    enrichedProfile.department = resolvedDepartment;
  }

  if (resolvedSchool) {
    enrichedProfile.school = resolvedSchool;
  }

  if (roleCodes.length > 0) {
    enrichedProfile.role_codes = roleCodes;
  }

  if (uniqueRoleMatrixAssignments.length > 0) {
    enrichedProfile.role_matrix_assignments = uniqueRoleMatrixAssignments;
    enrichedProfile.role_matrix_tags = roleMatrixTags;
    enrichedProfile.role_matrix_department = roleMatrixDepartment;
  }

  return enrichedProfile;
}
