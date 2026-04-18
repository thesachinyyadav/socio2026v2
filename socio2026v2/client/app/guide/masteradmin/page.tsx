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
    title: "Analytics Dashboard",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    steps: [
      { label: "Open Admin Panel", detail: "Click 'Admin Panel' in the navigation bar to access /masteradmin." },
      { label: "Dashboard tab", detail: "The default tab shows user distribution (Regular / Organisers / Support / Admins), event stats, and registration trends." },
      { label: "Recent Activity", detail: "See a live feed of newly created events, latest registrations, and new user sign-ups." },
      { label: "Quick Actions", detail: "Jump to Manage Users, Events, Fests, or Send Notification directly from the dashboard cards." },
      { label: "Export data", detail: "Use the CSV export button on the analytics dashboard to download platform-wide data." },
    ],
  },
  {
    title: "User Management",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    steps: [
      { label: "Navigate to Users tab", detail: "In /masteradmin, click the 'Users' tab to see the complete user list." },
      { label: "Search users", detail: "Use the search bar to find users by name or email address." },
      { label: "Filter by role", detail: "Use the dropdown filter to show only Organisers, Support staff, or Master Admins." },
      { label: "Edit a user", detail: "Click the edit button on any user row to open their role settings." },
    ],
  },
  {
    title: "Granting & Revoking Roles",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    steps: [
      { label: "Toggle Organiser", detail: "In the user edit modal, check/uncheck 'Organiser' to grant or revoke event creation access." },
      { label: "Toggle Support", detail: "Check/uncheck 'Support' to grant access to the support panel." },
      { label: "Toggle Master Admin", detail: "Check/uncheck 'Master Admin'. Note: you cannot remove the last Master Admin to prevent lockout." },
      { label: "Set expiration date", detail: "Use the date picker next to each role to set an auto-expiry. The role is automatically revoked when the date passes." },
      { label: "Save changes", detail: "Click 'Save' to apply. Changes take effect immediately -- the user will see updated access on their next page load." },
    ],
  },
  {
    title: "Managing All Events & Fests",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    steps: [
      { label: "Events tab", detail: "View ALL events across the platform -- not just your own. Search by title, filter by status (Live / This Week / Upcoming / Past)." },
      { label: "Edit any event", detail: "Click 'Edit' to modify any event regardless of who created it." },
      { label: "Delete any event", detail: "Click 'Delete' with confirmation. This removes the event and all its registrations." },
      { label: "Fests tab", detail: "Same as events -- view, edit, or delete any fest on the platform." },
      { label: "Manage page", detail: "When you visit /manage as a Master Admin, you see ALL events and fests (not filtered by creator)." },
    ],
  },
  {
    title: "Sending Notifications",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    steps: [
      { label: "Notifications tab", detail: "In /masteradmin, click the 'Notifications' tab." },
      { label: "Compose a notification", detail: "Write a title and message. Choose target audience (all users, specific event registrants, etc.)." },
      { label: "Send", detail: "Hit send. Users receive the notification via the bell icon in their navigation bar." },
    ],
  },
  {
    title: "Deleting Users",
    icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    steps: [
      { label: "Find the user", detail: "Search for the user in the Users tab." },
      { label: "Click Delete", detail: "Hit the delete button on their row. A confirmation modal will appear." },
      { label: "Confirm deletion", detail: "This permanently removes the user account. Note: you cannot delete your own account from here." },
    ],
  },
  {
    title: "Important Notes",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
    steps: [
      { label: "Role expiry is automatic", detail: "Once a role expiry date passes, the user loses that role without any manual action needed." },
      { label: "Cannot self-delete", detail: "Master Admins cannot delete their own account from the admin panel." },
      { label: "Last Admin protection", detail: "The system prevents removing all Master Admin access to avoid a lockout scenario." },
      { label: "Changes are instant", detail: "Role grants/revokes, event edits, and deletions take effect immediately." },
    ],
  },
];

export default function MasterAdminGuidePage() {
  const { isMasterAdmin } = useAuth();
  const router = useRouter();
  const [openSection, setOpenSection] = useState<number | null>(0);

  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">You need Master Admin access to view this guide.</p>
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Master Admin Guide</h1>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">ADMIN</span>
          </div>
          <p className="text-blue-200 mt-1 text-sm sm:text-base">
            Full platform control -- users, events, fests, analytics, and notifications.
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
                  <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="w-6 h-6 rounded-full bg-red-50 text-red-600 text-xs font-bold flex items-center justify-center">
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
            href="/masteradmin"
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium text-sm hover:bg-red-700 transition-colors"
          >
            Open Admin Panel
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
