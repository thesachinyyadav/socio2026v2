"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AttendanceManager } from "../_components/AttendanceManager";

function AttendanceContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const eventTitle = searchParams.get("eventTitle");

  if (!eventId || !eventTitle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Request</h2>
            <p className="text-gray-600 mb-4">
              Missing event information. Please access this page through the event management dashboard.
            </p>
            <a
              href="/manage"
              className="inline-flex items-center px-4 py-2 bg-[#154CB3] text-white rounded-lg hover:bg-[#154cb3eb] transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#063168] text-white p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <a
              href="/manage"
              className="flex items-center text-[#FFCC00] hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5 mr-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              Back to Dashboard
            </a>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Event Attendance
          </h1>
          <p className="text-base sm:text-lg text-gray-200 mt-2">
            Track and manage participant attendance for your event
          </p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        <AttendanceManager 
          eventId={eventId}
          eventTitle={decodeURIComponent(eventTitle)}
        />
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#154CB3] mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AttendanceContent />
    </Suspense>
  );
}