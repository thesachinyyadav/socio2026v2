"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEvents } from "../../context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { EventCard } from "../_components/Discover/EventCard";
import { PendingFeedbackSection } from "../_components/Discover/PendingFeedbackSection";
import Footer from "../_components/Home/Footer";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 12;

const safeText = (value: unknown, fallback = ""): string => {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const first = value.find((entry) => entry != null);
    return safeText(first, fallback);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = ["event_creator", "fest_creator", "created_by", "title", "name", "email", "fest_title", "id"] as const;
    for (const key of preferred) {
      const candidate = record[key];
      if (candidate != null && typeof candidate !== "object") {
        const normalized = safeText(candidate, "");
        if (normalized) return normalized;
      }
    }
  }
  return fallback;
};

const safeLower = (value: unknown): string => safeText(value, "").toLowerCase();

interface FetchedEvent {
  fest: string;
  id: number;
  event_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  category: string | null;
  claims_applicable: boolean | null;
  registration_fee: number | null;
  event_image_url: string | null;
  organizing_dept: string | null;
  allow_outsiders?: boolean | null;
  is_archived?: boolean | null;
  created_by?: string | null;
  organizer_email?: string | null;
}

interface FilterOption {
  name: string;
  active: boolean;
}

const buildEventsUrl = (category: string | null, searchValue: string) => {
  const params = new URLSearchParams();
  if (category && category.toLowerCase() !== "all") {
    params.set("category", category);
  }

  const normalizedSearch = searchValue.trim();
  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  const queryString = params.toString();
  return queryString ? `/events?${queryString}` : "/events";
};

const EventsPageContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search") || "";
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [currentPage, setCurrentPage] = useState(1);
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Set<string>>(new Set());
  const [localArchivedIds, setLocalArchivedIds] = useState<Set<string>>(new Set());
  const [pendingFeedbackEventIds, setPendingFeedbackEventIds] = useState<Set<string>>(new Set());

  const { allEvents, isLoading, error } = useEvents();
  const { userData, session } = useAuth();

  useEffect(() => {
    if (!userData?.email || !session?.access_token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
    const token = session.access_token;

    fetch(
      `${apiUrl}/api/notifications?email=${encodeURIComponent(userData.email)}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const notifs: any[] = Array.isArray(data?.notifications) ? data.notifications : [];
        // Include all feedback_form notifications regardless of read status
        const feedbackNotifs = notifs.filter((n) => n.type === "feedback_form" && n.eventId);

        if (feedbackNotifs.length === 0) {
          setPendingFeedbackEventIds(new Set());
          return;
        }

        // Filter out events where feedback was already submitted
        const checks = await Promise.all(
          feedbackNotifs.map((n) =>
            fetch(`${apiUrl}/api/feedbacks/${n.eventId}/check`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((r) => (r.ok ? r.json() : { submitted: true, feedback_sent: false }))
              .then((d) => ({ eventId: n.eventId as string, pending: !!d.feedback_sent && !d.submitted }))
              .catch(() => ({ eventId: n.eventId as string, pending: false }))
          )
        );

        const ids = new Set<string>(
          checks.filter((c) => c.pending).map((c) => c.eventId)
        );
        setPendingFeedbackEventIds(ids);
      })
      .catch(() => {});
  }, [userData?.email, session?.access_token]);

  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([
    { name: "All", active: true },
    { name: "Academic", active: false },
    { name: "Cultural", active: false },
    { name: "Sports", active: false },
    { name: "Literary", active: false },
    { name: "Arts", active: false },
    { name: "Innovation", active: false },
    { name: "Free", active: false },
  ]);

  useEffect(() => {
    const activeFilter = filterOptions
      .find((f) => f.active)
      ?.name.toLowerCase();
    const paramToMatch = categoryParam?.toLowerCase();

    if (categoryParam && activeFilter !== paramToMatch) {
      const normalizedCategoryParam = categoryParam.toLowerCase();
      const newActiveExists = filterOptions.some(
        (filter) => filter.name.toLowerCase() === normalizedCategoryParam
      );

      setFilterOptions((prevFilters) =>
        prevFilters.map((filter) => ({
          ...filter,
          active: newActiveExists
            ? filter.name.toLowerCase() === normalizedCategoryParam
            : filter.name === "All",
        }))
      );
    } else if (!categoryParam && activeFilter !== "all") {
      setFilterOptions((prevFilters) =>
        prevFilters.map((filter) => ({
          ...filter,
          active: filter.name === "All",
        }))
      );
    }
  }, [categoryParam]);

  const activeFilterName =
    filterOptions.find((filter) => filter.active)?.name || "All";

  // Sync searchQuery state when URL param changes
  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  // Keep URL in sync as users type in the page-level search box.
  useEffect(() => {
    const normalizedSearch = searchQuery.trim();
    const normalizedParamSearch = searchParam.trim();

    if (normalizedSearch === normalizedParamSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace(buildEventsUrl(categoryParam, normalizedSearch), {
        scroll: false,
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [categoryParam, router, searchParam, searchQuery]);

  const isAdminOrOrganizer = Boolean(userData?.is_organiser || userData?.is_masteradmin);
  
  const eventsToFilter: FetchedEvent[] = (Array.isArray(allEvents) ? allEvents : []).map((event: any) => ({
    ...event,
    title: safeText(event?.title, "Untitled event"),
    venue: safeText(event?.venue, "") || null,
    organizing_dept: safeText(event?.organizing_dept, "") || null,
    category: safeText(event?.category, "") || null,
    fest: safeText(event?.fest, ""),
    created_by: safeText(event?.created_by ?? event?.event_creator ?? event?.fest_creator, "") || null,
    organizer_email: safeText(event?.organizer_email, "") || null,
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
  const filteredEvents = eventsToFilter.filter((event) => {
    // Archive filter - hide archived events from normal users (including locally archived)
    if (localArchivedIds.has(event.event_id)) {
      return false;
    }
    if (!isAdminOrOrganizer && event.is_archived) {
      return false;
    }
    
    // Category filter
    if (activeFilterName !== "All") {
      const eventTagsForFiltering: string[] = [];
      if (event.category) {
        eventTagsForFiltering.push(event.category);
      }
      if (event.registration_fee === 0 || event.registration_fee === null) {
        eventTagsForFiltering.push("Free");
      }
      if (!eventTagsForFiltering.some(
        (tag) => safeLower(tag) === safeLower(activeFilterName)
      )) return false;
    }
    // Text search filter
    if (searchQuery.trim()) {
      const q = safeLower(searchQuery.trim());
      const titleMatch = safeLower(event.title).includes(q);
      const venueMatch = safeLower(event.venue).includes(q);
      const deptMatch = safeLower(event.organizing_dept).includes(q);
      const categoryMatch = safeLower(event.category).includes(q);
      const festMatch = safeLower(event.fest).includes(q);
      if (!titleMatch && !venueMatch && !deptMatch && !categoryMatch && !festMatch) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilterName, searchQuery]);

  const handleFilterClick = (clickedFilterName: string) => {
    setFilterOptions(
      filterOptions.map((filter) => ({
        ...filter,
        active: filter.name === clickedFilterName,
      }))
    );

    const nextCategory = clickedFilterName === "All" ? null : clickedFilterName;
    router.push(buildEventsUrl(nextCategory, searchQuery));
  };

  const handlePageSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(buildEventsUrl(categoryParam, searchQuery), { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#154CB3]"></div>
        <p className="ml-4 text-xl text-[#154CB3]">Loading events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-red-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <p className="mt-4 text-xl text-red-600">Error loading events</p>
        <p className="text-gray-600 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-[#154CB3] text-white rounded hover:bg-[#063168] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 pt-8 pb-8 sm:pt-10 sm:pb-10 max-w-7xl">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-row items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-[#154CB3] leading-tight">
                Explore events
              </h1>
              <p className="text-gray-500 mt-1 text-sm sm:text-base">
                Browse through all upcoming events happening on campus.
              </p>
            </div>
            <Link
              href="/Discover"
              className="mt-1 flex items-center text-[#063168] hover:underline cursor-pointer text-xs sm:text-base shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              Back to Discovery
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="order-2 lg:order-1 flex flex-wrap gap-2">
              {filterOptions.map((filter, index) => (
                <button
                  key={index}
                  onClick={() => handleFilterClick(filter.name)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer touch-manipulation ${
                    filter.active
                      ? "bg-[#154CB3] text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {filter.name}
                </button>
              ))}
            </div>

            <form
              onSubmit={handlePageSearchSubmit}
              className="order-1 lg:order-2 w-full lg:w-[420px] xl:w-[460px] lg:ml-6"
            >
              <label htmlFor="events-page-search" className="sr-only">
                Search events
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="events-page-search"
                    type="text"
                    placeholder="Search by title, venue, department, category, or fest"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-gray-300 px-4 py-2.5 pr-20 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-[#154CB3] focus:border-[#154CB3]"
                  />
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-[#154CB3] hover:bg-[#154CB3]/10 cursor-pointer"
                    >
                      Clear
                    </button>
                  ) : (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m21 21-4.35-4.35m1.6-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-[#154CB3] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3f95] transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>
            </form>
          </div>

          <PendingFeedbackSection />

          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-3 sm:mb-4">
            {`${
              activeFilterName === "All" ? "All" : activeFilterName
            } events (${filteredEvents.length})`}
          </h2>
          <div>
            {paginatedEvents.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {paginatedEvents.map((event) => (
                    <div key={event.id} className="min-w-0 h-full">
                      <EventCard
                        idForLink={event.event_id}
                        title={event.title}
                        festName={event.fest}
                        dept={event.organizing_dept || ""}
                        date={event.event_date}
                        time={event.event_time}
                        location={event.venue || "Venue TBD"}
                        tags={event.category ? [event.category] : []}
                        image={
                          event.event_image_url ||
                          process.env.NEXT_PUBLIC_EVENT_IMAGE_PLACEHOLDER_URL!
                        }
                        isArchived={Boolean(event.is_archived)}
                        onArchiveToggle={handleToggleArchive}
                        isArchiveLoading={archiveUpdatingIds.has(event.event_id)}
                        createdBy={event.created_by}
                        organizerEmail={event.organizer_email}
                        feedbackUrl={
                          pendingFeedbackEventIds.has(event.event_id)
                            ? `/feedback/${event.event_id}`
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {filteredEvents.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-center items-center gap-4 mt-12">
                    <button
                      onClick={() => {
  setCurrentPage((p) => Math.max(1, p - 1));
  window.scrollTo({ top: 0, behavior: "smooth" }); // scroll to top after going to previous page
}}
                      disabled={currentPage === 1}
                      className="px-6 py-3 bg-[#154CB3] text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors font-medium"
                    >
                      Previous
                    </button>
                    <span className="text-gray-700 font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => {
  setCurrentPage((p) => Math.min(totalPages, p + 1));
  window.scrollTo({ top: 0, behavior: "smooth" }); // scroll to top after going to next page
}}
                      disabled={currentPage === totalPages}
                      className="px-6 py-3 bg-[#154CB3] text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-2 text-lg sm:text-xl font-bold text-gray-700 mb-2">
                  No events found
                </h3>
                <p className="text-gray-500 text-sm sm:text-base">
                  Try adjusting your filters or check back later for new events.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

function EventsPageLoadingFallback() {
  return (
    <div className="min-h-screen bg-white flex justify-center items-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#154CB3]"></div>
      <p className="ml-4 text-xl text-[#154CB3]">Loading events...</p>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsPageLoadingFallback />}>
      <EventsPageContent />
    </Suspense>
  );
}
