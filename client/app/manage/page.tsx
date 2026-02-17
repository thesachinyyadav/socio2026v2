"use client";

import React, { useState, useEffect } from "react";
import { EventCard } from "../_components/Discover/EventCard";
import { FestCard } from "../_components/Discover/FestCard";
import { useAuth } from "@/context/AuthContext";
import {
  useEvents,
  FetchedEvent as ContextEvent,
} from "../../context/EventContext";
import { formatDateFull, formatTime } from "@/lib/dateUtils";
import Link from "next/link";
import { getFests } from "@/lib/api";
import { createBrowserClient } from "@supabase/ssr";

interface Fest {
  fest_id: string;
  fest_title: string;
  description: string;
  opening_date: string;
  closing_date: string;
  fest_image_url: string;
  organizing_dept: string;
  created_by?: string;
}

const ITEMS_PER_PAGE = 12;

const ACCREDITATION_BODIES = [
  {
    id: "naac",
    name: "NAAC",
    fullName: "National Assessment and Accreditation Council",
    description: "India's primary accreditation body for higher education institutions.",
    focus: "Governance, teaching learning, research, infrastructure, student support, best practices.",
  },
  {
    id: "nba",
    name: "NBA",
    fullName: "National Board of Accreditation",
    description: "Program level accreditation mainly for engineering and technical courses.",
    focus: "Outcome Based Education, curriculum quality, placements.",
  },
  {
    id: "aacsb",
    name: "AACSB",
    fullName: "Association to Advance Collegiate Schools of Business",
    description: "Global business school accreditation.",
    focus: "Faculty quality, research impact, assurance of learning.",
  },
  {
    id: "acbsp",
    name: "ACBSP",
    fullName: "Accreditation Council for Business Schools and Programs",
    description: "Business program accreditation. More teaching focused than research heavy.",
    focus: "Teaching excellence, student learning outcomes.",
  },
  {
    id: "nirf",
    name: "NIRF",
    fullName: "National Institutional Ranking Framework",
    description: "Not accreditation, but a national ranking framework.",
    focus: "Teaching, research, graduation outcomes, outreach.",
  },
  {
    id: "aicte",
    name: "AICTE",
    fullName: "All India Council for Technical Education",
    description: "Regulatory approval body for technical institutions.",
    focus: "Technical education standards, infrastructure, faculty.",
  },
  {
    id: "ugc",
    name: "UGC",
    fullName: "University Grants Commission",
    description: "Regulatory authority for universities in India.",
    focus: "University standards, grants, governance.",
  },
];

