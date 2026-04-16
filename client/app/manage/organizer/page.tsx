import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";
import OrganizerApprovalClient from "./_components/OrganizerApprovalClient";
import { fetchOrganizerDashboardData, type OrganizerDashboardData } from "./_lib/organizerDashboardData";

export const dynamic = "force-dynamic";

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

export default async function OrganizerManagePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
  const isOrganizerTeacher =
    hasAnyRoleCode(userProfile, ["ORGANIZER_TEACHER"]) ||
    Boolean(userProfile.is_organiser);

  if (!isOrganizerTeacher && !isMasterAdmin) {
    redirect("/error");
  }

  const userEmail = String(user.email || "").trim().toLowerCase();

  const fallbackData: OrganizerDashboardData = { queue: [], metrics: { pendingApprovals: 0 } };
  let dashboardData: OrganizerDashboardData = fallbackData;
  let dashboardErrorMessage: string | null = null;

  try {
    dashboardData = await fetchOrganizerDashboardData({ supabase, userEmail });
  } catch (error) {
    dashboardErrorMessage =
      error instanceof Error
        ? error.message
        : "Unable to load organizer dashboard data right now.";
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {dashboardErrorMessage ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {dashboardErrorMessage}
        </div>
      ) : null}
      <OrganizerApprovalClient
        initialQueue={dashboardData.queue}
        initialMetrics={dashboardData.metrics}
      />
    </main>
  );
}
