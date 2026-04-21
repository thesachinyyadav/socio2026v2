"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

interface VenueRequest {
  id: string;
  entity_id: string | null;
  entity_type: "event" | "fest" | "standalone";
  entity_title?: string;
  requested_by_name?: string | null;
  details: {
    venue_name?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    setup_notes?: string;
    booking_title?: string;
  };
  status: "pending" | "approved" | "rejected" | "returned_for_revision";
  requested_by: string;
  decision_notes: string | null;
}

const SOURCE_STYLES: Record<VenueRequest["entity_type"], string> = {
  event:      "bg-blue-100 text-blue-700",
  fest:       "bg-purple-100 text-purple-700",
  standalone: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ status }: { status: VenueRequest["status"] }) {
  const map: Record<VenueRequest["status"], string> = {
    pending:               "bg-yellow-100 text-yellow-700",
    approved:              "bg-green-100 text-green-700",
    rejected:              "bg-red-100 text-red-600",
    returned_for_revision: "bg-amber-100 text-amber-700",
  };
  const label: Record<VenueRequest["status"], string> = {
    pending:               "Pending",
    approved:              "Approved",
    rejected:              "Rejected",
    returned_for_revision: "Returned",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function RequestCard({
  req,
  showActions,
  onApprove,
  onReturn,
  acting,
}: {
  req: VenueRequest;
  showActions: boolean;
  onApprove: () => void;
  onReturn: () => void;
  acting: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 truncate">{req.entity_title || req.details.booking_title || req.entity_id || "Venue Booking"}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-medium ${SOURCE_STYLES[req.entity_type]}`}>{req.entity_type}</span>
          <StatusBadge status={req.status} />
        </div>
        <div className="mt-1 text-sm text-gray-600 space-y-0.5">
          {req.details.venue_name && <p><span className="font-medium">Venue:</span> {req.details.venue_name}</p>}
          {req.details.date && (
            <p>
              <span className="font-medium">Date:</span> {req.details.date}
              {req.details.start_time && ` · ${req.details.start_time}–${req.details.end_time}`}
            </p>
          )}
          {req.details.setup_notes && <p className="text-gray-500 text-xs italic">Notes: {req.details.setup_notes}</p>}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Requested by {req.requested_by_name ? `${req.requested_by_name} (${req.requested_by})` : req.requested_by}
        </p>
        {req.decision_notes && (
          <p className="text-xs text-gray-500 mt-1 italic">"{req.decision_notes}"</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {req.entity_type !== "standalone" && req.entity_id && (
          <Link
            href={`/approvals/${req.entity_id}?type=${req.entity_type}`}
            className="text-sm text-blue-600 hover:underline px-2 py-1"
          >
            View
          </Link>
        )}
        {showActions && (
          <>
            <button
              disabled={acting}
              onClick={onReturn}
              className="px-3 py-1.5 text-sm rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Return
            </button>
            <button
              disabled={acting}
              onClick={onApprove}
              className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {acting ? "…" : "Approve"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VenueDashboard() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [pending,  setPending]  = useState<VenueRequest[]>([]);
  const [reviewed, setReviewed] = useState<VenueRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState<string>("all");

  // Return-for-revision modal state
  const [returnModal, setReturnModal] = useState<{ id: string } | null>(null);
  const [returnNote,  setReturnNote]  = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const u = userData as any;
    if (u && !u.is_vendor_manager && !u.is_masteradmin) {
      router.replace("/error"); return;
    }
    fetchQueue();
  }, [authLoading, session, userData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/service-requests/my-queue`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      setPending(data.pending || []);
      setReviewed(data.reviewed || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approved" | "returned_for_revision", notes?: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/service-requests/${id}/action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(action === "approved" ? "Venue request approved" : "Returned to organiser");
      fetchQueue();
    } catch {
      toast.error("Network error");
    } finally {
      setActingId(null);
    }
  }

  async function confirmReturn() {
    if (!returnModal) return;
    if (returnNote.trim().length < 20) {
      toast.error("Notes must be at least 20 characters");
      return;
    }
    await handleAction(returnModal.id, "returned_for_revision", returnNote);
    setReturnModal(null);
    setReturnNote("");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venue Manager Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            All venue booking requests for your campus — event-linked and standalone.
          </p>
        </div>

        {(() => {
          const allVenueNames = Array.from(new Set([...pending, ...reviewed]
            .map(r => r.details.venue_name).filter(Boolean) as string[])).sort();
          const matchFilter = (r: VenueRequest) =>
            venueFilter === "all" || r.details.venue_name === venueFilter;
          const filteredPending  = pending.filter(matchFilter);
          const filteredReviewed = reviewed.filter(matchFilter);

          return (
            <>
              {/* Filter */}
              {allVenueNames.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-600 font-medium">Filter by venue:</label>
                  <select
                    value={venueFilter}
                    onChange={e => setVenueFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="all">All venues</option>
                    {allVenueNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {loading ? (
                <p className="text-gray-500 text-sm">Loading queue…</p>
              ) : (
                <>
                  {/* Pending */}
                  <section>
                    <h2 className="text-sm font-semibold text-gray-700 mb-2">
                      Pending <span className="text-gray-400 font-normal">({filteredPending.length})</span>
                    </h2>
                    {filteredPending.length === 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                        <p className="text-gray-400 text-sm">No pending venue requests.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredPending.map(req => (
                          <RequestCard
                            key={req.id}
                            req={req}
                            showActions
                            acting={actingId === req.id}
                            onApprove={() => handleAction(req.id, "approved")}
                            onReturn={() => { setReturnModal({ id: req.id }); setReturnNote(""); }}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Reviewed */}
                  {filteredReviewed.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-gray-700 mb-2">
                        Reviewed <span className="text-gray-400 font-normal">({filteredReviewed.length})</span>
                      </h2>
                      <div className="space-y-3">
                        {filteredReviewed.map(req => (
                          <RequestCard
                            key={req.id}
                            req={req}
                            showActions={false}
                            acting={false}
                            onApprove={() => {}}
                            onReturn={() => {}}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          );
        })()}
      </div>

      {/* Return modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Return to Organiser</h2>
            <p className="text-sm text-gray-600">
              Provide a reason so the organiser can address the issue (min 20 characters).
            </p>
            <textarea
              rows={3}
              value={returnNote}
              onChange={e => setReturnNote(e.target.value)}
              placeholder="Reason for returning the venue request…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p className="text-xs text-gray-400">{returnNote.trim().length} / 20 min</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReturnModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReturn}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
