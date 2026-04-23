"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { EventCard } from "../Discover/EventCard";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  useEvents,
  EventForCard as ContextEventForCard,
} from "../../../context/EventContext";

const UpcomingEvents = () => {
  const eventsRef = useRef<HTMLDivElement>(null);
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Set<string>>(new Set());
  const [localArchivedIds, setLocalArchivedIds] = useState<Set<string>>(new Set());
  const {
    upcomingEvents,
    isLoading: isLoadingContext,
    error: errorContext,
  } = useEvents();
  const { session, userData } = useAuth();
  const isAdminOrOrganizer = Boolean(userData?.is_organiser || userData?.is_masteradmin);

  // Filter out archived events for normal users (including locally archived)
  const filteredUpcomingEvents = useMemo(() =>
    upcomingEvents.filter(event => {
      if (localArchivedIds.has(String(event.event_id))) return false;
      if (isAdminOrOrganizer) return true;
      return !event.is_archived;
    }),
    [upcomingEvents, isAdminOrOrganizer, localArchivedIds]
  );

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
    // Added simple mount animation using CSS transitions
    const cards = eventsRef.current?.querySelectorAll(
      ".event-card-wrapper"
    ) as NodeListOf<HTMLElement>;

    cards?.forEach((card: HTMLElement) => {
      card.style.opacity = "1";
    });

    // Simple hover effect without GSAP
    const onMouseEnter = (card: HTMLElement) => () => {
      card.style.transform = "translateY(-4px)";
      card.style.transition = "transform 0.25s ease-out";
    };

    const onMouseLeave = (card: HTMLElement) => () => {
      card.style.transform = "translateY(0)";
      card.style.transition = "transform 0.25s ease-out";
    };

    cards?.forEach((card: HTMLElement) => {
      const enter = onMouseEnter(card);
      const leave = onMouseLeave(card);
      card.addEventListener("mouseenter", enter);
      card.addEventListener("mouseleave", leave);

      (card as any)._listeners = { enter, leave };
    });

    return () => {
      cards?.forEach((card: HTMLElement) => {
        const listeners = (card as any)._listeners;
        if (listeners) {
          card.removeEventListener("mouseenter", listeners.enter);
          card.removeEventListener("mouseleave", listeners.leave);
          delete (card as any)._listeners;
        }
      });
    };
  }, [filteredUpcomingEvents, isLoadingContext]);

  if (isLoadingContext) {
    return (
      <div className="flex flex-col items-center justify-center w-full my-16 py-10">
        <p className="text-lg text-[#063168]">Loading upcoming events...</p>
      </div>
    );
  }

  if (filteredUpcomingEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full mt-8 sm:mt-12 md:mt-16 mb-8 sm:mb-12 md:mb-16">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#063168] px-4 text-center">
          Upcoming events
        </h1>
        <p className="mt-4 text-[#1e1e1e8e] text-base sm:text-lg font-medium text-center px-4">
          No upcoming events scheduled at the moment. Check back soon or explore
          all events!
        </p>
        <Link href="/Discover">
          <button className="hover:border-[#154cb3df] hover:bg-[#154cb3df] transition-all duration-200 ease-in-out cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 my-4 sm:my-6 md:mt-10 border-2 border-[#154CB3] text-xs sm:text-sm rounded-full text-white bg-[#154CB3]">
            Explore All Events
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={eventsRef}
      className="flex flex-col items-center justify-center w-full mt-8 sm:mt-12 md:mt-16 mb-8 sm:mb-12 md:mb-16"
    >
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .event-card-wrapper {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }
        .event-card-wrapper:nth-child(1) {
          animation-delay: 0.05s;
        }
        .event-card-wrapper:nth-child(2) {
          animation-delay: 0.1s;
        }
        .event-card-wrapper:nth-child(3) {
          animation-delay: 0.15s;
        }
      `}</style>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#063168] px-4 text-center">
        Upcoming events
      </h1>
      <p className="mt-1 text-[#1e1e1e8e] text-base sm:text-lg font-medium text-center px-4">
        Here's a glimpse of what's next. Don't miss out!
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12 w-full px-4 sm:px-6 lg:px-8">
        {filteredUpcomingEvents.map((event: ContextEventForCard) => {
          const eventCardData = {
            title: event.title,
            dept: event.organizing_dept,
            festName: event.fest,
            date: event.date,
            time: event.time,
            location: event.location,
            tags: event.tags.slice(0, 4),
            image: event.image,
            idForLink: String(event.event_id),
            isArchived: Boolean(event.is_archived),
            isDraft: Boolean(event.is_draft),
            archivedVisualMode: "muted" as const,
            onArchiveToggle: handleToggleArchive,
            isArchiveLoading: archiveUpdatingIds.has(String(event.event_id)),
            createdBy: event.created_by,
            organizerEmail: event.organizer_email,
          };

          return (
            <div className="event-card-wrapper min-w-0 h-full" key={event.event_id}>
              <EventCard {...eventCardData} />
            </div>
          );
        })}
      </div>
      <Link href="/Discover">
        <button className="hover:border-[#154cb3df] hover:bg-[#154cb3df] transition-all duration-200 ease-in-out cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 my-4 sm:my-6 md:mt-10 border-2 border-[#154CB3] text-xs sm:text-sm rounded-full text-white bg-[#154CB3]">
          View more events
        </button>
      </Link>
    </div>
  );
};

export default UpcomingEvents;
