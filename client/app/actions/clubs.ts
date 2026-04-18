"use server";

import { createClient } from "@supabase/supabase-js";

export interface ClubRecord {
  club_id: string;
  club_name: string;
  club_description: string | null;
  club_banner_url: string | null;
  club_web_link: string | null;
  club_registrations: boolean;
  club_campus: string[];
  slug: string | null;
  subtitle: string | null;
  category: string | null;
  type: "club" | "centre" | "cell";
  created_at: string;
}

export interface CreateClubInput {
  type: "club" | "centre" | "cell";
  club_name: string;
  subtitle?: string | null;
  club_description: string;
  club_banner_url: string;
  club_registrations: boolean;
  club_campus: string[];
  club_editors: string[];
  club_roles_available: string[];
  club_web_link?: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeUrl = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const createSlugFromClubName = (clubName: string): string => {
  const baseSlug = slugify(clubName) || "club";
  return `${baseSlug}-${Date.now().toString(36)}`;
};

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function getCentres(): Promise<ClubRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .in("type", ["centre", "cell"])
    .order("club_name", { ascending: true });

  if (error) {
    console.error("getCentres error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getCentreBySlug(slug: string): Promise<ClubRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found — expected
    console.error("getCentreBySlug error:", error.message); // real DB error
    return null;
  }
  return data;
}

export async function getClubs(): Promise<ClubRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("type", "club")
    .order("club_name", { ascending: true });

  if (error) {
    console.error("getClubs error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getAllOrganizations(): Promise<ClubRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .order("club_name", { ascending: true });

  if (error) {
    console.error("getAllOrganizations error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function deleteClub(clubId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("clubs")
    .delete()
    .eq("club_id", clubId);

  if (error) {
    console.error("deleteClub error:", error.message);
    return false;
  }
  return true;
}

export async function createClub(input: CreateClubInput): Promise<{
  ok: boolean;
  error?: string;
  club?: ClubRecord;
}> {
  try {
    if (input.type !== "club") {
      return {
        ok: false,
        error: "Centre and Cell creation forms are not enabled yet.",
      };
    }

    const clubName = String(input.club_name ?? "").trim();
    const clubDescription = String(input.club_description ?? "").trim();
    const clubBannerUrl = String(input.club_banner_url ?? "").trim();
    const clubWebLink = normalizeUrl(input.club_web_link);
    const subtitle = normalizeUrl(input.subtitle);

    const clubCampus = (Array.isArray(input.club_campus) ? input.club_campus : [])
      .map((campus) => String(campus).trim())
      .filter(Boolean);

    const clubEditors = (Array.isArray(input.club_editors) ? input.club_editors : [])
      .map((email) => String(email).trim().toLowerCase())
      .filter(Boolean);

    const clubRolesAvailable = (
      Array.isArray(input.club_roles_available) ? input.club_roles_available : []
    )
      .map((role) => String(role).trim())
      .filter(Boolean);

    if (!clubName) return { ok: false, error: "Club name is required." };
    if (!clubDescription) return { ok: false, error: "Detailed description is required." };
    if (!clubBannerUrl || !clubBannerUrl.startsWith("https://")) {
      return { ok: false, error: "Club banner URL must be a valid https:// URL." };
    }
    if (clubWebLink && !clubWebLink.startsWith("https://")) {
      return { ok: false, error: "Official website link must be a valid https:// URL." };
    }
    if (clubCampus.length === 0) {
      return { ok: false, error: "Select at least one campus for club availability." };
    }
    if (clubRolesAvailable.length === 0) {
      return { ok: false, error: "Add at least one role in Roles Available." };
    }

    const invalidEditorEmail = clubEditors.find((email) => !EMAIL_REGEX.test(email));
    if (invalidEditorEmail) {
      return { ok: false, error: `Invalid editor email: ${invalidEditorEmail}` };
    }

    const supabase = getSupabase();
    const slug = createSlugFromClubName(clubName);

    const { data, error } = await supabase
      .from("clubs")
      .insert({
        type: input.type,
        slug,
        club_name: clubName,
        subtitle,
        club_description: clubDescription,
        club_banner_url: clubBannerUrl,
        club_registrations: Boolean(input.club_registrations),
        club_campus: clubCampus,
        club_editors: clubEditors,
        club_roles_available: clubRolesAvailable,
        club_web_link: clubWebLink,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "A club with this slug already exists. Please retry with a different name.",
        };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true, club: data as ClubRecord };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create club.",
    };
  }
}
