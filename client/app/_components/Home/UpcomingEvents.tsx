"use client";

import React, { useEffect, useRef, useState } from "react";
import { EventCard } from "../Discover/EventCard";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  useEvents,
  EventForCard as ContextEventForCard,
} from "../../../context/EventContext";

const UpcomingEvents = () => {
  const eventsRef = useRef<HTMLDivElement>(null);
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Set<string>>(new Set());
  const {
    upcomingEvents,
    isLoading: isLoadingContext,
    error: errorContext,
  } = useEvents();
  const { session } = useAuth();

  const handleToggleArchive = async (eventId: string, shouldArchive: boolean) => {
    if (!session?.access_token) {
      toast.error("Please sign in again to update archive status.");
      return;
    }

    setArchiveUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/events/${eventId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ archive: shouldArchive }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update archive status.");
      }

      toast.success(shouldArchive ? "Event archived successfully." : "Event moved back to active list.");
    } catch (error: any) {
      console.error("Archive update failed:", error);
      toast.error(error?.message || "Unable to update archive status.");
    } finally {
      setArchiveUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (isLoadingContext || upcomingEvents.length === 0) return;

    gsap.registerPlugin(ScrollTrigger);

    const cards = eventsRef.current?.querySelectorAll(
      ".event-card-wrapper"
    ) as NodeListOf<HTMLElement>;

    cards?.forEach((card: HTMLElement, index: number) => {
      gsap.from(card, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        delay: index * 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 90%",
        },
      });

      const onMouseEnter = () =>
        gsap.to(card, { y: -4, duration: 0.25, ease: "power2.out" });
      const onMouseLeave = () =>
        gsap.to(card, { y: 0, duration: 0.25, ease: "power2.out" });

      card.addEventListener("mouseenter", onMouseEnter);
      card.addEventListener("mouseleave", onMouseLeave);

      (card as any)._gsapListeners = { onMouseEnter, onMouseLeave };
    });

    return () => {
      cards?.forEach((card: HTMLElement) => {
        gsap.killTweensOf(card);
        ScrollTrigger.getAll().forEach((trigger) => {
          if (trigger.trigger === card) {
            trigger.kill();
          }
        });

        const listeners = (card as any)._gsapListeners;
        if (listeners) {
          card.removeEventListener("mouseenter", listeners.onMouseEnter);
          card.removeEventListener("mouseleave", listeners.onMouseLeave);
          delete (card as any)._gsapListeners;
        }
      });
    };
  }, [upcomingEvents, isLoadingContext]);

  if (isLoadingContext) {
    return (
      <div className="flex flex-col items-center justify-center w-full my-16 py-10">
        <p className="text-lg text-[#063168]">Loading upcoming events...</p>
      </div>
    );
  }

  if (upcomingEvents.length === 0) {
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
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#063168] px-4 text-center">
        Upcoming events
      </h1>
      <p className="mt-1 text-[#1e1e1e8e] text-base sm:text-lg font-medium text-center px-4">
        Here's a glimpse of what's next. Don't miss out!
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12 w-full px-4 sm:px-6 lg:px-8">
        {upcomingEvents.map((event: ContextEventForCard) => {
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
            onArchiveToggle: handleToggleArchive,
            isArchiveLoading: archiveUpdatingIds.has(String(event.event_id)),
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
