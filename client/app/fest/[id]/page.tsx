"use client";

import React, { useState, useEffect } from "react";
import moment from "moment";
import { EventCard } from "@/app/_components/Discover/EventCard";
import { useParams } from "next/navigation";
import {
  useEvents,
  FetchedEvent as ContextFetchedEvent,
} from "@/context/EventContext";

interface FestDataFromAPI {
  fest_id: string;
  fest_title: string;
  description: string;
  opening_date: string;
  closing_date: string;
  contact_email?: string;
  contact_phone?: string;
  organizing_dept?: string;
  fest_image_url?: string;
}

interface FestDetails {
  id: string;
  title: string;
  description: string;
  openingDate: string;
  closingDate: string;
  contactEmail?: string;
  contactPhone?: string;
  department?: string;
  imageUrl?: string;
}

const FestPage = () => {
  const params = useParams();
  const festIdSlug = params.id as string;

  const {
    allEvents,
    isLoading: isLoadingEventsContext,
    error: errorEventsContext,
  } = useEvents();

  const [festDetails, setFestDetails] = useState<FestDetails | null>(null);
  const [loadingFestDetails, setLoadingFestDetails] = useState(true);
  const [errorFestDetails, setErrorFestDetails] = useState<string | null>(null);
  const [festSpecificEvents, setFestSpecificEvents] = useState<
    ContextFetchedEvent[]
  >([]);

  useEffect(() => {
    if (!festIdSlug) {
      setErrorFestDetails("Fest ID is missing from URL.");
      setLoadingFestDetails(false);
      return;
    }

    setLoadingFestDetails(true);
    setErrorFestDetails(null);

    fetch(`http://localhost:8000/api/fests/${festIdSlug}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Fest with ID '${festIdSlug}' not found.`);
          }
          throw new Error(`Failed to fetch fest data (status: ${res.status})`);
        }
        return res.json();
      })
      .then((data: { fest: FestDataFromAPI }) => {
        if (data.fest) {
          const apiFest = data.fest;
          setFestDetails({
            id: apiFest.fest_id,
            title: apiFest.fest_title,
            description: apiFest.description,
            openingDate: moment(apiFest.opening_date).format("MMM DD, YYYY"),
            closingDate: moment(apiFest.closing_date).format("MMM DD, YYYY"),
            contactEmail: apiFest.contact_email || "N/A",
            contactPhone: apiFest.contact_phone || "N/A",
            department: apiFest.organizing_dept,
            imageUrl: apiFest.fest_image_url,
          });
        } else {
          throw new Error("Fest data not found in API response.");
        }
        setLoadingFestDetails(false);
      })
      .catch((err) => {
        console.error("Error fetching fest details:", err);
        setErrorFestDetails(
          err.message || "An error occurred while fetching fest details."
        );
        setLoadingFestDetails(false);
      });
  }, [festIdSlug]);

  useEffect(() => {
    if (isLoadingEventsContext) {
      return;
    }
    if (!festIdSlug || allEvents.length === 0) {
      setFestSpecificEvents([]);
      return;
    }

    const filtered = allEvents.filter((event) => {
      if (
        !event ||
        typeof event.fest !== "string" ||
        event.fest.trim() === ""
      ) {
        return false;
      }

      const eventFestSlug = event.fest
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      return eventFestSlug === festIdSlug;
    });
    setFestSpecificEvents(filtered);
  }, [isLoadingEventsContext, allEvents, festIdSlug]);

  if (loadingFestDetails) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <p className="text-gray-700 text-lg">Loading fest details...</p>
      </div>
    );
  }

  if (errorFestDetails) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <p className="text-red-500 text-lg">Error: {errorFestDetails}</p>
      </div>
    );
  }

  if (!festDetails) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <p className="text-gray-700 text-lg">Fest not found.</p>
      </div>
    );
  }

  const {
    title,
    description,
    openingDate,
    closingDate,
    contactEmail,
    contactPhone,
  } = festDetails;

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-xl sm:text-3xl font-black text-[#063168] mb-2 mt-4 sm:mt-6">
            {title}
          </h1>
          <p className="text-gray-500 mb-4 mt-4 max-w-full sm:max-w-[75%] text-sm sm:text-base">
            {description}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-gray-200">
            <div className="flex justify-evenly items-center gap-4 sm:gap-6">
              <div className="flex items-start space-x-3 sm:basis-[calc(50%-0.75rem)] md:basis-[calc(25%-1.125rem)]">
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#DBEAFE]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="-1 0 24 24"
                    fill="none"
                    stroke="#154CB3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-calendar-icon lucide-calendar"
                  >
                    <path d="M8 2v4" />
                    <path d="M16 2v4" />
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-700">
                    Fest Opening Date
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {openingDate || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 sm:basis-[calc(50%-0.75rem)] md:basis-[calc(25%-1.125rem)]">
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#DBEAFE]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="-1 0 24 24"
                    fill="none"
                    stroke="#154CB3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-calendar-icon lucide-calendar"
                  >
                    <path d="M8 2v4" />
                    <path d="M16 2v4" />
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-700">
                    Fest Closing Date
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {closingDate || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#DBEAFE]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="-1 0 24 24"
                    fill="none"
                    stroke="#154CB3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-mail-icon lucide-mail"
                  >
                    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-700">
                    Email
                  </h3>
                  {contactEmail && contactEmail !== "N/A" ? (
                    <a
                      href={`mailto:${contactEmail}`}
                      className="text-xs sm:text-sm text-[#063168] hover:underline break-all"
                    >
                      {contactEmail}
                    </a>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-500">N/A</p>
                  )}
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#DBEAFE]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="-1 0 24 24"
                    fill="none"
                    stroke="#154CB3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-phone-icon lucide-phone"
                  >
                    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-700">
                    Phone
                  </h3>
                  {contactPhone && contactPhone !== "N/A" ? (
                    <a
                      href={`tel:${contactPhone}`}
                      className="text-xs sm:text-sm text-[#063168] hover:underline"
                    >
                      {contactPhone}
                    </a>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-500">N/A</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
              Events
            </h2>
            {isLoadingEventsContext ? (
              <p className="text-gray-500">Loading events for this fest...</p>
            ) : errorEventsContext ? (
              <p className="text-red-500">
                Error loading events: {errorEventsContext}
              </p>
            ) : festSpecificEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                {festSpecificEvents.map((event) => {
                  const displayEventDate = event.event_date
                    ? moment(event.event_date).format("MMM DD, YYYY")
                    : "Date TBD";
                  const displayEventTime = event.event_time
                    ? moment(event.event_time, "HH:mm:ss").format("hh:mm A")
                    : "Time TBD";
                  const tags = [];
                  if (event.category) tags.push(event.category);
                  if (event.claims_applicable) tags.push("Claims");
                  if (
                    event.registration_fee === 0 ||
                    event.registration_fee === null
                  )
                    tags.push("Free");
                  else if (
                    typeof event.registration_fee === "number" &&
                    event.registration_fee > 0
                  )
                    tags.push("Paid");

                  return (
                    <EventCard
                      key={event.id}
                      idForLink={event.event_id}
                      title={event.title}
                      dept={event.organizing_dept || "N/A Dept"}
                      date={displayEventDate}
                      time={displayEventTime}
                      location={event.venue || "Venue TBD"}
                      tags={tags.slice(0, 3)}
                      image={
                        event.event_image_url ||
                        "https://via.placeholder.com/400x250.png?text=Event+Image"
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">
                No events currently scheduled for this fest.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FestPage;
