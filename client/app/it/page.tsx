"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface ITInfo {
  description: string;
  status: "pending" | "approved" | "declined" | "returned_for_revision" | string;
  note?: string | null;
  actioned_by?: string | null;
  actioned_at?: string | null;
}

interface ITRequest {
  event_id: string;
  title: string;
  event_date: string | null;
  venue: string | null;
  campus_hosted_at: string | null;
  it_info: ITInfo;
  organizing_dept: string | null;
  organizing_school: string | null;
  created_by: string | null;
  created_at: string;
  is_draft: boolean | null;
}

const safeText = (value: unknown, fallback = ""): string => {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = ["event_creator", "fest_creator", "created_by", "email", "name", "id"] as const;
    for (const key of preferred) {
      const candidate = record[key];
      if (candidate != null && typeof candidate !== "object") {
        const normalized = safeText(candidate, "");
        if (normalized) return normalized;
      }
    }
  }
  return fallback;
};

type ExpandedState = { eventId: string; type: "decline" | "return" } | null;

const STATUS_BADGE: Record<string, string> = {
  pending:              "bg-yellow-100 text-yellow-700",
  approved:             "bg-green-100 text-green-700",
  declined:             "bg-red-100 text-red-700",
  returned_for_revision: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending:              "Pending",
  approved:             "Approved",
  declined:             "Declined",
  returned_for_revision: "Returned for Revision",
};

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CampusIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function DeptIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export default function ItDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");

  // Action state — only one card expanded at a time
  const [expanded, setExpanded] = useState<ExpandedState>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const isIt = (userData as any)?.is_it_support;
    const isAdmin = (userData as any)?.is_masteradmin;
    if (userData && !isIt && !isAdmin) { router.replace("/error"); return; }
    if (userData) fetchRequests();
  }, [isLoading, session, userData]);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/events/it-requests`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load IT requests");
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  function openExpanded(eventId: string, type: "decline" | "return") {
    setExpanded({ eventId, type });
    setNoteText("");
    setActionError(null);
  }

  function closeExpanded() {
    setExpanded(null);
    setNoteText("");
    setActionError(null);
  }

  async function submitAction(
    eventId: string,
    action: "approve" | "reject" | "return_for_revision",
    note?: string
  ) {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/it-action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update request");
      }
      const data = await res.json();
      setRequests(prev =>
        prev.map(r => r.event_id === eventId ? { ...r, it_info: data.it_info } : r)
      );
      closeExpanded();
    } catch (err: any) {
      setActionError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const campus = (userData as any)?.campus;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#154CB3]">IT Support Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Incoming IT support requests{campus ? ` for ${campus}` : ""}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (() => {
          const pending  = requests.filter(r => (r.it_info?.status ?? "pending") === "pending");
          const reviewed = requests.filter(r => (r.it_info?.status ?? "pending") !== "pending");
          const visible  = activeTab === "pending" ? pending : reviewed;

          return (
            <>
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "pending"
                      ? "bg-white text-[#154CB3] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Pending
                  {pending.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 font-bold">
                      {pending.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("reviewed")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "reviewed"
                      ? "bg-white text-[#154CB3] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Reviewed
                  {reviewed.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600 font-bold">
                      {reviewed.length}
                    </span>
                  )}
                </button>
              </div>

              {visible.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <div className="flex justify-center mb-3">
                    <MonitorIcon />
                  </div>
                  {activeTab === "pending" ? (
                    <>
                      <p className="text-gray-600 font-medium">No pending requests</p>
                      <p className="text-sm text-gray-400 mt-1">All caught up! Check the Reviewed tab for past decisions.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 font-medium">No reviewed requests yet</p>
                      <p className="text-sm text-gray-400 mt-1">Requests you approve, decline, or return will appear here.</p>
                    </>
                  )}
                </div>
              )}

              {visible.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {visible.length} request{visible.length !== 1 ? "s" : ""}
                  </p>

                  {visible.map((req) => {
              const status = req.it_info?.status ?? "pending";
              const isPending = status === "pending";
              const isExpanded = expanded?.eventId === req.event_id;
              const expandType = isExpanded ? expanded!.type : null;

              return (
                <div
                  key={req.event_id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-[#154CB3]/30 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link
                          href={`/event/${req.event_id}`}
                          className="font-semibold text-[#154CB3] hover:underline text-base"
                        >
                          {req.title}
                        </Link>
                        {req.is_draft && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium">
                            Draft
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                        {req.event_date && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon />
                            {new Date(req.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                        {req.venue && (
                          <span className="flex items-center gap-1">
                            <LocationIcon />
                            {req.venue}
                          </span>
                        )}
                        {req.campus_hosted_at && (
                          <span className="flex items-center gap-1">
                            <CampusIcon />
                            {req.campus_hosted_at}
                          </span>
                        )}
                        {(req.organizing_dept || req.organizing_school) && (
                          <span className="flex items-center gap-1">
                            <DeptIcon />
                            {req.organizing_dept || req.organizing_school}
                          </span>
                        )}
                      </div>

                      {/* IT Requirements box */}
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                            IT Requirements
                          </p>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${
                            STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600"
                          }`}>
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{req.it_info?.description}</p>
                        {req.it_info?.note && (
                          <p className="mt-2 text-xs text-gray-500 italic border-t border-blue-100 pt-2">
                            Note: {req.it_info.note}
                          </p>
                        )}
                        {req.it_info?.actioned_by && (
                          <p className="mt-1 text-xs text-gray-400">
                            by {req.it_info.actioned_by}
                          </p>
                        )}
                      </div>

                      {/* Action buttons — only for pending requests */}
                      {isPending && !isExpanded && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => submitAction(req.event_id, "approve")}
                            disabled={submitting}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openExpanded(req.event_id, "decline")}
                            disabled={submitting}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => openExpanded(req.event_id, "return")}
                            disabled={submitting}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Return for Revision
                          </button>
                        </div>
                      )}

                      {/* Decline confirmation panel */}
                      {isExpanded && expandType === "decline" && (
                        <div className="border border-red-200 rounded-xl bg-red-50 px-4 py-3 space-y-3">
                          <p className="text-sm font-semibold text-red-700">Decline this IT request?</p>
                          <textarea
                            rows={3}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Optional — add a reason for declining"
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                          />
                          {actionError && (
                            <p className="text-xs text-red-600">{actionError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitAction(req.event_id, "reject", noteText)}
                              disabled={submitting}
                              className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submitting ? "Declining…" : "Confirm Decline"}
                            </button>
                            <button
                              onClick={closeExpanded}
                              disabled={submitting}
                              className="px-4 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Return for revision panel */}
                      {isExpanded && expandType === "return" && (
                        <div className="border border-amber-200 rounded-xl bg-amber-50 px-4 py-3 space-y-3">
                          <p className="text-sm font-semibold text-amber-700">Return for Revision</p>
                          <textarea
                            rows={3}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Describe what the organizer needs to change or clarify (required)"
                            className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                          />
                          {actionError && (
                            <p className="text-xs text-red-600">{actionError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitAction(req.event_id, "return_for_revision", noteText)}
                              disabled={submitting || !noteText.trim()}
                              className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submitting ? "Sending…" : "Send for Revision"}
                            </button>
                            <button
                              onClick={closeExpanded}
                              disabled={submitting}
                              className="px-4 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{timeAgo(req.created_at)}</p>
                      {safeText(req.created_by) && (
                        <p className="text-xs text-gray-400 mt-0.5">by {safeText(req.created_by)}</p>
                      )}
                    </div>
                  </div>
                </div>
                  );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
