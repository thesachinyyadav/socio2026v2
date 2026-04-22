"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { christCampuses } from "@/app/lib/eventFormSchema";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Venue {
  id: string;
  name: string;
  capacity: number | null;
  location: string | null;
}

interface VenueBooking {
  date: string;
  start_time: string;
  end_time: string;
  requested_by?: string;
  full_name?: string | null;
  booking_title?: string | null;
  entity_type?: string;
}

interface TimeSlot {
  id: string;
  name: string;
  start: string;
  end: string;
  displayTime: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { id: "morning",   name: "Morning",   start: "08:00", end: "12:00", displayTime: "8:00 AM – 12:00 PM" },
  { id: "afternoon", name: "Afternoon", start: "12:00", end: "17:00", displayTime: "12:00 PM – 5:00 PM" },
  { id: "evening",   name: "Evening",   start: "17:00", end: "21:00", displayTime: "5:00 PM – 9:00 PM" },
];

type SlotStatus = "available" | "selected" | "pending" | "booked" | "blocked";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
import { supabase } from "@/lib/supabaseClient";

function pad2(n: number) { return String(n).padStart(2, "0"); }

function toMinutes(t: string) {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function getSlotStatus(slot: TimeSlot, bookings: VenueBooking[], date: string, selectedSlots: string[]): SlotStatus {
  if (selectedSlots.includes(slot.id)) return "selected";
  const dayBookings = bookings.filter(b => b.date === date);
  for (const b of dayBookings) {
    if (overlaps(slot.start, slot.end, b.start_time, b.end_time)) return "booked";
  }
  return "available";
}

function getSlotsTimeRange(slotIds: string[]): { start: string; end: string; label: string; adjacent: boolean } | null {
  if (slotIds.length === 0) return null;
  const sorted = [...slotIds].sort((a, b) => {
    return TIME_SLOTS.findIndex(s => s.id === a) - TIME_SLOTS.findIndex(s => s.id === b);
  });
  const first = TIME_SLOTS.find(s => s.id === sorted[0]);
  const last  = TIME_SLOTS.find(s => s.id === sorted[sorted.length - 1]);
  if (!first || !last) return null;
  const indices = sorted.map(id => TIME_SLOTS.findIndex(s => s.id === id));
  let adjacent = true;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) { adjacent = false; break; }
  }
  return {
    start: first.start,
    end:   last.end,
    label: sorted.map(id => TIME_SLOTS.find(s => s.id === id)?.name).join(" + "),
    adjacent,
  };
}

