// components/Discover/EventCard.tsx
import React from "react";
import Link from "next/link";
import moment from "moment";
import { useAuth } from "../../../context/AuthContext";

interface EventCardProps {
  title: string;
  dept: string;
  festName?: string;
  date: string | null;
  time: string | null;
  location: string;
  tags: string[];
  image: string;
  baseUrl?: string;
  idForLink?: string;
}

export const EventCard = ({
  title,
  dept,
  festName,
  date,
  time,
  location,
  tags,
  image,
  baseUrl = "event",
  idForLink,
}: EventCardProps) => {
  const { userData, isLoading: authLoading } = useAuth();

  const eventSlug = idForLink;
  // No longer generating slugs from title; always use the actual event_id
  const eventPageUrl = `/${baseUrl}/${eventSlug}`;
  const participantsPageUrl = `/event/${eventSlug}/participants`;

  const displayDate = date
    ? moment.utc(date, moment.ISO_8601, true).format("MMM D, YYYY")
    : "Date TBD";
  const displayTime = time
    ? moment(time, ["HH:mm:ss", "HH:mm"]).format("h:mm A")
    : "Time TBD";

  return (
    <div className="bg-[#f9f9f9] rounded-lg overflow-hidden border-2 border-gray-200 transform transition duration-100 ease-in-out hover:scale-101 flex flex-col">
      <Link href={eventPageUrl} className="w-full block">
        <div className="relative h-40 bg-white">
          {tags.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-2 z-10 items-center flex-wrap justify-end">
              {(tags || []).map((tag, index) => {
                if (!tag || typeof tag !== 'string') return null;

                const titleTag = tag
                  .split(" ")
                  .filter(word => word && word.length > 0)
                  .map(
                    (word) =>
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join(" ");

                let base = "text-xs font-medium px-2 py-1 rounded-full";
                let bgColor = "bg-gray-100 text-gray-800";

                if (titleTag === "Trending")
                  bgColor = "bg-[#FFCC00] text-black";
                if (
                  [
                    "Cultural",
                    "Sports",
                    "Academic",
                    "Arts",
                    "Innovation",
                    "Literary",
                  ].includes(titleTag)
                )
                  bgColor = "bg-[#154CB3] text-white";
                if (["Free", "Paid"].includes(titleTag))
                  bgColor = "bg-white text-black border border-gray-300";
                if (titleTag === "Claims") bgColor = "bg-[#73ec66] text-black";

                return (
                  <span key={index} className={`${base} ${bgColor}`}>
                    {titleTag}
                  </span>
                );
              })}
            </div>
          )}
          {image ? (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover object-top relative z-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-image-icon lucide-image text-gray-400"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}
        </div>
      </Link>
      <div className="p-4 rounded-b-lg flex-grow flex flex-col justify-between">
        <div>
          <Link href={eventPageUrl} className="block">
            <h3 className="text-lg font-bold mb-1 hover:underline truncate">
              {title}
            </h3>
          </Link>
          <p className="text-sm text-gray-500 mb-3 font-semibold truncate">
            {festName && festName !== "none" ? festName : dept}
          </p>
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{displayDate}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{displayTime}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
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
            <span className="truncate">{location}</span>
          </div>
        </div>
        {!authLoading && userData?.is_organiser ? (
          <div className="mt-auto pt-2 border-t border-gray-200 flex gap-4">
            <Link
              href={participantsPageUrl}
              className="inline-flex items-center gap-1 text-sm text-[#154CB3] font-semibold hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-users"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              View Participants
            </Link>
            <Link
              href={`/attendance?eventId=${eventSlug}&eventTitle=${encodeURIComponent(title)}`}
              className="inline-flex items-center gap-1 text-sm text-green-600 font-semibold hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-clipboard-check"
              >
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <path d="m9 14 2 2 4-4"/>
              </svg>
              Mark Attendance
            </Link>
          </div>
        ) : (
          <Link
            href={eventPageUrl}
            className="items-center gap-1 text-sm text-[#154CB3] font-semibold hover:underline"
          >
            <div className="mt-auto pt-2 border-t border-gray-200 flex items-center justify-between">
              View event
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-4 text-[#154CB3]"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
};
