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
  is_archived?: boolean | null;
  is_draft?: boolean | null;
  created_by?: string | null;
  organizer_email?: string | null;
}

interface EventsSectionProps {
  title: string;
  events: Event[];
  showAll?: boolean;
  baseUrl?: string;
  archivedVisualMode?: "tag" | "muted";
  onArchiveToggle?: (eventId: string, shouldArchive: boolean) => Promise<void>;
  archiveLoadingIds?: Set<string>;
  approvalStatuses?: Record<string, "pending_approvals" | "live">;
}

export const EventsSection = ({
  title,
  events,
  baseUrl = "event",
  archivedVisualMode = "tag",
  onArchiveToggle,
  archiveLoadingIds = new Set(),
  approvalStatuses = {},
}: EventsSectionProps) => {
  return (
    <div className="min-w-0">
      <SectionHeader title={title} link="events" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
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
            idForLink={event.event_id}
            isArchived={Boolean(event.is_archived)}
            isDraft={Boolean(event.is_draft)}
            isPendingApproval={approvalStatuses[event.event_id] === "pending_approvals"}
            archivedVisualMode={archivedVisualMode}
            onArchiveToggle={onArchiveToggle}
            isArchiveLoading={archiveLoadingIds.has(event.event_id)}
            createdBy={event.created_by}
            organizerEmail={event.organizer_email}
          />
        ))}
      </div>
    </div>
  );
};
