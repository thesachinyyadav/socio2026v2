import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/auth/callback", "/error", "/about", "/auth", "/events", "/event/*", "/fests", "/fest/*", "/clubs", "/club/*", "/Discover", "/contact", "/faq", "/privacy", "/terms", "/cookies", "/pricing", "/solutions", "/support", "/support/*", "/about/*", "/app-download"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLocalhostRequest = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to client/.env.local (or save your env file) and restart Next.js."
    );
    return res;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
  const origin = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);

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
    pathname.startsWith("/bookvenue") ||
    pathname.startsWith("/bookcatering") ||
    pathname.startsWith("/bookstall");
  const isClubEditorDashboardRoute = pathname.startsWith("/clubeditor/");

  const isHodRoute         = pathname.startsWith("/hod");
  const isDeanRoute        = pathname.startsWith("/dean");
  const isCfoRoute         = pathname.startsWith("/cfo");
  const isAccountsRoute    = pathname.startsWith("/accounts");
  const isVenueRoute       = pathname.startsWith("/venue");
  const isCateringRoute    = pathname.startsWith("/catering");
  const isItRoute          = pathname.startsWith("/it");
  const isStallsRoute      = pathname.startsWith("/stalls");
  const isMasterAdminRoute = pathname.startsWith("/masteradmin");
  const isVolunteerRoute   = pathname.startsWith("/volunteer");

  if (user && (isManagementRoute || isHodRoute || isDeanRoute || isCfoRoute || isAccountsRoute || isVenueRoute || isCateringRoute || isItRoute || isStallsRoute || isMasterAdminRoute || isVolunteerRoute || isClubEditorDashboardRoute)) {
    if (!user.email) {
      return redirect("/error");
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("is_organiser, is_masteradmin, is_hod, is_dean, is_cfo, is_accounts_office, is_venue_manager, is_it_support, is_stalls, is_support, register_number, caters")
      .eq("email", user.email)
      .single();

    if (error || !userData) {
      return redirect("/error");
    }

    const canAccessClubEditorRoute = async (
      requestedId: string,
      allowMasterAdminBypass: boolean
    ) => {
      if (!requestedId) {
        return false;
      }

      const byId = await supabase
        .from("clubs")
        .select("club_editors")
        .eq("club_id", requestedId)
        .maybeSingle();
      const resolvedClub = byId.data
        ? byId
        : await supabase
            .from("clubs")
            .select("club_editors")
            .eq("slug", requestedId)
            .maybeSingle();

      if (resolvedClub.error || !resolvedClub.data) {
        return false;
      }

      const editors = Array.isArray((resolvedClub.data as any).club_editors)
        ? ((resolvedClub.data as any).club_editors as unknown[])
        : [];
      const isClubEditor = editors.some(
        (editor) => String(editor || "").trim().toLowerCase() === user.email!.toLowerCase()
      );

      if (isClubEditor) {
        return true;
      }

      if (allowMasterAdminBypass && Boolean(userData.is_masteradmin)) {
        return true;
      }

      return false;
    };

    if (pathname.startsWith("/edit/clubs/")) {
      const requestedId = decodeURIComponent(pathname.split("/")[3] || "").trim();
      const hasAccess = await canAccessClubEditorRoute(requestedId, true);
      if (!hasAccess) {
        return redirect("/error");
      }
      return res;
    }

    if (isClubEditorDashboardRoute) {
      const requestedId = decodeURIComponent(pathname.split("/")[2] || "").trim();
      const hasAccess = await canAccessClubEditorRoute(requestedId, true);
      if (!hasAccess) {
        return redirect("/error");
      }
      return res;
    }

    const canManage = Boolean(userData?.is_organiser) || Boolean(userData?.is_masteradmin);

    if (isManagementRoute && !canManage) {
      // Check if user is an active sub-head of any fest
      const { data: subHeadFests } = await supabase
        .from("fests")
        .select("fest_id, sub_heads")
        .filter("sub_heads", "cs", JSON.stringify([{ email: user.email }]));

      const now = new Date();
      const isSubHead = subHeadFests?.some((fest) => {
        if (!Array.isArray(fest.sub_heads)) return false;
        return fest.sub_heads.some(
          (sh: any) => sh.email === user.email && sh.expiresAt && new Date(sh.expiresAt) > now
        );
      }) ?? false;

      if (!isSubHead) return redirect("/error?error=not_authorized");
    }

    if (isHodRoute && !userData?.is_hod && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isDeanRoute && !userData?.is_dean && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isCfoRoute && !userData?.is_cfo && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isAccountsRoute && !userData?.is_accounts_office && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isVenueRoute && !userData?.is_venue_manager && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isCateringRoute && !userData?.is_masteradmin) {
      const caters = (userData as any)?.caters;
      const list = Array.isArray(caters) ? caters : caters ? [caters] : [];
      const isCaterer = list.some((c: any) => c?.is_catering);
      if (!isCaterer) return redirect("/error?error=not_authorized");
    }

    if (isItRoute && !(userData as any)?.is_it_support && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isStallsRoute && !(userData as any)?.is_stalls && !userData?.is_masteradmin) {
      return redirect("/error?error=not_authorized");
    }

    if (isMasterAdminRoute && !userData?.is_masteradmin && !isLocalhostRequest) {
      return redirect("/error?error=not_authorized");
    }

    if (isVolunteerRoute && !(userData as any)?.register_number) {
      return redirect("/error?error=not_authorized");
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
