import React from "react";
import { EventCard } from "./EventCard";
import { SectionHeader } from "./SectionHeader";

interface Event {
  fest: string;
  id: number;
  event_id: string; // Add this field for the event ID
  title: string;
  date?: string | null;
  organizing_dept: string;
  time?: string | null;
  location?: string;
  tags?: string[];
  image: string;
  allow_outsiders?: boolean | null;
}

interface EventsSectionProps {
  title: string;
  events: Event[];
  showAll?: boolean;
  baseUrl?: string;
}

export const EventsSection = ({
  title,
  events,
  baseUrl = "event",
}: EventsSectionProps) => {
  return (
    <div>
      <SectionHeader title={title} link="events" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {events.map((event) => (
          <EventCard
            key={event.id}
            title={event.title}
            dept={event.organizing_dept}
            date={event.date || ""}
            festName={event.fest || ""}
            time={event.time || ""}
            location={event.location || ""}
            tags={event.tags || []}
            image={event.image}
            allowOutsiders={event.allow_outsiders}
            baseUrl={baseUrl}
            idForLink={event.event_id} // Add the event_id for link generation
          />
        ))}
      </div>
    </div>
  );
};
