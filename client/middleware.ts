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
    pathname.startsWith("/edit");
  const isHodManagementRoute = pathname.startsWith("/manage/hod");
  const isDeanManagementRoute = pathname.startsWith("/manage/dean");
  const isCfoManagementRoute = pathname.startsWith("/manage/cfo");
  const isStudentOrganiserManagementRoute = pathname.startsWith("/manage/student-organiser");
  const isFinanceManagementRoute = pathname.startsWith("/manage/finance");
  const matchedServiceRoleRoute = SERVICE_ROLE_DASHBOARDS.find((roleConfig) => {
    const basePath = `/manage/${roleConfig.slug}`;
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  });

  if (user && isManagementRoute) {
    if (!user.email) {
      return redirect("/error");
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email)
      .single();

    const normalizedUserData = (userData as Record<string, unknown> | null) || null;
    let roleAssignments: Array<Record<string, unknown>> = [];

    if (normalizedUserData?.id) {
      const { data: roleAssignmentsData, error: roleAssignmentsError } = await supabase
        .from("user_role_assignments")
        .select("role_code,is_active,valid_from,valid_until")
        .eq("user_id", normalizedUserData.id);

      if (!roleAssignmentsError && Array.isArray(roleAssignmentsData)) {
        roleAssignments = roleAssignmentsData as Array<Record<string, unknown>>;
      }
    }

    const resolvedUserData = mergeUserDataWithAssignmentRoleCodes(
      normalizedUserData,
      roleAssignments
    );
    const isMasterAdmin =
      Boolean(userData?.is_masteradmin) || hasAnyRoleCode(resolvedUserData, ["MASTER_ADMIN"]);
    const isOrganiser =
      Boolean(userData?.is_organiser) || hasAnyRoleCode(resolvedUserData, ["ORGANIZER_TEACHER"]);
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
      hasAnyRoleCode(resolvedUserData, ["ACCOUNTS"]);
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
      hasServiceRole;
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

    if (matchedServiceRoleRoute && (error || !userData || !canAccessServiceRoleRoute)) {
      return redirect("/error");
    }

    if (
      !isHodManagementRoute &&
      !isDeanManagementRoute &&
      !isCfoManagementRoute &&
      !isStudentOrganiserManagementRoute &&
      !isFinanceManagementRoute &&
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
