import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/auth/callback", "/error", "/about", "/auth", "/events", "/event/*", "/fests", "/fest/*", "/clubs", "/club/*", "/Discover", "/contact", "/faq", "/privacy", "/terms", "/cookies", "/pricing", "/solutions", "/support", "/support/*", "/about/*", "/app-download"];

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
    pathname.startsWith("/edit");
  const isHodManagementRoute = pathname.startsWith("/manage/hod");
  const isDeanManagementRoute = pathname.startsWith("/manage/dean");

  if (user && isManagementRoute) {
    if (!user.email) {
      return redirect("/error");
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email)
      .single();

    const canManage =
      Boolean(userData?.is_masteradmin) ||
      Boolean(userData?.is_organiser) ||
      Boolean((userData as any)?.is_hod) ||
      Boolean((userData as any)?.is_dean);

    const universityRole = String((userData as any)?.university_role || "").toLowerCase();
    const canAccessHodRoute =
      Boolean(userData?.is_masteradmin) ||
      Boolean((userData as any)?.is_hod) ||
      universityRole === "hod";
    const canAccessDeanRoute =
      Boolean(userData?.is_masteradmin) ||
      Boolean((userData as any)?.is_dean) ||
      universityRole === "dean";

    if (isHodManagementRoute && (error || !userData || !canAccessHodRoute)) {
      return redirect("/error");
    }

    if (isDeanManagementRoute && (error || !userData || !canAccessDeanRoute)) {
      return redirect("/error");
    }

    if (
      !isHodManagementRoute &&
      !isDeanManagementRoute &&
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
