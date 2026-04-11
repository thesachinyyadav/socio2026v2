import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import FinanceDashboardClient from "./_components/FinanceDashboardClient";
import { fetchFinanceDashboardData } from "./_lib/financeDashboardData";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

export const dynamic = "force-dynamic";

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function createSupabaseServerClient() {
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

export default async function FinanceManagePage() {
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

  const supabase = await createSupabaseServerClient();
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
  const isFinanceOfficer =
    hasAnyRoleCode(userProfile, ["ACCOUNTS"]) ||
    Boolean((userProfile as any).is_finance_officer);
  if (!isFinanceOfficer && !isMasterAdmin) {
    redirect("/manage");
  }

  const fallbackData: Awaited<ReturnType<typeof fetchFinanceDashboardData>> = {
    approvals: [],
    advances: [],
    settlements: [],
    warnings: [],
  };

  let dashboardData: Awaited<ReturnType<typeof fetchFinanceDashboardData>> = fallbackData;

  try {
    dashboardData = await fetchFinanceDashboardData({ supabase });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to load Finance dashboard data right now.";
    dashboardData = {
      ...fallbackData,
      warnings: [errorMessage],
    };
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceDashboardClient initialData={dashboardData} />
    </main>
  );
}
