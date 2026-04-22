"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  id: string;
  venue_id: string;
  requested_by: string;
  requested_by_name?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  headcount: number | null;
  setup_notes: string | null;
  entity_type: "event" | "fest" | "standalone";
  entity_id: string | null;
  status: "pending" | "approved" | "rejected" | "returned_for_revision";
  decision_notes: string | null;
  created_at: string;
  has_overlap?: boolean;
  venue?: {
    name: string;
    campus: string;
    location: string | null;
    capacity: number | null;
    is_approval_needed: boolean;
  };
}

type ActionType = "approved" | "rejected" | "returned_for_revision";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

function pad2(n: number) { return String(n).padStart(2, "0"); }

function formatTime12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad2(m)} ${ampm}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, mo, day] = d.split("-").map(Number);
  return new Date(y, mo - 1, day).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS_STYLE: Record<BookingRow["status"], string> = {
  pending:               "bg-amber-50 text-amber-700 border-amber-200",
  approved:              "bg-green-50 text-green-700 border-green-200",
  rejected:              "bg-red-50 text-red-700 border-red-200",
  returned_for_revision: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_LABEL: Record<BookingRow["status"], string> = {
  pending:               "Pending",
  approved:              "Approved",
  rejected:              "Rejected",
  returned_for_revision: "Returned",
};

const ENTITY_STYLE: Record<BookingRow["entity_type"], string> = {
  event:      "bg-blue-50 text-blue-700 border-blue-200",
  fest:       "bg-purple-50 text-purple-700 border-purple-200",
  standalone: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconWarning = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({
  row,
  showActions,
  acting,
  onApprove,
  onReject,
  onReturn,
}: {
  row: BookingRow;
  showActions: boolean;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReturn: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${row.has_overlap ? "border-amber-300" : "border-gray-200"}`}>
      {/* Overlap warning banner */}
      {row.has_overlap && (
        <div className="flex items-center gap-1.5 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
          <IconWarning />
          Another pending booking overlaps this time slot. Only one can be approved.
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title + badges */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <p className="text-sm font-semibold text-gray-900 truncate">{row.title}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium capitalize ${ENTITY_STYLE[row.entity_type]}`}>
              {row.entity_type}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[row.status]}`}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>

          {/* Meta */}
          <div className="space-y-0.5 text-xs text-gray-500">
            {row.venue?.name && (
              <p className="font-medium text-gray-700">{row.venue.name}{row.venue.location ? ` · ${row.venue.location}` : ""}</p>
            )}
            <p className="flex items-center gap-1.5">
              <IconClock />
              {formatDate(row.date)} · {formatTime12(row.start_time)} – {formatTime12(row.end_time)}
            </p>
            {row.headcount && (
              <p className="flex items-center gap-1.5">
                <IconUsers /> {row.headcount} attendees
              </p>
            )}
            {row.setup_notes && (
              <p className="text-gray-400 italic">Notes: {row.setup_notes}</p>
            )}
            <p className="text-gray-400">
              Requested by{" "}
              <span className="font-medium text-gray-600">
                {row.requested_by_name || row.requested_by}
              </span>
            </p>
          </div>

          {row.decision_notes && (
            <p className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
              {row.decision_notes}
            </p>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex flex-col gap-2 shrink-0">
            <button
              disabled={acting}
              onClick={onApprove}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#154CB3] text-white hover:bg-[#0f3a7a] transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Approve"}
            </button>
            <button
              disabled={acting}
              onClick={onReturn}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              Return
            </button>
            <button
              disabled={acting}
              onClick={onReject}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenueDashboard() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [pending,  setPending]  = useState<BookingRow[]>([]);
  const [reviewed, setReviewed] = useState<BookingRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState("all");
  const [pendingPage,  setPendingPage]  = useState(1);
  const [reviewedPage, setReviewedPage] = useState(1);
  const PAGE_SIZE = 10;

  // Notes modal (used for both return and reject)
  const [notesModal, setNotesModal] = useState<{ id: string; action: "rejected" | "returned_for_revision" } | null>(null);
  const [notesText,  setNotesText]  = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const u = userData as any;
    if (u && !u.is_vendor_manager && !u.is_masteradmin) { router.replace("/error"); return; }
    fetchQueue();
  }, [authLoading, session, userData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/venue-bookings/queue`, {
        headers: { Authorization: `Bearer ${(session as any)!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      setPending(data.pending  || []);
      setReviewed(data.reviewed || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: ActionType, notes?: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/venue-bookings/${id}/action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${(session as any)!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error || "Action failed"); return; }
      toast.success(
        action === "approved"             ? "Booking approved" :
        action === "rejected"             ? "Booking rejected" :
        "Returned to organiser"
      );
      fetchQueue();
    } catch {
      toast.error("Network error");
    } finally {
      setActingId(null);
    }
  }

  async function confirmNotes() {
    if (!notesModal) return;
    if (notesText.trim().length < 10) { toast.error("Please provide at least 10 characters"); return; }
    await handleAction(notesModal.id, notesModal.action, notesText.trim());
    setNotesModal(null);
    setNotesText("");
  }

  // Derive unique venue names for filter
  const allVenueNames = Array.from(
    new Set([...pending, ...reviewed].map(r => r.venue?.name).filter(Boolean) as string[])
  ).sort();

  const matchFilter = (r: BookingRow) => venueFilter === "all" || r.venue?.name === venueFilter;
  const filteredPending  = pending.filter(matchFilter);
  const filteredReviewed = reviewed.filter(matchFilter);

  const pendingTotalPages  = Math.max(1, Math.ceil(filteredPending.length  / PAGE_SIZE));
  const reviewedTotalPages = Math.max(1, Math.ceil(filteredReviewed.length / PAGE_SIZE));
  const pagedPending  = filteredPending.slice( (pendingPage  - 1) * PAGE_SIZE, pendingPage  * PAGE_SIZE);
  const pagedReviewed = filteredReviewed.slice((reviewedPage - 1) * PAGE_SIZE, reviewedPage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50 pt-[72px]">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
          <h1 className="text-xl font-semibold text-gray-900">Venue Manager Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pending and reviewed venue booking requests for your campus.
          </p>
        </div>

        {/* Venue filter */}
        {allVenueNames.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter</label>
            <select
              value={venueFilter}
              onChange={e => { setVenueFilter(e.target.value); setPendingPage(1); setReviewedPage(1); }}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
            >
              <option value="all">All venues</option>
              {allVenueNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading queue…</div>
        ) : (
          <>
            {/* Pending */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  Pending <span className="text-gray-400 font-normal">({filteredPending.length})</span>
                </p>
                {pendingTotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pendingPage <= 1}
                      onClick={() => setPendingPage(p => p - 1)}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >← Prev</button>
                    <span className="text-xs text-gray-500">{pendingPage} / {pendingTotalPages}</span>
                    <button
                      disabled={pendingPage >= pendingTotalPages}
                      onClick={() => setPendingPage(p => p + 1)}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >Next →</button>
                  </div>
                )}
              </div>
              {filteredPending.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
                  <p className="text-sm text-gray-400">No pending venue requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pagedPending.map(row => (
                    <BookingCard
                      key={row.id}
                      row={row}
                      showActions
                      acting={actingId === row.id}
                      onApprove={() => handleAction(row.id, "approved")}
                      onReject={() => { setNotesModal({ id: row.id, action: "rejected" }); setNotesText(""); }}
                      onReturn={() => { setNotesModal({ id: row.id, action: "returned_for_revision" }); setNotesText(""); }}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Reviewed */}
            {filteredReviewed.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Reviewed <span className="text-gray-400 font-normal">({filteredReviewed.length})</span>
                  </p>
                  {reviewedTotalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={reviewedPage <= 1}
                        onClick={() => setReviewedPage(p => p - 1)}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >← Prev</button>
                      <span className="text-xs text-gray-500">{reviewedPage} / {reviewedTotalPages}</span>
                      <button
                        disabled={reviewedPage >= reviewedTotalPages}
                        onClick={() => setReviewedPage(p => p + 1)}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >Next →</button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {pagedReviewed.map(row => (
                    <BookingCard
                      key={row.id}
                      row={row}
                      showActions={false}
                      acting={false}
                      onApprove={() => {}}
                      onReject={() => {}}
                      onReturn={() => {}}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Notes modal — reused for both Reject and Return */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setNotesModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-base font-semibold text-gray-900">
                {notesModal.action === "rejected" ? "Reject booking" : "Return to organiser"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {notesModal.action === "rejected"
                  ? "Provide a reason for rejection (min 10 characters)."
                  : "Explain what needs to be corrected (min 10 characters)."}
              </p>
            </div>
            <div className="px-5 py-4">
              <textarea
                rows={4}
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="Enter reason…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
              />
              <p className="text-xs text-gray-400 mt-1">{notesText.trim().length} / 10 min</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2.5">
              <button
                onClick={() => setNotesModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmNotes}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                  notesModal.action === "rejected"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {notesModal.action === "rejected" ? "Reject" : "Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