const Page = () => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [eventsPage, setEventsPage] = useState(1);
  const [festsPage, setFestsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"fests" | "events" | "report">("fests");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedReportFest, setSelectedReportFest] = useState<string>("");
  const [selectedAccreditation, setSelectedAccreditation] = useState<string>("");
  const { userData, isMasterAdmin } = useAuth();
  const {
    allEvents: contextAllEvents,
    isLoading: isLoadingContextEvents,
    error: contextEventsError,
  } = useEvents();

  const [fests, setFests] = useState<Fest[]>([]);
  const [isLoadingFests, setIsLoadingFests] = useState(true);
  const [festsError, setFestsError] = useState<string | null>(null);

  useEffect(() => {
    if (!userData?.email) {
      setIsLoadingFests(false);
      setFests([]);
      return;
    }
    setIsLoadingFests(true);
    setFestsError(null);
    getFests()
      .then((data) => {
        const mappedFests: Fest[] = Array.isArray(data)
          ? data.map((fest: any) => ({
              fest_id: fest.fest_id,
              fest_title: fest.fest_title || fest.title || "Untitled fest",
              description: fest.description || "",
              opening_date: fest.opening_date || null,
              closing_date: fest.closing_date || null,
              fest_image_url: fest.fest_image_url || "",
              organizing_dept: fest.organizing_dept || "",
              created_by: fest.created_by || null,
            }))
          : [];

        // Show all fests for master admin, otherwise filter by created_by
        const userSpecificFests = isMasterAdmin 
          ? mappedFests 
          : mappedFests.filter((fest) => fest.created_by === userData.email);

        setFests(userSpecificFests);
      })
      .catch((error: any) => {
        setFests([]);
        setFestsError(error?.message || "Failed to fetch fests.");
      })
      .finally(() => {
        setIsLoadingFests(false);
      });
  }, [userData?.email, isMasterAdmin]);

  // Get auth token for reminder notifications
  useEffect(() => {
    const getToken = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
    };
    getToken();
  }, []);

  // Show all events for master admin, otherwise filter by created_by
  const userSpecificContextEvents = userData?.email
    ? isMasterAdmin
      ? (contextAllEvents as ContextEvent[])
      : (contextAllEvents as ContextEvent[]).filter(
          (event) => event.created_by === userData.email
        )
    : [];

  const searchedUserEvents = userSpecificContextEvents.filter((event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchedUserFests = fests.filter((fest) =>
    fest.fest_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination helpers
  const paginateArray = <T,>(array: T[], page: number) => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return {
      items: array.slice(startIndex, endIndex),
      totalPages: Math.ceil(array.length / ITEMS_PER_PAGE),
      hasNext: endIndex < array.length,
      hasPrev: page > 1,
    };
  };

  const paginatedFests = paginateArray(searchedUserFests, festsPage);
  const paginatedEvents = paginateArray(searchedUserEvents, eventsPage);

  const getDisplayTagsForEvent = (event: ContextEvent): string[] => {
    const tags: string[] = [];
    if (event.category) {
      tags.push(event.category);
    }
    if (event.registration_fee === 0 || event.registration_fee === null) {
      tags.push("Free");
    } else if (
      typeof event.registration_fee === "number" &&
      event.registration_fee > 0
    ) {
      tags.push("Paid");
    }
    if (event.claims_applicable) {
      tags.push("Claims");
    }
    return tags.filter((tag) => tag).slice(0, 3);
  };

  const formatDate = (dateString: string | null) => {
    return formatDateFull(dateString, "Date TBD");
  };

  const formatTimeStr = (timeString: string | null) => {
    return formatTime(timeString, "Time TBD");
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-10">
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <h1 className="text-3xl sm:text-4xl font-black text-[#154CB3] mb-1 sm:mb-3 mt-6">
                  Manage fests and events
                </h1>
                <div className="hidden sm:flex flex-row items-center space-x-2 flex-nowrap">
                  <Link href="/create/fest">
                    <button
                      type="button"
                      className="bg-[#154CB3] cursor-pointer text-white text-sm py-3 px-4 rounded-full font-medium flex items-center hover:bg-[#154cb3eb] transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create fest
                    </button>
                  </Link>
                  <Link href="/create/event">
                    <button
                      type="button"
                      className="bg-[#154CB3] cursor-pointer text-white text-sm py-3 px-4 rounded-full font-medium flex items-center hover:bg-[#154cb3eb] transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create event
                    </button>
                  </Link>
                </div>
              </div>
              <div className="flex flex-row justify-end items-center space-x-2 mb-4 sm:hidden -mt-1">
                <Link href="/create/fest">
                  <button
                    type="button"
                    className="bg-[#154CB3] cursor-pointer text-white text-xs py-2 px-3 rounded-full font-medium flex items-center hover:bg-[#154cb3eb] transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create fest
                  </button>
                </Link>
                <Link href="/create/event">
                  <button
                    type="button"
                    className="bg-[#154CB3] cursor-pointer text-white text-xs py-2 px-3 rounded-full font-medium flex items-center hover:bg-[#154cb3eb] transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create event
                  </button>
                </Link>
              </div>
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-search-icon lucide-search text-gray-400"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search your fests and events"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Toggle Buttons */}
          <div className="flex gap-3 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("fests")}
              className={`pb-3 px-1 font-semibold text-lg transition-all ${
                activeTab === "fests"
                  ? "text-[#154CB3] border-b-2 border-[#154CB3]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Your fests {searchedUserFests.length > 0 && `(${searchedUserFests.length})`}
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`pb-3 px-1 font-semibold text-lg transition-all ${
                activeTab === "events"
                  ? "text-[#154CB3] border-b-2 border-[#154CB3]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Your events {searchedUserEvents.length > 0 && `(${searchedUserEvents.length})`}
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`pb-3 px-1 font-semibold text-lg transition-all ${
                activeTab === "report"
                  ? "text-[#154CB3] border-b-2 border-[#154CB3]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Report
            </button>
          </div>

          {/* Fests Section */}
          {activeTab === "fests" && (
            <div>
              {isLoadingFests ? (
                <p className="text-gray-500">Loading your fests...</p>
              ) : festsError ? (
                <p className="text-red-500">Error loading fests: {festsError}</p>
              ) : paginatedFests.items.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                    {paginatedFests.items.map((fest) => (
                      <FestCard
                        key={fest.fest_id}
                        id={fest.fest_id}
                        title={fest.fest_title}
                        dept={fest.organizing_dept}
                        description={fest.description}
                        dateRange={`${formatDate(fest.opening_date)} - ${formatDate(
                          fest.closing_date
                        )}`}
                        image={
                          fest.fest_image_url ||
                          "https://placehold.co/400x250/e2e8f0/64748b?text=No+Image"
                        }
                        baseUrl="edit/fest"
                      />
                    ))}
                  </div>
                  {paginatedFests.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8">
                      <button
                        onClick={() => setFestsPage(p => p - 1)}
                        disabled={!paginatedFests.hasPrev}
                        className="px-4 py-2 bg-[#154CB3] text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-gray-700 font-medium">
                        Page {festsPage} of {paginatedFests.totalPages}
                      </span>
                      <button
                        onClick={() => setFestsPage(p => p + 1)}
                        disabled={!paginatedFests.hasNext}
                        className="px-4 py-2 bg-[#154CB3] text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">
                  {searchTerm && !isLoadingFests
                    ? "No fests found matching your search."
                    : "No fests created yet."}
                </p>
              )}
            </div>
          )}

          {/* Events Section */}
          {activeTab === "events" && (
            <div>
              {isLoadingContextEvents ? (
                <p className="text-gray-500">Loading your events...</p>
              ) : contextEventsError ? (
                <p className="text-red-500">
                  Error loading events: {contextEventsError}
                </p>
              ) : paginatedEvents.items.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                    {paginatedEvents.items.map((event) => (
                      <EventCard
                        key={event.id}
                        idForLink={event.event_id}
                        title={event.title}
                        festName={event.fest || ""}
                        dept={event.organizing_dept || "N/A"}
                        date={formatDate(event.event_date)}
                        time={formatTimeStr(event.event_time)}
                        location={event.venue || "TBD"}
                        tags={getDisplayTagsForEvent(event)}
                        image={
                          event.event_image_url ||
                          "https://placehold.co/400x250/e2e8f0/64748b?text=No+Image"
                        }
                        baseUrl="edit/event"
                        authToken={authToken || undefined}
                      />
                    ))}
                  </div>
                  {paginatedEvents.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8">
                      <button
                        onClick={() => setEventsPage(p => p - 1)}
                        disabled={!paginatedEvents.hasPrev}
                        className="px-4 py-2 bg-[#154CB3] text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-gray-700 font-medium">
                        Page {eventsPage} of {paginatedEvents.totalPages}
                      </span>
                      <button
                        onClick={() => setEventsPage(p => p + 1)}
                        disabled={!paginatedEvents.hasNext}
                        className="px-4 py-2 bg-[#154CB3] text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">
                  {searchTerm && !isLoadingContextEvents
                    ? "No events found matching your search."
                    : "No events created yet."}
                </p>
              )}
            </div>
          )}
          {/* Report Section */}
          {activeTab === "report" && (
            <div className="space-y-8">
              {/* Select Fest */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Select Fest</h2>
                <p className="text-sm text-gray-500 mb-4">Choose a fest to generate an accreditation report for.</p>
                <select
                  value={selectedReportFest}
                  onChange={(e) => setSelectedReportFest(e.target.value)}
                  className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all"
                >
                  <option value="">-- Select a fest --</option>
                  {fests.map((fest) => (
                    <option key={fest.fest_id} value={fest.fest_id}>
                      {fest.fest_title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Accreditation */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Select Accreditation</h2>
                <p className="text-sm text-gray-500 mb-4">Choose the accreditation body for the report.</p>
                <select
                  value={selectedAccreditation}
                  onChange={(e) => setSelectedAccreditation(e.target.value)}
                  className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all"
                >
                  <option value="">-- Select accreditation body --</option>
                  {ACCREDITATION_BODIES.map((body) => (
                    <option key={body.id} value={body.id}>
                      {body.name} - {body.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Accreditation Details */}
              {selectedAccreditation && (
                <div className="bg-white border border-[#154CB3]/20 rounded-2xl p-6 shadow-sm">
                  {(() => {
                    const body = ACCREDITATION_BODIES.find((b) => b.id === selectedAccreditation);
                    if (!body) return null;
                    return (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-[#154CB3]/10 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{body.name}</h3>
                            <p className="text-sm text-gray-500">{body.fullName}</p>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{body.description}</p>
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-800">Focus: </span>
                            {body.focus}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Generate Button */}
              {selectedReportFest && selectedAccreditation && (
                <div className="flex justify-start">
                  <button
                    className="bg-[#154CB3] hover:bg-[#0d3580] text-white font-semibold py-3 px-8 rounded-full transition-all hover:shadow-lg cursor-pointer"
                    onClick={() => {
                      // Placeholder for future generation logic
                      alert(`Report generation coming soon!\n\nFest: ${fests.find(f => f.fest_id === selectedReportFest)?.fest_title}\nAccreditation: ${ACCREDITATION_BODIES.find(b => b.id === selectedAccreditation)?.name}`);
                    }}
                  >
                    Generate Report
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Page;
