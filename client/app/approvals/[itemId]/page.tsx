"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MiniCalendar, findConflict, type VenueBooking } from "@/app/_components/OperationalRequestsWizard";

type StepStatus = "pending" | "approved" | "rejected" | "skipped";

interface ApprovalStage {
  step: number;
  role: string;
  label: string;
  status: StepStatus;
  blocking: boolean;
  approved_by: string | null;
}

interface ActionLogEntry {
  step_index?: number;
  step: string;
  action: string;
  by: string;
  byEmail: string;
  at: string;
  note?: string | null;
  is_override?: boolean;
}

interface BudgetItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface ApprovalRecord {
  id: string;
  event_or_fest_id: string;
  type: "event" | "fest";
  stages: ApprovalStage[];
  went_live_at: string | null;
  created_at: string;
  updated_at: string;
  organizing_department_snapshot: string | null;
  organizing_school_snapshot: string | null;
  submitted_by: string | null;
  action_log: ActionLogEntry[];
  budget_items?: BudgetItem[];
}

interface ItemMeta {
  title: string;
  type: string;
  organizing_dept: string | null;
  organizing_school: string | null;
  event_date: string | null;
  created_by: string | null;
}

const safeText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

function isPhase1Complete(stages: ApprovalStage[]): boolean {
  return stages.filter((s) => s.blocking).every(
    (s) => s.status === "approved" || s.status === "skipped"
  );
}

const STATUS_COLORS: Record<StepStatus, string> = {
  pending:  "bg-slate-50 text-slate-700 border-slate-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
  skipped:  "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusIcon({ status, className = "h-4 w-4" }: { status: StepStatus; className?: string }) {
  const strokeClass =
    status === "approved"
      ? "text-emerald-700"
      : status === "rejected"
      ? "text-rose-700"
      : "text-slate-500";

  if (status === "approved") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`${className} ${strokeClass}`}>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="m6.5 10.5 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "rejected") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`${className} ${strokeClass}`}>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="m7 7 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === "skipped") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`${className} ${strokeClass}`}>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="m7.2 8.1 2.2 1.9-2.2 1.9m3.6-3.8 2.2 1.9-2.2 1.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`${className} ${strokeClass}`}>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13.3" r="1" fill="currentColor" />
    </svg>
  );
}

function ArrowLeftIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="m12.5 4.5-5 5 5 5M7.5 9.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M10 3.6 17 16H3l7-12.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 7.4v4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="10" cy="14.8" r=".9" fill="currentColor" />
    </svg>
  );
}

