"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface GuideSection {
  title: string;
  icon: string;
  steps: { label: string; detail: string }[];
}

const sections: GuideSection[] = [
  {
    title: "Creating a Fest",
    icon: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
    steps: [
      { label: "Navigate to Create Fest", detail: "From /manage, click 'Create Fest'." },
      { label: "Fest details", detail: "Name, dates, description, department, registration deadline, venue, fees, and banner image." },
      { label: "Add sponsors & FAQs", detail: "List sponsors (name + logo URL) and frequently asked questions." },
      { label: "Social links & timeline", detail: "Add Instagram, website, or other links. Create a fest timeline with milestones." },
      { label: "Link events to the fest", detail: "After publishing the fest, create events and select this fest in the 'Fest Association' dropdown." },
    ],
  },
  {
    title: "Creating an Event",
    icon: "M12 4v16m8-8H4",
    steps: [
      { label: "Go to Manage Dashboard", detail: "Click 'Manage events' from the navigation bar or visit /manage." },
      { label: "Click 'Create Event'", detail: "Hit the blue 'Create Event' button at the top of the dashboard." },
      { label: "Fill in the basics", detail: "Title, date, end date, time, venue, description, and category are the essentials." },
      { label: "Set registration details", detail: "Registration deadline, max participants, and fees. Toggle 'Allow Outsiders' if non-Christ students can join." },
      { label: "Add extra details", detail: "Schedule items, rules, prizes, event heads, and custom registration fields (text, dropdown, etc.)." },
      { label: "Upload media", detail: "Add a poster image (max 3MB), banner, or a PDF brochure." },
      { label: "Campus settings", detail: "Choose which campus hosts the event and which campuses can register." },
      { label: "Publish", detail: "Hit 'Publish Event'. Watch the little guy push the ball up the mountain -- your event is live!" },
    ],
  },
  {
    title: "Managing Your Events",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    steps: [
      { label: "Dashboard overview", detail: "Visit /manage to see all your events and fests in one place. Search, filter, and sort." },
      { label: "Edit an event", detail: "Click the edit icon on any event card. Change any field and hit 'Update Event'." },
      { label: "Delete an event", detail: "Click delete on the edit page. Confirm the deletion. Registrations are also removed." },
      { label: "Close registrations", detail: "On the edit page, you can close registrations early even if the deadline hasn't passed." },
    ],
  },
  {
    title: "Attendance & QR Codes",
    icon: "M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z",
    steps: [
      { label: "Open Attendance Manager", detail: "From /manage, click the QR icon on any event card. Or go to /attendance?eventId=YOUR_EVENT." },
      { label: "Scan QR codes", detail: "Click 'Open Scanner' to activate the camera. Point at a participant's QR code to instantly mark them present." },
      { label: "Manual marking", detail: "Search participants by name/email in the list and toggle their attendance status manually." },
      { label: "Export data", detail: "Click 'Export CSV' to download the full attendance sheet -- names, emails, register numbers, teams, and timestamps." },
    ],
  },
  {
    title: "Notifications & Reminders",
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    steps: [
      { label: "Event reminders", detail: "On the event detail page, use the 'Send Reminder' button to notify all registered users." },
      { label: "Bell notifications", detail: "Registered users get notified via the bell icon in the nav bar. Notifications show event updates." },
    ],
  },
  {
    title: "Tips & Best Practices",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    steps: [
      { label: "Use descriptive titles", detail: "Clear titles help students find your event. 'Hackathon 2026' beats 'Event 1'." },
      { label: "Upload a good poster", detail: "A high-quality poster image (JPEG/PNG, under 3MB) makes your event stand out in the feed." },
      { label: "Set deadlines wisely", detail: "Registration deadline should be at least a day before the event to give you time to plan." },
      { label: "Add custom fields", detail: "Need team names? Dietary preferences? Use custom registration fields -- participants fill them during sign-up." },
      { label: "Check attendance early", detail: "Test the QR scanner before the event day to make sure your camera works." },
    ],
  },
];

export default function OrganiserGuidePage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [openSection, setOpenSection] = useState<number | null>(0);

  if (!userData?.is_organiser && !(userData as any)?.is_masteradmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">You need organiser access to view this guide.</p>
          <Link href="/profile" className="text-[#154CB3] underline">Back to Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#063168] text-white px-4 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center text-[#FFCC00] mb-4 hover:underline text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold">Organiser Guide</h1>
          <p className="text-blue-200 mt-2 text-sm sm:text-base">
            Everything you need to know about creating and managing events on SOCIO.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-3">
        {sections.map((section, i) => {
          const isOpen = openSection === i;
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow duration-200 hover:shadow-md"
            >
              <button
                onClick={() => setOpenSection(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#063168] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} />
                    </svg>
                  </div>
                  <span className="font-semibold text-[#063168] text-sm sm:text-base">{section.title}</span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: isOpen ? `${section.steps.length * 120 + 20}px` : "0px",
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="px-4 sm:px-5 pb-5 space-y-3">
                  {section.steps.map((step, j) => (
                    <div key={j} className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-6 h-6 rounded-full bg-blue-50 text-[#154CB3] text-xs font-bold flex items-center justify-center">
                          {j + 1}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{step.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div className="pt-6 pb-4 text-center">
          <Link
            href="/manage"
            className="inline-flex items-center gap-2 bg-[#063168] text-white px-6 py-3 rounded-lg font-medium text-sm hover:bg-[#154CB3] transition-colors"
          >
            Go to Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
