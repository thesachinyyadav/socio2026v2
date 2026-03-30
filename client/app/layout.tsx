import type { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NavigationBar from "./_components/NavigationBar";
import ChatBot from "./_components/ChatBot";
import { OrganizationJsonLd, WebsiteJsonLd } from "./_components/JsonLd";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Toaster } from "react-hot-toast";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import ClientInit from "./_components/ClientInit";
import MobileDetectionRedirect from "./_components/MobileDetectionRedirect";

import {
  EventsProvider,
  EventForCard,
  CarouselDisplayImage,
  FetchedEvent,
} from "../context/EventContext";

// OPTIMIZATION: Use Incremental Static Regeneration instead of force-dynamic
// This caches the initial data and revalidates every 5 minutes
export const revalidate = 300; // Revalidate every 5 minutes

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SOCIO – Campus Event Management Platform | Christ University",
    template: "%s | SOCIO",
  },
  description:
    "Discover, register, and manage campus events at Christ University. SOCIO is the all-in-one platform for fests, clubs, workshops, and more — built for students and organisers.",
  keywords: [
    "SOCIO",
    "campus events",
    "Christ University",
    "event management",
    "college fests",
    "student events",
    "event registration",
    "university events",
    "clubs",
    "workshops",
    "hackathons",
    "cultural events",
    "tech fests",
    "campus life",
  ],
  authors: [{ name: "SOCIO Team" }],
  creator: "SOCIO",
  publisher: "SOCIO – Christ University",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "SOCIO",
    title: "SOCIO – Campus Event Management Platform | Christ University",
    description:
      "Discover, register, and manage campus events at Christ University. Fests, clubs, workshops, hackathons and more — all in one place.",
    images: [
      {
        url: "/images/withsocio.png",
        width: 1200,
        height: 630,
        alt: "SOCIO – Campus Event Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SOCIO – Campus Event Management Platform | Christ University",
    description:
      "Discover, register, and manage campus events at Christ University. Fests, clubs, workshops and more.",
    images: ["/images/withsocio.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
  manifest: "/manifest.json",
  category: "education",
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

const getRandomEvents = (
  events: FetchedEvent[],
  count: number
): FetchedEvent[] => {
  if (!events || events.length === 0) return [];
  const shuffled = [...events].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, events.length));
};

const transformToEventCardData = (event: FetchedEvent): EventForCard => {
  return {
    id: event.id,
    event_id: event.event_id, // Ensure this is always included
    title: event.title,
    fest: event.fest,
    date: event.event_date,
    time: event.event_time,
    location: event.venue || "Location TBD",
    tags: deriveTags(event),
    image:
      event.event_image_url ||
      "https://placehold.co/400x250/e2e8f0/64748b?text=Event+Image",
    organizing_dept: event.organizing_dept || "TBD",
    allow_outsiders: event.allow_outsiders ?? false,
  };
};

const transformToCarouselImage = (
  event: FetchedEvent
): CarouselDisplayImage => {
  return {
    id: event.id,
    src:
      event.banner_url ||
      event.event_image_url ||
      "https://placehold.co/1200x400/e2e8f0/64748b?text=Event+Banner",
    link: `/event/${event.event_id}`,
    title: event.title,
    department: event.organizing_dept || "",
  };
};

// Create a singleton Supabase client for server-side operations
let serverSupabase: SupabaseClient | null = null;

function getServerSupabase(): SupabaseClient {
  if (serverSupabase) return serverSupabase;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase configuration missing");
  }
  
  serverSupabase = createClient(supabaseUrl, supabaseAnonKey);
  return serverSupabase;
}

async function fetchEventsFromSupabase() {
  const supabase = getServerSupabase();
  
  const { data, error: supabaseError } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (supabaseError) {
    throw new Error(supabaseError.message);
  }

  return data as FetchedEvent[];
}

// OPTIMIZATION: Cache the Supabase query with unstable_cache
const getCachedEvents = unstable_cache(
  fetchEventsFromSupabase,
  ['events-list'],
  { 
    revalidate: 60, // 1 minute - reduced for faster updates when events are modified
    tags: ['events']
  }
);

async function getInitialEventsData() {
  let allEvents: FetchedEvent[] = [];
  let carouselEvents: CarouselDisplayImage[] = [];
  let trendingEvents: EventForCard[] = [];
  let upcomingEvents: EventForCard[] = [];
  let isLoading = true;
  let error: string | null = null;

  try {
    // Use cached Supabase query
    const data = await getCachedEvents();

    if (data && Array.isArray(data)) {
      allEvents = data;

      if (allEvents.length > 0) {
        const randomEventsForCarousel = getRandomEvents(allEvents, 3);
        carouselEvents = randomEventsForCarousel.map(transformToCarouselImage);

        const sortedEvents = [...allEvents].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latestEventsForSections = sortedEvents.slice(0, 3);

        trendingEvents = latestEventsForSections.map((event) => {
          const baseCardData = transformToEventCardData(event);
          const uniqueTags = Array.from(
            new Set(["Trending", ...baseCardData.tags])
          );
          return { ...baseCardData, tags: uniqueTags };
        });

        upcomingEvents = latestEventsForSections.map(transformToEventCardData);
      } else {
        console.log("No events found from Supabase.");
      }
    } else {
      throw new Error("Fetched event data is not in the expected format.");
    }
  } catch (err: any) {
    console.error("Error fetching initial events in RootLayout:", err);
    error =
      err.message || "Failed to load initial events. Please try again later.";
    allEvents = [];
    carouselEvents = [];
    trendingEvents = [];
    upcomingEvents = [];
  } finally {
    isLoading = false;
  }

  return {
    allEvents,
    carouselEvents,
    trendingEvents,
    upcomingEvents,
    isLoading,
    error,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {
    allEvents,
    carouselEvents,
    trendingEvents,
    upcomingEvents,
    isLoading,
    error,
  } = await getInitialEventsData();

  return (
    <html lang="en">
      <head>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
      </head>
      <body
        className="font-sans antialiased bg-[#FFFFFF] text-[#101010] font-[DM_Sans] overflow-x-hidden"
      >
        <ClientInit />
        <MobileDetectionRedirect />
        <AuthProvider>
          <EventsProvider
            initialAllEvents={allEvents}
            initialCarouselEvents={carouselEvents}
            initialTrendingEvents={trendingEvents}
            initialUpcomingEvents={upcomingEvents}
            initialIsLoading={isLoading}
            initialError={error}
          >
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 4000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
              <div className="relative w-full overflow-hidden">
                <Suspense fallback={null}>
                  <NavigationBar />
                </Suspense>
                {children}
              </div>
          </EventsProvider>
          <ChatBot />
        </AuthProvider>
      </body>
    </html>
  );
}
