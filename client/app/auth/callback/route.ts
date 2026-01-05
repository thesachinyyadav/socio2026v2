import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_DOMAIN = "christuniversity.in";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    console.warn("Auth callback invoked without a 'code' parameter.");
    return NextResponse.redirect(`${APP_URL}/?error=no_code`);
  }

  const supabase = createRouteHandlerClient({ cookies });

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

    if (!session.user.email.endsWith(ALLOWED_DOMAIN)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${APP_URL}/error?error=invalid_domain`);
    }

    return NextResponse.redirect(`${APP_URL}/Discover`);
  } catch (error) {
    console.error("Unexpected error in auth callback:", error);
    const supabaseClient = createRouteHandlerClient({
      cookies,
    });
    await supabaseClient.auth.signOut();
    return NextResponse.redirect(`${APP_URL}/?error=callback_exception`);
  }
}
