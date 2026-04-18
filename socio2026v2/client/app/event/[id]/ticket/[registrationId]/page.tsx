"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/context/EventContext";
import { dayjs } from "@/lib/dateUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

const generateGoogleCalendarUrl = (title: string, date: string, time?: string): string | null => {
  try {
    const dateObj = dayjs(date);
    let startDateTime: string;
    let endDateTime: string;
    if (time) {
      const timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const period = timeMatch[3]?.toUpperCase();
        if (period === "PM" && hours < 12) hours += 12;
        else if (period === "AM" && hours === 12) hours = 0;
        const startDate = dateObj.hour(hours).minute(minutes);
        startDateTime = startDate.format("YYYYMMDDTHHmmss");
        endDateTime = startDate.add(1, "hour").format("YYYYMMDDTHHmmss");
      } else {
        startDateTime = dateObj.format("YYYYMMDD");
        endDateTime = dateObj.add(1, "day").format("YYYYMMDD");
      }
    } else {
      startDateTime = dateObj.format("YYYYMMDD");
      endDateTime = dateObj.add(1, "day").format("YYYYMMDD");
    }
    const params = new URLSearchParams({ text: title, dates: `${startDateTime}/${endDateTime}` });
    return `${process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_BASE_URL!}&${params.toString()}`;
  } catch {
    return null;
  }
};

