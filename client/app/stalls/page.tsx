"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onAction,
  actionLoading,
}: {
  booking: StallBooking;
  onAction?: (id: string, action: "accept" | "decline") => void;
  actionLoading?: string | null;
}) {
  const desc = booking.description || {};
  const linkedTitle = booking.event_title || booking.fest_title;
  const linkedDate = booking.event_date || booking.fest_date;
  const isPending = booking.status === "pending";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                STATUS_STYLES[booking.status] || "bg-gray-100 text-gray-600"
              }`}
            >
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </span>
            {booking.campus && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                {booking.campus}
              </span>
            )}
          </div>

          {desc.notes && (
            <p className="text-sm text-gray-800 mb-2">{desc.notes}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
            <span>
              Hard board:{" "}
              <span className="font-medium text-gray-800">
                {desc.hardboard_stalls ?? 0}
              </span>
            </span>
            <span>
              Canopy:{" "}
              <span className="font-medium text-gray-800">
                {desc.canopy_stalls ?? 0}
              </span>
            </span>
          </div>

          {linkedTitle && (
            <p className="text-sm text-gray-500">
              Linked to:{" "}
              <span className="font-medium text-[#154CB3]">{linkedTitle}</span>
              {linkedDate && ` (${formatDate(linkedDate)})`}
            </p>
          )}

          <p className="text-xs text-gray-400 mt-1">
            Requested by{" "}
            <span className="font-medium text-gray-600">{booking.requested_by}</span>
            {" · "}
            {formatSubmitted(booking.created_at)}
          </p>
        </div>
      </div>

      {isPending && onAction && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => onAction(booking.stall_id, "accept")}
            disabled={actionLoading === booking.stall_id}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === booking.stall_id ? "Updating..." : "Accept"}
          </button>
          <button
            onClick={() => onAction(booking.stall_id, "decline")}
            disabled={actionLoading === booking.stall_id}
            className="flex-1 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StallsDashboardPage() {
  const { session, userData, authLoading } = useAuth();
  const router = useRouter();

  const [pending, setPending] = useState<StallBooking[]>([]);
  const [reviewed, setReviewed] = useState<StallBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Auth Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
    if (!authLoading && session && userData) {
      const isStalls = Boolean((userData as any)?.is_stalls);
      const isMasterAdmin = Boolean((userData as any)?.is_masteradmin);
      if (!isStalls && !isMasterAdmin) router.replace("/error");
    }
  }, [authLoading, session, userData, router]);

  // ─── Fetch Queue ─────────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stall-bookings/queue`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load queue");
      setPending(json.pending || []);
      setReviewed(json.reviewed || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchQueue();
  }, [session, fetchQueue]);

  // ─── Action ──────────────────────────────────────────────────────────────────
  const handleAction = async (id: string, action: "accept" | "decline") => {
    if (!session) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/api/stall-bookings/${id}/action`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");

      const updated = json.booking as StallBooking;
      setPending((prev) => prev.filter((b) => b.stall_id !== id));
      setReviewed((prev) => [updated, ...prev]);
      toast.success(action === "accept" ? "Booking accepted" : "Booking declined");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Loading State ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#063168]">Stall Booking Requests</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Review and approve stall booking requests for your campus
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Pending Section */}
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-4">
                Pending{" "}
                {pending.length > 0 && (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    {pending.length}
                  </span>
                )}
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No pending stall booking requests
                </p>
              ) : (
                <div className="space-y-4">
                  {pending.map((b) => (
                    <BookingCard
                      key={b.stall_id}
                      booking={b}
                      onAction={handleAction}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Reviewed Section */}
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-4">
                Reviewed
              </h2>
              {reviewed.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No reviewed bookings yet
                </p>
              ) : (
                <div className="space-y-4">
                  {reviewed.map((b) => (
                    <BookingCard key={b.stall_id} booking={b} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
