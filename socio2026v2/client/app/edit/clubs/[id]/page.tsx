"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CreateClubForm from "@/app/_components/CreateClubForm";
import { ClubRecord } from "@/app/actions/clubs";
import supabase from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/app/_components/Home/Footer";

export default function EditClubPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { userData, session, isLoading: authLoading } = useAuth();

  const [club, setClub] = useState<ClubRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchClub = async () => {
      setLoading(true);
      setError(null);

      try {
        const byId = await supabase.from("clubs").select("*").eq("club_id", id).maybeSingle();
        const resolved = byId.data
          ? byId
          : await supabase.from("clubs").select("*").eq("slug", id).maybeSingle();

        if (!isMounted) return;
        if (resolved.error) throw new Error(resolved.error.message);

        if (!resolved.data) {
          setClub(null);
          setError("Club not found.");
          return;
        }

        setClub(resolved.data as ClubRecord);
      } catch (fetchError) {
        if (!isMounted) return;
        setClub(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load club.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    if (id) {
      void fetchClub();
    } else {
      setLoading(false);
      setError("Club ID is missing from URL.");
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#154CB3]" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-white px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#063168]">Unable to edit club</h1>
        <p className="mt-3 text-gray-600">{error || "Club not found."}</p>
        <Link href="/masteradmin" className="mt-6 inline-flex rounded-md bg-[#154CB3] px-5 py-2 text-white">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const currentEmail = String(userData?.email || session?.user?.email || "")
    .trim()
    .toLowerCase();
  const editors = Array.isArray(club.club_editors) ? club.club_editors : [];
  const canEditClub =
    Boolean(userData?.is_masteradmin) ||
    editors.some((editor) => String(editor || "").trim().toLowerCase() === currentEmail);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#154CB3]" />
      </div>
    );
  }

  if (!canEditClub) {
    return (
      <div className="min-h-screen bg-white px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#063168]">Access denied</h1>
        <p className="mt-3 text-gray-600">Only assigned club editors or masteradmins can edit this club.</p>
        <Link href="/clubs" className="mt-6 inline-flex rounded-md bg-[#154CB3] px-5 py-2 text-white">
          Back to clubs
        </Link>
      </div>
    );
  }

  const entityLabel =
    club.type === "centre" ? "Centre" : club.type === "cell" ? "Cell" : "Club";
  const entityLabelLower = entityLabel.toLowerCase();

  return (
    <div className="min-h-screen bg-[#f3f5f9]">
      <section className="bg-[#0b3879] px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-5xl">
          <Link href="/masteradmin" className="inline-flex items-center text-[#f3c83a] hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="mt-5 text-5xl font-bold">{`Edit ${entityLabel}`}</h1>
          <p className="mt-2 text-base text-white/90">{`Fill in the details to edit your ${entityLabelLower}.`}</p>
        </div>
      </section>

      <div className="pb-12">
        <CreateClubForm mode="edit" initialClub={club} hideHeader embedded />
      </div>
      <Footer />
    </div>
  );
}
