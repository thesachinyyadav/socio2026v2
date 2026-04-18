"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface EventForCard {
  id: number;
  event_id: string;
  fest: string;
  title: string;
  date: string | null;
  time: string | null;
  location: string;
  tags: string[];
  image: string;
  organizing_dept: string;
  allow_outsiders?: boolean | null;
  is_archived?: boolean | null;
  is_draft?: boolean | null;
}

export interface CarouselDisplayImage {
  id: number;
  src: string;
  link: string;
  title: string;
  department: string;
}

export interface CampusScopedItem {
  campus_hosted_at?: string | null;
  allowed_campuses?: string[] | string | null;
  venue?: string | null;
  location?: string | null;
}

interface EventsContextType {
  allEvents: FetchedEvent[];
  carouselEvents: CarouselDisplayImage[];
  trendingEvents: EventForCard[];
  upcomingEvents: EventForCard[];
  isLoading: boolean;
  error: string | null;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export interface FetchedEvent {
  event_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  end_date: string | null;
  venue: string | null;
  category: string | null;
  department_access: string[] | string | null;
  claims_applicable: boolean | null;
  registration_fee: number | null;
  participants_per_team: number | null;
  event_image_url: string | null;
  banner_url: string | null;
  pdf_url: string | null;
  rules: string | any[] | null;
  schedule: string | Array<{ time: string; activity: string }> | null;
  prizes: string | string[] | null;
  custom_fields: any[] | null;
  organizer_email: string | null;
  organizer_phone: number | string | null;
  whatsapp_invite_link: string | null;
  organizing_dept: string | null;
  id: number;
  fest: string;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  registration_deadline: string | null;
  total_participants: number | null;
  on_spot?: boolean | null;
  allow_outsiders?: boolean | null;
  campus_hosted_at?: string | null;
  allowed_campuses?: string[] | string | null;
  is_archived?: boolean | null;
  is_draft?: boolean | null;
  archived_at?: string | null;
  archived_by?: string | null;
}

const normalizeCampusText = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const CAMPUS_ALIASES: Record<string, string[]> = {
  "central campus main": ["central campus main", "central campus", "main campus", "central"],
  "bannerghatta road campus": ["bannerghatta road campus", "bannerghatta", "bg road"],
  "yeshwanthpur campus": ["yeshwanthpur campus", "yeshwanthpur"],
  "kengeri campus": ["kengeri campus", "kengeri"],
  "delhi ncr campus": ["delhi ncr campus", "delhi ncr", "delhi"],
  "pune lavasa campus": ["pune lavasa campus", "pune lavasa", "lavasa", "pune"],
};

const getCampusMatchers = (selectedCampus: string): string[] => {
  const normalizedCampus = normalizeCampusText(selectedCampus);
  const aliases = CAMPUS_ALIASES[normalizedCampus] || [selectedCampus];

  return Array.from(
    new Set(aliases.map((entry) => normalizeCampusText(entry)).filter(Boolean))
  );
};

const parseCampusField = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      return [trimmed];
    }

    return [];
  }

  return [];
};

const matchesCampusText = (value: string | null | undefined, matchers: string[]): boolean => {
  const normalizedValue = normalizeCampusText(value);
  if (!normalizedValue) return false;

  return matchers.some(
    (matcher) =>
      normalizedValue === matcher ||
      normalizedValue.includes(matcher) ||
      matcher.includes(normalizedValue)
  );
};

export const matchesSelectedCampus = (
  item: CampusScopedItem,
  selectedCampus: string
): boolean => {
  if (!selectedCampus) return true;

  const campusMatchers = getCampusMatchers(selectedCampus);
  if (campusMatchers.length === 0) return true;

  if (matchesCampusText(item.campus_hosted_at, campusMatchers)) {
    return true;
  }

  const allowedCampuses = parseCampusField(item.allowed_campuses);
  if (allowedCampuses.some((campus) => matchesCampusText(campus, campusMatchers))) {
    return true;
  }

  if (
    matchesCampusText(item.venue, campusMatchers) ||
    matchesCampusText(item.location, campusMatchers)
  ) {
    return true;
  }

  return false;
};

const parseComparableDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    parsed.setHours(0, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTodayBoundary = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const isUpcomingEventDate = (eventDate: string | null | undefined): boolean => {
  const parsedDate = parseComparableDate(eventDate);
  if (!parsedDate) return false;
  return parsedDate.getTime() >= getTodayBoundary().getTime();
};

const deriveTags = (event: FetchedEvent): string[] => {
  const tags: string[] = [];

  if (event.category) {
    tags.push(event.category);
  }
  if (event.claims_applicable) {
    tags.push("Claims");
  }
  if (event.registration_fee === 0 || event.registration_fee === null) {
    tags.push("Free");
  } else if (event.registration_fee > 0) {
    tags.push("Paid");
  }

  return tags.filter((tag) => tag && tag.trim() !== "");
};

const toEventCard = (event: FetchedEvent): EventForCard => {
  return {
    id: event.id,
    event_id: event.event_id,
    title: event.title,
    fest: event.fest,
    date: event.event_date,
    time: event.event_time,
    location: event.venue || "Location TBD",
    tags: deriveTags(event),
    image:
      event.event_image_url ||
      process.env.NEXT_PUBLIC_EVENT_IMAGE_PLACEHOLDER_URL!,
    organizing_dept: event.organizing_dept || "TBD",
    allow_outsiders: event.allow_outsiders ?? false,
    is_archived: event.is_archived,
    is_draft: event.is_draft,
  };
};

const toCarouselImage = (event: FetchedEvent): CarouselDisplayImage => {
  return {
    id: event.id,
    src:
      event.banner_url ||
      event.event_image_url ||
      process.env.NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL!,
    link: `/event/${event.event_id}`,
    title: event.title,
    department: event.organizing_dept || "",
  };
};

export const buildDiscoverCampusDatasets = (
  events: FetchedEvent[],
  selectedCampus: string
) => {
  const filteredEvents = (events || []).filter((event) =>
    matchesSelectedCampus(
      {
        campus_hosted_at: event.campus_hosted_at,
        allowed_campuses: event.allowed_campuses,
        venue: event.venue,
      },
      selectedCampus
    )
  );

  const sortedEvents = [...filteredEvents].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const latestEvents = sortedEvents.slice(0, 3);

  const carouselEvents = sortedEvents.slice(0, 3).map(toCarouselImage);
  const trendingEvents = latestEvents.map((event) => {
    const card = toEventCard(event);
    return {
      ...card,
      tags: Array.from(new Set(["Trending", ...card.tags])),
    };
  });

  const upcomingEvents = [...filteredEvents]
    .filter((event) => isUpcomingEventDate(event.event_date))
    .sort((a, b) => {
      const aDate = parseComparableDate(a.event_date)?.getTime() || 0;
      const bDate = parseComparableDate(b.event_date)?.getTime() || 0;
      return aDate - bDate;
    })
    .slice(0, 3)
    .map(toEventCard);

  return {
    filteredEvents,
    carouselEvents,
    trendingEvents,
    upcomingEvents,
  };
};

interface EventsProviderProps {
  children: ReactNode;
  initialAllEvents: FetchedEvent[];
  initialCarouselEvents: CarouselDisplayImage[];
  initialTrendingEvents: EventForCard[];
  initialUpcomingEvents: EventForCard[];
  initialIsLoading?: boolean;
  initialError?: string | null;
}

export const EventsProvider = ({
  children,
  initialAllEvents,
  initialCarouselEvents,
  initialTrendingEvents,
  initialUpcomingEvents,
  initialIsLoading = false,
  initialError = null,
}: EventsProviderProps) => {
  const [allEvents, setAllEvents] = useState<FetchedEvent[]>(initialAllEvents);
  const [carouselEvents, setCarouselEvents] = useState<CarouselDisplayImage[]>(
    initialCarouselEvents
  );
  const [trendingEvents, setTrendingEvents] = useState<EventForCard[]>(
    initialTrendingEvents
  );
  const [upcomingEvents, setUpcomingEvents] = useState<EventForCard[]>(
    initialUpcomingEvents
  );
  const [isLoading, setIsLoading] = useState<boolean>(initialIsLoading);
  const [error, setError] = useState<string | null>(initialError);

  return (
    <EventsContext.Provider
      value={{
        allEvents,
        carouselEvents,
        trendingEvents,
        upcomingEvents,
        isLoading,
        error,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = (): EventsContextType => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return context;
};
