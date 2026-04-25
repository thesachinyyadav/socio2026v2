"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
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
  const eventId = String(params?.eventId || "");
  const { userData, isLoading } = useAuth();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [eventTitle, setEventTitle] = useState("");

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
        .select("title, volunteers")
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

      setEventTitle(authorized ? data.title || "Volunteer Scanner" : "");
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Volunteer Dashboard</h1>
              <p className="text-sm text-slate-500">{eventTitle}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <QRScanner
          eventId={eventId}
          eventTitle={eventTitle}
          embedded
          disableClose
        />
      </main>
    </div>
  );
}
