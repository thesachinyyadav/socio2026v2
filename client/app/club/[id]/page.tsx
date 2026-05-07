"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import { ClubRecord } from "@/app/actions/clubs";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/app/_components/Home/Footer";
import { getClubBannerCandidates } from "@/app/lib/clubBannerUrl";
import { toClubCategories } from "@/app/lib/clubCategory";
import toast from "react-hot-toast";

const normalizeRoleOptions = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: string[] = [];

  for (const item of value) {
    const role = String(item ?? "").trim();
    if (!role) continue;
    const key = role.toLowerCase();
    if (key === "member" || seen.has(key)) continue;
    seen.add(key);
    options.push(role);
  }

  return options;
};

const readApiBodySafely = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const parseClubApplicants = (value: unknown): Array<{ regno?: string; email?: string }> => {
  const parsed =
    typeof value === "string"
      ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      })()
      : value;

  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
};

const ClubDetailsPage = () => {
  const params = useParams();
  const id = String(params.id ?? "");
  const { userData, session } = useAuth();

  const [club, setClub] = useState<ClubRecord | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applicantRegisterNumber, setApplicantRegisterNumber] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [currentUserRegisterNumber, setCurrentUserRegisterNumber] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const currentEmail = String(userData?.email || session?.user?.email || "")
    .trim()
    .toLowerCase();

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

  useEffect(() => {
    setImageError(false);
    setImageCandidateIndex(0);
  }, [club?.club_banner_url]);

  useEffect(() => {
    let isMounted = true;

    const fallbackRegisterNumber = String(userData?.register_number ?? "").trim();
    if (fallbackRegisterNumber) {
      setCurrentUserRegisterNumber(fallbackRegisterNumber);
    }

    const hydrateUserRegisterNumber = async () => {
      if (!currentEmail) {
        if (isMounted) setCurrentUserRegisterNumber("");
        return;
      }

      const { data, error: userError } = await supabase
        .from("users")
        .select("register_number")
        .eq("email", currentEmail)
        .maybeSingle();

      if (!isMounted || userError) return;

      const nextRegisterNumber = String(
        data?.register_number ?? fallbackRegisterNumber ?? ""
      ).trim();
      setCurrentUserRegisterNumber(nextRegisterNumber);
    };

    void hydrateUserRegisterNumber();

    return () => {
      isMounted = false;
    };
  }, [currentEmail, userData?.register_number]);

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
  const bannerUrl = club.club_banner_url || club.club_image_url || "";
  const website = club.club_web_link || "";
  const categories = toClubCategories(club.category);
  const category = categories[0] || "Uncategorized";
  const baseBannerCandidates = getClubBannerCandidates(bannerUrl);
  const bannerCandidates = [
    ...baseBannerCandidates,
    ...(club.club_image_url && club.club_image_url !== bannerUrl ? [club.club_image_url] : [])
  ];
  const activeBannerUrl = bannerCandidates[imageCandidateIndex] ?? bannerUrl;
  const editors = Array.isArray(club.club_editors) ? club.club_editors : [];
  const canEditClub =
    Boolean(userData?.is_masteradmin) ||
    editors.some((editor) => String(editor || "").trim().toLowerCase() === currentEmail);
  const availableRoles = normalizeRoleOptions(club.club_roles_available);
  const clubApplicants = parseClubApplicants(
    club.clubs_applicants ?? club.clubs_applicant
  );
  const normalizedCurrentRegisterNumber = currentUserRegisterNumber.trim().toUpperCase();
  const isAlreadyApplicant =
    Boolean(currentEmail) &&
    clubApplicants.some((entry) => {
      const applicantEmail = String(entry?.email ?? "").trim().toLowerCase();
      const applicantRegno = String(entry?.regno ?? "").trim().toUpperCase();
      if (applicantEmail && applicantEmail === currentEmail) return true;
      if (normalizedCurrentRegisterNumber && applicantRegno === normalizedCurrentRegisterNumber) {
        return true;
      }
      return false;
    });

  const handleJoinClick = async () => {
    if (isAlreadyApplicant) {
      toast.error("You are already an applicant.", { duration: 3000 });
      return;
    }

    if (!club.club_registrations) {
      toast.error("Registrations are currently closed.", { duration: 3000 });
      return;
    }

    if (!currentEmail) {
      toast.error("Please log in to apply.", { duration: 3000 });
      return;
    }

    if (availableRoles.length === 0) {
      toast.error("No roles are currently available for this club.", { duration: 3000 });
      return;
    }

    const { data: latestUser, error: latestUserError } = await supabase
      .from("users")
      .select("name,email,register_number")
      .eq("email", currentEmail)
      .maybeSingle();

    if (latestUserError) {
      toast.error("Could not verify your profile right now.", { duration: 3000 });
      return;
    }

    const registerNumber = String(
      latestUser?.register_number ?? userData?.register_number ?? ""
    ).trim();

    if (!registerNumber) {
      toast.error("Register number is missing from your profile.", { duration: 3000 });
      return;
    }

    if (registerNumber.toUpperCase().startsWith("VIS")) {
      toast.error("Please login through your university email to apply.", { duration: 3000 });
      return;
    }

    setCurrentUserRegisterNumber(registerNumber);
    setApplicantRegisterNumber(registerNumber);
    setApplicantName(
      String(
        latestUser?.name ??
        userData?.name ??
        session?.user?.user_metadata?.full_name ??
        session?.user?.user_metadata?.name ??
        ""
      ).trim()
    );
    setApplicantEmail(String(latestUser?.email ?? currentEmail).trim().toLowerCase());
    setSelectedRole("");
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedRole) {
      toast.error("Please select a role to apply.", { duration: 3000 });
      return;
    }

    if (!availableRoles.some((role) => role.toLowerCase() === selectedRole.toLowerCase())) {
      toast.error("Please choose a valid role.", { duration: 3000 });
      return;
    }

    if (!session?.access_token) {
      toast.error("Please log in again and retry.", { duration: 3000 });
      return;
    }

    setIsSubmittingApplication(true);

    try {
      const response = await fetch(
        `/api/clubs/${encodeURIComponent(club.club_id)}/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ role: selectedRole }),
        }
      );

      const body = await readApiBodySafely(response);
      if (!response.ok) {
        toast.error(body?.error || body?.message || "Failed to submit application.", {
          duration: 3000,
        });
        return;
      }

      const appliedRole =
        availableRoles.find((role) => role.toLowerCase() === selectedRole.toLowerCase()) ||
        selectedRole;
      const nextApplicant = {
        regno: applicantRegisterNumber,
        name: applicantName,
        email: applicantEmail,
        role_applied_for: appliedRole,
        applied_at:
          typeof body?.applicant?.applied_at === "string"
            ? body.applicant.applied_at
            : new Date().toISOString(),
      };
      setClub((prev) => {
        if (!prev) return prev;
        const existingApplicants = Array.isArray(prev.clubs_applicants)
          ? prev.clubs_applicants
          : Array.isArray(prev.clubs_applicant)
            ? prev.clubs_applicant
            : [];
        const alreadyExists = existingApplicants.some((entry) => {
          const regno = String(entry?.regno ?? "").trim().toUpperCase();
          const email = String(entry?.email ?? "").trim().toLowerCase();
          return (
            regno === String(nextApplicant.regno).trim().toUpperCase() ||
            (email && email === String(nextApplicant.email).trim().toLowerCase())
          );
        });
        if (alreadyExists) return prev;
        return {
          ...prev,
          clubs_applicants: [...existingApplicants, nextApplicant],
          clubs_applicant: [...existingApplicants, nextApplicant],
        };
      });

      toast.success("Application submitted successfully.");
      setIsApplyModalOpen(false);
    } catch {
      toast.error("Failed to submit application. Please try again.", { duration: 3000 });
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="relative h-[260px] w-full overflow-hidden sm:h-[320px]">
        <div className="absolute inset-0">
          {activeBannerUrl && !imageError ? (
            <img
              src={activeBannerUrl}
              alt={name}
              className="h-full w-full object-cover object-center"
              referrerPolicy="no-referrer"
              onError={() => {
                if (imageCandidateIndex < bannerCandidates.length - 1) {
                  setImageCandidateIndex((prev) => prev + 1);
                  return;
                }
                setImageError(true);
              }}
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
          <div className="absolute right-6 top-6 z-20 flex flex-col items-end gap-2">
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
            <Link
              href={`/clubeditor/${club.slug ?? club.club_id}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-[#0f3f95]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Manage
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

              {club.club_registrations ? (
                <button
                  type="button"
                  onClick={handleJoinClick}
                  className={`block w-full rounded-[10px] border-2 px-4 py-3 text-center text-[17px] font-medium transition-colors duration-200 ${isAlreadyApplicant
                    ? "border-[#16a34a] text-[#16a34a] hover:bg-[#ecfdf3]"
                    : "border-[#133f86] text-[#133f86] hover:bg-[#edf2fb]"
                    }`}
                >
                  {isAlreadyApplicant ? "Applied" : `Join ${name}`}
                </button>
              ) : (
                <div className="rounded-[10px] border-2 border-red-200 bg-red-50 px-4 py-3 text-center">
                  <p className="text-[15px] font-semibold text-red-700">Applications Closed</p>
                </div>
              )}
            </div>

          </div>

          <div className="rounded-xl bg-[#f3f6fc] p-6">
            <h3 className="text-3xl font-bold text-[#1f57c3]">Category</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {(categories.length > 0 ? categories : [category]).map((item) => (
                <span
                  key={item}
                  className="inline-flex rounded-full border border-[#2253b5] px-4 py-2 text-base font-medium text-[#2253b5]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {isApplyModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => {
            if (!isSubmittingApplication) {
              setIsApplyModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#d7e3f9] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#e3ebfa] px-6 py-4">
              <h3 className="text-xl font-bold text-[#063168]">Application form</h3>
              <p className="mt-1 text-sm text-[#4f6482]">{`Apply to ${name}`}</p>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4f6482]">
                  Register number
                </label>
                <input
                  value={applicantRegisterNumber}
                  disabled
                  readOnly
                  className="h-11 w-full rounded-xl border border-[#c6d5ee] bg-[#f3f6fc] px-3 text-sm font-semibold text-[#123a7a] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="club-role-select"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4f6482]"
                >
                  Role
                </label>
                <select
                  id="club-role-select"
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-[#c6d5ee] bg-white px-3 text-sm font-medium text-[#123a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                >
                  <option value="">Select role</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-[#e3ebfa] bg-[#f8fbff] px-3 py-2 text-xs text-[#4f6482]">
                <p>
                  <span className="font-semibold text-[#063168]">Name:</span>{" "}
                  {applicantName || "Not available"}
                </p>
                <p className="mt-1 break-all">
                  <span className="font-semibold text-[#063168]">Email:</span>{" "}
                  {applicantEmail || "Not available"}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  disabled={isSubmittingApplication}
                  className="rounded-lg border border-[#b8c8e6] px-4 py-2 text-sm font-semibold text-[#33507f] transition-colors hover:bg-[#eef3fd] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApplication}
                  className="rounded-lg bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0f3f95] disabled:cursor-not-allowed disabled:bg-[#8aa8de]"
                >
                  {isSubmittingApplication ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
};

export default ClubDetailsPage;
