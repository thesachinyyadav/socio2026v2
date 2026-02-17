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

  if (
    user &&
    (pathname.startsWith("/manage") ||
      pathname.startsWith("/create") ||
      pathname.startsWith("/edit"))
  ) {
    if (!user.email) {
      return redirect("/error");
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("is_organiser")
      .eq("email", user.email)
      .single();

    if (error || !userData || !userData.is_organiser) {
      return redirect("/error");
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
