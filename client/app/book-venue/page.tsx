"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  is_approval_needed?: boolean;
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

interface MyBooking {
  id: string;
  venue_id: string;
  status: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  headcount: number | null;
  decision_notes: string | null;
  venue?: { name: string; campus: string; location: string | null; capacity: number | null };
}

type TabKey = "mine" | "specific" | "any";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

const HOUR_START  = 6;
const HOUR_END    = 22;
const HOUR_HEIGHT = 56; // px per hour

function pad2(n: number) { return String(n).padStart(2, "0"); }

function toMinutes(t: string): number {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${pad2(m)} ${ampm}`;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday-start
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function weekRangeLabel(ws: Date): string {
  const end = addDays(ws, 6);
  const sm = ws.toLocaleDateString("en-IN", { month: "short" });
  const em = end.toLocaleDateString("en-IN", { month: "short" });
  return sm === em
    ? `${ws.getDate()} – ${end.getDate()} ${sm} ${ws.getFullYear()}`
    : `${ws.getDate()} ${sm} – ${end.getDate()} ${em} ${end.getFullYear()}`;
}

function isPast(dateStr: string, time: string): boolean {
  if (!dateStr) return false;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime() < Date.now();
}

function statusStyle(status: string) {
  switch (status) {
    case "approved":               return "bg-green-50 text-green-700 border-green-200";
    case "pending":                return "bg-amber-50 text-amber-700 border-amber-200";
    case "rejected":               return "bg-red-50 text-red-700 border-red-200";
    case "returned_for_revision":  return "bg-purple-50 text-purple-700 border-purple-200";
    default:                       return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function statusLabel(status: string): string {
  if (status === "returned_for_revision") return "Revision";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function bookingBarColor(status: string) {
  switch (status) {
    case "approved": return { bg: "#dcfce7", border: "#86efac", text: "#15803d" };
    case "pending":  return { bg: "#fef3c7", border: "#fbbf24", text: "#92400e" };
    default:         return { bg: "#e2e8f0", border: "#94a3b8", text: "#1e293b" };
  }
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconBuilding = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookVenuePage() {
  const router = useRouter();
  const { session, userData, isLoading: authLoading } = useAuth() as any;

  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
    if (!authLoading && session && userData && !userData.is_organiser && !userData.is_masteradmin) {
      router.replace("/error");
    }
  }, [authLoading, session, userData, router]);

  const [tab, setTab] = useState<TabKey>("specific");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-[72px] flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-[72px]">
      <div className="max-w-screen-xl mx-auto px-6 pt-3 pb-6">

        {/* Compact header row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Link href="/manage" className="hover:text-[#154CB3] transition-colors">Manage</Link>
              <span>›</span>
              <span className="text-gray-600 font-medium">Venue Booking</span>
            </div>
          </div>

          {/* Compact tab strip */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5 max-md:hidden">
            <TabButton active={tab === "mine"}     onClick={() => setTab("mine")}     icon={<IconCalendar />}  label="My Bookings" />
            <TabButton active={tab === "specific"} onClick={() => setTab("specific")} icon={<IconBuilding />}  label="Book Specific Venue" />
            <TabButton active={tab === "any"}      onClick={() => setTab("any")}      icon={<IconSearch />}    label="Find Available Venue" />
          </div>
        </div>

        {/* Mobile tab strip */}
        <div className="hidden max-md:flex flex-col gap-1.5 mb-3">
          <TabButton active={tab === "mine"}     onClick={() => setTab("mine")}     icon={<IconCalendar />}  label="My Bookings" />
          <TabButton active={tab === "specific"} onClick={() => setTab("specific")} icon={<IconBuilding />}  label="Book Specific Venue" />
          <TabButton active={tab === "any"}      onClick={() => setTab("any")}      icon={<IconSearch />}    label="Find Available Venue" />
        </div>

        {tab === "mine"     && <MyBookingsView session={session} />}
        {tab === "specific" && <SpecificVenueView session={session} userData={userData} />}
        {tab === "any"      && <AnyAvailableView session={session} userData={userData} />}
      </div>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
        active
          ? "bg-[#154CB3] text-white shadow-sm"
          : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
      } max-md:justify-center max-md:py-2.5 max-md:rounded-lg max-md:border max-md:text-sm ${
        active ? "max-md:border-[#154CB3]" : "max-md:bg-white max-md:border-gray-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW 1 — BOOK SPECIFIC VENUE
// ══════════════════════════════════════════════════════════════════════════════

function SpecificVenueView({ session, userData }: { session: any; userData: any }) {
  const [campuses,       setCampuses]       = useState<string[]>([]);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [blocks,         setBlocks]         = useState<string[]>([]);
  const [loadingBlocks,  setLoadingBlocks]  = useState(false);
  const [selectedBlock,  setSelectedBlock]  = useState("");
  const [venues,         setVenues]         = useState<Venue[]>([]);
  const [loadingVenues,  setLoadingVenues]  = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const selectedVenue = venues.find(v => v.id === selectedVenueId) || null;

  const [weekStart,     setWeekStart]     = useState<Date>(() => startOfWeek(new Date()));
  const [bookings,      setBookings]      = useState<VenueBooking[]>([]);
  const [ownBookings,   setOwnBookings]   = useState<MyBooking[]>([]);
  const [loadingCal,    setLoadingCal]    = useState(false);
  const [modal,         setModal]         = useState<{ date: string; start_time: string; end_time: string } | null>(null);

  // Load campuses
  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/venues/campuses`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setCampuses(d?.campuses?.length ? d.campuses : [...christCampuses].sort()))
      .catch(() => setCampuses([...christCampuses].sort()));
  }, [session?.access_token]);

  // Prefill campus from profile
  useEffect(() => {
    if (userData?.campus && !selectedCampus && campuses.includes(userData.campus)) {
      setSelectedCampus(userData.campus);
    }
  }, [userData?.campus, campuses]);

  // Campus → Blocks
  useEffect(() => {
    setSelectedBlock(""); setBlocks([]); setVenues([]); setSelectedVenueId("");
    if (!selectedCampus || !session?.access_token) return;
    setLoadingBlocks(true);
    fetch(`${API_URL}/api/venues/blocks?campus=${encodeURIComponent(selectedCampus)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : { blocks: [] })
      .then(d => setBlocks(Array.isArray(d.blocks) ? d.blocks : []))
      .catch(() => {})
      .finally(() => setLoadingBlocks(false));
  }, [selectedCampus, session?.access_token]);

  // Block → Venues
  useEffect(() => {
    setSelectedVenueId(""); setVenues([]);
    if (!selectedCampus || !selectedBlock || !session?.access_token) return;
    setLoadingVenues(true);
    fetch(
      `${API_URL}/api/venues?campus=${encodeURIComponent(selectedCampus)}&block=${encodeURIComponent(selectedBlock)}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    )
      .then(r => r.ok ? r.json() : [])
      .then(d => setVenues(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingVenues(false));
  }, [selectedCampus, selectedBlock, session?.access_token]);

  // Load approved (public) availability for the visible week
  const loadBookings = useCallback(async () => {
    if (!selectedVenueId || !session?.access_token) { setBookings([]); return; }
    setLoadingCal(true);
    try {
      const mid = addDays(weekStart, 3);
      const monthStr = `${mid.getFullYear()}-${pad2(mid.getMonth() + 1)}`;
      const r = await fetch(
        `${API_URL}/api/venues/${selectedVenueId}/availability?month=${monthStr}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (r.ok) {
        const d = await r.json();
        setBookings(Array.isArray(d.bookings) ? d.bookings : []);
      }
    } catch {}
    finally { setLoadingCal(false); }
  }, [selectedVenueId, session?.access_token, weekStart]);

  // Load current user's own non-approved bookings for this venue (pending/rejected/returned)
  const loadOwnBookings = useCallback(async () => {
    if (!selectedVenueId || !session?.access_token) { setOwnBookings([]); return; }
    try {
      const r = await fetch(`${API_URL}/api/venue-bookings/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!r.ok) { setOwnBookings([]); return; }
      const d = await r.json();
      const all: MyBooking[] = [...(d.upcoming || []), ...(d.past || [])];
      setOwnBookings(all.filter(b => b.venue_id === selectedVenueId && b.status !== "approved"));
    } catch { setOwnBookings([]); }
  }, [selectedVenueId, session?.access_token]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { loadOwnBookings(); }, [loadOwnBookings]);

  function handleCellClick(date: string, hour: number) {
    if (!selectedVenueId) return;
    const start = `${pad2(hour)}:00`;
    const end   = `${pad2(hour + 1)}:00`;
    if (isPast(date, start)) { toast.error("Cannot book a past time slot."); return; }
    setModal({ date, start_time: start, end_time: end });
  }

  return (
    <>
      {/* Filter row */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-3">
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <FormField label="Campus">
            <select
              value={selectedCampus}
              onChange={e => setSelectedCampus(e.target.value)}
              className={selectCls}
            >
              <option value="">Select campus…</option>
              {campuses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>

          <FormField label="Location">
            <select
              value={selectedBlock}
              disabled={!selectedCampus || loadingBlocks || blocks.length === 0}
              onChange={e => setSelectedBlock(e.target.value)}
              className={selectCls}
            >
              {!selectedCampus
                ? <option>Select campus first</option>
                : loadingBlocks
                  ? <option>Loading…</option>
                  : blocks.length === 0
                    ? <option>No locations found</option>
                    : <>
                        <option value="">Select location…</option>
                        {blocks.map(b => <option key={b} value={b}>{b}</option>)}
                      </>
              }
            </select>
          </FormField>

          <FormField label="Venue">
            <select
              value={selectedVenueId}
              disabled={!selectedBlock || loadingVenues || venues.length === 0}
              onChange={e => setSelectedVenueId(e.target.value)}
              className={selectCls}
            >
              {!selectedBlock
                ? <option>Select location first</option>
                : loadingVenues
                  ? <option>Loading…</option>
                  : venues.length === 0
                    ? <option>No venues found</option>
                    : <>
                        <option value="">Select venue…</option>
                        {venues.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}{v.capacity ? ` · cap ${v.capacity}` : ""}
                          </option>
                        ))}
                      </>
              }
            </select>
          </FormField>
        </div>

        {selectedVenue && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
            <span className="font-semibold text-gray-800">{selectedVenue.name}</span>
            {selectedVenue.location && <span>· {selectedVenue.location}</span>}
            {selectedVenue.capacity != null && (
              <span className="flex items-center gap-1"><IconUsers /> {selectedVenue.capacity} capacity</span>
            )}
            {selectedVenue.is_approval_needed && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                Requires approval
              </span>
            )}
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {!selectedVenueId ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Select a campus, location, and venue to view the calendar.
          </div>
        ) : (
          <WeekCalendar
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            bookings={bookings}
            ownBookings={ownBookings}
            loading={loadingCal}
            onCellClick={handleCellClick}
            venueName={selectedVenue?.name || ""}
          />
        )}
      </div>

      {modal && selectedVenue && (
        <BookingModal
          session={session}
          userData={userData}
          venue={selectedVenue}
          initial={modal}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); loadBookings(); loadOwnBookings(); }}
        />
      )}
    </>
  );
}

