import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

export const dynamic = "force-dynamic";

function resolveSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
}

function getBearerTokenFromRequest(request: Request): string | null {
  const authorizationHeader = request.headers.get("authorization") || "";
  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

function hasSupabaseConfig(): boolean {
  return Boolean(resolveSupabaseUrl() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function hasServiceRoleConfig(): boolean {
  return Boolean(resolveSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function buildSupabaseServerClient() {
  const supabaseUrl = resolveSupabaseUrl()!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });
}

function buildSupabaseAdminClient() {
  const supabaseUrl = resolveSupabaseUrl()!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  const supabase = await buildSupabaseServerClient();
  const bearerToken = getBearerTokenFromRequest(request);
  const {
    data: { user },
    error: userError,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const profileClient = hasServiceRoleConfig()
    ? buildSupabaseAdminClient()
    : supabase;

  const profile = await getCurrentUserProfileWithRoleCodes(profileClient, {
    id: user.id,
    email: user.email,
  });

  if (!profile) {
    return NextResponse.json({ error: "Unable to resolve user profile." }, { status: 404 });
  }

  return NextResponse.json(
    { user: profile },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