function formatTime12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${pad2(m)} ${ampm}`;
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  border: "1.5px solid #e2ddd4",
  borderRadius: 8,
  padding: "0 36px 0 12px",
  fontSize: 13.5,
  color: "#171c1f",
  background: "#fff",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%238a8578' strokeWidth='2' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  backgroundSize: "16px",
  boxSizing: "border-box",
};

// ─── Small UI Primitives ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8a8578", textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#e2ddd4", margin: "20px 0" }} />;
}

function SkeletonPulse({ height = 36, radius = 8, width = "100%" }: { height?: number; radius?: number; width?: string | number }) {
  return <div className="animate-pulse" style={{ height, borderRadius: radius, background: "#e8e6e1", width }} />;
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

function SlotCard({ slot, status, onClick }: { slot: TimeSlot; status: SlotStatus; onClick: () => void }) {
  const styles: Record<SlotStatus, React.CSSProperties> = {
    available: { background: "#e8f7f0", border: "1.5px solid #9ee0c0", cursor: "pointer", color: "#1a7a52" },
    selected:  { background: "#1a7a52", border: "1.5px solid #1a7a52", cursor: "pointer", color: "#fff" },
    pending:   { background: "#fef7ec", border: "1.5px solid #f5d08a", cursor: "not-allowed", color: "#b86c10", opacity: 0.8 },
    booked:    { background: "#fef1f1", border: "1.5px solid #f5b8b8", cursor: "not-allowed", color: "#c42b2b" },
    blocked:   { background: "#f0ede8", border: "1.5px solid #e2ddd4", cursor: "not-allowed", color: "#8a8578" },
  };
  const isInteractive = status === "available" || status === "selected";
  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={isInteractive ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{ position: "relative", minWidth: 120, padding: "10px 16px", borderRadius: 8, display: "flex", flexDirection: "column", gap: 2, transition: "transform 0.1s, box-shadow 0.1s", flex: 1, ...styles[status] }}
      className={isInteractive ? "hover:scale-[1.02] hover:shadow-sm" : ""}
      title={status === "pending" ? "Reserved by another coordinator" : undefined}
    >
      {status === "selected" && <span style={{ position: "absolute", top: 6, right: 8, fontSize: 12 }}>✓</span>}
      <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.name}</span>
      <span style={{ fontSize: 11, opacity: status === "selected" ? 0.9 : 0.8 }}>{slot.displayTime}</span>
      {status === "pending" && <span style={{ fontSize: 10, fontStyle: "italic", marginTop: 2 }}>Reserved</span>}
      {status === "booked"  && <span style={{ fontSize: 10, marginTop: 2 }}>Booked</span>}
      {status === "blocked" && <span style={{ fontSize: 10, marginTop: 2 }}>Blocked</span>}
    </div>
  );
}

// ─── Checklist Item ───────────────────────────────────────────────────────────

function ChecklistItem({ icon, color, bg, text }: { icon: string; color: string; bg: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: 10, background: bg, color, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700 }}>
        {icon}
      </span>
      <span style={{ fontSize: 12, color: "#545f73", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ─── Full-size Calendar ───────────────────────────────────────────────────────

function FullCalendar({
  bookings,
  selectedDate,
  currentMonth,
  onMonthChange,
  venueSelected,
  venueName,
}: {
  bookings: VenueBooking[];
  selectedDate: string;
  currentMonth: { year: number; month: number };
  onMonthChange: (y: number, m: number) => void;
  venueSelected: boolean;
  venueName?: string;
}) {
  const { year, month } = currentMonth;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel  = new Date(year, month).toLocaleString("en-IN", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, VenueBooking[]>();
    bookings.forEach(b => {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    });
    return map;
  }, [bookings]);

  function prevMonth() {
    const nm = month === 0 ? 11 : month - 1;
    const ny = month === 0 ? year - 1 : year;
    onMonthChange(ny, nm);
  }
  function nextMonth() {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    onMonthChange(ny, nm);
  }

  const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  // pill colors by entity_type / status
  function getPillStyle(b: VenueBooking): React.CSSProperties {
    return { background: "#dcfce7", color: "#166534" };
  }

  return (
    <div>
      {/* ── Card Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: "1px solid #f0f4f8",
      }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#171c1f" }}>Venue Availability</span>
          {venueName && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#8a8578", background: "#f0f4f8", borderRadius: 6, padding: "2px 8px" }}>
              {venueName}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button" onClick={prevMonth}
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #e2ddd4", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#545f73" }}
            className="hover:border-[#154CB3] hover:text-[#154CB3]"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#171c1f", minWidth: 130, textAlign: "center" }}>{monthLabel}</span>
          <button
            type="button" onClick={nextMonth}
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #e2ddd4", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#545f73" }}
            className="hover:border-[#154CB3] hover:text-[#154CB3]"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ padding: "0 16px 16px" }}>
        {/* Day-of-week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f0f4f8", marginBottom: 0 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              color: "#8a8578", textAlign: "center", padding: "10px 0",
              background: "#f6fafe",
            }}>
              {d}
            </div>
          ))}
        </div>

        {!venueSelected ? (
          /* Empty state — big centered */
          <div style={{
            minHeight: 420, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            color: "#b5b0a5",
          }}>
            <svg width="56" height="56" fill="none" stroke="#b5b0a5" strokeWidth={1.2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p style={{ fontSize: 14, fontStyle: "italic", textAlign: "center" }}>Select a venue to see availability</p>
          </div>
        ) : (
          /* Calendar cells */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderLeft: "1px solid #f0ede8" }}>
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <div key={i} style={{
                    minHeight: 90, background: "#fafaf9",
                    borderRight: "1px solid #f0ede8", borderBottom: "1px solid #f0ede8",
                  }} />
                );
              }

              const dateStr   = `${year}-${pad2(month + 1)}-${pad2(day)}`;
              const isToday   = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayBookings = bookingsByDate.get(dateStr) || [];
              const pills   = dayBookings.slice(0, 2);
              const extra   = dayBookings.length - 2;

              return (
                <div key={i} style={{
                  minHeight: 90,
                  background: isSelected ? "#eef3ff" : "#fff",
                  borderRight: "1px solid #f0ede8",
                  borderBottom: "1px solid #f0ede8",
                  padding: "6px 5px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}>
                  {/* Date number */}
                  <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: 2 }}>
                    {isToday ? (
                      <span style={{
                        width: 26, height: 26, borderRadius: 13, background: "#154CB3",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{day}</span>
                    ) : (
                      <span style={{
                        fontSize: 12, fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "#154CB3" : "#171c1f",
                      }}>{day}</span>
                    )}
                  </div>

                  {/* Booking pills */}
                  {pills.map((b, pi) => (
                    <div key={pi} style={{
                      padding: "2px 5px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      ...getPillStyle(b),
                    }}>
                      {b.booking_title || b.full_name || "Booked"}
                    </div>
                  ))}
                  {extra > 0 && (
                    <span style={{ fontSize: 10, color: "#8a8578", paddingLeft: 3 }}>+{extra} more</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: "flex", gap: 16, flexWrap: "wrap",
        padding: "10px 20px", borderTop: "1px solid #f0f4f8",
      }}>
        {[
          { bg: "#dcfce7", border: "#166534", label: "Approved" },
          { bg: "#fef08a", border: "#854d0e", label: "Pending" },
          { bg: "#f3f4f6", border: "#4b5563", label: "Blocked" },
          { bg: "#eef3ff", border: "#154CB3", label: "Your booking" },
        ].map(({ bg, border, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8a8578" }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: bg, border: `1.5px solid ${border}`, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookVenuePage() {
  const router = useRouter();
  const { session, userData, isLoading: authLoading } = useAuth() as any;

  // Auth guard
  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
    if (!authLoading && session && userData && !userData.is_organiser && !userData.is_masteradmin) {
      router.replace("/error");
    }
  }, [authLoading, session, userData, router]);

  const userEmail = userData?.email || "";

  // ── Campus → Venue cascade ────────────────────────────────────────────────
  const [dbCampuses, setDbCampuses]         = useState<string[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [venues, setVenues]                 = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues]   = useState(false);

  // Fetch unique campuses from the db, fallback if not deployed
  useEffect(() => {
    async function loadCampuses() {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${API_URL}/api/venues/campuses`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.campuses && data.campuses.length > 0) {
            setDbCampuses(data.campuses);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch campuses via API", err);
      }
      
      // Fallback if API fails or returns empty (e.g. hitting Vercel before backend is deployed)
      console.log("Falling back to local christCampuses list");
      setDbCampuses([...christCampuses].sort());
      setLoadingCampuses(false);
    }
    loadCampuses();
  }, [session?.access_token]);

  // Prefill campus from profile once loaded
  useEffect(() => {
    if (userData?.campus && !selectedCampus && dbCampuses.includes(userData.campus)) {
      setSelectedCampus(userData.campus);
    }
  }, [userData?.campus, dbCampuses]);

  // Fetch venues whenever campus changes
  useEffect(() => {
    if (!selectedCampus || !session?.access_token) {
      setVenues([]);
      return;
    }
    setLoadingVenues(true);
    setSelectedVenueId("");
    setSelectedDate("");
    setSelectedSlots([]);
    setBookings([]);
    fetch(`${API_URL}/api/venues?campus=${encodeURIComponent(selectedCampus)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setVenues(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingVenues(false));
  }, [selectedCampus, session?.access_token]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [selectedDate,    setSelectedDate]    = useState("");
  const [selectedSlots,   setSelectedSlots]   = useState<string[]>([]);
  const [headcount,       setHeadcount]       = useState("");
  const [setupNotes,      setSetupNotes]      = useState("");
  const [notesCount,      setNotesCount]      = useState(0);

  // ── Bookings ──────────────────────────────────────────────────────────────
  const [bookings,        setBookings]        = useState<VenueBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [calendarMonth,   setCalendarMonth]   = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  const selectedVenue = venues.find(v => v.id === selectedVenueId) || null;

  const loadBookings = useCallback(async (venueId: string, year: number, month: number) => {
    if (!venueId || !session?.access_token) return;
    const monthStr = `${year}-${pad2(month + 1)}`;
    setLoadingBookings(true);
    try {
      const r = await fetch(`${API_URL}/api/venues/${venueId}/availability?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setBookings(d.bookings || []);
      }
    } catch {}
    finally { setLoadingBookings(false); }
  }, [session?.access_token]);

  useEffect(() => {
    if (selectedVenueId) {
      loadBookings(selectedVenueId, calendarMonth.year, calendarMonth.month);
    } else {
      setBookings([]);
    }
  }, [selectedVenueId]);

  // ── Date validation ───────────────────────────────────────────────────────
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, []);

  const dateState = useMemo<"" | "valid" | "too-soon">(() => {
    if (!selectedDate) return "";
    if (selectedDate < minDate) return "too-soon";
    return "valid";
  }, [selectedDate, minDate]);

  // ── Slot statuses ─────────────────────────────────────────────────────────
  const slotStatuses = useMemo<Record<string, SlotStatus>>(() => {
    const result: Record<string, SlotStatus> = {};
    TIME_SLOTS.forEach(slot => {
      result[slot.id] = getSlotStatus(slot, bookings, selectedDate, selectedSlots);
    });
    return result;
  }, [bookings, selectedDate, selectedSlots]);

  const slotsRange  = useMemo(() => getSlotsTimeRange(selectedSlots), [selectedSlots]);
  const areAdjacent = slotsRange?.adjacent !== false;

  // ── Submit ────────────────────────────────────────────────────────────────
  const [submitting,       setSubmitting]       = useState(false);
  const [successState,     setSuccessState]     = useState<{ confirmationNumber: string } | null>(null);
  const [slotConflictError, setSlotConflictError] = useState<string | null>(null);

  const hcNum          = parseInt(headcount || "0", 10);
  const exceedsCapacity = selectedVenue?.capacity != null && hcNum > selectedVenue.capacity;

  const checks = {
    campusSelected:   Boolean(selectedCampus),
    venueSelected:    Boolean(selectedVenueId),
    dateValid:        dateState === "valid",
    dateTooSoon:      dateState === "too-soon",
    slotSelected:     selectedSlots.length > 0,
    headcountEntered: hcNum > 0,
    overCapacity:     exceedsCapacity,
  };

  const canSubmit =
    checks.venueSelected &&
    checks.dateValid &&
    checks.slotSelected &&
    checks.headcountEntered &&
    !submitting;

  function toggleSlot(slotId: string) {
    setSelectedSlots(prev => prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]);
    setSlotConflictError(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const range = getSlotsTimeRange(selectedSlots);
    if (!range) return;

    setSubmitting(true);
    setSlotConflictError(null);

    try {
      const res = await fetch(`${API_URL}/api/service-requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "standalone",
          details: {
            booking_title: `Venue booking by ${userData?.name || userEmail}`,
            venue_id:      selectedVenueId,
            venue_name:    selectedVenue?.name || "",
            date:          selectedDate,
            start_time:    range.start,
            end_time:      range.end,
            headcount:     hcNum,
            setup_notes:   setupNotes.trim() || null,
            slots:         selectedSlots,
          },
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 && body.conflict) {
          setSlotConflictError(
            `This slot was just taken by another coordinator (${body.conflict.start_time}–${body.conflict.end_time}). Please select a different slot.`
          );
          await loadBookings(selectedVenueId, calendarMonth.year, calendarMonth.month);
          setSelectedSlots([]);
          return;
        }
        toast.error(body.error || "Failed to submit booking");
        return;
      }

      const confNum = `VB-${String(body.request?.id || Date.now()).slice(-6).toUpperCase()}`;
      setSuccessState({ confirmationNumber: confNum });
      toast.success("Venue booking submitted successfully!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success State ────────────────────────────────────────────────────────

  if (successState) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6fafe", paddingTop: 72 }}>
        <div style={{ maxWidth: 520, margin: "80px auto", padding: "0 24px" }}>
          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e2ddd4",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 40,
            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 4 }}>
              ✓
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1a7a52", margin: 0 }}>Slots Reserved ✓</h2>
            <p style={{ fontSize: 14, color: "#545f73", margin: 0, lineHeight: 1.6 }}>
              Your request has been sent to the Venue Manager for approval.
            </p>
            <div style={{ background: "#f6fafe", borderRadius: 10, padding: "16px 24px", width: "100%", textAlign: "left" }}>
              <p style={{ fontSize: 11, color: "#8a8578", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Confirmation Number</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#154CB3", margin: 0, letterSpacing: "0.05em" }}>{successState.confirmationNumber}</p>
            </div>
            <div style={{ background: "#f6fafe", borderRadius: 10, padding: "12px 20px", width: "100%", textAlign: "left" }}>
              <p style={{ fontSize: 12, color: "#545f73", margin: 0 }}>📅 You'll receive an email once your booking is approved.</p>
              <p style={{ fontSize: 12, color: "#545f73", margin: "6px 0 0" }}>📆 A Google Calendar invite will be sent on approval.</p>
            </div>
            <Link href="/manage" style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 24px", borderRadius: 8,
              background: "linear-gradient(135deg, #154CB3, #4f46e5)",
              color: "#fff", fontSize: 13.5, fontWeight: 500, textDecoration: "none",
            }}>
              ← Back to Manage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6fafe", paddingTop: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#8a8578", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f6fafe", paddingTop: 72 }}>

      {/* ── Page Header ── */}
      <div style={{ padding: "32px 32px 20px", maxWidth: 1320, margin: "0 auto" }}>
        <nav style={{ fontSize: 12, color: "#8a8578", marginBottom: 6 }}>
          <Link href="/manage" style={{ color: "#8a8578", textDecoration: "none" }} className="hover:text-[#154CB3]">Manage</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          <span style={{ color: "#545f73" }}>Book a Venue</span>
        </nav>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#171c1f", margin: 0, letterSpacing: "-0.01em" }}>Book a Venue</h1>
        <p style={{ fontSize: 14, color: "#545f73", marginTop: 6 }}>
          Slots are reserved immediately on submission and sent to the Venue Manager for approval.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "0 32px 48px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="max-lg:!grid-cols-1"
      >

        {/* ══════════════════════════════════════════════════════════════
            LEFT — BOOKING FORM
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          background: "#fff", borderRadius: 12,
          border: "1px solid #e2ddd4", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          padding: 24,
        }}>

          {/* ── Section 1: Campus & Venue ── */}
          <SectionLabel>Select Campus &amp; Venue</SectionLabel>

          {/* Campus dropdown */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="campus-select" style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8a8578", marginBottom: 5 }}>
              Campus
            </label>
            {loadingCampuses ? (
              <SkeletonPulse height={44} />
            ) : (
              <select
                id="campus-select"
                value={selectedCampus}
                onChange={e => setSelectedCampus(e.target.value)}
                style={selectStyle}
                onFocus={e  => { e.target.style.borderColor = "#154CB3"; }}
                onBlur={e   => { e.target.style.borderColor = "#e2ddd4"; }}
              >
                <option value="">Select a campus…</option>
                {dbCampuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Venue dropdown — shown only after campus is chosen */}
          {selectedCampus && (
            <div style={{ marginBottom: 4 }}>
              <label htmlFor="venue-select" style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8a8578", marginBottom: 5 }}>
                Venue
              </label>

              {loadingVenues ? (
                <SkeletonPulse height={44} />
              ) : venues.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 0", color: "#b5b0a5" }}>
                  <svg width="36" height="36" fill="none" stroke="#b5b0a5" strokeWidth={1.3} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  <p style={{ fontSize: 13, margin: 0 }}>No venues available for this campus</p>
                  <p style={{ fontSize: 11, margin: 0 }}>Contact your Master Admin to add venues.</p>
                </div>
              ) : (
                <select
                  id="venue-select"
                  value={selectedVenueId}
                  onChange={e => {
                    setSelectedVenueId(e.target.value);
                    setSelectedDate("");
                    setSelectedSlots([]);
                    setSlotConflictError(null);
                    if (e.target.value) {
                      loadBookings(e.target.value, calendarMonth.year, calendarMonth.month);
                    } else {
                      setBookings([]);
                    }
                  }}
                  style={selectStyle}
                  onFocus={e => { e.target.style.borderColor = "#154CB3"; }}
                  onBlur={e  => { e.target.style.borderColor = "#e2ddd4"; }}
                >
                  <option value="">Choose a venue…</option>
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.capacity ? ` (cap. ${v.capacity})` : ""}{v.location ? ` — ${v.location}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Venue info card */}
          {selectedVenue && (
            <div style={{ marginTop: 10, background: "#f0f4f8", borderRadius: 8, padding: 14, border: "1px solid #e2ddd4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: selectedVenue.location ? 8 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#171c1f" }}>{selectedVenue.name}</span>
                <span style={{ fontSize: 10, background: "#eef3ff", color: "#154CB3", borderRadius: 9999, padding: "2px 8px", fontWeight: 600 }}>
                  {selectedCampus}
                </span>
                {selectedVenue.capacity && (
                  <span style={{ fontSize: 12, color: "#545f73" }}>👥 {selectedVenue.capacity} people</span>
                )}
              </div>
              {selectedVenue.location && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {["Projector", "AC", "Stage", "PA System", "Whiteboard"].map(am => (
                    <span key={am} style={{ fontSize: 11, color: "#464555", background: "#fff", border: "1px solid #e2ddd4", borderRadius: 6, padding: "2px 8px" }}>{am}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <Divider />

          {/* ── Section 2: Date ── */}
          <SectionLabel>Select Date</SectionLabel>
          <input
            id="booking-date"
            type="date"
            value={selectedDate}
            min={minDate}
            disabled={!selectedVenueId}
            onChange={e => {
              setSelectedDate(e.target.value);
              setSelectedSlots([]);
              setSlotConflictError(null);
            }}
            style={{
              width: "100%", height: 44, border: "1.5px solid #e2ddd4",
              borderRadius: 8, padding: "0 12px", fontSize: 13.5,
              color: selectedDate ? "#171c1f" : "#8a8578",
              background: !selectedVenueId ? "#f6fafe" : "#fff",
              outline: "none", cursor: !selectedVenueId ? "not-allowed" : "pointer",
              boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = "#154CB3"; }}
            onBlur={e  => { e.target.style.borderColor = "#e2ddd4"; }}
          />

          {selectedDate && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              {dateState === "valid" && (
                <>
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                  <span style={{ fontSize: 12, color: "#1a7a52" }}>{formatDisplayDate(selectedDate)}</span>
                </>
              )}
              {dateState === "too-soon" && (
                <>
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: "#fef7ec", color: "#b86c10", fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>⚠</span>
                  <span style={{ fontSize: 12, color: "#b86c10" }}>Must book at least 48 hours in advance</span>
                </>
              )}
            </div>
          )}

          <Divider />

          {/* ── Section 3: Slots (only when venue + valid date) ── */}
          {selectedVenueId && dateState === "valid" && (
            <>
              <SectionLabel>Select Slots</SectionLabel>

              {slotConflictError && (
                <div style={{ background: "#fef1f1", border: "1.5px solid #f5b8b8", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#c42b2b" }}>
                  {slotConflictError}
                </div>
              )}

              {loadingBookings ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <SkeletonPulse height={72} radius={8} />
                  <SkeletonPulse height={72} radius={8} />
                  <SkeletonPulse height={72} radius={8} />
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    {TIME_SLOTS.map(slot => (
                      <SlotCard key={slot.id} slot={slot} status={slotStatuses[slot.id]} onClick={() => toggleSlot(slot.id)} />
                    ))}
                  </div>

                  {/* Adjacent summary pill */}
                  {slotsRange && selectedSlots.length > 1 && areAdjacent && (
                    <div style={{
                      marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4,
                      background: "#eef3ff", borderRadius: 9999, padding: "5px 14px",
                      fontSize: 12, color: "#154CB3", fontWeight: 500,
                    }}>
                      {slotsRange.label} = {formatTime12(slotsRange.start)} – {formatTime12(slotsRange.end)} ✓
                    </div>
                  )}

                  {/* Non-adjacent warning */}
                  {slotsRange && selectedSlots.length > 1 && !areAdjacent && (
                    <div style={{ marginTop: 10, background: "#fef7ec", border: "1px solid #f5d08a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#b86c10" }}>
                      ⚠ Non-adjacent slots must be submitted as separate requests
                    </div>
                  )}

                  {/* Slot legend */}
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                    {[
                      { dot: "#9ee0c0", label: "Available" },
                      { dot: "#f5d08a", label: "Reserved" },
                      { dot: "#f5b8b8", label: "Booked" },
                      { dot: "#e2ddd4", label: "Blocked" },
                    ].map(({ dot, label }) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8a8578" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, display: "inline-block" }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <Divider />
            </>
          )}

          {/* ── Section 4: Booking Details ── */}
          <SectionLabel>Booking Details</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="max-sm:!grid-cols-1">
            <div>
              <label htmlFor="headcount" style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8a8578", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Expected Headcount *
              </label>
              <input
                id="headcount"
                type="number"
                min={1}
                value={headcount}
                onChange={e => setHeadcount(e.target.value)}
                placeholder="e.g. 250"
                style={{ width: "100%", height: 40, border: "1.5px solid #e2ddd4", borderRadius: 8, padding: "0 12px", fontSize: 13.5, color: "#171c1f", background: "#fff", outline: "none", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = "#154CB3"; }}
                onBlur={e  => { e.target.style.borderColor = "#e2ddd4"; }}
              />
              {exceedsCapacity && (
                <p style={{ marginTop: 5, fontSize: 11, color: "#b86c10", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>⚠</span> Exceeds venue capacity of {selectedVenue?.capacity}. Manager will be alerted.
                </p>
              )}
              {hcNum > 0 && !exceedsCapacity && (
                <p style={{ marginTop: 5, fontSize: 11, color: "#1a7a52" }}>✓ Within capacity</p>
              )}
            </div>

            <div>
              <label htmlFor="event-link" style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8a8578", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Link to Event (optional)
              </label>
              <select
                id="event-link"
                style={{ ...selectStyle, height: 40 }}
                onFocus={e => { e.target.style.borderColor = "#154CB3"; }}
                onBlur={e  => { e.target.style.borderColor = "#e2ddd4"; }}
              >
                <option>No link — standalone booking</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label htmlFor="setup-notes" style={{ fontSize: 11, fontWeight: 600, color: "#8a8578", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Setup Notes (optional)
              </label>
              <span style={{ fontSize: 11, color: "#b5b0a5" }}>{notesCount} / 500</span>
            </div>
            <textarea
              id="setup-notes"
              rows={3}
              value={setupNotes}
              maxLength={500}
              onChange={e => { setSetupNotes(e.target.value); setNotesCount(e.target.value.length); }}
              placeholder="e.g. Need stage setup, 150 chairs in rows, 2 projectors, podium at front. AV team should arrive 1 hr early."
              style={{ width: "100%", border: "1.5px solid #e2ddd4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#171c1f", background: "#fff", outline: "none", resize: "vertical", lineHeight: 1.55, boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#154CB3"; }}
              onBlur={e  => { e.target.style.borderColor = "#e2ddd4"; }}
            />
          </div>

          {/* ── Submit ── */}
          <Divider />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={{ fontSize: 12, color: "#8a8578", maxWidth: 340, lineHeight: 1.5, flex: 1 }}>
              Slots are reserved immediately on submission.<br />
              Venue Manager will be notified for approval.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/manage" style={{
                padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e2ddd4",
                background: "transparent", color: "#8a8578", fontSize: 13.5, fontWeight: 500,
                textDecoration: "none", display: "inline-flex", alignItems: "center",
              }}>
                Cancel
              </Link>
              <button
                id="reserve-submit-btn"
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  padding: "10px 24px", borderRadius: 8, border: "none",
                  background: canSubmit ? "linear-gradient(135deg, #154CB3, #4f46e5)" : "#e2ddd4",
                  color: canSubmit ? "#fff" : "#8a8578",
                  fontSize: 13.5, fontWeight: 500,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  transition: "opacity 0.15s",
                }}
                className={canSubmit ? "hover:opacity-90 active:scale-[0.97]" : ""}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Reserving…
                  </>
                ) : "Reserve & Submit"}
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT — CALENDAR + CHECKLIST (calendar takes most space)
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Big Calendar Card ── */}
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e2ddd4", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}>
            <FullCalendar
              bookings={bookings}
              selectedDate={selectedDate}
              currentMonth={calendarMonth}
              onMonthChange={(y, m) => {
                setCalendarMonth({ year: y, month: m });
                if (selectedVenueId) loadBookings(selectedVenueId, y, m);
              }}
              venueSelected={Boolean(selectedVenueId)}
              venueName={selectedVenue?.name}
            />
          </div>

          {/* ── Checklist Card ── */}
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e2ddd4", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            padding: "18px 20px",
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#171c1f", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Booking Checklist
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ChecklistItem
                icon={checks.campusSelected ? "✓" : "○"}
                color={checks.campusSelected ? "#166534" : "#8a8578"}
                bg={checks.campusSelected ? "#dcfce7" : "#f0ede8"}
                text="Campus selected"
              />
              <ChecklistItem
                icon={checks.venueSelected ? "✓" : "○"}
                color={checks.venueSelected ? "#166534" : "#8a8578"}
                bg={checks.venueSelected ? "#dcfce7" : "#f0ede8"}
                text="Venue selected"
              />
              <ChecklistItem
                icon={checks.dateTooSoon ? "⚠" : checks.dateValid ? "✓" : "○"}
                color={checks.dateTooSoon ? "#b86c10" : checks.dateValid ? "#166534" : "#8a8578"}
                bg={checks.dateTooSoon ? "#fef7ec" : checks.dateValid ? "#dcfce7" : "#f0ede8"}
                text={checks.dateTooSoon ? "Less than 48 hours ahead" : "Date selected (min 48 hours ahead)"}
              />
              <ChecklistItem
                icon={checks.slotSelected ? "✓" : "○"}
                color={checks.slotSelected ? "#166534" : "#8a8578"}
                bg={checks.slotSelected ? "#dcfce7" : "#f0ede8"}
                text="At least one slot selected"
              />
              <ChecklistItem
                icon={checks.overCapacity ? "⚠" : checks.headcountEntered ? "✓" : "○"}
                color={checks.overCapacity ? "#b86c10" : checks.headcountEntered ? "#166534" : "#8a8578"}
                bg={checks.overCapacity ? "#fef7ec" : checks.headcountEntered ? "#dcfce7" : "#f0ede8"}
                text={checks.overCapacity ? "⚠ Over capacity — Venue Manager will be alerted" : "Headcount entered"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
