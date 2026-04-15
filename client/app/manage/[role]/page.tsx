import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HodDashboardClient from "../hod/_components/HodDashboardClient";
import { HodApprovalQueueItem } from "../hod/types";
import {
  getServiceRoleConfigBySlug,
  hasServiceRoleAccess,
} from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

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

function normalizeEntityType(value: unknown): "event" | "fest" {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "fest" ? "fest" : "event";
}

function normalizeDateLabel(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchServiceRoleDashboardData({
  serviceRoleCode,
  accessToken,
}: {
  serviceRoleCode: string;
  accessToken: string;
}): Promise<{ queue: HodApprovalQueueItem[]; metrics: { deptBudgetUsedYtd: number; pendingL1Approvals: number } }> {
  const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "").replace(/\/api\/?$/, "");
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for workflow queue fetch.");
  }

  const queueResponse = await fetch(
    `${apiBaseUrl}/api/approvals/service-queues/${encodeURIComponent(serviceRoleCode)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const queuePayload = await queueResponse.json().catch(() => null);
  if (!queueResponse.ok) {
    throw new Error(
      String(queuePayload?.error || "Unable to load service queue from backend workflow API.")
    );
  }

  const items = Array.isArray(queuePayload?.items) ? queuePayload.items : [];

  const queue: HodApprovalQueueItem[] = items
    .map((item: any) => {
      const entityType = normalizeEntityType(item?.entity_type);
      const entityRef = String(item?.entity_id || item?.event_id || "").trim();
      if (!entityRef) {
        return null;
      }

      const details = item?.details && typeof item.details === "object" ? item.details : {};
      const displayName =
        String(details.event_name || details.event_title || details.fest_title || "").trim() ||
        (entityType === "fest" ? `Fest ${entityRef}` : `Event ${entityRef}`);

      const departmentName =
        String(item?.organizing_dept || details.organizing_dept || details.department || "").trim() ||
        "Unknown Department";

      const coordinatorName =
        String(item?.requested_by_email || details.requester_email || details.requested_by_email || "").trim() ||
        "Coordinator";

      const eventDate = normalizeDateLabel(item?.event_date || details.event_date || details.date);

      return {
        id: String(item?.service_request_id || item?.id || "").trim() || entityRef,
        eventId: entityRef,
        eventName: displayName,
        entityType,
        totalBudget: toNumber(details.total_estimated_expense || details.total_budget),
        coordinatorName,
        departmentName,
        eventDate,
        requestedAt: normalizeDateLabel(item?.created_at),
      } as HodApprovalQueueItem;
    })
    .filter((row: HodApprovalQueueItem | null): row is HodApprovalQueueItem => Boolean(row));

  return {
    queue,
    metrics: {
      deptBudgetUsedYtd: 0,
      pendingL1Approvals: queue.length,
    },
  };
}

export default async function ServiceRoleManagePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const roleConfig = getServiceRoleConfigBySlug(role);

  if (!roleConfig) {
    redirect("/error");
  }

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    redirect("/auth");
  }

  if (!session?.access_token) {
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
  const canAccessRole =
    isMasterAdmin || hasServiceRoleAccess(userProfile as Record<string, unknown>, roleConfig);

  if (!canAccessRole) {
    redirect("/error");
  }

  const fallbackDashboardData = {
    queue: [],
    metrics: {
      deptBudgetUsedYtd: 0,
      pendingL1Approvals: 0,
    },
  };

  type ServiceRoleDashboardData = Awaited<ReturnType<typeof fetchServiceRoleDashboardData>>;
  const fallbackDashboardDataTyped: ServiceRoleDashboardData = fallbackDashboardData;

  let dashboardData: ServiceRoleDashboardData = fallbackDashboardDataTyped;
  let dashboardErrorMessage: string | null = null;

  const serviceRoleCode = Array.isArray(roleConfig.roleCodes) && roleConfig.roleCodes.length > 0
    ? String(roleConfig.roleCodes[0] || "").trim().toUpperCase()
    : "";

  try {
    dashboardData = await fetchServiceRoleDashboardData({
      serviceRoleCode,
      accessToken: session.access_token,
    });
  } catch (error) {
    dashboardErrorMessage =
      error instanceof Error
        ? error.message
        : `Unable to load ${roleConfig.label} dashboard data right now.`;
  }

  const departmentName = isMasterAdmin ? "All Departments" : roleConfig.label;

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
        dashboardTitle={`${roleConfig.label} Dashboard`}
        pendingMetricLabel="Pending Service Requests"
        emptyStateTitle={`No pending ${roleConfig.label} requests`}
        emptyStateDescription={`No logistics-phase requests are waiting in the ${roleConfig.label} queue.`}
        eventDetailBasePath="/event"
        decisionMessages={{
          approve: `${roleConfig.label} request approved`,
          return: `${roleConfig.label} request returned for revision`,
        }}
        approvalApiBasePath={`/api/manage/${roleConfig.slug}`}
      />
    </main>
  );
}
