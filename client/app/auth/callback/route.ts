import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Helper to determine organization type
const getOrganizationType = (email: string): 'christ_member' | 'outsider' => {
  return email.toLowerCase().endsWith('@christuniversity.in') ? 'christ_member' : 'outsider';
};

// Create or update user in database (server-side for speed)
async function createUserInDatabase(user: any) {
  try {
    const orgType = getOrganizationType(user.email);
    
    let fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
    let registerNumber = null;
    let course = null;
    
    if (orgType === 'christ_member') {
      const emailParts = user.email.split("@");
      if (emailParts.length === 2) {
        const domainParts = emailParts[1].split(".");
        if (domainParts.length > 0) {
          const possibleCourse = domainParts[0].toUpperCase();
          if (possibleCourse && possibleCourse !== "CHRISTUNIVERSITY") {
            course = possibleCourse;
          }
        }
      }
      
      if (user.user_metadata?.last_name) {
        const lastNameStr = user.user_metadata.last_name.trim();
        if (/^\d+$/.test(lastNameStr)) {
          registerNumber = lastNameStr;
        }
      } else if (fullName) {
        const nameParts = fullName.split(" ");
        if (nameParts.length > 1) {
          const lastPart = nameParts[nameParts.length - 1].trim();
          if (/^\d+$/.test(lastPart)) {
            registerNumber = lastPart;
            fullName = nameParts.slice(0, nameParts.length - 1).join(" ");
          }
        }
      }
    }
    
    const payload = {
      id: user.id,
      email: user.email,
      name: fullName || user.email?.split("@")[0],
      avatar_url: user.user_metadata?.avatar_url,
      register_number: registerNumber,
      course: course
    };

    // Fire and forget - don't wait for response to speed up redirect
    fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: payload }),
    }).catch(err => console.error("Background user creation error:", err));
    
  } catch (error) {
    console.error("Error preparing user data:", error);
  }
}

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

    // Create/update user in database (fire and forget for speed)
    createUserInDatabase(session.user);

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
