"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type {
  AssignRoleActionResult,
  AssignableRole,
  DeleteUserActionResult,
  DepartmentOption,
  RolesPageData,
  SchoolOption,
  UserRoleRow,
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

function ensureEnvVars() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing for role management.");
  }
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

function normalizeUserRecord(row: any): UserRoleRow {
  return {
    id: row.id,
    name: row.name ?? null,
    email: String(row.email ?? ""),
    created_at: row.created_at ?? null,
    is_masteradmin: Boolean(row.is_masteradmin),
    is_hod: Boolean(row.is_hod),
    is_dean: Boolean(row.is_dean),
    department_id: row.department_id ?? null,
    school_id: row.school_id ?? null,
    campus: row.campus ?? null,
    university_role: row.university_role ?? null,
  };
}

function normalizeAssignableRole(input: string): AssignableRole | null {
  const normalized = input.trim().toUpperCase();
  if (
    normalized === "HOD" ||
    normalized === "DEAN" ||
    normalized === "CFO" ||
    normalized === "FINANCE_OFFICER"
  ) {
    return normalized as AssignableRole;
  }

  return null;
}

function needsDomain(role: AssignableRole): boolean {
  return role === "HOD" || role === "DEAN" || role === "CFO";
}

function mapToUniversityRole(role: AssignableRole): "hod" | "dean" | "cfo" | "finance_officer" {
  if (role === "HOD") {
    return "hod";
  }

  if (role === "DEAN") {
    return "dean";
  }

  if (role === "CFO") {
    return "cfo";
  }

  return "finance_officer";
}

function isMissingColumnError(error: { message?: string | null; details?: string | null }) {
  const fullText = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    fullText.includes("column") &&
    (fullText.includes("university_role") ||
      fullText.includes("campus") ||
      fullText.includes("is_hod") ||
      fullText.includes("is_dean") ||
      fullText.includes("school_id"))
  );
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
    .select("id,email,university_role")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  if (byAuthUuidError) {
    const message = isMissingColumnError(byAuthUuidError)
      ? "Role schema is outdated. Please apply the latest users role-scope migration."
      : byAuthUuidError.message || "Failed to verify admin permissions.";
    throw new Error(message);
  }

  let actingUser = byAuthUuid;

  if (!actingUser && authUser.email) {
    const { data: byEmail, error: byEmailError } = await adminClient
      .from("users")
      .select("id,email,university_role")
      .eq("email", authUser.email)
      .maybeSingle();

    if (byEmailError) {
      const message = isMissingColumnError(byEmailError)
        ? "Role schema is outdated. Please apply the latest users role-scope migration."
        : byEmailError.message || "Failed to verify admin permissions.";
      throw new Error(message);
    }

    actingUser = byEmail;
  }

  if (!actingUser) {
    throw new Error("Unable to resolve your user profile for role checks.");
  }

  const actingRole = String(actingUser.university_role || "").toLowerCase().trim();
  if (actingRole !== "masteradmin") {
    throw new Error("Master Admin privileges are required.");
  }

  return {
    adminClient,
    actingUser: {
      id: actingUser.id as string | number,
      email: String(actingUser.email || authUser.email || ""),
      university_role: actingRole,
    },
  };
}

