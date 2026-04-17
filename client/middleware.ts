import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SERVICE_ROLE_DASHBOARDS,
  hasAnyRoleCode,
  hasServiceRoleAccess,
} from "./lib/roleDashboards";

const publicPaths = ["/", "/auth/callback", "/error", "/about", "/auth", "/events", "/event/*", "/fests", "/fest/*", "/clubs", "/club/*", "/Discover", "/contact", "/faq", "/privacy", "/terms", "/cookies", "/pricing", "/solutions", "/support", "/support/*", "/about/*", "/app-download", "/prototype-website", "/prototype-website/*"];

const isLocalOrigin = (value?: string | null) =>
  /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(value || ""));

function resolveRequestOrigin(params: {
  headerOrigin: string | null;
  requestOrigin: string;
  appUrl?: string | null;
}): string {
  const { headerOrigin, requestOrigin, appUrl } = params;

  if (isLocalOrigin(headerOrigin) || isLocalOrigin(requestOrigin)) {
    return headerOrigin || requestOrigin;
  }

  return headerOrigin || appUrl || requestOrigin;
}

function normalizeRoleCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeUniversityRole(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}

function getActiveRoleCodesFromAssignments(
  assignments: Array<Record<string, unknown>>,
  nowDate: Date = new Date()
): string[] {
  const now = nowDate.getTime();

  const activeCodes = assignments
    .filter((assignment) => {
      if (!assignment || assignment.is_active === false) {
        return false;
      }

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
    })
    .map((assignment) => normalizeRoleCode(assignment.role_code))
    .filter((roleCode) => roleCode.length > 0);

  return Array.from(new Set(activeCodes));
}

function mergeUserDataWithAssignmentRoleCodes(
  userData: Record<string, unknown> | null,
  assignments: Array<Record<string, unknown>>
): Record<string, unknown> | null {
  if (!userData) {
    return userData;
  }

  const existingRoleCodes = Array.isArray(userData.role_codes)
    ? userData.role_codes
        .map((roleCode) => normalizeRoleCode(roleCode))
        .filter((roleCode) => roleCode.length > 0)
    : [];
  const assignmentRoleCodes = getActiveRoleCodesFromAssignments(assignments);
  const roleCodes = Array.from(new Set([...existingRoleCodes, ...assignmentRoleCodes]));

  if (roleCodes.length === 0) {
    return userData;
  }

  return {
    ...userData,
    role_codes: roleCodes,
  };
}

