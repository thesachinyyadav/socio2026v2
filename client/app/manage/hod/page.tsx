import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HodDashboardClient from "./_components/HodDashboardClient";
import { fetchHodDashboardData } from "./_lib/hodDashboardData";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

export const dynamic = "force-dynamic";

function normalizeScope(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isAssignmentActive(assignment: Record<string, unknown>, nowDate: Date = new Date()): boolean {
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

function resolveHodDepartmentScope(userProfile: Record<string, unknown>): string {
  const assignmentRows = Array.isArray(userProfile.role_assignments)
    ? (userProfile.role_assignments as Array<Record<string, unknown>>)
    : [];

  const scopedDepartment = assignmentRows.find(
    (assignment) =>
      String(assignment.role_code || "").trim().toUpperCase() === "HOD" &&
      isAssignmentActive(assignment) &&
      normalizeScope(assignment.department_scope).length > 0
  );

  const assignmentScope = normalizeScope(scopedDepartment?.department_scope);
  if (assignmentScope) {
    return assignmentScope;
  }

  return normalizeScope(userProfile.department_id) || normalizeScope(userProfile.department);
}

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function buildSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server components cannot mutate response cookies directly.
      },
    },
  });
}

export default async function HodManagePage() {
  if (!hasSupabaseConfig()) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
          Supabase environment variables are missing. Please configure NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </div>
      </main>
    );
  }

  const supabase = await buildSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const userProfile = await getCurrentUserProfileWithRoleCodes(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!userProfile) {
    redirect("/error");
  }

  const isMasterAdmin = Boolean(userProfile.is_masteradmin);
  const isHodUser =
    hasAnyRoleCode(userProfile, ["HOD"]) ||
    Boolean(userProfile.is_hod);
  if (!isHodUser && !isMasterAdmin) {
    redirect("/error");
  }

  const hodDepartmentScope = resolveHodDepartmentScope(userProfile);
  if (!isMasterAdmin && !hodDepartmentScope) {
    redirect("/error");
  }

  const campusName = String(userProfile.campus || "").trim();

  const fallbackDashboardData: Awaited<ReturnType<typeof fetchHodDashboardData>> = {
    queue: [],
    metrics: {
      deptBudgetUsedYtd: 0,
      pendingL1Approvals: 0,
    },
  };

  let dashboardData: Awaited<ReturnType<typeof fetchHodDashboardData>> = fallbackDashboardData;
  let dashboardErrorMessage: string | null = null;

  try {
    dashboardData = await fetchHodDashboardData({
      supabase,
      departmentId: isMasterAdmin ? null : hodDepartmentScope,
      campusScope: isMasterAdmin ? null : campusName,
    });
  } catch (error) {
    dashboardErrorMessage =
      error instanceof Error ? error.message : "Unable to load HOD dashboard data right now.";
  }

  const departmentName = isMasterAdmin ? "All Departments" : hodDepartmentScope;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {dashboardErrorMessage ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {dashboardErrorMessage}
        </div>
      ) : null}
      <HodDashboardClient
        departmentName={departmentName}
        initialQueue={dashboardData.queue}
        initialMetrics={dashboardData.metrics}
      />
    </main>
  );
}
