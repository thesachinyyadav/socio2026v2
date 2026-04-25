"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { christCampuses } from "@/app/lib/eventFormSchema";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StallDescription {
  notes?: string;
  hardboard_stalls?: number;
  canopy_stalls?: number;
}

interface StallBooking {
  stall_id: string;
  description: StallDescription | null;
  requested_by: string;
  campus: string | null;
  event_fest_id: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  event_title?: string | null;
  event_date?: string | null;
  fest_title?: string | null;
  fest_date?: string | null;
}

interface EventOption {
  event_id: string;
  title: string;
  event_date: string;
}

interface FestOption {
  fest_id: string;
  fest_title: string;
  opening_date: string;
}

type Tab = "mine" | "book";
type LinkedType = "none" | "event" | "fest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookStallPage() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("mine");

  // My Bookings state
  const [bookings, setBookings] = useState<StallBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Booking form state
  const [description, setDescription] = useState("");
  const [hardboardStalls, setHardboardStalls] = useState<string>("0");
  const [canopyStalls, setCanopyStalls] = useState<string>("0");
  const [campus, setCampus] = useState("");
  const [linkedType, setLinkedType] = useState<LinkedType>("none");
  const [eventFestId, setEventFestId] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [fests, setFests] = useState<FestOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Auth Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !session) router.replace("/auth");
    if (!isLoading && session && userData) {
      if (!userData.is_organiser && !(userData as any).is_masteradmin) {
        router.replace("/error");
      }
    }
  }, [isLoading, session, userData, router]);

  // ─── Fetch My Bookings ───────────────────────────────────────────────────────
  const fetchMyBookings = useCallback(async () => {
    if (!session) return;
    setBookingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stall-bookings/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bookings");
      setBookings(json.bookings || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setBookingsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && tab === "mine") fetchMyBookings();
  }, [session, tab, fetchMyBookings]);

  // ─── Fetch Organiser's Events & Fests ────────────────────────────────────────
  useEffect(() => {
    if (!session || tab !== "book") return;
    setOptionsLoading(true);
    setOptionsError(null);
    fetch(`${API_URL}/api/stall-bookings/my-options`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load options");
        setEvents(json.events || []);
        setFests(json.fests || []);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load events/fests";
        setOptionsError(msg);
        toast.error(msg);
      })
      .finally(() => setOptionsLoading(false));
  }, [session, tab]);

  // Reset selection when type changes
  useEffect(() => {
    setEventFestId("");
  }, [linkedType]);

  // ─── Submit Booking ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !description.trim() || !campus) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        description: description.trim(),
        hardboard_stalls: Number(hardboardStalls) || 0,
        canopy_stalls: Number(canopyStalls) || 0,
        campus,
      };
      if (linkedType !== "none" && eventFestId) {
        body.event_fest_id = eventFestId;
      }

      const res = await fetch(`${API_URL}/api/stall-bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit booking");

      toast.success("Stall booking submitted!");
      setDescription("");
      setHardboardStalls("0");
      setCanopyStalls("0");
      setCampus("");
      setLinkedType("none");
      setEventFestId("");
      setTab("mine");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading State ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#063168]">Book a Stall</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Request a stall for your event or fest
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(
            [
              ["mine", "My Bookings"],
              ["book", "Book a Stall"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-[#154CB3] text-[#154CB3]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── My Bookings Tab ─────────────────────────────────────────────────── */}
        {tab === "mine" && (
          <div>
            {bookingsLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg font-medium">No stall bookings yet</p>
                <p className="text-sm mt-1">
                  Click &ldquo;Book a Stall&rdquo; to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => {
                  const desc = b.description || {};
                  const linkedTitle = b.event_title || b.fest_title;
                  const linkedDate = b.event_date || b.fest_date;
                  return (
                    <div
                      key={b.stall_id}
                      className="bg-white rounded-xl border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                STATUS_STYLES[b.status] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                            </span>
                            {b.campus && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                                {b.campus}
                              </span>
                            )}
                          </div>

                          {desc.notes && (
                            <p className="text-sm text-gray-800 mb-2">{desc.notes}</p>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            {(desc.hardboard_stalls ?? 0) > 0 && (
                              <span>
                                Hard board:{" "}
                                <span className="font-medium text-gray-800">
                                  {desc.hardboard_stalls}
                                </span>
                              </span>
                            )}
                            {(desc.canopy_stalls ?? 0) > 0 && (
                              <span>
                                Canopy:{" "}
                                <span className="font-medium text-gray-800">
                                  {desc.canopy_stalls}
                                </span>
                              </span>
                            )}
                          </div>

                          {linkedTitle && (
                            <p className="text-sm text-gray-500 mt-1.5">
                              Linked to:{" "}
                              <span className="font-medium text-[#154CB3]">
                                {linkedTitle}
                              </span>
                              {linkedDate && ` (${formatDate(linkedDate)})`}
                            </p>
                          )}

                          <p className="text-xs text-gray-400 mt-2">
                            Submitted {formatSubmitted(b.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Book a Stall Tab ─────────────────────────────────────────────────── */}
        {tab === "book" && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
          >
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is the stall for? Any special requirements?"
                rows={3}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3] resize-none"
              />
            </div>

            {/* Stall counts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Hard Board Stalls
                </label>
                <input
                  type="number"
                  min="0"
                  value={hardboardStalls}
                  onChange={(e) => setHardboardStalls(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Canopy Stalls
                </label>
                <input
                  type="number"
                  min="0"
                  value={canopyStalls}
                  onChange={(e) => setCanopyStalls(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
                />
              </div>
            </div>

            {/* Campus */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Campus <span className="text-red-500">*</span>
              </label>
              <select
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
              >
                <option value="">— Select campus —</option>
                {christCampuses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Link to Event or Fest (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link to Event or Fest{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">
                You can only link to one event or fest — select None to skip.
              </p>
              <div className="flex gap-2 mb-3">
                {(["none", "event", "fest"] as LinkedType[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setLinkedType(t)}
                    className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                      linkedType === t
                        ? "border-[#154CB3] bg-[#154CB3] text-white"
                        : "border-gray-300 text-gray-600 hover:border-[#154CB3]"
                    }`}
                  >
                    {t === "none" ? "None" : t === "event" ? "Event" : "Fest"}
                  </button>
                ))}
              </div>

              {linkedType !== "none" &&
                (optionsLoading ? (
                  <p className="text-sm text-gray-400">Loading your {linkedType === "event" ? "events" : "fests"}…</p>
                ) : optionsError ? (
                  <p className="text-sm text-red-500">{optionsError}</p>
                ) : (
                  <>
                    <select
                      value={eventFestId}
                      onChange={(e) => setEventFestId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
                    >
                      <option value="">
                        — Select {linkedType === "event" ? "event" : "fest"} —
                      </option>
                      {linkedType === "event"
                        ? events.map((ev) => (
                            <option key={ev.event_id} value={ev.event_id}>
                              {ev.title} ({formatDate(ev.event_date)})
                            </option>
                          ))
                        : fests.map((ft) => (
                            <option key={ft.fest_id} value={ft.fest_id}>
                              {ft.fest_title} ({formatDate(ft.opening_date)})
                            </option>
                          ))}
                    </select>
                    {linkedType === "event" && events.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        No events found. Create an event first from the Manage page.
                      </p>
                    )}
                    {linkedType === "fest" && fests.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        No fests found. Create a fest first from the Manage page.
                      </p>
                    )}
                  </>
                ))}
            </div>

            <button
              type="submit"
              disabled={submitting || !description.trim() || !campus}
              className="w-full py-3 bg-[#154CB3] text-white font-semibold rounded-lg hover:bg-[#0d3a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Stall Booking"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
