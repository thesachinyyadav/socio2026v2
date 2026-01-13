"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { EventsSection } from "../_components/Discover/EventsSection";
import { FullWidthCarousel } from "../_components/Discover/ImageCarousel";
import { FestsSection } from "../_components/Discover/FestSection";
import { CategorySection } from "../_components/Discover/CategorySection";
import { ClubSection } from "../_components/Discover/ClubSection";
import Footer from "../_components/Home/Footer";
import { getFests } from "@/lib/api";

import {
  useEvents,
  FetchedEvent as ContextFetchedEvent,
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
}

interface Category {
  id: number;
  title: string;
  count: string;
  icon: string;
}

const DiscoverPage = () => {
  const {
    carouselEvents: carouselEventsDataFromContext,
    trendingEvents: trendingEventsDataFromContext,
    upcomingEvents: upcomingEventsDataFromContext,
    isLoading: isLoadingEventsFromContext,
    error: errorEventsFromContext,
    allEvents,
  } = useEvents();

  const [selectedCampus, setSelectedCampus] = useState("Central Campus (Main)");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const christCampuses = [
    "Central Campus (Main)",
    "Bannerghatta Road Campus",
    "Yeshwanthpur Campus",
    "Kengeri Campus",
  ];

  const [upcomingFests, setUpcomingFests] = useState<Fest[]>([]);
  const [isLoadingFests, setIsLoadingFests] = useState(true);
  const [errorFests, setErrorFests] = useState<string | null>(null);

  useEffect(() => {
    const fetchFests = async () => {
      setIsLoadingFests(true);
      setErrorFests(null);
      try {
        const data = await getFests();

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
            }))
          : [];

        const sortedFests = mappedFests.sort(
          (a, b) =>
            new Date(b.opening_date ?? 0).getTime() -
            new Date(a.opening_date ?? 0).getTime()
        );
        const recentFests = sortedFests.slice(0, 3);
        setUpcomingFests(recentFests);
      } catch (err: any) {
        setErrorFests(err.message || "Failed to load fests.");
        setUpcomingFests([]);
      } finally {
        setIsLoadingFests(false);
      }
    };

    fetchFests();
  }, []);

  const dynamicCategories = useMemo(() => {
    const baseCategories: Omit<Category, "count">[] = [
      { id: 1, title: "Academic", icon: "academic" },
      { id: 2, title: "Cultural", icon: "culturals" },
      { id: 3, title: "Sports", icon: "sports" },
      { id: 4, title: "Arts", icon: "arts" },
      { id: 5, title: "Literary", icon: "literary" },
      { id: 6, title: "Innovation", icon: "innovation" },
    ];

    if (isLoadingEventsFromContext || !allEvents || allEvents.length === 0) {
      return baseCategories.map((cat) => ({ ...cat, count: "0 events" }));
    }

    return baseCategories.map((cat) => {
      const count = allEvents.filter(
        (event: ContextFetchedEvent) =>
          event.category && cat.title && 
          event.category.toLowerCase() === cat.title.toLowerCase()
      ).length;
      return { ...cat, count: `${count} event${count !== 1 ? "s" : ""}` };
    });
  }, [allEvents, isLoadingEventsFromContext]);

  const centres = [
    {
      id: 1,
      title: "SDG Cell",
      subtitle: "Sustainable Development Goal Cell",
      description:
        "Committed to integrating UN Sustainable Development Goals into the university's framework through research, education, and community engagement initiatives.",
      link: "Sustainable Development Goal Cell",
      image:
        "https://img.recraft.ai/j8wS9gYWtLzTM61OIZ-hh8kHVDv3_hGRBQIvl8YVe1A/rs:fit:2048:1024:0/q:95/g:no/plain/abs://prod/images/f8478bc3-8c33-4344-b64a-27a521778253@jpg",
    },
    {
      id: 2,
      title: "CAPS",
      subtitle: "Centre for Academic and Professional Support",
      description:
        "Provides academic and professional training, resources, and talks designed to support students' academic excellence and career development with workshops on various skills.",
      link: "Centre for Academic and Professional Support",
      image:
        "https://img.recraft.ai/DXVis5aciXPl_SpXpocvUcec6eLxmTogWC4mTJ-vDOY/rs:fit:2048:1024:0/q:95/g:no/plain/abs://prod/images/18ca971b-fabe-4b20-8fbf-9cdd1528e714@jpg",
    },
    {
      id: 3,
      title: "CAI",
      subtitle: "Centre for Artificial Intelligence",
      description:
        "Dedicated to advancing education, research, and innovation in artificial intelligence, focusing on practical applications of AI technologies in industries and academia.",
      link: "Centre for Artificial Intelligence",
      image:
        "https://img.recraft.ai/fZsh_b0fzcNaVdNLipdxoIPA-pj0NIm_SRLcnRapWRI/rs:fit:2048:1024:0/q:95/g:no/plain/abs://prod/images/76d78cf4-c7a2-479c-bd3d-d46d88cd63b3@jpg",
    },
  ];

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
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl pb-16">
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

          {!isLoadingEventsFromContext && !errorEventsFromContext && (
            <>
              {carouselEventsDataFromContext &&
              carouselEventsDataFromContext.length > 0 ? (
                <FullWidthCarousel images={carouselEventsDataFromContext} />
              ) : (
                <div className="text-center py-8 md:py-12 text-gray-500">
                  No events available for the carousel.
                </div>
              )}

              {trendingEventsDataFromContext &&
              trendingEventsDataFromContext.length > 0 ? (
                <EventsSection
                  title="Trending events"
                  events={trendingEventsDataFromContext}
                  baseUrl="event"
                />
              ) : (
                <div className="my-8 p-6 bg-gray-50 rounded-lg text-center text-gray-500">
                  No trending events at the moment. Check back later!
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
            <FestsSection
              title="Upcoming fests"
              fests={upcomingFests.map((fest: Fest) => {
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
                  fest_image_url: fest.fest_image_url || null,
                  opening_date: openingDate,
                  closing_date: closingDate,
                };
              })}
              showAll={true}
              baseUrl="fest"
            />
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
            items={centres}
            type="centre"
            linkUrl="/clubs"
            showAll={true}
          />
        </section>

        {!isLoadingEventsFromContext && !errorEventsFromContext && (
          <>
            {upcomingEventsDataFromContext &&
            upcomingEventsDataFromContext.length > 0 ? (
              <EventsSection
                title="Upcoming events"
                events={upcomingEventsDataFromContext}
                showAll={false}
                baseUrl="event"
              />
            ) : (
              <div className="my-8 p-6 bg-gray-50 rounded-lg text-center text-gray-500">
                No upcoming events scheduled yet. Stay tuned!
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default DiscoverPage;
