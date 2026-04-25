"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventsSection } from "../_components/Discover/EventsSection";
import { FullWidthCarousel } from "../_components/Discover/ImageCarousel";
import { FestsSection } from "../_components/Discover/FestSection";
import { CategorySection } from "../_components/Discover/CategorySection";
import { ClubSection } from "../_components/Discover/ClubSection";
import { PendingFeedbackSection } from "../_components/Discover/PendingFeedbackSection";
import Footer from "../_components/Home/Footer";
import { allCentres } from "../lib/centresData";
import { christCampuses } from "../lib/eventFormSchema";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

import {
  useEvents,
  FetchedEvent as ContextFetchedEvent,
  buildDiscoverCampusDatasets,
  matchesSelectedCampus,
} from "../../context/EventContext";

interface Fest {
  id: number | null;
  fest_id: string;
  title: string;
  opening_date: string | null;
  closing_date: string | null;
  description: string | null;
  fest_image_url: string | null;
  organizing_dept: string | null;
  campus_hosted_at?: string | null;
  allowed_campuses?: string[] | string | null;
  venue?: string | null;
  is_archived?: boolean;
  is_draft?: boolean;
  created_by?: string | null;
  archived_at?: string | null;
}

interface Category {
  id: number;
  title: string;
  count: string;
  icon: string;
}

const DEFAULT_DISCOVER_CAMPUS = "Central Campus (Main)";

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const findCampusByQueryValue = (value: string | null) => {
  if (!value) {
    return null;
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return null;
  }

  return (
    christCampuses.find(
      (campus) => normalizeText(campus) === normalizedValue
    ) || null
  );
};

const DiscoverPageContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campusParam = searchParams.get("campus");
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Set<string>>(new Set());
  const [localArchivedIds, setLocalArchivedIds] = useState<Set<string>>(new Set());
  const [localFestArchivedIds, setLocalFestArchivedIds] = useState<Set<string>>(new Set());

  const {
    isLoading: isLoadingEventsFromContext,
    error: errorEventsFromContext,
    allEvents,
  } = useEvents();
  const { session, userData } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

  const [selectedCampus, setSelectedCampus] = useState(DEFAULT_DISCOVER_CAMPUS);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdminOrOrganizer = Boolean(userData?.is_organiser || userData?.is_masteradmin);

  const [allFests, setAllFests] = useState<Fest[]>([]);
  const [isLoadingFests, setIsLoadingFests] = useState(true);
  const [errorFests, setErrorFests] = useState<string | null>(null);

  useEffect(() => {
    const fetchFests = async () => {
      setIsLoadingFests(true);
      setErrorFests(null);
      try {
        const response = await fetch(`${API_URL}/api/fests?status=upcoming&sortBy=opening_date&sortOrder=asc`, {
          headers: session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : undefined,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load fests (status: ${response.status})`);
        }

        const payload = await response.json();
        const data = Array.isArray(payload?.fests) ? payload.fests : [];

        const mappedFests: Fest[] = Array.isArray(data)
          ? data.map((fest: any) => ({
              id: fest.id ?? null,
              fest_id: fest.fest_id,
              title: fest.fest_title || fest.title || "Untitled fest",
              opening_date: fest.opening_date ?? null,
              closing_date: fest.closing_date ?? null,
              description: fest.description ?? null,
              fest_image_url: fest.fest_image_url ?? null,
              organizing_dept: fest.organizing_dept ?? null,
              campus_hosted_at: fest.campus_hosted_at ?? fest.campusHostedAt ?? null,
              allowed_campuses: fest.allowed_campuses ?? fest.allowedCampuses ?? [],
              venue: fest.venue ?? null,
              is_archived: Boolean(fest.is_archived),
              is_draft: Boolean(fest.is_draft),
              created_by: fest.created_by || fest.user_email || fest.organiser_email || null,
              archived_at: fest.archived_at ?? null,
            }))
          : [];

        const sortedFests = mappedFests.sort(
          (a, b) =>
            new Date(a.opening_date ?? 0).getTime() -
            new Date(b.opening_date ?? 0).getTime()
        );
        setAllFests(sortedFests);
      } catch (err: any) {
        setErrorFests(err.message || "Failed to load fests.");
        setAllFests([]);
      } finally {
        setIsLoadingFests(false);
      }
    };

    fetchFests();
  }, [API_URL, session?.access_token]);

  const {
    filteredEvents: allFilteredEvents,
    carouselEvents: campusCarouselEvents,
    trendingEvents: campusTrendingEvents,
    upcomingEvents: campusUpcomingEvents,
  } = useMemo(
    () => buildDiscoverCampusDatasets(allEvents || [], selectedCampus),
    [allEvents, selectedCampus]
  );

  // Filter out archived events for normal users (including locally archived)
  const filterArchivedForNormalUsers = (events: any[]) => {
    const filtered = events.filter(e => {
      if (localArchivedIds.has(String(e.event_id))) return false;
      if (isAdminOrOrganizer) return true;
      return !e.is_archived;
    });
    return filtered;
  };

  const filteredEvents = filterArchivedForNormalUsers(allFilteredEvents);
  const campusTrendingEventsFiltered = filterArchivedForNormalUsers(campusTrendingEvents);
  const campusUpcomingEventsFiltered = filterArchivedForNormalUsers(campusUpcomingEvents);
  const visibleEventIds = useMemo(
    () => new Set(filteredEvents.map((event) => String(event.event_id))),
    [filteredEvents]
  );
  const campusCarouselEventsFiltered = useMemo(() => {
    if (isAdminOrOrganizer) {
      return campusCarouselEvents;
    }

    return campusCarouselEvents.filter((image) => {
      const eventId = image.link?.split("/").filter(Boolean).pop();
      return eventId ? visibleEventIds.has(eventId) : true;
    });
  }, [campusCarouselEvents, isAdminOrOrganizer, visibleEventIds]);

  const filteredUpcomingFests = useMemo(() => {
    const filtered = allFests.filter((fest) => {
      // Filter by campus
      const matchesCampus = matchesSelectedCampus(
        {
          campus_hosted_at: fest.campus_hosted_at,
          allowed_campuses: fest.allowed_campuses,
          venue: fest.venue,
        },
        selectedCampus
      );
      
      // Filter archived fests for normal users (including locally archived)
      if (!matchesCampus) return false;
      if (localFestArchivedIds?.has(String(fest.fest_id))) return false;
      if (isAdminOrOrganizer) return true;
      return !fest.is_archived;
    });

    return filtered.slice(0, 3);
  }, [allFests, selectedCampus, isAdminOrOrganizer, localFestArchivedIds]);

  const dynamicCategories = useMemo(() => {
    const baseCategories: Omit<Category, "count">[] = [
      { id: 1, title: "Academic", icon: "academic" },
      { id: 2, title: "Cultural", icon: "culturals" },
      { id: 3, title: "Sports", icon: "sports" },
      { id: 4, title: "Arts", icon: "arts" },
      { id: 5, title: "Literary", icon: "literary" },
      { id: 6, title: "Innovation", icon: "innovation" },
    ];

    if (isLoadingEventsFromContext || !filteredEvents || filteredEvents.length === 0) {
      return baseCategories.map((cat) => ({ ...cat, count: "0 events" }));
    }

    return baseCategories.map((cat) => {
      const count = filteredEvents.filter(
        (event: ContextFetchedEvent) =>
          normalizeText(event.category) &&
          normalizeText(cat.title) &&
          normalizeText(event.category) === normalizeText(cat.title)
      ).length;
      return { ...cat, count: `${count} event${count !== 1 ? "s" : ""}` };
    });
  }, [filteredEvents, isLoadingEventsFromContext]);

  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, "pending_approvals" | "live">>({});
  useEffect(() => {
    if (!isAdminOrOrganizer || !session?.access_token) return;
    const draftFestIds = allFests.filter(f => f.is_draft).map(f => f.fest_id);
    const draftEventIds = (allEvents || []).filter((e: any) => e.is_draft).map((e: any) => e.event_id);
    const allIds = [...draftFestIds, ...draftEventIds];
    if (!allIds.length) return;
    fetch(`${API_URL}/api/approvals/statuses?ids=${allIds.join(",")}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : {})
      .then(data => setApprovalStatuses(data))
      .catch(() => {});
  }, [isAdminOrOrganizer, session?.access_token, allFests, allEvents]); // eslint-disable-line

  // Use centres from centralized data, show first 3 on Discover page
  const displayCentres = allCentres.slice(0, 3).map(centre => ({
    id: centre.id,
    title: centre.title,
    subtitle: centre.subtitle,
    description: centre.description,
    link: centre.externalLink,
    image: centre.image,
    slug: centre.slug,
  }));

  const handleToggleArchive = async (eventId: string, shouldArchive: boolean) => {
    console.log(`🔄 Archive toggle initiated: eventId=${eventId}, shouldArchive=${shouldArchive}`);
    
    if (!session?.access_token) {
      toast.error("Please sign in again to update archive status.");
      console.error("❌ No access token available");
      return;
    }

    setArchiveUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });

    try {
      const endpoint = `/api/events/${eventId}/archive`;
      console.log(`📤 Sending PATCH request to: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ archive: shouldArchive }),
      });

      console.log(`📨 Response status: ${response.status}`);
      const payload = await response.json().catch(() => null);
      console.log(`📋 Response payload:`, payload);

      if (!response.ok) {
        const errorMsg = payload?.error || `HTTP ${response.status}: Failed to update archive status.`;
        throw new Error(errorMsg);
      }

      // Immediately update local state to reflect change in UI
      if (shouldArchive) {
        setLocalArchivedIds((prev) => new Set(prev).add(eventId));
      } else {
        setLocalArchivedIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }

      toast.success(shouldArchive ? "✅ Event archived successfully." : "✅ Event moved back to active list.");
      console.log(`✅ Archive update successful`);
    } catch (error: any) {
      console.error("❌ Archive update failed:", error);
      toast.error(`❌ ${error?.message || "Unable to update archive status."}`);
    } finally {
      setArchiveUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };


  useEffect(() => {
    const campusFromUrl =
      findCampusByQueryValue(campusParam) || DEFAULT_DISCOVER_CAMPUS;

    setSelectedCampus((previous) =>
      previous === campusFromUrl ? previous : campusFromUrl
    );
  }, [campusParam]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleCampusSelect = (campus: string) => {
    setSelectedCampus(campus);
    setIsDropdownOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    if (campus === DEFAULT_DISCOVER_CAMPUS) {
      params.delete("campus");
    } else {
      params.set("campus", campus);
    }

    const queryString = params.toString();
    router.push(queryString ? `/Discover?${queryString}` : "/Discover", {
      scroll: false,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 sm:px-6 lg:px-10 py-6 max-w-[1200px] pb-16">
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-10">
            <div className="flex-1">
              <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6 tracking-tight">
                Discover events
              </h1>
              <p className="text-gray-500">
                Explore trending events, browse by category, or check out some
                of the upcoming fests.
              </p>
            </div>
            <div
              className="relative w-full md:w-64 mt-4 md:mt-6"
              ref={dropdownRef}
            >
              <div
                className="bg-white rounded-lg px-4 py-3 border-2 border-gray-200 transition-all hover:border-[#154CB3] cursor-pointer"
                onClick={toggleDropdown}
              >
                <div className="flex items-center space-x-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#154CB3] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500">
                      LOCATION
                    </label>
                    <div className="flex items-center justify-between mt-1 text-gray-900">
                      <span className="text-sm font-medium truncate max-w-[160px]">
                        {selectedCampus}
                      </span>
                      <svg
                        className={`h-4 w-4 text-[#154CB3] transform transition-transform ${
                          isDropdownOpen ? "rotate-180" : ""
                        }`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  {christCampuses.map((campus) => (
                    <div
                      key={campus}
                      className={`px-4 py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                        selectedCampus === campus
                          ? "bg-blue-50 text-[#154CB3]"
                          : "text-gray-900"
                      }`}
                      onClick={() => handleCampusSelect(campus)}
                    >
                      {campus}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isLoadingEventsFromContext && (
            <div className="text-center py-10 text-gray-500">
              Loading events...
            </div>
          )}
          {errorEventsFromContext && (
            <div className="text-center py-10 text-red-600 font-semibold">
              Error loading events: {errorEventsFromContext}
            </div>
          )}

          <PendingFeedbackSection />

          {!isLoadingEventsFromContext && !errorEventsFromContext && (
            <>
              {campusCarouselEventsFiltered.length > 0 ? (
                <FullWidthCarousel images={campusCarouselEventsFiltered} />
              ) : (
                <div className="text-center py-8 md:py-12 text-gray-500">
                  No carousel events found for {selectedCampus}.
                </div>
              )}

              {campusTrendingEventsFiltered.length > 0 ? (
                <EventsSection
                  title="Trending events"
                  events={campusTrendingEventsFiltered}
                  baseUrl="event"
                  archivedVisualMode="muted"
                  onArchiveToggle={handleToggleArchive}
                  archiveLoadingIds={archiveUpdatingIds}
                  approvalStatuses={approvalStatuses}
                />
              ) : (
                <div className="my-8 p-6 bg-gray-50 rounded-lg text-center text-gray-500">
                  No trending events found for {selectedCampus}.
                </div>
              )}
            </>
          )}
        </section>

        <section className="mb-12">
          {isLoadingFests && (
            <div className="text-center py-10 text-gray-500">
              Loading fests...
            </div>
          )}
          {errorFests && (
            <div className="text-center py-10 text-red-600 font-semibold">
              Error: {errorFests}
            </div>
          )}
          {!isLoadingFests && !errorFests && (
            <>
              {filteredUpcomingFests.length > 0 ? (
                <FestsSection
                  title="Upcoming fests"
                  fests={filteredUpcomingFests.map((fest: Fest) => {
                    const festIdNum = Number(fest.fest_id) || Number(fest.id) || 0;
                    const openingDate = fest.opening_date
                      ? new Date(fest.opening_date)
                      : new Date();
                    const closingDate = fest.closing_date
                      ? new Date(fest.closing_date)
                      : openingDate;

                    return {
                      fest_id: festIdNum,
                      fest_title: fest.title || "Untitled fest",
                      organizing_dept: fest.organizing_dept || "",
                      description: fest.description || "",
                      dateRange: `${fest.opening_date ?? "TBD"} - ${fest.closing_date ?? "TBD"}`,
                      fest_image_url: fest.fest_image_url || "",
                      opening_date: openingDate,
                      closing_date: closingDate,
                      is_archived: Boolean(fest.is_archived),
                      is_draft: Boolean(fest.is_draft),
                    };
                  })}
                  showAll={true}
                  baseUrl="fest"
                  approvalStatuses={approvalStatuses}
                />
              ) : (
                <div className="my-8 p-6 bg-gray-50 rounded-lg text-center text-gray-500">
                  No upcoming fests found for {selectedCampus}.
                </div>
              )}
            </>
          )}
        </section>

        <section className="mb-12">
          <CategorySection
            title="Browse by category"
            categories={dynamicCategories}
          />
        </section>

        <section className="mb-12">
          <ClubSection
            title="Centers and clubs"
            items={displayCentres}
            type="centre"
            linkUrl="/clubs"
            showAll={true}
          />
        </section>

        {!isLoadingEventsFromContext && !errorEventsFromContext && (
          <>
            {campusUpcomingEventsFiltered.length > 0 ? (
              <EventsSection
                title="Upcoming events"
                events={campusUpcomingEventsFiltered}
                showAll={false}
                baseUrl="event"
                archivedVisualMode="muted"
                onArchiveToggle={handleToggleArchive}
                archiveLoadingIds={archiveUpdatingIds}
                approvalStatuses={approvalStatuses}
              />
            ) : (
                <div className="my-8 p-6 bg-gray-50 rounded-lg text-center text-gray-500">
                  No upcoming events found for {selectedCampus}.
                </div>
              )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

function DiscoverPageLoadingFallback() {
  return (
    <div className="min-h-screen bg-white flex justify-center items-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#154CB3]"></div>
      <p className="ml-4 text-xl text-[#154CB3]">Loading discover page...</p>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverPageLoadingFallback />}>
      <DiscoverPageContent />
    </Suspense>
  );
}
