"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import { ClubRecord } from "@/app/actions/clubs";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/app/_components/Home/Footer";

const ClubDetailsPage = () => {
  const params = useParams();
  const id = String(params.id ?? "");
  const { userData, session } = useAuth();

  const [club, setClub] = useState<ClubRecord | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchClub = async () => {
      setLoading(true);
      setError(null);

      try {
        const bySlug = await supabase.from("clubs").select("*").eq("slug", id).maybeSingle();
        const resolved = bySlug.data
          ? bySlug
          : await supabase.from("clubs").select("*").eq("club_id", id).maybeSingle();

        if (!isMounted) return;

        if (resolved.error) {
          throw new Error(resolved.error.message);
        }

        const nextClub = (resolved.data ?? null) as ClubRecord | null;
        setClub(nextClub);
      } catch (fetchError) {
        if (!isMounted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load club.");
        setClub(null);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    if (id) {
      void fetchClub();
    } else {
      setLoading(false);
      setClub(null);
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

  if (error) {
    return (
      <div className="min-h-screen bg-white px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#063168]">Failed to load details</h1>
        <p className="mt-3 text-gray-600">{error}</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-white px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#063168]">Organization not found</h1>
        <p className="mt-3 text-gray-600">The organization you are looking for does not exist.</p>
      </div>
    );
  }

  const entityLabel =
    club.type === "centre" ? "Centre" : club.type === "cell" ? "Cell" : "Club";
  const name = club.club_name || entityLabel;
  const subtitle = club.subtitle || "";
  const description = club.club_description || "";
  const bannerUrl = club.club_banner_url || "";
  const website = club.club_web_link || "";
  const category = club.category || "Uncategorized";
  const currentEmail = String(userData?.email || session?.user?.email || "")
    .trim()
    .toLowerCase();
  const editors = Array.isArray(club.club_editors) ? club.club_editors : [];
  const canEditClub =
    Boolean(userData?.is_masteradmin) ||
    editors.some((editor) => String(editor || "").trim().toLowerCase() === currentEmail);

  const handleJoinClick = () => {
    setJoinMessage(club.club_registrations ? "Coming soon" : "Registrations closed");
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="relative h-[260px] w-full overflow-hidden sm:h-[320px]">
        <div className="absolute inset-0">
          {bannerUrl && !imageError ? (
            <img
              src={bannerUrl}
              alt={name}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-[#9ea2a8] to-[#46484d]" />
          )}
          <div className="absolute inset-0 bg-black/35" />
        </div>
        <div className="absolute left-4 top-4 z-20">
          <Link
            href="/clubs"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/28 px-4 py-2 text-[15px] font-medium text-white backdrop-blur-md transition-colors duration-200 hover:bg-white/36"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L7.414 8H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
        </div>
        {canEditClub ? (
          <div className="absolute right-6 top-6 z-20">
            <Link
              href={`/edit/clubs/${club.club_id}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-[#0f3f95]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 010 2.828l-8.9 8.9a1 1 0 01-.39.242l-3 1a1 1 0 01-1.266-1.266l1-3a1 1 0 01.242-.39l8.9-8.9a2 2 0 012.828 0z" />
                <path d="M4 16a1 1 0 100 2h12a1 1 0 100-2H4z" />
              </svg>
               {`Edit ${entityLabel.toLowerCase()}`}
             </Link>
           </div>
         ) : null}

        <div className="absolute bottom-10 left-1/2 w-full max-w-6xl -translate-x-1/2 px-6 text-white">
          <span className="inline-flex rounded-full bg-[#1f57c3] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {category}
          </span>
          <h1 className="mt-3 text-5xl font-black leading-none">{name}</h1>
          {subtitle ? <p className="mt-3 text-2xl leading-tight sm:text-4xl">{subtitle}</p> : null}
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="text-4xl font-bold text-[#063168]">About</h2>
          <p className="mt-4 text-xl leading-relaxed text-[#334155]">{description}</p>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl bg-[#f3f6fc] p-6">
            <h3 className="text-3xl font-bold text-[#1f57c3]">Quick Links</h3>
            <div className="mt-5 space-y-4">
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-[10px] bg-[#2253b5] px-4 py-3 text-center text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#1b4699]"
                >
                  Visit Official Website
                </a>
              ) : null}

              <Link
                href="/clubs"
                className="block w-full rounded-[10px] border-2 border-[#2253b5] px-4 py-3 text-center text-[17px] font-medium text-[#2253b5] transition-colors duration-200 hover:bg-[#e9effb]"
              >
                Browse all centres
              </Link>

              <button
                type="button"
                onClick={handleJoinClick}
                className="block w-full rounded-[10px] border-2 border-[#133f86] px-4 py-3 text-center text-[17px] font-medium text-[#133f86] transition-colors duration-200 hover:bg-[#edf2fb]"
              >
                Join {name}
              </button>
            </div>

            {joinMessage ? (
              <p className="mt-3 rounded-md border border-[#d7e3f9] bg-white px-3 py-2 text-sm text-[#133f86]">
                {joinMessage}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl bg-[#f3f6fc] p-6">
            <h3 className="text-3xl font-bold text-[#1f57c3]">Category</h3>
            <span className="mt-4 inline-flex rounded-full border border-[#2253b5] px-4 py-2 text-base font-medium text-[#2253b5]">
              {category}
            </span>
          </div>
        </aside>
      </main>
      <Footer />
    </div>
  );
};

export default ClubDetailsPage;
