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
  club_editors?: string[] | null;
  club_roles_available?: string[] | null;
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
  category?: string | null;
  club_description: string;
  club_banner_url?: string | null;
  club_registrations: boolean;
  club_campus: string[];
  club_editors?: string[];
  club_roles_available: string[];
  club_web_link?: string | null;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function deleteClub(clubId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from("clubs").delete().eq("club_id", clubId);
  if (error) {
    console.error("deleteClub error:", error.message);
    return false;
  }
  return true;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeUrl = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

export async function createClub(input: CreateClubInput): Promise<{
  ok: boolean;
  error?: string;
  club?: ClubRecord;
}> {
  try {
    const clubType = input.type || "club";
    const clubName = String(input.club_name ?? "").trim();
    const description = String(input.club_description ?? "").trim();
    const subtitle = normalizeUrl(input.subtitle);
    const category = normalizeUrl(input.category);
    const website = normalizeUrl(input.club_web_link);
    const banner = normalizeUrl(input.club_banner_url);
    const campus = (Array.isArray(input.club_campus) ? input.club_campus : [])
      .map((c) => String(c).trim())
      .filter(Boolean);
    const roles = (Array.isArray(input.club_roles_available)
      ? input.club_roles_available
      : []
    )
      .map((r) => String(r).trim())
      .filter(Boolean);
    const normalizedRoles = Array.from(
      new Set(
        ["Member", ...roles].map((role) =>
          role.toLowerCase() === "member" ? "Member" : role
        )
      )
    );
    const editors = (Array.isArray(input.club_editors) ? input.club_editors : [])
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean);

    if (!clubName) return { ok: false, error: "Club name is required." };
    if ((clubType === "centre" || clubType === "cell") && !subtitle) {
      return { ok: false, error: "Subtitle is required." };
    }
    if (!category) return { ok: false, error: "Category is required." };
    if (!description) return { ok: false, error: "Description is required." };
    if (campus.length === 0) return { ok: false, error: "Select at least one campus." };
    if (normalizedRoles.length === 0) return { ok: false, error: "Add at least one role." };
    if (website && !website.startsWith("https://")) {
      return { ok: false, error: "Website must be a valid https:// URL." };
    }
    if (banner && !banner.startsWith("https://")) {
      return { ok: false, error: "Banner URL must be a valid https:// URL." };
    }

    const slug = `${slugify(clubName) || "club"}-${Date.now().toString(36)}`;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("clubs")
      .insert({
        type: input.type || "club",
        slug,
        club_name: clubName,
        subtitle,
        category,
        club_description: description,
        club_banner_url: banner,
        club_registrations: Boolean(input.club_registrations),
        club_campus: campus,
        club_editors: editors,
        club_roles_available: normalizedRoles,
        club_web_link: website,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, club: data as ClubRecord };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create club.",
    };
  }
}

export async function updateClub(
  clubId: string,
  input: CreateClubInput
): Promise<{ ok: boolean; error?: string; club?: ClubRecord }> {
  try {
    const id = String(clubId ?? "").trim();
    if (!id) return { ok: false, error: "Club ID is required." };

    const clubName = String(input.club_name ?? "").trim();
    const description = String(input.club_description ?? "").trim();
    const subtitle = normalizeUrl(input.subtitle);
    const category = normalizeUrl(input.category);
    const website = normalizeUrl(input.club_web_link);
    const banner = normalizeUrl(input.club_banner_url);
    const campus = (Array.isArray(input.club_campus) ? input.club_campus : [])
      .map((c) => String(c).trim())
      .filter(Boolean);
    const roles = (Array.isArray(input.club_roles_available)
      ? input.club_roles_available
      : []
    )
      .map((r) => String(r).trim())
      .filter(Boolean);
    const normalizedRoles = Array.from(
      new Set(
        ["Member", ...roles].map((role) =>
          role.toLowerCase() === "member" ? "Member" : role
        )
      )
    );
    const editors = (Array.isArray(input.club_editors) ? input.club_editors : [])
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean);

    if (!clubName) return { ok: false, error: "Club name is required." };

    const supabase = getSupabase();
    const { data: existing, error: existingError } = await supabase
      .from("clubs")
      .select("club_id,type")
      .eq("club_id", id)
      .maybeSingle();

    if (existingError) return { ok: false, error: existingError.message };
    if (!existing) return { ok: false, error: "Club not found." };
    if ((existing.type === "centre" || existing.type === "cell") && !subtitle) {
      return { ok: false, error: "Subtitle is required." };
    }
    if (!category) return { ok: false, error: "Category is required." };
    if (!description) return { ok: false, error: "Description is required." };
    if (campus.length === 0) return { ok: false, error: "Select at least one campus." };
    if (normalizedRoles.length === 0) return { ok: false, error: "Add at least one role." };
    if (website && !website.startsWith("https://")) {
      return { ok: false, error: "Website must be a valid https:// URL." };
    }
    if (banner && !banner.startsWith("https://")) {
      return { ok: false, error: "Banner URL must be a valid https:// URL." };
    }

    const { data, error } = await supabase
      .from("clubs")
      .update({
        type: existing.type,
        club_name: clubName,
        subtitle,
        category,
        club_description: description,
        club_banner_url: banner,
        club_registrations: Boolean(input.club_registrations),
        club_campus: campus,
        club_editors: editors,
        club_roles_available: normalizedRoles,
        club_web_link: website,
      })
      .eq("club_id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, club: data as ClubRecord };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update club.",
    };
  }
}
