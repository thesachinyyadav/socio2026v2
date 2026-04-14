"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Clock, Calendar, MapPin, Users } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

interface EventDetail {
  event_id: string;
  title: string;
  description?: string;
  event_date?: string;
  venue?: string;
  organizing_dept?: string;
  organizer_email?: string;
  max_participants?: number;
  registration_fee?: number;
  workflow_status?: string;
  approval_state?: string;
  is_draft?: boolean;
  parent_fest_id?: string;
  fest_title?: string;
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending_organiser") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
      <Clock className="w-3.5 h-3.5" /> Awaiting Your Review
    </span>
  );
  if (normalized === "organiser_approved") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
      <CheckCircle className="w-3.5 h-3.5" /> Approved
    </span>
  );
  if (normalized === "rejected" || normalized === "final_rejected") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
      <XCircle className="w-3.5 h-3.5" /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
      {normalized || "Unknown"}
    </span>
  );
}

export default function OrganiserApprovalPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { userData } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<"approve" | "return" | "reject" | null>(null);

  // Load auth token
  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      setAuthToken(session?.access_token ?? null);
    };
    load();
  }, []);

  // Load event details
  const fetchEvent = useCallback(async () => {
    if (!authToken || !eventId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to fetch event (${res.status})`);
      const data = await res.json();
      setEvent(data?.event ?? data);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load event details.");
    } finally {
      setIsLoading(false);
    }
  }, [authToken, eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleDecision = async (action: "approved" | "returned_for_revision" | "rejected") => {
    if (!authToken) { toast.error("Not authenticated."); return; }
    if ((action === "rejected" || action === "returned_for_revision") && note.trim().length < 20) {
      toast.error("Please provide a revision note of at least 20 characters.");
      return;
    }
    setIsSubmitting(true);
    setDecision(action === "approved" ? "approve" : action === "returned_for_revision" ? "return" : "reject");
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/organiser-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action, notes: note.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Decision failed.");
      if (action === "approved") {
        toast.success("Event approved successfully.");
      } else if (action === "returned_for_revision") {
        toast.success("Event returned for revision.");
      } else {
        toast.success("Event rejected.");
      }
      await fetchEvent();
    } catch (err: any) {
      toast.error(err.message ?? "Unable to submit decision.");
    } finally {
      setIsSubmitting(false);
      setDecision(null);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading event details…</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Event Not Found</h1>
          <p className="text-slate-500 mb-6">This event does not exist or you don&apos;t have access to it.</p>
          <Link href="/manage" className="text-blue-600 hover:underline text-sm font-semibold">← Back to Manage</Link>
        </div>
      </main>
    );
  }

  const isPending = String(event.workflow_status || "").toLowerCase() === "pending_organiser";
  const isResolved = !isPending;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/manage" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Manage
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Organiser Review</p>
              <h1 className="text-2xl font-extrabold text-[#0f2557]">{event.title}</h1>
              {event.fest_title && (
                <p className="text-sm text-slate-500 mt-0.5">Part of <span className="font-semibold text-slate-700">{event.fest_title}</span></p>
              )}
            </div>
            <StatusBadge status={event.workflow_status} />
          </div>
        </div>

        {/* Event Details Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Event Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
            {event.event_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{new Date(event.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
            {event.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{event.venue}</span>
              </div>
            )}
            {event.max_participants && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Max {event.max_participants} participants</span>
              </div>
            )}
            {event.organizing_dept && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Dept:</span>
                <span>{event.organizing_dept}</span>
              </div>
            )}
            {event.organizer_email && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-slate-400 font-medium">Submitted by:</span>
                <span className="font-semibold text-slate-700">{event.organizer_email}</span>
              </div>
            )}
          </div>
          {event.description && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{event.description}</p>
            </div>
          )}
        </div>

        {/* Decision Panel */}
        {isPending ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Your Decision</h2>
            <p className="text-sm text-slate-500">
              As the fest organiser, you are reviewing this sub-event submitted by a fest subhead.
              Approve to flag it as ready for publication, or return it for revision.
            </p>

            {/* Revision Note */}
            <div>
              <label htmlFor="revision-note" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Revision Notes <span className="text-slate-400 font-normal">(required when returning)</span>
              </label>
              <textarea
                id="revision-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe what needs to be changed or improved…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none placeholder:text-slate-400"
              />
              {note.length > 0 && note.length < 20 && (
                <p className="mt-1 text-xs text-red-500">Note must be at least 20 characters ({note.length}/20)</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleDecision("approved")}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 flex-1 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {isSubmitting && decision === "approve" ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Approving…</span>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Approve Event</>
                )}
              </button>
              <button
                onClick={() => handleDecision("returned_for_revision")}
                disabled={isSubmitting || note.trim().length < 20}
                className="flex items-center justify-center gap-2 flex-1 px-5 py-3 bg-white text-red-600 border border-red-300 font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {isSubmitting && decision === "return" ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin" /> Returning…</span>
                ) : (
                  <><XCircle className="w-4 h-4" /> Return for Revision</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center gap-3">
            {String(event.workflow_status || "").toLowerCase() === "organiser_approved" ? (
              <>
                <CheckCircle className="w-12 h-12 text-emerald-500" />
                <h2 className="text-lg font-bold text-slate-800">Event Approved</h2>
                <p className="text-sm text-slate-500">This event has been approved and is moving forward in the workflow.</p>
              </>
            ) : (
              <>
                <XCircle className="w-12 h-12 text-red-400" />
                <h2 className="text-lg font-bold text-slate-800">Event Returned</h2>
                <p className="text-sm text-slate-500">This event was returned for revision. The subhead will be notified.</p>
              </>
            )}
            <Link href="/manage" className="mt-2 text-sm font-semibold text-blue-600 hover:underline">
              ← Back to Manage Dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
