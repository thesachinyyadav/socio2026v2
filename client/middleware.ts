import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/auth/callback", "/error", "/about", "/auth", "/events", "/event/*", "/fests", "/fest/*", "/clubs", "/club/*", "/Discover", "/contact", "/faq", "/privacy", "/terms", "/cookies", "/pricing", "/solutions", "/support", "/support/*", "/about/*", "/app-download"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
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
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".")
  ) {
    return res;
  }

  const isPublic = (currentPath: string) =>
    publicPaths.some(
      (publicPath) =>
        currentPath === publicPath ||
        (publicPath.endsWith("/*") &&
          currentPath.startsWith(publicPath.slice(0, -2)))
    );

  if (!user && !isPublic(pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    (pathname.startsWith("/manage") ||
      pathname.startsWith("/create") ||
      pathname.startsWith("/edit"))
  ) {
    if (!user.email) {
      const errorRedirectUrl = req.nextUrl.clone();
      errorRedirectUrl.pathname = "/error";
      return NextResponse.redirect(errorRedirectUrl);
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("is_organiser")
      .eq("email", user.email)
      .single();

    if (error || !userData || !userData.is_organiser) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/error";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
