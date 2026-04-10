import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import VolunteerExecutionDashboardClient from "./_components/VolunteerExecutionDashboardClient";
import { fetchVolunteerExecutionData } from "./_lib/fetchVolunteerExecutionData";
import { VolunteerExecutionDashboardData } from "./types";

export const dynamic = "force-dynamic";

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

export default async function VolunteerExecutionPage() {
  if (!hasSupabaseConfig()) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
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

  const resolvedEmail =
    String(userProfile.email || "").trim().toLowerCase() || String(user.email || "").trim().toLowerCase();

  if (!resolvedEmail) {
    redirect("/error");
  }

  const fallbackData: VolunteerExecutionDashboardData = {
    events: [],
    runsheetByEventId: {},
    resourcesByEventId: {},
    incidentsByEventId: {},
    warnings: [],
    hasAccess: false,
  };

  let dashboardData = fallbackData;
  let dashboardError: string | null = null;

  try {
    dashboardData = await fetchVolunteerExecutionData({
      supabase,
      userEmail: resolvedEmail,
    });
  } catch (error) {
    dashboardError =
      error instanceof Error
        ? error.message
        : "Unable to load Volunteer Execution dashboard right now.";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {dashboardError ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {dashboardError}
        </div>
      ) : null}

      <VolunteerExecutionDashboardClient
        userEmail={resolvedEmail}
        userName={String(userProfile.name || "").trim() || null}
        initialData={dashboardData}
      />
    </main>
  );
}