export async function getRolesTableData(): Promise<RolesPageData> {
  const { adminClient } = await assertMasterAdmin();

  const usersSelect =
    "id,name,email,created_at,is_masteradmin,is_hod,is_dean,department_id,school_id,campus,university_role";

  let usersData: any[] | null = null;

  const usersQuery = await adminClient
    .from("users")
    .select(usersSelect)
    .order("created_at", { ascending: false });

  if (usersQuery.error) {
    if (isMissingColumnError(usersQuery.error)) {
      const legacyUsersQuery = await adminClient
        .from("users")
        .select("id,name,email,created_at,is_masteradmin,is_hod,is_dean,department_id,school_id")
        .order("created_at", { ascending: false });

      if (legacyUsersQuery.error) {
        throw new Error(legacyUsersQuery.error.message || "Failed to load users.");
      }

      usersData = (legacyUsersQuery.data || []).map((row: any) => {
        const derivedRole = Boolean(row.is_masteradmin)
          ? "masteradmin"
          : Boolean(row.is_hod)
            ? "hod"
            : Boolean(row.is_dean)
              ? "dean"
              : null;

        return {
          ...row,
          university_role: derivedRole,
          campus: null,
        };
      });
    } else {
      throw new Error(usersQuery.error.message || "Failed to load users.");
    }
  } else {
    usersData = usersQuery.data;
  }

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
    const schoolName = (department.school || "").trim();
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

  const schools = Array.from(schoolMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  return {
    users: (usersData || []).map(normalizeUserRecord),
    departments,
    schools,
    campuses: [...CAMPUS_OPTIONS],
  };
}

export async function assignRoleAction(
  userId: string | number,
  role: AssignableRole | string,
  domainId?: string | null
): Promise<AssignRoleActionResult> {
  try {
    const { adminClient, actingUser } = await assertMasterAdmin();
    const targetUserId = coerceUserId(userId);
    const normalizedRole = normalizeAssignableRole(String(role || ""));

    if (!normalizedRole) {
      return {
        ok: false,
        error: "Invalid role selection.",
      };
    }

    const normalizedDomain = String(domainId || "").trim() || null;
    if (needsDomain(normalizedRole) && !normalizedDomain) {
      return {
        ok: false,
        error: `Select a ${normalizedRole === "HOD" ? "department" : normalizedRole === "DEAN" ? "school" : "campus"} before assigning ${normalizedRole}.`,
      };
    }

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id,email,university_role")
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

    const existingRole = String(existingUser.university_role || "").toLowerCase().trim();
    if (existingRole === "masteradmin") {
      if (sameUserId(existingUser.id, actingUser.id)) {
        return {
          ok: false,
          error: "You cannot reassign your own Master Admin account.",
        };
      }

      const { count, error: countError } = await adminClient
        .from("users")
        .select("id", { head: true, count: "exact" })
        .eq("university_role", "masteradmin");

      if (countError) {
        return {
          ok: false,
          error: countError.message || "Failed to validate master admin count.",
        };
      }

      if ((count || 0) <= 1) {
        return {
          ok: false,
          error: "Cannot reassign the last Master Admin.",
        };
      }
    }

    if (normalizedRole === "HOD" && normalizedDomain) {
      const { data: departmentRow, error: departmentError } = await adminClient
        .from("departments_courses")
        .select("id")
        .eq("id", normalizedDomain)
        .maybeSingle();

      if (departmentError) {
        return {
          ok: false,
          error: departmentError.message || "Failed to validate department selection.",
        };
      }

      if (!departmentRow) {
        return {
          ok: false,
          error: "Selected department does not exist.",
        };
      }
    }

    if (normalizedRole === "DEAN" && normalizedDomain) {
      const { data: schoolRows, error: schoolError } = await adminClient
        .from("departments_courses")
        .select("id")
        .eq("school", normalizedDomain)
        .limit(1);

      if (schoolError) {
        return {
          ok: false,
          error: schoolError.message || "Failed to validate school selection.",
        };
      }

      if (!Array.isArray(schoolRows) || schoolRows.length === 0) {
        return {
          ok: false,
          error: "Selected school does not exist.",
        };
      }
    }

    if (normalizedRole === "CFO" && normalizedDomain && !CAMPUS_OPTIONS.includes(normalizedDomain)) {
      return {
        ok: false,
        error: "Invalid campus selection.",
      };
    }

    const updatePayload: Record<string, any> = {
      university_role: mapToUniversityRole(normalizedRole),
      department_id: null,
      school_id: null,
      campus: null,
      is_hod: false,
      is_dean: false,
    };

    if (normalizedRole === "HOD") {
      updatePayload.department_id = normalizedDomain;
      updatePayload.is_hod = true;
    } else if (normalizedRole === "DEAN") {
      updatePayload.school_id = normalizedDomain;
      updatePayload.is_dean = true;
    } else if (normalizedRole === "CFO") {
      updatePayload.campus = normalizedDomain;
    }

    const { data: updatedUser, error: updateError } = await adminClient
      .from("users")
      .update(updatePayload)
      .eq("id", targetUserId)
      .select(
        "id,name,email,created_at,is_masteradmin,is_hod,is_dean,department_id,school_id,campus,university_role"
      )
      .single();

    if (updateError) {
      const fallbackMessage = isMissingColumnError(updateError)
        ? "Role schema is outdated. Please apply the latest users role-scope migration."
        : updateError.message || "Failed to assign user role.";

      return {
        ok: false,
        error: fallbackMessage,
      };
    }

    revalidatePath("/masteradmin");
    revalidatePath("/masteradmin/roles");
    revalidatePath("/manage");

    return {
      ok: true,
      user: normalizeUserRecord(updatedUser),
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Failed to assign user role.",
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
      .select("id,email,university_role")
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

    const existingRole = String(existingUser.university_role || "").toLowerCase().trim();
    if (existingRole === "masteradmin") {
      const { count, error: countError } = await adminClient
        .from("users")
        .select("id", { head: true, count: "exact" })
        .eq("university_role", "masteradmin");

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

    const { error: deleteError } = await adminClient
      .from("users")
      .delete()
      .eq("id", targetUserId);

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
