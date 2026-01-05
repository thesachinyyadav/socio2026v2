"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEvents } from "../../context/EventContext";
import { EventCard } from "../_components/Discover/EventCard";
import Footer from "../_components/Home/Footer";

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
}

interface FilterOption {
  name: string;
  active: boolean;
}

const EventsPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get("category");

  const { allEvents, isLoading, error } = useEvents();

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

  const eventsToFilter = Array.isArray(allEvents) ? allEvents : [];
  const filteredEvents = (eventsToFilter as FetchedEvent[]).filter((event) => {
    if (activeFilterName === "All") {
      return true;
    }
    const eventTagsForFiltering: string[] = [];
    if (event.category) {
      eventTagsForFiltering.push(event.category);
    }
    if (event.registration_fee === 0 || event.registration_fee === null) {
      eventTagsForFiltering.push("Free");
    }
    return eventTagsForFiltering.some(
      (tag) => tag.toLowerCase() === activeFilterName.toLowerCase()
    );
  });

  const handleFilterClick = (clickedFilterName: string) => {
    setFilterOptions(
      filterOptions.map((filter) => ({
        ...filter,
        active: filter.name === clickedFilterName,
      }))
    );
    if (clickedFilterName === "All") {
      router.push(`/events`);
    } else {
      router.push(`/events?category=${clickedFilterName}`);
    }
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
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Explore events
            </h1>
            <Link
              href="/Discover"
              className="flex items-center text-[#063168] hover:underline cursor-pointer text-xs sm:text-base"
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
          <p className="text-gray-500 mb-6 text-sm sm:text-base">
            Browse through all upcoming events happening on campus.
          </p>
          <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
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
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
              {`${
                activeFilterName === "All" ? "All" : activeFilterName
              } events (${filteredEvents.length})`}
            </h2>
            {filteredEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
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
                      "https://via.placeholder.com/400x250.png?text=No+Image+Available"
                    }
                  />
                ))}
              </div>
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

export default EventsPage;