function StepCard({
  label,
  status,
  approvedBy,
}: {
  label: string;
  status: StepStatus;
  approvedBy?: string | null;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${STATUS_COLORS[status]}`}>
      <StatusIcon status={status} className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {approvedBy && (
          <p className="text-xs opacity-70 mt-0.5">by {safeText(approvedBy)}</p>
        )}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide">{status}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ApprovalsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = params?.itemId as string;
  const typeParam = searchParams.get("type") || undefined;

  const { session, isLoading } = useAuth();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [item, setItem] = useState<ItemMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMissingApprovalRecord, setIsMissingApprovalRecord] = useState(false);
  const itemType = typeParam === "fest" ? "fest" : "event";

  // Venue booking state
  const [venueList,        setVenueList]        = useState<{ id: string; name: string; capacity: number | null; location: string | null }[]>([]);
  const [bookings,         setBookings]         = useState<VenueBooking[]>([]);
  const [existingVenueReq, setExistingVenueReq] = useState<{ id: string; status: string; details: any; decision_notes: string | null } | null>(null);
  const [venueForm,        setVenueForm]        = useState({ venue_id: "", venue_name: "", date: "", start_time: "", end_time: "", setup_notes: "" });
  const [venueSubmitting,  setVenueSubmitting]  = useState(false);
  const [venueError,       setVenueError]       = useState<string | null>(null);
  const [venueSuccess,     setVenueSuccess]     = useState(false);

  const loadBookings = useCallback(async (venueId: string, year: number, month: number) => {
    if (!venueId || !session?.access_token) return;
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    try {
      const r = await fetch(`${API_URL}/api/venues/${venueId}/availability?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) { const d = await r.json(); setBookings(d.bookings || []); }
    } catch { /* non-critical */ }
  }, [session?.access_token, API_URL]);

  // Auto-load bookings when venue id changes (e.g. after pre-fill from intent)
  useEffect(() => {
    if (!venueForm.venue_id) { setBookings([]); return; }
    const src = venueForm.date ? new Date(venueForm.date + "T00:00:00") : new Date();
    loadBookings(venueForm.venue_id, src.getFullYear(), src.getMonth());
  }, [venueForm.venue_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    fetchApproval();
  }, [isLoading, session, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchApproval() {
    setLoading(true);
    setError(null);
    setIsMissingApprovalRecord(false);
    try {
      const url = `${API_URL}/api/approvals/${itemId}${typeParam ? `?type=${typeParam}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (res.status === 403) { setError("You do not have access to this approval record."); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404 && body.error === "Approval record not found") {
          setIsMissingApprovalRecord(true);
          setError(`This ${itemType} has not been sent for approvals yet.`);
          return;
        }
        setError(body.error || "Failed to load approval record.");
        return;
      }
      const data = await res.json();
      setApproval(data.approval);
      setItem(data.item);

      // If entity is live, load venue data
      if (data.approval?.went_live_at) {
        const campus = data.approval.organizing_campus_snapshot;
        if (campus) {
          fetch(`${API_URL}/api/venues?campus=${encodeURIComponent(campus)}`, {
            headers: { Authorization: `Bearer ${session!.access_token}` },
          }).then(r => r.ok ? r.json() : []).then(setVenueList).catch(() => {});
        }
        fetch(`${API_URL}/api/service-requests?entity_id=${itemId}&service_type=venue`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        }).then(r => r.ok ? r.json() : []).then((rows: any[]) => {
          if (rows.length > 0) setExistingVenueReq(rows[0]);
          else {
            // Pre-fill from intent stored in approvals.stages
            const venueStage = data.approval.stages?.find((s: any) => s.role === "venue");
            if (venueStage?.request_data) {
              setVenueForm(f => ({ ...f, ...venueStage.request_data }));
            }
          }
        }).catch(() => {});
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitVenueRequest() {
    if (!venueForm.venue_id || !venueForm.date) {
      setVenueError("Please select a venue and date.");
      return;
    }
    setVenueSubmitting(true);
    setVenueError(null);
    try {
      const res = await fetch(`${API_URL}/api/venue-bookings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id:    venueForm.venue_id,
          date:        venueForm.date,
          start_time:  venueForm.start_time,
          end_time:    venueForm.end_time,
          title:       item?.title || "Venue booking",
          setup_notes: venueForm.setup_notes || undefined,
          entity_type: approval!.type,
          entity_id:   itemId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setVenueError(body.error || "Failed to submit venue request."); return; }
      setVenueSuccess(true);
      setExistingVenueReq({ id: body.request?.id, status: body.request?.status || "pending", details: venueForm, decision_notes: null });
    } catch {
      setVenueError("Network error. Please try again.");
    } finally {
      setVenueSubmitting(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading approval status…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        {isMissingApprovalRecord && (
          <button
            onClick={() => router.push(`/edit/${itemType}/${itemId}?tab=approvals`)}
            className="px-4 py-2 rounded-md bg-[#154CB3] text-white text-sm font-medium hover:bg-[#0f3a7a]"
          >
            Send for Approvals
          </button>
        )}
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">Go back</button>
      </div>
    );
  }

  if (!approval) return null;

  const blockingStages    = approval.stages.filter((s) => s.blocking);
  const operationalStages = approval.stages.filter((s) => !s.blocking);
  const phase1Done        = isPhase1Complete(approval.stages);
  const hasRejection      = approval.action_log.some((e) => e.action === "reject");
  const pendingCount = approval.stages.filter((s) => s.status === "pending").length;
  const approvedCount = approval.stages.filter((s) => s.status === "approved").length;
  const rejectedCount = approval.stages.filter((s) => s.status === "rejected").length;
  const totalEstimate = approval.budget_items?.reduce((s, b) => s + b.quantity * b.unitPrice, 0) || 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <button
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Approval Status</h1>
          {item && (
            <p className="text-gray-700 font-medium leading-snug">
              {item.title}
            </p>
          )}
          <p className="text-sm text-slate-500">
            {approval.type.toUpperCase()}
            {item?.organizing_school ? ` · ${item.organizing_school}` : ""}
            {item?.organizing_dept ? ` · ${item.organizing_dept}` : ""}
          </p>
        </div>

        {/* Compact status strip */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
              phase1Done ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800"
            }`}>
              {phase1Done ? "Stage 2: Operational" : "Stage 1: Pending Approval"}
            </span>
            {approval.went_live_at && (
              <span className="text-sm text-slate-600">
                Live since {formatDate(approval.went_live_at)}
              </span>
            )}
          </div>
        </div>

        {/* Minimal metrics strip */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-700">
            <span><span className="font-semibold">Pending:</span> {pendingCount}</span>
            <span><span className="font-semibold">Approved:</span> {approvedCount}</span>
            <span><span className="font-semibold">Rejected:</span> {rejectedCount}</span>
            <span><span className="font-semibold">Budget:</span> ₹{totalEstimate.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7">
            {/* Rejection alert */}
            {hasRejection && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <WarningIcon className="h-5 w-5 text-rose-700" />
                  <p className="text-rose-800 font-semibold text-sm">Submission Returned</p>
                </div>
                {approval.action_log.filter((e) => e.action === "reject").map((e, i) => (
                  <div key={i} className={`${i > 0 ? "mt-3 pt-3 border-t border-red-200" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded uppercase">
                        {e.step}
                      </span>
                      <span className="text-xs text-rose-700/80">{safeText(e.by)} · {formatDate(e.at)}</span>
                      {e.is_override && (
                        <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">Override</span>
                      )}
                    </div>
                    {e.note ? (
                      <p className="text-sm text-rose-800 bg-white rounded-lg px-3 py-2 border border-rose-200 italic">
                        "{e.note}"
                      </p>
                    ) : (
                      <p className="text-xs text-rose-700/70 italic">No reason provided.</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Blocking stages */}
            {blockingStages.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Stage 1 — Blocking Approvals
                </h2>
                {blockingStages.map((s) => (
                  <StepCard key={s.step} label={s.label} status={s.status} approvedBy={s.approved_by} />
                ))}
              </div>
            )}

            {/* Operational stages */}
            {operationalStages.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Stage 2 — Operational Lanes
                </h2>
                {operationalStages.map((s) => (
                  <StepCard key={s.step} label={s.label} status={s.status} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-5">
            {/* Budget estimate */}
            {approval.budget_items && approval.budget_items.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Budget Estimate
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                        <th className="text-left pb-2 font-semibold">Item</th>
                        <th className="text-center pb-2 font-semibold">Qty</th>
                        <th className="text-right pb-2 font-semibold">Unit (₹)</th>
                        <th className="text-right pb-2 font-semibold">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approval.budget_items.map((b, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-800">{b.name || "—"}</td>
                          <td className="py-1.5 text-center text-gray-600">{b.quantity}</td>
                          <td className="py-1.5 text-right text-gray-600">{b.unitPrice.toLocaleString("en-IN")}</td>
                          <td className="py-1.5 text-right font-medium text-gray-800">
                            {(b.quantity * b.unitPrice).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Estimate</td>
                        <td className="pt-3 text-right text-base font-bold text-gray-900">
                          ₹{approval.budget_items.reduce((s, b) => s + b.quantity * b.unitPrice, 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Activity timeline */}
            {approval.action_log.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Activity Timeline
                </h2>
                <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                  {[...approval.action_log].reverse().map((entry, i) => (
                    <li key={i} className="ml-4">
                      <span className="absolute -left-3 mt-0.5 rounded-full bg-white p-0.5">
                        <StatusIcon
                          status={
                            entry.action === "approve"
                              ? "approved"
                              : entry.action === "return_for_revision"
                              ? "pending"
                              : "rejected"
                          }
                          className="h-4 w-4"
                        />
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {entry.step.toUpperCase()} —{" "}
                        {entry.action === "approve"
                          ? "Approved"
                          : entry.action === "return_for_revision"
                          ? "Returned for Revision"
                          : "Declined"}
                        {entry.is_override && (
                          <span className="ml-2 text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">Override</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{safeText(entry.by)} · {formatDate(entry.at)}</p>
                      {entry.note && <p className="text-sm text-gray-600 mt-1 italic">"{entry.note}"</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* ── Venue Booking Section (shown only after full approval) ── */}
        {approval.went_live_at && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Venue Booking</h2>

            {existingVenueReq ? (
              /* Show existing request status */
              <div className={`rounded-lg border px-4 py-3 text-sm ${
                existingVenueReq.status === "approved"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : existingVenueReq.status === "rejected"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : existingVenueReq.status === "returned_for_revision"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}>
                <p className="font-medium">
                  Venue request — <span className="capitalize">{existingVenueReq.status.replace(/_/g, " ")}</span>
                </p>
                <p className="text-xs mt-1 opacity-80">
                  {safeText(existingVenueReq.details?.venue_name)}{existingVenueReq.details?.date ? `, ${safeText(existingVenueReq.details.date)}` : ""}
                  {existingVenueReq.details?.start_time ? ` · ${safeText(existingVenueReq.details.start_time)}–${safeText(existingVenueReq.details.end_time)}` : ""}
                </p>
                {existingVenueReq.decision_notes && (
                  <p className="text-xs mt-2 italic">"{existingVenueReq.decision_notes}"</p>
                )}
                {venueSuccess && (
                  <p className="text-xs mt-2 text-emerald-700 font-medium">Request submitted. The Venue Manager will respond shortly.</p>
                )}
              </div>
            ) : (
              /* Venue request form */
              <div className="space-y-4">
                {/* Venue dropdown */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  {venueList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No venues found for your campus. Contact the admin.</p>
                  ) : (
                    <select
                      value={venueForm.venue_id}
                      onChange={e => {
                        const v = venueList.find(x => x.id === e.target.value);
                        setVenueForm(f => ({ ...f, venue_id: e.target.value, venue_name: v?.name || "", date: "" }));
                        if (e.target.value) {
                          const now = new Date();
                          loadBookings(e.target.value, now.getFullYear(), now.getMonth());
                        } else {
                          setBookings([]);
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="">Select a venue</option>
                      {venueList.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}{v.capacity ? ` (cap. ${v.capacity})` : ""}{v.location ? ` — ${v.location}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {venueForm.venue_id && (() => {
                  const dayBookings = bookings.filter(b => b.date === venueForm.date);
                  const conflict = findConflict(bookings, venueForm.date, venueForm.start_time, venueForm.end_time);
                  return (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Date <span className="text-red-500">*</span>
                        </label>
                        <MiniCalendar
                          value={venueForm.date}
                          onChange={d => setVenueForm(f => ({ ...f, date: d }))}
                          bookings={bookings}
                          onMonthChange={(y, m) => loadBookings(venueForm.venue_id, y, m)}
                        />
                      </div>

                      {venueForm.date && dayBookings.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">
                            Already booked on {venueForm.date}:
                          </p>
                          <ul className="space-y-0.5">
                            {dayBookings.map((b, i) => (
                              <li key={i} className="text-xs text-amber-900">
                                <span className="font-mono">{b.start_time}–{b.end_time}</span>
                                {b.booking_title && <> · {b.booking_title}</>}
                                {b.full_name && <> · {b.full_name}</>}
                                {b.requested_by && <> ({b.requested_by})</>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {venueForm.date && (
                        <>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
                              <input type="time" value={venueForm.start_time}
                                onChange={e => setVenueForm(f => ({ ...f, start_time: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">End time</label>
                              <input type="time" value={venueForm.end_time}
                                onChange={e => setVenueForm(f => ({ ...f, end_time: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                              />
                            </div>
                          </div>
                          {conflict && (
                            <p className="text-xs text-red-600">
                              Conflicts with an existing booking ({conflict.start_time}–{conflict.end_time}). Pick a non-overlapping window.
                            </p>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Setup notes</label>
                            <textarea rows={2} value={venueForm.setup_notes}
                              onChange={e => setVenueForm(f => ({ ...f, setup_notes: e.target.value }))}
                              placeholder="Any special setup requirements (optional)"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                            />
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}

                {venueError && (
                  <p className="text-sm text-red-600">{venueError}</p>
                )}

                <button
                  onClick={submitVenueRequest}
                  disabled={venueSubmitting || !venueForm.venue_id || !venueForm.date}
                  className="px-5 py-2 text-sm font-semibold bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {venueSubmitting ? "Submitting…" : "Submit Venue Request"}
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Submitted on {formatDate(approval.created_at)}
          {approval.submitted_by ? ` by ${safeText(approval.submitted_by)}` : ""}
        </p>
      </div>
    </div>
  );
}