// ─── Week Calendar ────────────────────────────────────────────────────────────

function WeekCalendar({
  weekStart, onWeekChange, bookings, ownBookings = [], loading, onCellClick, venueName,
}: {
  weekStart: Date;
  onWeekChange: (d: Date) => void;
  bookings: VenueBooking[];
  ownBookings?: MyBooking[];
  loading: boolean;
  onCellClick: (date: string, hour: number) => void;
  venueName: string;
}) {
  const days  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const todayStr = ymd(new Date());

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWeekChange(addDays(weekStart, -7))}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-[#154CB3] hover:text-[#154CB3] transition-colors"
            aria-label="Previous week"
          >
            <IconChevronLeft />
          </button>
          <button
            onClick={() => onWeekChange(startOfWeek(new Date()))}
            className="px-3 h-8 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-[#154CB3] hover:text-[#154CB3] transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onWeekChange(addDays(weekStart, 7))}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-[#154CB3] hover:text-[#154CB3] transition-colors"
            aria-label="Next week"
          >
            <IconChevronRight />
          </button>
          <span className="ml-2 text-sm font-semibold text-gray-800">{weekRangeLabel(weekStart)}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-400 inline-block" />
            Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-400 inline-block" />
            My pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-400 inline-block" />
            My rejected
          </span>
          {loading && <span className="text-gray-400">Loading…</span>}
        </div>
      </div>

      {/* Day header row */}
      <div
        className="grid border-b border-gray-200 bg-gray-50"
        style={{ gridTemplateColumns: "52px repeat(7, minmax(0,1fr))" }}
      >
        <div className="border-r border-gray-200" />
        {days.map((d, i) => {
          const isToday = ymd(d) === todayStr;
          return (
            <div key={i} className="py-2 px-1 text-center border-l border-gray-100 first:border-l-0">
              <div className="text-[10px] font-semibold text-gray-400 tracking-widest">
                {d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase()}
              </div>
              <div className={`mt-1 mx-auto w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                isToday ? "bg-[#154CB3] text-white" : "text-gray-700"
              }`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="overflow-y-auto" style={{ maxHeight: "min(62vh, 720px)" }}>
        <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, minmax(0,1fr))" }}>

          {/* Hour labels */}
          <div className="border-r border-gray-200">
            {hours.map(h => (
              <div
                key={h}
                className="border-b border-gray-100 text-[10px] text-gray-400 text-right pr-2 pt-1 select-none"
                style={{ height: HOUR_HEIGHT }}
              >
                {h % 12 || 12}{h < 12 ? "a" : "p"}
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {days.map((d, di) => {
            const dateStr    = ymd(d);
            const dayBooks   = bookings.filter(b => b.date === dateStr);
            const dayOwn     = ownBookings.filter(b => b.date === dateStr);
            return (
              <div key={di} className="relative border-l border-gray-100 first:border-l-0">
                {/* Clickable hour cells */}
                {hours.map(h => {
                  const pastCell = isPast(dateStr, `${pad2(h)}:00`);
                  return (
                    <div
                      key={h}
                      role={pastCell ? undefined : "button"}
                      tabIndex={pastCell ? undefined : 0}
                      onClick={pastCell ? undefined : () => onCellClick(dateStr, h)}
                      onKeyDown={pastCell ? undefined : e => { if (e.key === "Enter") onCellClick(dateStr, h); }}
                      className={`border-b border-gray-100 ${pastCell ? "bg-gray-50 cursor-not-allowed" : "cursor-pointer hover:bg-blue-50 transition-colors"}`}
                      style={{ height: HOUR_HEIGHT }}
                      aria-label={pastCell ? "Past" : `Book ${formatTime12(`${pad2(h)}:00`)} — ${d.toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" })}`}
                    />
                  );
                })}

                {/* Approved booking blocks (visible to everyone) */}
                {dayBooks.map((b, bi) => {
                  const startMin = toMinutes(b.start_time);
                  const endMin   = toMinutes(b.end_time);
                  const baseMin  = HOUR_START * 60;
                  const top    = Math.max(0, (startMin - baseMin) / 60 * HOUR_HEIGHT);
                  const height = Math.max(18, (endMin - startMin) / 60 * HOUR_HEIGHT - 2);
                  const c = bookingBarColor("approved");
                  return (
                    <div
                      key={bi}
                      title={`${b.booking_title || b.full_name || "Booking"} · ${formatTime12(b.start_time)}–${formatTime12(b.end_time)}`}
                      style={{
                        position: "absolute",
                        left: 3, right: 3,
                        top, height,
                        background: c.bg,
                        borderLeft: `3px solid ${c.border}`,
                        borderRadius: 4,
                        padding: "2px 5px",
                        zIndex: 2,
                        pointerEvents: "none",
                        overflow: "hidden",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {b.booking_title || b.full_name || "Booking"}
                      </p>
                      <p style={{ margin: 0, fontSize: 9, color: c.text, opacity: 0.8 }}>
                        {formatTime12(b.start_time)} – {formatTime12(b.end_time)}
                      </p>
                    </div>
                  );
                })}

                {/* Own non-approved bookings (only visible to the requester) */}
                {dayOwn.map((b, bi) => {
                  const startMin = toMinutes(b.start_time);
                  const endMin   = toMinutes(b.end_time);
                  const baseMin  = HOUR_START * 60;
                  const top    = Math.max(0, (startMin - baseMin) / 60 * HOUR_HEIGHT);
                  const height = Math.max(18, (endMin - startMin) / 60 * HOUR_HEIGHT - 2);
                  const c = bookingBarColor(b.status);
                  const label =
                    b.status === "pending"               ? "Awaiting approval" :
                    b.status === "rejected"              ? "Rejected" :
                    b.status === "returned_for_revision" ? "Returned" : b.status;
                  return (
                    <div
                      key={`own-${bi}`}
                      title={`${b.title} · ${label}${b.decision_notes ? ` — ${b.decision_notes}` : ""} · ${formatTime12(b.start_time)}–${formatTime12(b.end_time)}`}
                      style={{
                        position: "absolute",
                        left: 4, right: 4,
                        top, height,
                        background: c.bg,
                        borderLeft: `3px solid ${c.border}`,
                        borderRadius: 4,
                        padding: "2px 5px",
                        zIndex: 3,
                        pointerEvents: "none",
                        overflow: "hidden",
                        opacity: 0.92,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {b.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 9, color: c.text, opacity: 0.85 }}>
                        {label} · {formatTime12(b.start_time)}–{formatTime12(b.end_time)}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {venueName && (
        <div className="px-5 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-400">
          Approved bookings for <span className="font-semibold text-gray-600">{venueName}</span> are visible to everyone. Your pending/rejected bookings are visible only to you. Click any empty slot to book.
        </div>
      )}
    </div>
  );
}

// ─── Booking Modal ────────────────────────────────────────────────────────────

function BookingModal({
  session, userData, venue, initial, onClose, onSuccess,
}: {
  session: any; userData: any; venue: Venue;
  initial: { date: string; start_time: string; end_time: string };
  onClose: () => void; onSuccess: () => void;
}) {
  const [date,      setDate]      = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.start_time);
  const [endTime,   setEndTime]   = useState(initial.end_time);
  const [title,     setTitle]     = useState(`Venue booking — ${userData?.name || userData?.email || ""}`);
  const [headcount, setHeadcount] = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const hcNum = parseInt(headcount || "0", 10);
  const validTimes = toMinutes(endTime) > toMinutes(startTime);
  const overCapacity = venue.capacity != null && hcNum > 0 && hcNum > venue.capacity;
  const canSubmit = !!date && validTimes && title.trim().length >= 3 && hcNum > 0 && !overCapacity && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/venue-bookings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venue.id,
          date,
          start_time: startTime,
          end_time: endTime,
          title: title.trim(),
          headcount: hcNum || null,
          setup_notes: notes.trim() || null,
          entity_type: "standalone",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body.conflict) {
          setError(`Conflicts with existing booking (${body.conflict.start_time}–${body.conflict.end_time}).`);
        } else {
          setError(body.error || "Failed to submit.");
        }
        return;
      }
      toast.success(body.auto_approved ? "Venue booked and confirmed!" : "Booking submitted — awaiting approval.");
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false); }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">New booking</p>
            <p className="text-base font-semibold text-gray-900">{venue.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <IconX />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <FormField label="Title">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. Department orientation"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Date">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </FormField>
            <FormField label="Start">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
            </FormField>
            <FormField label="End">
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
            </FormField>
          </div>

          <FormField label={`Headcount${venue.capacity != null ? ` (max ${venue.capacity})` : ""}`}>
            <input
              type="number" min={1}
              value={headcount}
              onChange={e => setHeadcount(e.target.value)}
              className={inputCls}
              placeholder="Expected attendees"
            />
            {overCapacity && (
              <p className="text-[11px] text-red-600 mt-1">Exceeds venue capacity of {venue.capacity}</p>
            )}
          </FormField>

          <FormField label="Setup notes (optional)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, 500))}
              className={`${inputCls} h-20 resize-none pt-2`}
              placeholder="Microphone, projector, seating layout…"
            />
          </FormField>

          {!validTimes && date && (
            <p className="text-xs text-red-600">End time must be after start time.</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex gap-2.5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#154CB3] text-white hover:bg-[#0f3a7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW 2 — MY BOOKINGS
// ══════════════════════════════════════════════════════════════════════════════

const MY_BOOKINGS_PAGE_SIZE = 8;

function MyBookingsView({ session }: { session: any }) {
  const [sub,      setSub]      = useState<"upcoming" | "past">("upcoming");
  const [upcoming, setUpcoming] = useState<MyBooking[]>([]);
  const [past,     setPast]     = useState<MyBooking[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [page,     setPage]     = useState(1);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    setFetchErr(null);
    fetch(`${API_URL}/api/venue-bookings/mine`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => {
        if (!r.ok) return Promise.reject(new Error(`Server error ${r.status}`));
        return r.json();
      })
      .then(d => { setUpcoming(d.upcoming || []); setPast(d.past || []); })
      .catch(e => setFetchErr(e.message || "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const rows       = sub === "upcoming" ? upcoming : past;
  const totalPages = Math.max(1, Math.ceil(rows.length / MY_BOOKINGS_PAGE_SIZE));
  const pagedRows  = rows.slice((page - 1) * MY_BOOKINGS_PAGE_SIZE, page * MY_BOOKINGS_PAGE_SIZE);

  function switchSub(s: "upcoming" | "past") { setSub(s); setPage(1); }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Sub-tab toggle */}
      <div className="flex items-center border-b border-gray-200 px-5 py-3 gap-2">
        <button
          onClick={() => switchSub("upcoming")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            sub === "upcoming" ? "bg-[#154CB3] text-white" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => switchSub("past")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            sub === "past" ? "bg-[#154CB3] text-white" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Past
        </button>
        <span className="ml-auto text-xs text-gray-400">{rows.length} booking{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : fetchErr ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-500 mb-1">Could not load bookings</p>
          <p className="text-xs text-gray-400">{fetchErr}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          No {sub} bookings.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {pagedRows.map(r => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {r.venue?.name && <span className="font-medium text-gray-700">{r.venue.name}</span>}
                      <span className="flex items-center gap-1">
                        <IconClock />{r.date} · {formatTime12(r.start_time)} – {formatTime12(r.end_time)}
                      </span>
                      {r.headcount && (
                        <span className="flex items-center gap-1"><IconUsers />{r.headcount}</span>
                      )}
                    </div>
                    {r.decision_notes && (
                      <p className={`mt-1.5 text-xs italic border-l-2 pl-2 ${
                        r.status === "rejected" ? "border-red-300 text-red-600" :
                        r.status === "returned_for_revision" ? "border-purple-300 text-purple-700" :
                        "border-gray-200 text-gray-400"
                      }`}>
                        {r.decision_notes}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                {(page - 1) * MY_BOOKINGS_PAGE_SIZE + 1}–{Math.min(page * MY_BOOKINGS_PAGE_SIZE, rows.length)} of {rows.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >← Prev</button>
                <span className="text-xs text-gray-500">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW 3 — FIND AVAILABLE VENUE
// ══════════════════════════════════════════════════════════════════════════════

function AnyAvailableView({ session, userData }: { session: any; userData: any }) {
  const [campuses, setCampuses] = useState<string[]>([]);
  const [campus,   setCampus]   = useState("");
  const [date,     setDate]     = useState(() => { const d = new Date(); d.setDate(d.getDate() + 2); return ymd(d); });
  const [startT,   setStartT]   = useState("09:00");
  const [endT,     setEndT]     = useState("11:00");
  const [minCap,   setMinCap]   = useState("");
  const [searching, setSearching] = useState(false);
  const [results,  setResults]  = useState<null | { venue: Venue; free: boolean; conflict?: { start_time: string; end_time: string } }[]>(null);
  const [picked,   setPicked]   = useState<Venue | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/venues/campuses`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setCampuses(d?.campuses?.length ? d.campuses : [...christCampuses].sort()))
      .catch(() => setCampuses([...christCampuses].sort()));
  }, [session?.access_token]);

  useEffect(() => {
    if (userData?.campus && !campus && campuses.includes(userData.campus)) setCampus(userData.campus);
  }, [userData?.campus, campuses]);

  async function search() {
    if (!session?.access_token || !campus) return;
    if (toMinutes(endT) <= toMinutes(startT)) { toast.error("End must be after start time."); return; }
    setSearching(true); setResults(null);
    try {
      const vr = await fetch(`${API_URL}/api/venues?campus=${encodeURIComponent(campus)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const vs: Venue[] = vr.ok ? await vr.json() : [];
      const minCapN = parseInt(minCap || "0", 10);
      const monthStr = date.slice(0, 7);

      const checked = await Promise.all(vs.map(async v => {
        if (minCapN > 0 && v.capacity != null && v.capacity < minCapN) {
          return { venue: v, free: false, conflict: { start_time: "—", end_time: "capacity" } };
        }
        try {
          const ar = await fetch(`${API_URL}/api/venues/${v.id}/availability?month=${monthStr}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const ab = ar.ok ? await ar.json() : { bookings: [] };
          const clash = (ab.bookings || []).find((b: VenueBooking) =>
            b.date === date &&
            toMinutes(startT) < toMinutes(b.end_time) &&
            toMinutes(endT)   > toMinutes(b.start_time)
          );
          return clash
            ? { venue: v, free: false, conflict: { start_time: clash.start_time, end_time: clash.end_time } }
            : { venue: v, free: true };
        } catch {
          return { venue: v, free: true };
        }
      }));
      setResults(checked);
    } finally {
      setSearching(false);
    }
  }

  const free      = results?.filter(r => r.free)  || [];
  const occupied  = results?.filter(r => !r.free) || [];
  const RESULTS_PAGE_SIZE = 8;
  const [freePage,     setFreePage]     = useState(1);
  const [occupiedPage, setOccupiedPage] = useState(1);

  // Reset pages when results change
  useEffect(() => { setFreePage(1); setOccupiedPage(1); }, [results]);

  const freeTotalPages     = Math.max(1, Math.ceil(free.length     / RESULTS_PAGE_SIZE));
  const occupiedTotalPages = Math.max(1, Math.ceil(occupied.length / RESULTS_PAGE_SIZE));
  const pagedFree     = free.slice    ((freePage     - 1) * RESULTS_PAGE_SIZE, freePage     * RESULTS_PAGE_SIZE);
  const pagedOccupied = occupied.slice((occupiedPage - 1) * RESULTS_PAGE_SIZE, occupiedPage * RESULTS_PAGE_SIZE);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="grid grid-cols-6 gap-3 items-end max-lg:grid-cols-3 max-md:grid-cols-2">
          <FormField label="Campus">
            <select value={campus} onChange={e => setCampus(e.target.value)} className={selectCls}>
              <option value="">Select…</option>
              {campuses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </FormField>
          <FormField label="Start">
            <input type="time" value={startT} onChange={e => setStartT(e.target.value)} className={inputCls} />
          </FormField>
          <FormField label="End">
            <input type="time" value={endT} onChange={e => setEndT(e.target.value)} className={inputCls} />
          </FormField>
          <FormField label="Min capacity">
            <input type="number" min={1} value={minCap} onChange={e => setMinCap(e.target.value)} className={inputCls} placeholder="Any" />
          </FormField>
          <FormField label="&nbsp;">
            <button
              onClick={search}
              disabled={!campus || searching}
              className="w-full h-10 px-4 rounded-lg text-sm font-semibold bg-[#154CB3] text-white hover:bg-[#0f3a7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <IconSearch />
              {searching ? "Searching…" : "Search"}
            </button>
          </FormField>
        </div>
      </div>

      {results && (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-green-700">Available — {free.length}</p>
            </div>
            {free.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">No venues available in this window.</p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100">
                  {pagedFree.map(({ venue }) => (
                    <li key={venue.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{venue.name}</p>
                        <p className="text-xs text-gray-400">{venue.location}{venue.capacity != null ? ` · cap ${venue.capacity}` : ""}</p>
                      </div>
                      <button
                        onClick={() => setPicked(venue)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#154CB3] text-white hover:bg-[#0f3a7a] transition-colors"
                      >
                        Book
                      </button>
                    </li>
                  ))}
                </ul>
                {freeTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <span className="text-xs text-gray-500">{freePage} / {freeTotalPages}</span>
                    <div className="flex gap-1">
                      <button disabled={freePage <= 1} onClick={() => setFreePage(p => p - 1)}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
                      <button disabled={freePage >= freeTotalPages} onClick={() => setFreePage(p => p + 1)}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-red-700">Unavailable — {occupied.length}</p>
            </div>
            {occupied.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">None.</p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100">
                  {pagedOccupied.map(({ venue, conflict }) => (
                    <li key={venue.id} className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{venue.name}</p>
                      <p className="text-xs text-red-500 mt-0.5">
                        {conflict?.end_time === "capacity"
                          ? `Below minimum capacity (${venue.capacity})`
                          : `Booked ${formatTime12(conflict?.start_time || "")} – ${formatTime12(conflict?.end_time || "")}`
                        }
                      </p>
                    </li>
                  ))}
                </ul>
                {occupiedTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <span className="text-xs text-gray-500">{occupiedPage} / {occupiedTotalPages}</span>
                    <div className="flex gap-1">
                      <button disabled={occupiedPage <= 1} onClick={() => setOccupiedPage(p => p - 1)}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
                      <button disabled={occupiedPage >= occupiedTotalPages} onClick={() => setOccupiedPage(p => p + 1)}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {picked && (
        <BookingModal
          session={session}
          userData={userData}
          venue={picked}
          initial={{ date, start_time: startT, end_time: endT }}
          onClose={() => setPicked(null)}
          onSuccess={() => { setPicked(null); search(); }}
        />
      )}
    </>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function FormField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

// Shared Tailwind class strings
const selectCls =
  "w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed";

const inputCls =
  "w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent";
