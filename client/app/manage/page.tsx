"use client";

import React, { useState, useEffect } from "react";
import { EventCard } from "../_components/Discover/EventCard";
import { FestCard } from "../_components/Discover/FestCard";
import { useAuth } from "@/context/AuthContext";
import {
  useEvents,
  FetchedEvent as ContextEvent,
} from "../../context/EventContext";
import moment from "moment";
import Link from "next/link";
import { getFests } from "@/lib/api";

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

const Page = () => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { userData } = useAuth();
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

        const userSpecificFests = mappedFests.filter(
          (fest) => fest.created_by === userData.email
        );

        setFests(userSpecificFests);
      })
      .catch((error: any) => {
        setFests([]);
        setFestsError(error?.message || "Failed to fetch fests.");
      })
      .finally(() => {
        setIsLoadingFests(false);
      });
  }, [userData?.email]);

  const userSpecificContextEvents = userData?.email
    ? (contextAllEvents as ContextEvent[]).filter(
        (event) => event.created_by === userData.email
      )
    : [];

  const searchedUserEvents = userSpecificContextEvents.filter((event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchedUserFests = fests.filter((fest) =>
    fest.fest_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (!dateString) return "Date TBD";
    return moment(dateString).format("MMM DD, YYYY");
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Time TBD";
    return moment(timeString, "HH:mm:ss").format("hh:mm A");
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
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
              Your fests
            </h2>
            {isLoadingFests ? (
              <p className="text-gray-500">Loading your fests...</p>
            ) : festsError ? (
              <p className="text-red-500">Error loading fests: {festsError}</p>
            ) : searchedUserFests.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                {searchedUserFests.map((fest) => (
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
            ) : (
              <p className="text-gray-500">
                {searchTerm && !isLoadingFests
                  ? "No fests found matching your search."
                  : "No fests created yet."}
              </p>
            )}
          </div>
        </section>

        <section className="mb-12">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
              Your events
            </h2>
            {isLoadingContextEvents ? (
              <p className="text-gray-500">Loading your events...</p>
            ) : contextEventsError ? (
              <p className="text-red-500">
                Error loading events: {contextEventsError}
              </p>
            ) : searchedUserEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                {searchedUserEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    idForLink={event.event_id}
                    title={event.title}
                    festName={event.fest || ""}
                    dept={event.organizing_dept || "N/A"}
                    date={formatDate(event.event_date)}
                    time={formatTime(event.event_time)}
                    location={event.venue || "TBD"}
                    tags={getDisplayTagsForEvent(event)}
                    image={
                      event.event_image_url ||
                      "https://placehold.co/400x250/e2e8f0/64748b?text=No+Image"
                    }
                    baseUrl="edit/event"
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500">
                {searchTerm && !isLoadingContextEvents
                  ? "No events found matching your search."
                  : "No events created yet."}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Page;
