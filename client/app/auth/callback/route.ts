import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    console.warn("Auth callback invoked without a 'code' parameter.");
    return NextResponse.redirect(`${APP_URL}/?error=no_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code
    );
    if (exchangeError) {
      console.error(
        "Error exchanging code for session:",
        exchangeError.message
      );
      return NextResponse.redirect(`${APP_URL}/?error=auth_exchange_failed`);
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      console.error(
        "Error getting session after exchange:",
        sessionError.message
      );
      return NextResponse.redirect(`${APP_URL}/?error=session_fetch_failed`);
    }

    if (!session || !session.user || !session.user.email) {
      console.warn(
        "No session or user email found after successful code exchange."
      );
      await supabase.auth.signOut();
      return NextResponse.redirect(`${APP_URL}/?error=auth_incomplete`);
    }

    // Allow all Gmail users (both Christ members and outsiders)
    console.log(`Auth callback successful for: ${session.user.email}`);
    return NextResponse.redirect(`${APP_URL}/Discover`);
  } catch (error) {
    console.error("Unexpected error in auth callback:", error);
    const cookieStore = await cookies();
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    await supabaseClient.auth.signOut();
    return NextResponse.redirect(`${APP_URL}/?error=callback_exception`);
  }
}
