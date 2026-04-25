import React from "react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { useAuth } from "../../../context/AuthContext";
import EventReminderButton from "../EventReminderButton";

const toLowerSafe = (value: unknown): string =>
  typeof value === "string" ? value.toLowerCase() : "";

const toStringArray = (values: unknown): string[] =>
  Array.isArray(values) ? values.filter((item): item is string => typeof item === "string") : [];

interface EventCardProps {
  title: string;
  dept: string;
  festName?: string;
  date: string | null;
  time: string | null;
  location: string;
  tags: string[];
  image: string;
  allowOutsiders?: boolean | null;
  baseUrl?: string;
  idForLink?: string;
  authToken?: string;
  isArchived?: boolean;
  isDraft?: boolean;
  isPendingApproval?: boolean;
  archivedVisualMode?: "tag" | "muted";
  onArchiveToggle?: (eventId: string, shouldArchive: boolean) => Promise<void>;
  isArchiveLoading?: boolean;
  createdBy?: string | object | null;
  organizerEmail?: string | null;
  registrationFee?: number | null;
  feedbackUrl?: string;
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
  allowOutsiders,
  baseUrl = "event",
  idForLink,
  authToken,
  isArchived = false,
  isDraft = false,
  isPendingApproval = false,
  archivedVisualMode = "tag",
  onArchiveToggle,
  isArchiveLoading = false,
  createdBy,
  organizerEmail,
  registrationFee,
  feedbackUrl,
}: EventCardProps) => {
  const { userData, session, isLoading } = useAuth();

  const isOutsiderUser = userData?.organization_type === "outsider";
  const showOutsiderBadge = !isLoading && isOutsiderUser && Boolean(allowOutsiders);
  const isAdminOrOrganizer = !isLoading && (userData?.is_organiser || userData?.is_masteradmin);

  const userEmailLower = toLowerSafe(userData?.email);
  const createdByLower = toLowerSafe(createdBy);
  const organizerEmailLower = toLowerSafe(organizerEmail);

  const isOwner = !authLoading && (
    (session?.user?.id && createdBy && session.user.id === createdBy) ||
    (userEmailLower && createdByLower && userEmailLower === createdByLower) ||
    (userEmailLower && organizerEmailLower && userEmailLower === organizerEmailLower)
  );

  if (userData?.is_organiser && !isLoading) {
    console.log(`[EventCard Debug] title: ${title}, isOwner: ${isOwner}, createdBy: ${JSON.stringify(createdBy)}, createdByEmail: ${createdByEmail}, sessionUserId: ${session?.user?.id}, organizerEmail: ${organizerEmail}, userEmail: ${userData?.email}`);
  }

  const canManage = !isLoading && (userData?.is_masteradmin || (userData?.is_organiser && isOwner));
  const reminderAuthToken = authToken || session?.access_token || "";

  const eventSlug = idForLink;
  const eventPageUrl = `/${baseUrl}/${eventSlug}`;
  const participantsPageUrl = `/event/${eventSlug}/participants`;

  const displayDate = formatDate(date, "Date TBD");
  const displayTime = formatTime(time, "Time TBD");

  const showArchivedTag = isArchived && isAdminOrOrganizer && archivedVisualMode === "tag";
  const shouldMuteArchivedCard = (isArchived || isDraft) && archivedVisualMode === "muted";
  const overlayLabel = isDraft ? (isPendingApproval ? "PENDING" : "DRAFT") : isArchived ? "ARCHIVED" : null;

  // Separate Free/Paid from category tags — price shown in footer row instead
  const normalizedTags = toStringArray(tags);
  const isFree = normalizedTags.includes("Free") || normalizedTags.some((t) => toLowerSafe(t) === "free");
  const displayTags = normalizedTags.filter((t) => !["Free", "Paid"].includes(
    t.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
  ));

  const priceLabel = registrationFee != null && registrationFee > 0
    ? `₹${registrationFee}`
    : isFree || registrationFee === 0
      ? "Free entry"
      : normalizedTags.some((t) => toLowerSafe(t) === "paid") ? "Paid" : "Free entry";

  const deptLabel = (festName && festName !== "none" ? festName : dept) || "";

  return (
    <div className={`bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col group w-full h-full min-w-0 ${
      shouldMuteArchivedCard ? "opacity-60 grayscale" : ""
    }`}>

      {/* Image */}
      <Link href={eventPageUrl} className="w-full block">
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#063168] to-[#154CB3]">
          {showOutsiderBadge && (
            <div className="absolute top-2 left-2 z-10">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#F59E0B] text-black shadow-sm">
                Public
              </span>
            </div>
          )}

          {/* Tags — top right */}
          {(displayTags.length > 0 || showArchivedTag) && (
            <div className="absolute top-2 right-2 flex gap-1.5 z-10 items-center flex-wrap justify-end max-w-[85%]">
              {showArchivedTag && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 shadow-sm">
                  ARCHIVED
                </span>
              )}
              {displayTags.map((tag, index) => {
                if (!tag || typeof tag !== "string") return null;
                const titleTag = tag
                  .split(" ")
                  .filter(w => w.length > 0)
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ");

                let bgColor = "bg-gray-100 text-gray-800";
                if (titleTag === "Trending") bgColor = "bg-[#FFCC00] text-black";
                if (["Cultural", "Sports", "Academic", "Arts", "Innovation", "Literary"].includes(titleTag))
                  bgColor = "bg-[#154CB3] text-white";
                if (titleTag === "Claims") bgColor = "bg-[#73ec66] text-black";

                return (
                  <span key={index} className={`text-xs font-medium px-2 py-1 rounded-full max-w-full truncate ${bgColor}`}>
                    {titleTag}
                  </span>
                );
              })}
            </div>
          )}

          {image ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-[#063168]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
              {overlayLabel && (
                <div className="absolute inset-0 z-20 bg-white/65 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl sm:text-5xl font-black tracking-[0.25em] text-slate-800/70">{overlayLabel}</span>
                </div>
              )}
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover object-top relative z-0 transition-all duration-700 group-hover:scale-110"
              />
            </>
          ) : (
            overlayLabel && (
              <div className="absolute inset-0 z-20 bg-white/65 flex items-center justify-center pointer-events-none">
                <span className="text-4xl sm:text-5xl font-black tracking-[0.25em] text-slate-800/70">{overlayLabel}</span>
              </div>
            )
          )}
        </div>
      </Link>

      {/* Card body */}
      <div className="p-4 flex-grow flex flex-col justify-between">
        <div>
          {/* Department label above title */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1 truncate">
            {deptLabel}
          </p>

          <Link href={eventPageUrl} className="block">
            <h3 className="text-base font-bold text-[#0f2557] mb-3 line-clamp-2 leading-snug group-hover:text-[#154CB3] transition-colors duration-200">
              {title}
            </h3>
          </Link>

          {/* Date */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{displayDate}</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{displayTime}</span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{location}</span>
          </div>
        </div>

        {/* Footer row */}
        {canManage ? (
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href={participantsPageUrl}
              className="inline-flex items-center gap-1 text-sm text-[#154CB3] font-semibold hover:underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <path d="m9 14 2 2 4-4"/>
              </svg>
              Mark Attendance
            </Link>
            {onArchiveToggle && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchiveToggle(idForLink || "", !isArchived); }}
                disabled={isArchiveLoading}
                className={`inline-flex items-center gap-1 text-sm font-semibold transition-colors cursor-pointer ${
                  isArchiveLoading ? "text-slate-400 cursor-not-allowed"
                    : isArchived ? "text-emerald-700 hover:text-emerald-800"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {isArchiveLoading ? "Saving..." : isArchived ? "Unarchive" : "Archive"}
              </button>
            )}
            {eventSlug && (
              <Link href={`/edit/event/${eventSlug}`} className="inline-flex items-center gap-1 text-sm text-[#154CB3] font-semibold hover:underline">
                Edit
              </Link>
            )}
            {reminderAuthToken && (
              <EventReminderButton eventId={eventSlug || ""} eventTitle={title} authToken={reminderAuthToken} />
            )}
          </div>
        ) : feedbackUrl ? (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded-full">Feedback needed</span>
            <Link
              href={feedbackUrl}
              className="inline-flex items-center gap-1 text-sm text-violet-600 font-semibold hover:underline"
            >
              Give Feedback
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">{priceLabel}</span>
            <Link
              href={eventPageUrl}
              className="inline-flex items-center gap-1 text-sm text-[#154CB3] font-semibold hover:underline"
            >
              Register
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
