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
}

export interface CarouselDisplayImage {
  id: number;
  src: string;
  link: string;
  title: string;
  department: string;
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
  allow_outsiders?: boolean | null;
}

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
