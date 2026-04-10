import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import CfoDashboardClient from "./_components/CfoDashboardClient";
import { fetchCfoDashboardData } from "./_lib/cfoDashboardData";

export const dynamic = "force-dynamic";

const DEFAULT_L2_THRESHOLD = 100000;

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

async function resolveL2Threshold(supabase: any, campusName: string): Promise<number> {
  if (!campusName) {
    return DEFAULT_L2_THRESHOLD;
  }

  const { data: configRow } = await supabase
    .from("campus_approval_config")
    .select("l2_threshold")
    .eq("campus", campusName)
    .maybeSingle();

  const candidateThreshold = Number((configRow as any)?.l2_threshold);
  if (Number.isFinite(candidateThreshold) && candidateThreshold > 0) {
    return candidateThreshold;
  }

  return DEFAULT_L2_THRESHOLD;
}

export default async function CfoManagePage() {
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
  if (universityRole !== "cfo") {
    redirect("/manage");
  }

  const campusName = String(userProfile.campus || "").trim();
  if (!campusName) {
    redirect("/error");
  }

  const l2Threshold = await resolveL2Threshold(supabase, campusName);

  const fallbackDashboardData: Awaited<ReturnType<typeof fetchCfoDashboardData>> = {
    queue: [],
    metrics: {
      campusRequestedBudgetYtd: 0,
      campusApprovedBudgetYtd: 0,
      highValuePendingRequests: 0,
      highValuePendingBudget: 0,
      l2Threshold,
    },
  };

  let dashboardData: Awaited<ReturnType<typeof fetchCfoDashboardData>> = fallbackDashboardData;
  let dashboardErrorMessage: string | null = null;

  try {
    dashboardData = await fetchCfoDashboardData({
      supabase,
      campus: campusName,
      l2Threshold,
    });
  } catch (error) {
    dashboardErrorMessage =
      error instanceof Error ? error.message : "Unable to load CFO dashboard data right now.";
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {dashboardErrorMessage ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {dashboardErrorMessage}
        </div>
      ) : null}
      <CfoDashboardClient
        campusName={campusName}
        initialQueue={dashboardData.queue}
        initialMetrics={dashboardData.metrics}
      />
    </main>
  );
}