export default function TicketPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;
  const registrationId = params?.registrationId as string;

  const { allEvents } = useEvents();
  const { session } = useAuth();

  const [event, setEvent] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOutsider, setIsOutsider] = useState(false);
  const [gatedReady, setGatedReady] = useState(false);
  const [gatedPollTimeout, setGatedPollTimeout] = useState(false);
  const [printing, setPrinting] = useState(false);

  const ticketRef = useRef<HTMLDivElement>(null);

  // Find event from context
  useEffect(() => {
    if (allEvents.length > 0) {
      const found = allEvents.find((e) => e.event_id === eventId);
      if (found) setEvent(found);
    }
  }, [allEvents, eventId]);

  const fetchQR = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/registrations/${registrationId}/qr-code`);
    if (res.ok) {
      const data = await res.json();
      setQrImage(data.qrCodeImage);
    }
  }, [registrationId]);

  // Load registration
  useEffect(() => {
    if (!registrationId) return;

    const load = async () => {
      try {
        const regRes = await fetch(`${API_URL}/api/registrations/${registrationId}`);
        if (!regRes.ok) throw new Error("Registration not found");
        const regData = await regRes.json();
        const reg = regData.registration;
        setRegistration(reg);

        const outsider = reg?.participant_organization === "outsider";
        setIsOutsider(outsider);

        if (!outsider || reg?.qr_code_data?.gated_verify_url) {
          setGatedReady(true);
        }

        await fetchQR();
      } catch (err: any) {
        setError(err.message || "Failed to load ticket");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [registrationId, fetchQR]);

  // Poll for gated pass if outsider and not yet ready
  useEffect(() => {
    if (!isOutsider || gatedReady) return;

    let attempts = 0;
    const maxAttempts = 10; // 30 seconds total

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API_URL}/api/registrations/${registrationId}/gated-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.gated_ready) {
            setGatedReady(true);
            clearInterval(interval);
            await fetchQR();
            return;
          }
        }
      } catch {
        // ignore poll errors
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setGatedPollTimeout(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOutsider, gatedReady, registrationId, fetchQR]);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  const participantName =
    registration?.individual_name ||
    registration?.team_leader_name ||
    "Participant";

  const teamName = registration?.team_name;
  const regType = registration?.registration_type;
  const teammates: any[] = registration?.teammates || [];
  const regId = registration?.registration_id;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#154CB3] mx-auto mb-4" />
          <p className="text-gray-600">Loading your ticket...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-600 text-lg font-semibold">{error}</p>
        <Link href="/Discover" className="text-[#154CB3] underline text-sm">
          Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #socio-ticket-print, #socio-ticket-print * { visibility: visible !important; }
          #socio-ticket-print { position: fixed; top: 0; left: 0; width: 100vw; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* Page header - hidden during print */}
        <div className="no-print bg-[#063168] text-white py-5 px-4 md:px-10 shadow">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Link
              href={`/event/${eventId}`}
              className="text-[#FFCC00] hover:underline text-sm flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back
            </Link>
            <span className="text-white/50">|</span>
            <h1 className="text-lg font-bold">Your Ticket</h1>
          </div>
        </div>

        {/* Success banner - hidden during print */}
        <div className="no-print max-w-3xl mx-auto px-4 pt-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
            <div className="bg-green-100 rounded-full p-1.5 flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">Registration successful!</p>
              <p className="text-sm text-green-700 mt-0.5">
                Your ticket is confirmed. Present the QR code at the event entrance.
              </p>
            </div>
          </div>
        </div>

        {/* TICKET CARD */}
        <div id="socio-ticket-print" className="max-w-3xl mx-auto px-4 pb-6" ref={ticketRef}>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">

            {/* Ticket header */}
            <div className="bg-gradient-to-r from-[#063168] to-[#154CB3] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[#FFCC00] text-xs font-semibold uppercase tracking-widest mb-1">
                    SOCIO · Christ University
                  </p>
                  <h2 className="text-2xl font-bold leading-snug">
                    {event?.title || "Event Ticket"}
                  </h2>
                  {event?.organizing_dept && (
                    <p className="text-white/75 text-sm mt-1">{event.organizing_dept}</p>
                  )}
                </div>
                {/* SOCIO wordmark */}
                <div className="text-right flex-shrink-0">
                  <span className="text-3xl font-black tracking-tight text-white/20 select-none">
                    SOCIO
                  </span>
                </div>
              </div>
            </div>

            {/* Dashed tear line */}
            <div className="relative flex items-center">
              <div className="w-6 h-6 rounded-full bg-gray-50 border border-gray-200 -ml-3 flex-shrink-0" />
              <div className="flex-1 border-b-2 border-dashed border-gray-200 mx-1" />
              <div className="w-6 h-6 rounded-full bg-gray-50 border border-gray-200 -mr-3 flex-shrink-0" />
            </div>

            {/* Ticket body */}
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6">

                {/* Left: event & participant info */}
                <div className="flex-1 space-y-4">
                  {/* Event details */}
                  <div className="grid grid-cols-2 gap-3">
                    {event?.event_date && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">
                          {dayjs(event.event_date).format("DD MMM YYYY")}
                        </p>
                      </div>
                    )}
                    {event?.event_time && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Time</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{event.event_time}</p>
                      </div>
                    )}
                    {event?.venue && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Venue</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{event.venue}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                        {regType === "team" ? "Team Leader" : "Participant"}
                      </p>
                      <p className="text-base font-bold text-[#063168] mt-0.5">{participantName}</p>
                    </div>

                    {regType === "team" && teamName && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Team</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{teamName}</p>
                      </div>
                    )}

                    {regType === "team" && teammates.length > 1 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Members</p>
                        <div className="mt-0.5 space-y-1">
                          {teammates.slice(1).map((tm: any, i: number) => (
                            <p key={i} className="text-sm text-gray-700">{tm.name}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Registration ID</p>
                      <p className="text-xs font-mono text-gray-600 mt-0.5 break-all">{regId}</p>
                    </div>

                    {isOutsider && (
                      <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                        </svg>
                        External Visitor Pass
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: QR code */}
                <div className="flex flex-col items-center justify-center gap-3 md:w-48 flex-shrink-0">
                  {isOutsider && !gatedReady ? (
                    <div className="w-40 h-40 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center gap-2 text-center p-3">
                      {gatedPollTimeout ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-amber-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          <p className="text-xs text-amber-600 font-medium">Gate pass pending</p>
                          <p className="text-xs text-gray-500">Check your profile later</p>
                        </>
                      ) : (
                        <>
                          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#154CB3]" />
                          <p className="text-xs text-blue-700 font-medium">Generating gate pass...</p>
                        </>
                      )}
                    </div>
                  ) : qrImage ? (
                    <div className="p-2 border-2 border-gray-200 rounded-xl bg-white shadow-sm">
                      <img src={qrImage} alt="Entry QR Code" className="w-36 h-36 block" />
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 rounded-xl animate-pulse" />
                  )}

                  <p className="text-xs text-gray-400 text-center leading-snug">
                    {isOutsider && gatedReady
                      ? "Scan at campus gate & event entry"
                      : "Scan at event entrance"}
                  </p>
                </div>
              </div>
            </div>

            {/* Ticket footer */}
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400">socio.christuniversity.in</p>
              <p className="text-xs text-gray-400 font-mono">#{regId?.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          {/* Outsider gate info banner */}
          {isOutsider && gatedReady && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-800">You have a university gate pass</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Your QR code is registered with the SOCIO Gated system. Show it at the campus entrance and again at the event for attendance marking.
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="no-print mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">Instructions</h4>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• Keep this QR code screenshot on your phone or download it</li>
              <li>• Present it at the event entrance — the organiser will scan it</li>
              <li>• Make sure the QR code is clearly visible and not cropped</li>
              {isOutsider && <li>• As an external visitor, show this at the campus gate first</li>}
            </ul>
          </div>
        </div>

        {/* Action buttons - hidden during print */}
        <div className="no-print max-w-3xl mx-auto px-4 pb-10">
          <div className="flex flex-wrap gap-3">
            {/* Download / Print button */}
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-2 bg-[#154CB3] text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-[#063168] transition-colors shadow disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save / Print Ticket
            </button>

            {/* Add to calendar */}
            {event?.event_date && (
              <button
                onClick={() => {
                  const url = generateGoogleCalendarUrl(event.title, event.event_date, event.event_time);
                  if (url) window.open(url, "_blank");
                }}
                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-blue-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Add to Calendar
              </button>
            )}

            {/* Back to discover */}
            <Link
              href="/Discover"
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Browse More Events
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
