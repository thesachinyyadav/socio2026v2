import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import DeanDashboardClient from "./_components/DeanDashboardClient";
import { fetchDeanDashboardData } from "./_lib/deanDashboardData";

export const dynamic = "force-dynamic";

const DEFAULT_L1_THRESHOLD = 25000;

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

async function getCurrentUserProfile(supabase: any, authUser: { id: string; email?: string | null }) {
  const byAuthUuid = await supabase
    .from("users")
    .select("*")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  if (!byAuthUuid.error && byAuthUuid.data) {
    return byAuthUuid.data as Record<string, unknown>;
  }

  if (!authUser.email) {
    return null;
  }

  const byEmail = await supabase
    .from("users")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle();

  if (byEmail.error || !byEmail.data) {
    return null;
  }

  return byEmail.data as Record<string, unknown>;
}

async function resolveL1Threshold(supabase: any, campusName: string): Promise<number> {
  if (!campusName) {
    return DEFAULT_L1_THRESHOLD;
  }

  const { data: configRow } = await supabase
    .from("campus_approval_config")
    .select("l1_threshold")
    .eq("campus", campusName)
    .maybeSingle();

  const candidateThreshold = Number((configRow as any)?.l1_threshold);
  if (Number.isFinite(candidateThreshold) && candidateThreshold > 0) {
    return candidateThreshold;
  }

  return DEFAULT_L1_THRESHOLD;
}

export default async function DeanManagePage() {
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

  const userProfile = await getCurrentUserProfile(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!userProfile) {
    redirect("/error");
  }

  const universityRole = String(userProfile.university_role || "").toLowerCase().trim();
  const isMasterAdmin = Boolean(userProfile.is_masteradmin);
  const isDeanUser = Boolean(userProfile.is_dean) || universityRole === "dean";
  if (!isDeanUser && !isMasterAdmin) {
    redirect("/manage");
  }

  const schoolId = String(userProfile.school_id || "").trim();
  if (!schoolId && !isMasterAdmin) {
    redirect("/error");
  }

  const campusName = String(userProfile.campus || "").trim();
  const l1Threshold = await resolveL1Threshold(supabase, campusName);

  const fallbackDashboardData: Awaited<ReturnType<typeof fetchDeanDashboardData>> = {
    queue: [],
    metrics: {
      pendingL2Approvals: 0,
      pendingBudgetTotal: 0,
    },
    departmentKpis: [],
  };
  let dashboardData: Awaited<ReturnType<typeof fetchDeanDashboardData>> = fallbackDashboardData;
  let dashboardErrorMessage: string | null = null;

  try {
    dashboardData = await fetchDeanDashboardData({
      supabase,
      schoolId: schoolId || null,
      l1Threshold,
    });
  } catch (error) {
    dashboardErrorMessage =
      error instanceof Error ? error.message : "Unable to load Dean dashboard data right now.";
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {dashboardErrorMessage ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {dashboardErrorMessage}
        </div>
      ) : null}
      <DeanDashboardClient
        schoolName={schoolId || "All Schools"}
        l1Threshold={l1Threshold}
        initialQueue={dashboardData.queue}
        initialMetrics={dashboardData.metrics}
        initialDepartmentKpis={dashboardData.departmentKpis}
      />
    </main>
  );
}
