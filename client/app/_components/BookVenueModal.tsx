"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { MiniCalendar, findConflict, type VenueBooking } from "./OperationalRequestsWizard";

interface VenueOption { id: string; name: string; capacity: number | null; location: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function BookVenueModal({ open, onClose, onSubmitted }: Props) {
  const { session, userData } = useAuth() as any;
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
  const campus = userData?.campus || "";

  const [venueList, setVenueList] = useState<VenueOption[]>([]);
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [form, setForm] = useState({
    booking_title: "",
    venue_id: "",
    venue_name: "",
    date: "",
    start_time: "",
    end_time: "",
    setup_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ booking_title: "", venue_id: "", venue_name: "", date: "", start_time: "", end_time: "", setup_notes: "" });
    setBookings([]);
    setError(null);
    if (!campus || !session?.access_token) return;
    fetch(`${API_URL}/api/venues?campus=${encodeURIComponent(campus)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => (r.ok ? r.json() : []))
      .then(setVenueList)
      .catch(() => {});
  }, [open, campus, session?.access_token, API_URL]);

  async function loadBookings(venueId: string, year: number, month: number) {
    if (!venueId || !session?.access_token) return;
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    try {
      const r = await fetch(`${API_URL}/api/venues/${venueId}/availability?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) { const d = await r.json(); setBookings(d.bookings || []); }
    } catch { /* non-critical */ }
  }

  const dayBookings = bookings.filter(b => b.date === form.date);
  const conflict = findConflict(bookings, form.date, form.start_time, form.end_time);
  const canSubmit =
    form.booking_title.trim().length >= 3 &&
    form.venue_id &&
    form.date &&
    form.start_time &&
    form.end_time &&
    form.start_time < form.end_time &&
    !conflict &&
    !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/service-requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "standalone",
          details: {
            booking_title: form.booking_title.trim(),
            venue_id: form.venue_id,
            venue_name: form.venue_name,
            date: form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            setup_notes: form.setup_notes,
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body.conflict) {
          setError(`Time conflict with an approved booking (${body.conflict.start_time}–${body.conflict.end_time}). Pick another slot.`);
        } else {
          setError(body.error || "Failed to submit booking");
        }
        return;
      }
      toast.success("Venue booking submitted for approval");
      onSubmitted?.();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Book a Venue</h2>
            <p className="text-xs text-gray-500 mt-0.5">Standalone booking — no event/fest required. Goes to the venue manager for approval.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Booking title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.booking_title}
              onChange={e => setForm(f => ({ ...f, booking_title: e.target.value }))}
              placeholder="e.g. CS Dept Weekly Meeting"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Venue <span className="text-red-500">*</span>
            </label>
            {!campus ? (
              <p className="text-xs text-gray-400 italic">Campus not detected on your profile. Contact the admin.</p>
            ) : venueList.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Loading venues…</p>
            ) : (
              <select
                value={form.venue_id}
                onChange={e => {
                  const v = venueList.find(x => x.id === e.target.value);
                  setForm(f => ({ ...f, venue_id: e.target.value, venue_name: v?.name || "", date: "" }));
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

          {form.venue_id && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <MiniCalendar
                  value={form.date}
                  onChange={d => setForm(f => ({ ...f, date: d }))}
                  bookings={bookings}
                  onMonthChange={(y, m) => loadBookings(form.venue_id, y, m)}
                />
              </div>

              {form.date && dayBookings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Already booked on {form.date}:</p>
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

              {form.date && (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
                      <input type="time" value={form.start_time}
                        onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">End time</label>
                      <input type="time" value={form.end_time}
                        onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
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
                    <textarea rows={2} value={form.setup_notes}
                      onChange={e => setForm(f => ({ ...f, setup_notes: e.target.value }))}
                      placeholder="Any special setup requirements (optional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 pb-5 pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-5 py-2 text-sm font-semibold bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
