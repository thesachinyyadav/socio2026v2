"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Bell 
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { QRScanner } from "@/app/_components/QRScanner";
import LoadingIndicator from "@/app/_components/UI/LoadingIndicator";

type VolunteerRecord = {
  register_number?: string;
  expires_at?: string;
  assigned_by?: string;
};

const normalizeRegisterNumber = (value: unknown): string =>
  String(value ?? "").trim().toUpperCase();

const hasActiveVolunteerAccess = (
  volunteers: VolunteerRecord[] | null | undefined,
  registerNumber: string | null | undefined
) => {
  const currentRegisterNumber = normalizeRegisterNumber(registerNumber);
  if (!currentRegisterNumber || !Array.isArray(volunteers)) return false;

  return volunteers.some((volunteer) => {
    const volunteerRegisterNumber = normalizeRegisterNumber(volunteer?.register_number);
    if (volunteerRegisterNumber !== currentRegisterNumber) return false;

    const expiresAt = new Date(String(volunteer?.expires_at || ""));
    return !Number.isNaN(expiresAt.getTime()) && new Date() < expiresAt;
  });
};

function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You do not have active volunteer scanner access for this event.
        </p>
      </div>
    </div>
  );
}

export default function VolunteerScannerPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = String(params?.eventId || "");
  const { userData, isLoading, session } = useAuth();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [eventData, setEventData] = useState<any>(null);
  const [imgError, setImgError] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (isLoading) return;

      setIsCheckingAccess(true);
      setIsAuthorized(false);

      if (!eventId || !userData?.register_number) {
        if (!cancelled) setIsCheckingAccess(false);
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select("title, volunteers, event_date, event_time, venue, campus_hosted_at")
        .eq("event_id", eventId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setIsCheckingAccess(false);
        return;
      }

      const authorized = hasActiveVolunteerAccess(
        Array.isArray(data.volunteers) ? data.volunteers : [],
        userData.register_number
      );

      if (authorized) {
        setEventData(data);
      }
      setIsAuthorized(authorized);
      setIsCheckingAccess(false);
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [eventId, isLoading, userData?.register_number]);

  if (isLoading || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingIndicator label="Checking volunteer access" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <AccessDenied />;
  }

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return "Date TBD";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatEventTime = (timeStr: string) => {
    if (!timeStr) return "Time TBD";
    return timeStr;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] flex flex-col font-sans">
      {/* ── Standard TopBar (White) ── */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Profile Avatar */}
          <div className="flex-1 flex justify-start">
            <Link href="/profile" className="shrink-0 block">
              <div className="w-[34px] h-[34px] rounded-full overflow-hidden ring-[2.5px] ring-[#011F7B] shadow-sm bg-[#011F7B] flex items-center justify-center">
                {userData?.avatar_url && !imgError ? (
                  <Image
                    src={userData.avatar_url}
                    alt={userData.name || "User"}
                    width={34}
                    height={34}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[13px] font-black text-white drop-shadow-sm">
                    {userData?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </Link>
          </div>
          
          {/* Center: SOCIO in Blue */}
          <span className="text-[18px] font-black tracking-tight text-[#011F7B]">
            SOCIO
          </span>
          
          {/* Right: Notification Bell in Blue */}
          <div className="flex-1 flex justify-end">
            <Link href="/notifications" className="relative text-[#011F7B] p-1.5 -mr-1.5 active:scale-95 transition-transform">
              <Bell className="w-5.5 h-5.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Navy Event Header Card ── */}
      <div className="bg-[#011F7B] text-white pt-6 pb-24 rounded-b-[40px] px-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Top Row: Back Button, Title, Scan count Badge */}
          <div className="flex items-center justify-between gap-4">
            <button 
              className="flex-shrink-0 w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all text-white border-none cursor-pointer"
              onClick={() => router.replace("/volunteer")}
              title="Back to Volunteer Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white text-base sm:text-lg font-bold leading-tight flex-1 truncate">
              {eventData?.title || "Volunteer Scanner"}
            </h1>
            <div className="flex-shrink-0 border border-white/20 bg-white/10 rounded-xl px-3.5 py-1 text-white text-[12px] font-bold whitespace-nowrap shadow-sm">
              {scanCount} scanned
            </div>
          </div>

          {/* Bottom Row: Metadata info */}
          <div className="flex items-center gap-4 text-xs text-blue-200 font-medium flex-wrap px-1">
             {/* Date */}
             <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#FFBA09]" />
                {formatEventDate(eventData?.event_date)}
             </span>
             <span className="w-1 h-1 rounded-full bg-blue-300/40" />
             {/* Time */}
             <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FFBA09]" />
                {formatEventTime(eventData?.event_time)}
             </span>
             <span className="w-1 h-1 rounded-full bg-blue-300/40" />
             {/* Venue */}
             <span className="flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
                <MapPin className="w-3.5 h-3.5 text-[#FFBA09] flex-shrink-0" />
                <span className="truncate">{eventData?.venue || eventData?.campus_hosted_at || "Venue TBD"}</span>
             </span>
          </div>
        </div>
      </div>

      {/* ── Main content scanner cards grid ── */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 -mt-16 pb-20 relative z-10 flex-1">
        <QRScanner
          eventId={eventId}
          eventTitle={eventData?.title || "Volunteer Scanner"}
          embedded
          disableClose
          onScanSuccess={() => setScanCount(prev => prev + 1)}
        />
      </main>
    </div>
  );
}

