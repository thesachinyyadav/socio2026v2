"use client";

import React, { useEffect, useRef } from "react";
import { EventCard } from "../Discover/EventCard";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  useEvents,
  EventForCard as ContextEventForCard,
} from "../../../context/EventContext";

const UpcomingEvents = () => {
  const eventsRef = useRef<HTMLDivElement>(null);
  const {
    upcomingEvents,
    isLoading: isLoadingContext,
    error: errorContext,
  } = useEvents();

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
        gsap.to(card, { scale: 1.03, duration: 0.3, ease: "power2.out" });
      const onMouseLeave = () =>
        gsap.to(card, { scale: 1, duration: 0.3, ease: "power2.out" });

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-12 mt-8 sm:mt-12 w-full px-4 sm:px-8 md:px-16 lg:px-28">
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
          };

          return (
            <div className="event-card-wrapper" key={event.id}>
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
