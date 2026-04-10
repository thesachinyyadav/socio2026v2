"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type {
  DeleteUserActionResult,
  DepartmentOption,
  RolesPageData,
  RolesPayload,
  SchoolOption,
  UpdateRolesActionResult,
  UserRoleRow,
} from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    is_organiser: Boolean(row.is_organiser),
    is_support: Boolean(row.is_support),
    is_hod: Boolean(row.is_hod),
    is_dean: Boolean(row.is_dean),
    is_masteradmin: Boolean(row.is_masteradmin),
    department_id: row.department_id ?? null,
    school_id: row.school_id ?? null,
  };
}

function normalizePayload(payload: RolesPayload) {
  return {
    is_organiser: Boolean(payload.isOrganiser),
    is_support: Boolean(payload.isSupport),
    is_masteradmin: Boolean(payload.isMasterAdmin),
    is_hod: Boolean(payload.isHod),
    is_dean: Boolean(payload.isDean),
    department_id: payload.department_id ?? null,
    school_id: payload.school_id ?? null,
  };
}

function isMissingColumnError(error: { message?: string | null; details?: string | null }) {
  const fullText = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    fullText.includes("column") &&
    (fullText.includes("is_hod") ||
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
    .select("id,email,is_masteradmin")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  if (byAuthUuidError) {
    throw new Error(byAuthUuidError.message || "Failed to verify admin permissions.");
  }

  let actingUser = byAuthUuid;

  if (!actingUser && authUser.email) {
    const { data: byEmail, error: byEmailError } = await adminClient
      .from("users")
      .select("id,email,is_masteradmin")
      .eq("email", authUser.email)
      .maybeSingle();

    if (byEmailError) {
      throw new Error(byEmailError.message || "Failed to verify admin permissions.");
    }

    actingUser = byEmail;
  }

  if (!actingUser?.is_masteradmin) {
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

export async function getRolesTableData(): Promise<RolesPageData> {
  const { adminClient } = await assertMasterAdmin();

  const usersSelect =
    "id,name,email,created_at,is_organiser,is_support,is_masteradmin,is_hod,is_dean,department_id,school_id";

  let usersData: any[] | null = null;

  const usersQuery = await adminClient
    .from("users")
    .select(usersSelect)
    .order("created_at", { ascending: false });

  if (usersQuery.error) {
    if (isMissingColumnError(usersQuery.error)) {
      const legacyUsersQuery = await adminClient
        .from("users")
        .select("id,name,email,created_at,is_organiser,is_support,is_masteradmin,department_id")
        .order("created_at", { ascending: false });

      if (legacyUsersQuery.error) {
        throw new Error(legacyUsersQuery.error.message || "Failed to load users.");
      }

      usersData = (legacyUsersQuery.data || []).map((row: any) => ({
        ...row,
        is_hod: false,
        is_dean: false,
        school_id: null,
      }));
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
  };
}

export async function updateUserRoles(
  userId: string | number,
  rolesPayload: RolesPayload
): Promise<UpdateRolesActionResult> {
  try {
    const { adminClient, actingUser } = await assertMasterAdmin();
    const targetUserId = coerceUserId(userId);

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id,email,is_masteradmin")
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

    const normalized = normalizePayload(rolesPayload);

    if (normalized.is_hod && normalized.is_dean) {
      return {
        ok: false,
        error: "A user cannot be both HOD and Dean.",
      };
    }

    if (!normalized.is_hod) {
      normalized.department_id = null;
    }

    if (!normalized.is_dean) {
      normalized.school_id = null;
    }

    if (normalized.is_hod && !normalized.department_id) {
      return {
        ok: false,
        error: "Select a department before enabling HOD.",
      };
    }

    if (normalized.is_dean && !normalized.school_id) {
      return {
        ok: false,
        error: "Select a school before enabling Dean.",
      };
    }

    if (existingUser.is_masteradmin && normalized.is_masteradmin === false) {
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
          error: "Cannot remove the last Master Admin.",
        };
      }
    }

    if (sameUserId(existingUser.id, actingUser.id) && !normalized.is_masteradmin) {
      return {
        ok: false,
        error: "You cannot revoke your own Master Admin access.",
      };
    }

    const { data: updatedUser, error: updateError } = await adminClient
      .from("users")
      .update({
        is_organiser: normalized.is_organiser,
        is_support: normalized.is_support,
        is_masteradmin: normalized.is_masteradmin,
        is_hod: normalized.is_hod,
        is_dean: normalized.is_dean,
        department_id: normalized.department_id,
        school_id: normalized.school_id,
      })
      .eq("id", targetUserId)
      .select(
        "id,name,email,created_at,is_organiser,is_support,is_masteradmin,is_hod,is_dean,department_id,school_id"
      )
      .single();

    if (updateError) {
      const fallbackMessage = isMissingColumnError(updateError)
        ? "HOD/Dean columns are missing in the database. Apply the latest migration first."
        : updateError.message || "Failed to update user roles.";

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
      error: error?.message || "Failed to update user roles.",
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
      .select("id,email,is_masteradmin")
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

    if (existingUser.is_masteradmin) {
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
