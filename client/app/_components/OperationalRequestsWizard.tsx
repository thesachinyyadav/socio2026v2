"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OperationalRequests {
  it:       { enabled: boolean; description: string };
  venue:    { enabled: boolean; venue_id: string; venue_name: string; date: string; start_time: string; end_time: string; setup_notes: string };
  catering: { enabled: boolean; approximate_count: string; description: string };
  stalls:   { enabled: boolean; canopy: boolean; hardboard: boolean };
}

const DEFAULT_REQUESTS: OperationalRequests = {
  it:       { enabled: false, description: "" },
  venue:    { enabled: false, venue_id: "", venue_name: "", date: "", start_time: "", end_time: "", setup_notes: "" },
  catering: { enabled: false, approximate_count: "", description: "" },
  stalls:   { enabled: false, canopy: false, hardboard: false },
};

interface Props {
  eventTitle: string;
  campus?: string;
  onSubmit: (requests: OperationalRequests) => Promise<void>;
  onSkip?: () => void;
  isSubmitting?: boolean;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = ["it", "venue", "catering", "stalls"] as const;
type Step = typeof STEPS[number];

const STEP_META: Record<Step, { label: string; icon: React.ReactNode; subtitle: string }> = {
  it: {
    label: "IT",
    subtitle: "Request IT support for equipment and infra.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  venue: {
    label: "Venue",
    subtitle: "Book a venue on campus for your event.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  catering: {
    label: "Catering",
    subtitle: "Add food service estimate and requirements.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0" /><path d="M3 8h18v2a9 9 0 0 1-9 9 9 9 0 0 1-9-9V8z" /><path d="M12 19v3M8 22h8" />
      </svg>
    ),
  },
  stalls: {
    label: "Stalls",
    subtitle: "Select canopy and/or hardboard stalls.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
};

// ─── Mini calendar ─────────────────────────────────────────────────────────────

export interface VenueBooking {
  date: string;
  start_time: string;
  end_time: string;
  requested_by?: string;
  full_name?: string | null;
  booking_title?: string | null;
  entity_type?: string;
}

function minutes(t: string) {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// A date is "full" when its approved windows cumulatively cover >= 12 hours.
const FULL_DAY_MINUTES = 12 * 60;

export function MiniCalendar({
  value,
  onChange,
  bookings = [],
  onMonthChange,
}: {
  value: string;
  onChange: (d: string) => void;
  bookings?: VenueBooking[];
  onMonthChange?: (year: number, month: number) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const selected = value ? new Date(value + "T00:00:00") : null;
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-IN", { month: "long", year: "numeric" });

  // date → total booked minutes
  const bookedMinutesByDate = new Map<string, number>();
  bookings.forEach((b) => {
    const mins = Math.max(0, minutes(b.end_time) - minutes(b.start_time));
    bookedMinutesByDate.set(b.date, (bookedMinutesByDate.get(b.date) || 0) + mins);
  });

  function prevMonth() {
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const newYear  = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(newMonth); setViewYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }
  function nextMonth() {
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const newYear  = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(newMonth); setViewYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }

  function pad2(n: number) { return String(n).padStart(2, "0"); }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <span key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
          const isPast   = new Date(dateStr) < new Date(today.toDateString());
          const bookedMins = bookedMinutesByDate.get(dateStr) || 0;
          const isFull   = bookedMins >= FULL_DAY_MINUTES;
          const isPartial = bookedMins > 0 && !isFull;
          const isSelected = selected && dateStr === value;
          const title = isFull
            ? "Fully booked"
            : isPartial
            ? `${Math.round(bookedMins / 60 * 10) / 10} hour(s) already booked — pick an open window`
            : undefined;
          return (
            <button
              key={i}
              type="button"
              disabled={isPast || isFull}
              onClick={() => onChange(dateStr)}
              title={title}
              className={`relative text-xs rounded py-1.5 transition-colors font-medium ${
                isSelected
                  ? "bg-[#154CB3] text-white"
                  : isFull
                  ? "bg-red-50 text-red-400 cursor-not-allowed line-through"
                  : isPartial
                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : isPast
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {day}
              {isPartial && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Partly booked</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300" /> Full</span>
      </div>
    </div>
  );
}

// Helper exported for callers (wizard, modal, approval page) to validate a
// candidate time window against a list of approved bookings for the same date.
export function findConflict(
  bookings: VenueBooking[],
  date: string,
  start_time: string,
  end_time: string,
): VenueBooking | null {
  if (!date || !start_time || !end_time || start_time >= end_time) return null;
  const s = minutes(start_time);
  const e = minutes(end_time);
  return (
    bookings.find(
      (b) => b.date === date && minutes(b.start_time) < e && minutes(b.end_time) > s,
    ) || null
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface VenueOption { id: string; name: string; capacity: number | null; location: string | null }

export default function OperationalRequestsWizard({ eventTitle, campus, onSubmit, onSkip, isSubmitting }: Props) {
  const { userData, session } = useAuth() as any;
  const [requests, setRequests] = useState<OperationalRequests>(DEFAULT_REQUESTS);
  const [stepIdx, setStepIdx] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  // Venue availability state
  const [venueList, setVenueList] = useState<VenueOption[]>([]);
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
  const effectiveCampus = campus || userData?.campus || "";

  // Load venues when venue step is active and enabled
  useEffect(() => {
    if (stepIdx !== STEPS.indexOf("venue") || !requests.venue.enabled || !effectiveCampus || !session?.access_token) return;
    fetch(`${API_URL}/api/venues?campus=${encodeURIComponent(effectiveCampus)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setVenueList)
      .catch(() => {});
  }, [stepIdx, requests.venue.enabled, effectiveCampus, session?.access_token]);

  // Load time-windowed bookings when a venue is selected or month changes
  async function loadBookings(venueId: string, year: number, month: number) {
    if (!venueId || !session?.access_token) return;
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    try {
      const r = await fetch(`${API_URL}/api/venues/${venueId}/availability?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setBookings(data.bookings || []);
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    const today = new Date();
    if (requests.venue.venue_id) {
      loadBookings(requests.venue.venue_id, today.getFullYear(), today.getMonth());
    } else {
      setBookings([]);
    }
  }, [requests.venue.venue_id]);

  const conflict = findConflict(bookings, requests.venue.date, requests.venue.start_time, requests.venue.end_time);
  const dayBookings = bookings.filter(b => b.date === requests.venue.date);

  const currentStep = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  function setIt(patch: Partial<OperationalRequests["it"]>) {
    setRequests(r => ({ ...r, it: { ...r.it, ...patch } }));
  }
  function setVenue(patch: Partial<OperationalRequests["venue"]>) {
    setRequests(r => ({ ...r, venue: { ...r.venue, ...patch } }));
  }
  function setCatering(patch: Partial<OperationalRequests["catering"]>) {
    setRequests(r => ({ ...r, catering: { ...r.catering, ...patch } }));
  }
  function setStalls(patch: Partial<OperationalRequests["stalls"]>) {
    setRequests(r => ({ ...r, stalls: { ...r.stalls, ...patch } }));
  }

  function goNext() {
    if (isLast) { setUnlocked(true); return; }
    setStepIdx(i => i + 1);
  }

  async function handleSubmit() {
    await onSubmit(requests);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">Additional Requests</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Operational requests for <span className="font-medium text-gray-700">{eventTitle}</span>. Enable the modules you need.
        </p>
      </div>

      {/* Step nav */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done = i < stepIdx || unlocked;
            const active = i === stepIdx && !unlocked;
            return (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => { if (done || unlocked) setStepIdx(i); }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                    active
                      ? "bg-[#154CB3] border-[#154CB3] text-white"
                      : done || unlocked
                      ? "bg-[#154CB3] border-[#154CB3] text-white cursor-pointer"
                      : "bg-white border-gray-200 text-gray-400"
                  }`}
                >
                  {STEP_META[step].icon}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${done || unlocked ? "bg-[#154CB3]" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="px-6 py-5 min-h-[220px]">
        {unlocked ? (
          // Summary view
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Summary</p>
            {STEPS.map(step => {
              const r = requests[step];
              return (
                <div key={step} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? "bg-[#154CB3]" : "bg-gray-200"}`} />
                  <span className={r.enabled ? "text-gray-800 font-medium" : "text-gray-400"}>
                    {STEP_META[step].label}
                  </span>
                  {!r.enabled && <span className="text-gray-400 text-xs">— not requested</span>}
                  {r.enabled && step === "it" && requests.it.description && (
                    <span className="text-gray-500 text-xs truncate">"{requests.it.description}"</span>
                  )}
                  {r.enabled && step === "venue" && requests.venue.venue_name && (
                    <span className="text-gray-500 text-xs">{requests.venue.venue_name}{requests.venue.date ? `, ${requests.venue.date}` : ""}</span>
                  )}
                  {r.enabled && step === "catering" && requests.catering.approximate_count && (
                    <span className="text-gray-500 text-xs">~{requests.catering.approximate_count} people</span>
                  )}
                  {r.enabled && step === "stalls" && (
                    <span className="text-gray-500 text-xs">
                      {[requests.stalls.canopy && "Canopy", requests.stalls.hardboard && "Hardboard"].filter(Boolean).join(", ") || "—"}
                    </span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setUnlocked(false)}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Edit requests
            </button>
          </div>
        ) : (
          <>
            {/* Step header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{STEP_META[currentStep].label}</p>
                <p className="text-xs text-gray-500">{STEP_META[currentStep].subtitle}</p>
              </div>
              {/* Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{requests[currentStep].enabled ? "On" : "Off"}</span>
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={requests[currentStep].enabled}
                  onChange={e => {
                    if (currentStep === "it") setIt({ enabled: e.target.checked });
                    else if (currentStep === "venue") setVenue({ enabled: e.target.checked });
                    else if (currentStep === "catering") setCatering({ enabled: e.target.checked });
                    else setStalls({ enabled: e.target.checked });
                  }}
                />
                <div className="relative w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#154CB3] transition-colors">
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
            </div>

            {/* Step fields */}
            {currentStep === "it" && requests.it.enabled && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={requests.it.description}
                  onChange={e => setIt({ description: e.target.value })}
                  placeholder="Any specific services like junction box, extension, projector, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            )}

            {currentStep === "venue" && requests.venue.enabled && (
              <div className="space-y-4">
                {/* Venue dropdown */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  {venueList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      {effectiveCampus ? "Loading venues…" : "Campus not detected — venues unavailable."}
                    </p>
                  ) : (
                    <select
                      value={requests.venue.venue_id}
                      onChange={e => {
                        const selected = venueList.find(v => v.id === e.target.value);
                        setVenue({ venue_id: e.target.value, venue_name: selected?.name || "", date: "" });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="">Select a venue</option>
                      {venueList.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}{v.capacity ? ` (cap. ${v.capacity})` : ""}
                          {v.location ? ` — ${v.location}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Availability calendar — shown once venue is picked */}
                {requests.venue.venue_id && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <MiniCalendar
                        value={requests.venue.date}
                        onChange={d => setVenue({ date: d })}
                        bookings={bookings}
                        onMonthChange={(y, m) => loadBookings(requests.venue.venue_id, y, m)}
                      />
                    </div>
                    {/* Existing bookings for the picked date */}
                    {requests.venue.date && dayBookings.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1">
                          Already booked on {requests.venue.date}:
                        </p>
                        <ul className="space-y-0.5">
                          {dayBookings.map((b, idx) => (
                            <li key={idx} className="text-xs text-amber-900">
                              <span className="font-mono">{b.start_time}–{b.end_time}</span>
                              {b.booking_title && <> · {b.booking_title}</>}
                              {b.full_name && <> · {b.full_name}</>}
                              {b.requested_by && <> ({b.requested_by})</>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Time fields — shown once date is picked */}
                    {requests.venue.date && (
                      <>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
                            <input
                              type="time"
                              value={requests.venue.start_time}
                              onChange={e => setVenue({ start_time: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">End time</label>
                            <input
                              type="time"
                              value={requests.venue.end_time}
                              onChange={e => setVenue({ end_time: e.target.value })}
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
                          <textarea
                            rows={2}
                            value={requests.venue.setup_notes}
                            onChange={e => setVenue({ setup_notes: e.target.value })}
                            placeholder="Any special setup requirements (optional)"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {currentStep === "catering" && requests.catering.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Approximate Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={requests.catering.approximate_count}
                    onChange={e => setCatering({ approximate_count: e.target.value })}
                    placeholder="Enter expected count"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={requests.catering.description}
                    onChange={e => setCatering({ description: e.target.value })}
                    placeholder="Veg / Non-veg preference and any additional catering details"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>
            )}

            {currentStep === "stalls" && requests.stalls.enabled && (
              <div className="space-y-3 mt-2">
                {[
                  { key: "canopy" as const, label: "Canopy Stalls" },
                  { key: "hardboard" as const, label: "Hardboard Stalls" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requests.stalls[key]}
                      onChange={e => setStalls({ [key]: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 accent-[#154CB3]"
                    />
                    <span className="text-sm text-gray-800">{label}</span>
                  </label>
                ))}
              </div>
            )}

            {!requests[currentStep].enabled && (
              <p className="text-sm text-gray-400 italic mt-2">Not required — toggle on to add a request.</p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-5 border-t border-gray-100 pt-4 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {unlocked
            ? "All options reviewed. Submit when ready."
            : `Step ${stepIdx + 1} of ${STEPS.length}`}
        </p>
        <div className="flex items-center gap-2">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Skip all
            </button>
          )}
          {unlocked ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isSubmitting ? "Submitting…" : "Submit requests"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="px-5 py-2 text-sm font-semibold bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a]"
            >
              {isLast ? "Review" : "Next option"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
