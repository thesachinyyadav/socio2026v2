"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dayjs } from "@/lib/dateUtils";
import { QrCode, Calendar, Clock, MapPin, Users, ShieldAlert, ArrowRight } from "lucide-react";
import LoadingIndicator from "@/app/_components/UI/LoadingIndicator";

interface VolunteerAssignment {
  register_number: string;
  expires_at: string;
  assigned_by: string;
}

interface VolunteerEvent {
  event_id: string;
  title: string;
  event_date: string;
  end_date?: string;
  venue: string;
  campus_hosted_at: string;
  volunteer_assignment: VolunteerAssignment;
}

export default function VolunteerDashboard() {
  const { session, userData, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authIsLoading) return;

    if (!session) {
      router.replace("/auth");
      return;
    }

    if (!userData?.register_number) {
      setError("Only students with a register number can access the Volunteer Dashboard.");
      setIsLoading(false);
      return;
    }

    const fetchVolunteerEvents = async () => {
      try {
        setIsLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
        const res = await fetch(`${API_URL}/api/volunteer/events`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || "Failed to fetch assigned events.");
        }

        const data = await res.json();
        setEvents(data.events || []);
      } catch (err: any) {
        console.error("Error fetching volunteer events:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVolunteerEvents();
  }, [authIsLoading, session, userData, router]);

  if (authIsLoading || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingIndicator />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8 pt-24 min-h-screen">
        <div className="bg-red-50 text-red-800 p-6 rounded-2xl flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-red-600" />
          <div>
            <h2 className="text-lg font-bold text-red-900 mb-1">Access Denied</h2>
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 pt-28 min-h-screen">
      <div className="mb-10">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Volunteer Dashboard
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Manage your assigned events and scan attendee QR codes.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Assignments</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            You are not currently assigned as a volunteer for any active events. Once an organizer assigns you, the event will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const expiryDate = dayjs(event.volunteer_assignment.expires_at);
            const isExpiringSoon = expiryDate.diff(dayjs(), 'hour') < 24;

            return (
              <div
                key={event.event_id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#154CB3] opacity-80" />
                
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="font-bold text-lg text-slate-900 leading-tight line-clamp-2">
                      {event.title}
                    </h3>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{dayjs(event.event_date).format("MMM D, YYYY")}</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{event.venue} • {event.campus_hosted_at}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        Access expires:{" "}
                        <span className={`font-semibold ${isExpiringSoon ? "text-amber-600" : "text-slate-700"}`}>
                          {expiryDate.format("MMM D, YYYY h:mm A")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <div className="text-xs text-slate-400 mb-4 truncate">
                    Assigned by: {event.volunteer_assignment.assigned_by}
                  </div>
                  
                  <Link
                    href={`/volunteer/scanner/${event.event_id}`}
                    className="w-full flex items-center justify-center gap-2 bg-[#154CB3] hover:bg-[#0f3782] text-white py-2.5 px-4 rounded-xl font-semibold transition-colors group-hover:shadow-md"
                  >
                    <QrCode className="w-4 h-4" />
                    Open Scanner
                    <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform ml-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