function isRoleLookupBypassError(error: unknown): boolean {
  const code = String((error as any)?.code || "").toUpperCase();
  const message = String((error as any)?.message || "").toLowerCase();

  return (
    code === "42501" ||
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("failed to fetch")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip middleware for static assets, internal Next.js requests and files with extensions
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Handle Cookies and Supabase
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value); // Update request cookies for current execution
            res.cookies.set(name, value, options); // Update response cookies for browser
          });
        },
      },
    }
  );

  // 3. Get user - this might trigger a session refresh
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4. Robust origin detection for redirects
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(':', '');
  const headerOrigin = host ? `${protocol}://${host}` : null;
  const origin = resolveRequestOrigin({
    headerOrigin,
    requestOrigin: req.nextUrl.origin,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  // Helper to maintain cookies on redirect
  const redirect = (path: string) => {
    const redirectUrl = new URL(path, origin);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy updated cookies from our 'res' to the 'redirectResponse'
    res.cookies.getAll().forEach((cookie: any) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  const isPublic = (currentPath: string) =>
    publicPaths.some(
      (publicPath) =>
        currentPath === publicPath ||
        (publicPath.endsWith("/*") &&
          currentPath.startsWith(publicPath.slice(0, -2)))
    );

  if (!user && !isPublic(pathname)) {
    return redirect("/auth");
  }

  const isManagementRoute =
    pathname.startsWith("/manage") ||
    pathname.startsWith("/create") ||
    pathname.startsWith("/edit") ||
    pathname.startsWith("/approvals");
  const isHodManagementRoute = pathname.startsWith("/manage/hod");
  const isDeanManagementRoute = pathname.startsWith("/manage/dean");
  const isCfoManagementRoute = pathname.startsWith("/manage/cfo");
  const isStudentOrganiserManagementRoute = pathname.startsWith("/manage/student-organiser");
  const isFinanceManagementRoute = pathname.startsWith("/manage/finance");
  const isOrganizerManagementRoute = pathname === "/manage/organizer" || pathname.startsWith("/manage/organizer/");
  const isVenueServiceRoute = pathname === "/manage/venue" || pathname.startsWith("/manage/venue/");
  const isItServiceRoute = pathname === "/manage/it" || pathname.startsWith("/manage/it/");
  const isCateringServiceRoute = pathname === "/manage/catering" || pathname.startsWith("/manage/catering/");
  const isStallsServiceRoute = pathname === "/manage/stalls" || pathname.startsWith("/manage/stalls/");
  const matchedServiceRoleRoute = SERVICE_ROLE_DASHBOARDS.find((roleConfig) => {
    const basePath = `/manage/${roleConfig.slug}`;
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  });

  if (user && isManagementRoute) {
    if (!user.email) {
      return redirect("/error");
    }

    const userByAuthUuidResponse = await supabase
      .from("users")
      .select("*")
      .eq("auth_uuid", user.id)
      .maybeSingle();

    let userData = userByAuthUuidResponse.data as Record<string, unknown> | null;
    let error = userByAuthUuidResponse.error;

    if (!userData) {
      const userByEmailResponse = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      userData = userByEmailResponse.data as Record<string, unknown> | null;
      error = userByEmailResponse.error || error;
    }

    if (!userData && error && isRoleLookupBypassError(error)) {
      return res;
    }

    const normalizedUserData = (userData as Record<string, unknown> | null) || null;
    let roleAssignments: Array<Record<string, unknown>> = [];
    let hasRoleAssignmentLookupError = false;

    if (normalizedUserData?.id) {
      const { data: roleAssignmentsData, error: roleAssignmentsError } = await supabase
        .from("user_role_assignments")
        .select("role_code,is_active,valid_from,valid_until")
        .eq("user_id", normalizedUserData.id);

      if (!roleAssignmentsError && Array.isArray(roleAssignmentsData)) {
        roleAssignments = roleAssignmentsData as Array<Record<string, unknown>>;
      } else if (roleAssignmentsError && isRoleLookupBypassError(roleAssignmentsError)) {
        hasRoleAssignmentLookupError = true;
      }
    }

    if (hasRoleAssignmentLookupError) {
      return res;
    }

    const normalizedEmail = String(user.email || "").trim().toLowerCase();
    let subheadFestCount = 0;
    let ownedFestCount = 0;
    if (normalizedEmail) {
      const { data: subheadRows, error: subheadError } = await supabase
        .from("fest_subheads")
        .select("fest_id")
        .eq("user_email", normalizedEmail)
        .eq("is_active", true);

      if (!subheadError && Array.isArray(subheadRows)) {
        subheadFestCount = subheadRows.length;
      } else if (subheadError && isRoleLookupBypassError(subheadError)) {
        subheadFestCount = 1;
      }

      const { data: ownedFestRows, error: ownedFestError } = await supabase
        .from("fests")
        .select("fest_id")
        .or(
          `created_by.eq.${normalizedEmail},contact_email.eq.${normalizedEmail}`
        );

      if (!ownedFestError && Array.isArray(ownedFestRows)) {
        ownedFestCount = ownedFestRows.length;
      } else if (ownedFestError && isRoleLookupBypassError(ownedFestError)) {
        ownedFestCount = 1;
      }
    }
    const isSubhead = subheadFestCount > 0;
    const ownsFests = ownedFestCount > 0;

    const resolvedUserData = mergeUserDataWithAssignmentRoleCodes(
      normalizedUserData,
      roleAssignments
    );
    const userDataForRoleChecks =
      (resolvedUserData as Record<string, unknown> | null) ||
      (userData as Record<string, unknown> | null) ||
      null;
    const normalizedUniversityRole = normalizeUniversityRole(
      userDataForRoleChecks?.university_role
    );
    const isMasterAdmin =
      Boolean(userData?.is_masteradmin) ||
      hasAnyRoleCode(resolvedUserData, ["MASTER_ADMIN"]) ||
      normalizedUniversityRole === "masteradmin" ||
      normalizedUniversityRole === "master_admin";
    const isOrganiser =
      Boolean(userData?.is_organiser) || hasAnyRoleCode(resolvedUserData, ["ORGANIZER"]);
    const isHod =
      Boolean((userData as any)?.is_hod) ||
      hasAnyRoleCode(resolvedUserData, ["HOD"]);
    const isDean =
      Boolean((userData as any)?.is_dean) ||
      hasAnyRoleCode(resolvedUserData, ["DEAN"]);
    const isCfo =
      Boolean((userData as any)?.is_cfo) ||
      hasAnyRoleCode(resolvedUserData, ["CFO"]);
    const isStudentOrganiser =
      Boolean((userData as any)?.is_organiser_student) ||
      hasAnyRoleCode(resolvedUserData, ["ORGANIZER_STUDENT"]);
    const isFinanceOfficer =
      Boolean((userData as any)?.is_finance_officer) ||
      Boolean((userData as any)?.is_finance_office) ||
      hasAnyRoleCode(resolvedUserData, ["ACCOUNTS", "FINANCE_OFFICER"]);
    const hasServiceRole = SERVICE_ROLE_DASHBOARDS.some((roleConfig) =>
      hasServiceRoleAccess(resolvedUserData, roleConfig)
    );
    const canManage =
      isMasterAdmin ||
      isOrganiser ||
      isHod ||
      isDean ||
      isCfo ||
      isStudentOrganiser ||
      isFinanceOfficer ||
      hasServiceRole ||
      isSubhead;
    const isSubheadOnly =
      isSubhead &&
      !isMasterAdmin &&
      !isOrganiser &&
      !isHod &&
      !isDean &&
      !isCfo &&
      !isStudentOrganiser &&
      !isFinanceOfficer &&
      !hasServiceRole;
    // Subheads may only create events, never fests.
    if (isSubheadOnly && pathname.startsWith("/create/fest")) {
      return redirect("/error");
    }
    const canAccessHodRoute =
      isMasterAdmin || isHod;
    const canAccessDeanRoute =
      isMasterAdmin || isDean;
    const canAccessCfoRoute =
      isMasterAdmin || isCfo;
    const canAccessStudentOrganiserRoute =
      isMasterAdmin || isStudentOrganiser;
    const canAccessFinanceRoute =
      isMasterAdmin || isFinanceOfficer;
    const canAccessVenueServiceRouteStrict =
      isMasterAdmin ||
      hasAnyRoleCode(userDataForRoleChecks, ["SERVICE_VENUE"]) ||
      Boolean(userDataForRoleChecks?.is_service_venue) ||
      Boolean(userDataForRoleChecks?.is_venue_manager) ||
      normalizedUniversityRole === "service_venue" ||
      normalizedUniversityRole === "venue_manager";
    const canAccessItServiceRouteStrict =
      isMasterAdmin ||
      hasAnyRoleCode(userDataForRoleChecks, ["SERVICE_IT"]) ||
      Boolean(userDataForRoleChecks?.is_service_it) ||
      Boolean(userDataForRoleChecks?.is_it_service) ||
      normalizedUniversityRole === "service_it" ||
      normalizedUniversityRole === "it_service" ||
      normalizedUniversityRole === "it";
    const canAccessCateringServiceRouteStrict =
      isMasterAdmin ||
      hasAnyRoleCode(userDataForRoleChecks, ["SERVICE_CATERING"]) ||
      Boolean(userDataForRoleChecks?.is_service_catering) ||
      Boolean(userDataForRoleChecks?.is_catering) ||
      normalizedUniversityRole === "service_catering" ||
      normalizedUniversityRole === "catering_service" ||
      normalizedUniversityRole === "catering_vendors";
    const canAccessStallsServiceRouteStrict =
      isMasterAdmin ||
      hasAnyRoleCode(userDataForRoleChecks, ["SERVICE_STALLS"]) ||
      Boolean(userDataForRoleChecks?.is_service_stalls) ||
      Boolean(userDataForRoleChecks?.is_stalls_misc) ||
      Boolean(userDataForRoleChecks?.is_stalls) ||
      normalizedUniversityRole === "service_stalls" ||
      normalizedUniversityRole === "stalls_service" ||
      normalizedUniversityRole === "stalls_misc" ||
      normalizedUniversityRole === "stalls";
    const canAccessOrganizerManagementRoute =
      isMasterAdmin || ownsFests;
    const canAccessServiceRoleRoute = matchedServiceRoleRoute
      ? isMasterAdmin || hasServiceRoleAccess(resolvedUserData, matchedServiceRoleRoute)
      : true;

    if (isHodManagementRoute && (error || !userData || !canAccessHodRoute)) {
      return redirect("/error");
    }

    if (isDeanManagementRoute && (error || !userData || !canAccessDeanRoute)) {
      return redirect("/error");
    }

    if (isCfoManagementRoute && (error || !userData || !canAccessCfoRoute)) {
      return redirect("/error");
    }

    if (isStudentOrganiserManagementRoute && (error || !userData || !canAccessStudentOrganiserRoute)) {
      return redirect("/error");
    }

    if (isFinanceManagementRoute && (error || !userData || !canAccessFinanceRoute)) {
      return redirect("/error");
    }

    if (isVenueServiceRoute && (error || !userData || !canAccessVenueServiceRouteStrict)) {
      return redirect("/error");
    }

    if (isItServiceRoute && (error || !userData || !canAccessItServiceRouteStrict)) {
      return redirect("/error");
    }

    if (isCateringServiceRoute && (error || !userData || !canAccessCateringServiceRouteStrict)) {
      return redirect("/error");
    }

    if (isStallsServiceRoute && (error || !userData || !canAccessStallsServiceRouteStrict)) {
      return redirect("/error");
    }

    if (isOrganizerManagementRoute && (error || !userData || !canAccessOrganizerManagementRoute)) {
      return redirect("/error");
    }

    if (matchedServiceRoleRoute && (error || !userData || !canAccessServiceRoleRoute)) {
      return redirect("/error");
    }

    if (
      !isHodManagementRoute &&
      !isDeanManagementRoute &&
      !isCfoManagementRoute &&
      !isStudentOrganiserManagementRoute &&
      !isFinanceManagementRoute &&
      !isOrganizerManagementRoute &&
      !matchedServiceRoleRoute &&
      isManagementRoute &&
      (error || !userData || !canManage)
    ) {
      return redirect("/error");
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
