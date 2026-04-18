"use server";

import { createClient } from "@supabase/supabase-js";

export interface ClubRecord {
  club_id: string;
  club_name: string;
  club_description: string | null;
  club_banner_url: string | null;
  club_web_link: string | null;
  club_registrations: boolean;
  slug: string | null;
  subtitle: string | null;
  category: string | null;
  type: "club" | "centre" | "cell";
  created_at: string;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
