"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchHodFests,
  fetchHodFestSummary,
  type HodFest,
  type HodFestEvent,
  type HodFestSummary,
} from "@/lib/hodAnalyticsApi";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Calendar,
  Users,
  TrendingUp,
  MessageSquare,
  Ticket,
  Globe,
  Building2,
  Flame,
  Download,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#154CB3";
const ACCENT = "#0EA5A4";
const SUCCESS = "#10B981";
const WARN = "#F59E0B";
const DANGER = "#EF4444";

const CAT_COLORS: Record<string, string> = {
  Tech: "#154CB3",
  Workshop: "#0EA5A4",
  Cultural: "#A855F7",
  Sports: "#F59E0B",
  Talk: "#0284C7",
  Competition: "#EF4444",
  Social: "#22C55E",
  Other: "#64748b",
};

const FB_QUESTIONS = [
  { id: "q1" as const, short: "Overall experience", full: "How would you rate the overall event experience?" },
  { id: "q2" as const, short: "Content relevance", full: "How relevant and valuable was the content to you?" },
  { id: "q3" as const, short: "Organization", full: "How well-organized was the event (scheduling, flow, communication)?" },
  { id: "q4" as const, short: "Venue & logistics", full: "How would you rate the venue / platform and logistics?" },
  { id: "q5" as const, short: "Likelihood to return", full: "How likely are you to attend or recommend future events like this?" },
];

type SortKey = "date" | "rate-desc" | "rate-asc" | "regs" | "attend";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fbColor(v: number) {
  return v >= 4.3 ? SUCCESS : v >= 3.7 ? WARN : DANGER;
}

function statusColor(rate: number) {
  return rate >= 80 ? SUCCESS : rate >= 60 ? WARN : DANGER;
}

function statusLabel(rate: number) {
  return rate >= 80 ? "Strong" : rate >= 60 ? "Steady" : "Low turnout";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `${accent}18`, color: accent }}
        >
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}

function CatPill({ cat }: { cat: string }) {
  const c = CAT_COLORS[cat] || CAT_COLORS.Other;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {cat}
    </span>
  );
}

function InsightCard({
  icon,
  label,
  title,
  valueNum,
  valueLabel,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  valueNum: string | number;
  valueLabel: string;
  hint?: string;
  tone: "good" | "bad";
}) {
  const styles = {
    good: {
      bg: "from-emerald-50 to-white",
      ring: "ring-emerald-100",
      chip: "bg-emerald-100 text-emerald-700",
      icon: "text-emerald-600 bg-emerald-100",
    },
    bad: {
      bg: "from-red-50 to-white",
      ring: "ring-red-100",
      chip: "bg-red-100 text-red-700",
      icon: "text-red-600 bg-red-100",
    },
  };
  const s = styles[tone];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${s.bg} ring-1 ${s.ring} p-4`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${s.icon}`}>{icon}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${s.chip}`}>
          {label}
        </span>
      </div>
      <p className="mt-3 text-[13px] font-semibold leading-snug text-slate-700">{title}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold leading-none text-slate-900 tabular-nums">{valueNum}</span>
        <span className="text-xs font-semibold text-slate-500">{valueLabel}</span>
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
  height = "h-2",
}: {
  value: number;
  max: number;
  color: string;
  height?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`${height} rounded-full bg-slate-100 overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function EventRow({
  e,
  expanded,
  onToggle,
}: {
  e: HodFestEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sc = statusColor(e.rate);
  const sl = statusLabel(e.rate);
  const dropoff = e.regs - e.attend;

  return (
    <div
      className={`rounded-xl transition-colors ${
        expanded ? "bg-slate-50/70 ring-1 ring-slate-200" : "hover:bg-slate-50"
      }`}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full text-left grid grid-cols-12 items-center gap-3 py-3 px-3"
      >
        {/* Chevron + name */}
        <div className="col-span-12 md:col-span-5 flex min-w-0 items-center gap-2">
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-slate-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{e.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <CatPill cat={e.cat} />
              <span className="tabular-nums">{e.date}</span>
            </div>
          </div>
        </div>

        {/* Registrations */}
        <div className="col-span-3 md:col-span-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:hidden">Regs</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{e.regs}</p>
        </div>

        {/* Attendance */}
        <div className="col-span-3 md:col-span-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:hidden">Attended</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{e.attend}</p>
          {dropoff > 0 && (
            <p className="text-[10px] tabular-nums text-slate-400">−{dropoff} drop</p>
          )}
        </div>

        {/* Attendance % bar */}
        <div className="col-span-6 md:col-span-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold tabular-nums" style={{ color: sc }}>
              {e.rate}%
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: sc }}>
              {e.rate >= 80 ? (
                <CheckCircle className="h-3 w-3" />
              ) : e.rate >= 60 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {sl}
            </span>
          </div>
          <ProgressBar value={e.rate} max={100} color={sc} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Description */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              About this event
            </p>
            {e.description ? (
              <p className="text-[12.5px] leading-relaxed text-slate-700">{e.description}</p>
            ) : (
              <p className="text-[12px] text-slate-400 italic">No description added.</p>
            )}
          </div>

          {/* Per-event feedback */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Feedback · {e.feedback.count} responses
              </p>
              {e.feedback.count > 0 && (
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{ color: fbColor(e.feedback.score) }}
                >
                  {e.feedback.score.toFixed(1)}
                </p>
              )}
            </div>
            {e.feedback.count > 0 ? (
              <div className="space-y-2">
                {FB_QUESTIONS.map((q, i) => {
                  const v = e.feedback[q.id];
                  return (
                    <div key={q.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                      <span className="w-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 tabular-nums">
                        Q{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-700">{q.short}</p>
                        <div className="mt-0.5">
                          <ProgressBar value={v} max={5} color={fbColor(v)} height="h-1.5" />
                        </div>
                      </div>
                      <span
                        className="text-[12px] font-bold tabular-nums"
                        style={{ color: fbColor(v) }}
                      >
                        {v.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 italic">No feedback submitted yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InsiderDonut({
  insiders,
  outsiders,
}: {
  insiders: number;
  outsiders: number;
}) {
  const total = insiders + outsiders;
  const data = [
    { name: "Insiders", value: insiders, color: PRIMARY },
    { name: "Outsiders", value: outsiders, color: ACCENT },
  ];
  return (
    <div className="relative">
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="68%"
              outerRadius="94%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [v.toLocaleString(), ""]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-slate-900">
            {total.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HodFestDashboard() {
  const { session, isLoading } = useAuth();

  const [fests, setFests] = useState<HodFest[]>([]);
  const [selectedFestId, setSelectedFestId] = useState<string>("");
  const [summary, setSummary] = useState<HodFestSummary | null>(null);
  const [loadingFests, setLoadingFests] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventSort, setEventSort] = useState<SortKey>("date");
  const [eventFilter, setEventFilter] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Fetch fests on mount
  useEffect(() => {
    if (isLoading || !session?.access_token) return;
    setLoadingFests(true);
    setError(null);
    fetchHodFests(session.access_token)
      .then((data) => {
        setFests(data);
        if (data.length > 0) setSelectedFestId(data[0].id);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingFests(false));
  }, [isLoading, session?.access_token]);

  // Fetch summary when fest changes
  useEffect(() => {
    if (!session?.access_token || !selectedFestId) return;
    setLoadingSummary(true);
    setSummary(null);
    setExpandedEvent(null);
    fetchHodFestSummary(session.access_token, selectedFestId)
      .then(setSummary)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingSummary(false));
  }, [session?.access_token, selectedFestId]);

  const currentFest = fests.find((f) => f.id === selectedFestId);

  const allCats = useMemo(() => {
    if (!summary) return ["all"];
    const cats = [...new Set(summary.events.map((e) => e.cat))];
    return ["all", ...cats];
  }, [summary]);

  const sortedEvents = useMemo(() => {
    if (!summary) return [];
    let list = [...summary.events];
    if (eventFilter !== "all") list = list.filter((e) => e.cat === eventFilter);
    switch (eventSort) {
      case "rate-desc": list.sort((a, b) => b.rate - a.rate); break;
      case "rate-asc":  list.sort((a, b) => a.rate - b.rate); break;
      case "regs":      list.sort((a, b) => b.regs - a.regs); break;
      case "attend":    list.sort((a, b) => b.attend - a.attend); break;
      default:          list.sort((a, b) => a.date.localeCompare(b.date)); break;
    }
    return list;
  }, [summary, eventSort, eventFilter]);

  const topEvent = useMemo(
    () => summary && [...summary.events].sort((a, b) => b.attend - a.attend)[0],
    [summary]
  );
  const worstEvent = useMemo(
    () => summary && [...summary.events].sort((a, b) => a.rate - b.rate)[0],
    [summary]
  );

  // Overall feedback weighted averages
  const feedbackStats = useMemo(() => {
    if (!summary || summary.events.length === 0) return null;
    const withFb = summary.events.filter((e) => e.feedback.count > 0);
    if (withFb.length === 0) return null;
    const totalCount = withFb.reduce((s, e) => s + e.feedback.count, 0);
    const avgs = FB_QUESTIONS.map((q) => {
      const weighted = withFb.reduce((s, e) => s + e.feedback[q.id] * e.feedback.count, 0);
      return Math.round((weighted / totalCount) * 100) / 100;
    });
    const overall = Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100;
    return { avgs, overall, totalCount };
  }, [summary]);

  const showInsights = !!summary && summary.events.length >= 2 && !!topEvent && !!worstEvent;

  // ── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  if (loadingFests) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <p className="mt-1 text-xs text-red-500">
          Ensure your HOD account has a department configured.
        </p>
      </div>
    );
  }

  if (fests.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">No fests found</p>
        <p className="mt-1 text-xs text-slate-500">
          No active fests are organized by your department yet.
        </p>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header with fest selector ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            <span>Fest Dashboard</span>
            {currentFest?.dates && (
              <>
                <span>•</span>
                <span>{currentFest.dates}</span>
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-[24px] font-bold leading-tight tracking-tight text-slate-900">
              {currentFest?.name ?? "Loading…"}
            </h2>
            {/* Fest selector */}
            <div className="relative">
              <select
                value={selectedFestId}
                onChange={(e) => setSelectedFestId(e.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 shadow-sm outline-none hover:bg-slate-50 focus:ring-2 focus:ring-blue-200"
              >
                {fests.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Live view of how the fest is performing — registrations, attendance, and feedback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (session?.access_token && selectedFestId) {
                setLoadingSummary(true);
                setSummary(null);
                fetchHodFestSummary(session.access_token, selectedFestId)
                  .then(setSummary)
                  .catch((e: Error) => setError(e.message))
                  .finally(() => setLoadingSummary(false));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: PRIMARY }}
          >
            <Download className="h-3.5 w-3.5" /> Export report
          </button>
        </div>
      </div>

      {/* Loading summary */}
      {loadingSummary && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: PRIMARY }} />
        </div>
      )}

      {!loadingSummary && summary && (
        <>
          {summary.events.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Calendar className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No events in this fest</p>
              <p className="mt-1 text-xs text-slate-500">
                No events are organized by your department under this fest.
              </p>
            </div>
          ) : (
          <>
          {/* ═══ 1. TOP SUMMARY ═══ */}
          <section>
            <SectionLabel num={1} title="Top Summary" sub="how the fest is doing at a glance" primary={PRIMARY} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                icon={<Calendar className="h-4 w-4" />}
                label="Total Events"
                value={String(summary.summary.events)}
                sub="events in this fest"
                accent={PRIMARY}
              />
              <KpiCard
                icon={<Ticket className="h-4 w-4" />}
                label="Registrations"
                value={summary.summary.registrations.toLocaleString()}
                sub="entries received"
                accent={ACCENT}
              />
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label="Attendance"
                value={summary.summary.attendance.toLocaleString()}
                sub="checked in via QR"
                accent={SUCCESS}
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Attendance Rate"
                value={`${summary.summary.attendanceRate.toFixed(1)}%`}
                sub={`${summary.summary.dropOff.toLocaleString()} didn't show up`}
                accent={WARN}
              />
              <KpiCard
                icon={<MessageSquare className="h-4 w-4" />}
                label="Feedback Rate"
                value={`${summary.summary.feedbackRate.toFixed(1)}%`}
                sub="of attendees responded"
                accent="#A855F7"
              />
            </div>
          </section>

          {/* ═══ 2. QUICK INSIGHTS ═══ */}
          {showInsights && (
            <section>
              <SectionLabel num={2} title="Quick Insights" sub="headline takeaways from this fest" primary={PRIMARY} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InsightCard
                  tone="good"
                  icon={<Flame className="h-4 w-4" />}
                  label="Highest Participation"
                  title={topEvent.name}
                  valueNum={topEvent.attend}
                  valueLabel="attended"
                  hint={`${topEvent.regs} registered · ${topEvent.rate}% turnout — standout event of this fest`}
                />
                <InsightCard
                  tone="bad"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Lowest Participation"
                  title={worstEvent.name}
                  valueNum={worstEvent.attend}
                  valueLabel="attended"
                  hint={`${worstEvent.regs} registered · only ${worstEvent.rate}% turnout — needs review`}
                />
              </div>
            </section>
          )}

          {/* ═══ 3. EVENT PERFORMANCE ═══ */}
          <section>
            <SectionLabel num={showInsights ? 3 : 2} title="Event Performance" sub="every event, how it did" primary={PRIMARY} />
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-2 pb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {allCats.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEventFilter(c)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                      style={
                        eventFilter === c
                          ? { background: PRIMARY, color: "#fff" }
                          : { background: "#f1f5f9", color: "#475569" }
                      }
                    >
                      {c === "all"
                        ? `All · ${summary.events.length}`
                        : `${c} · ${summary.events.filter((e) => e.cat === c).length}`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sort</span>
                  <select
                    value={eventSort}
                    onChange={(e) => setEventSort(e.target.value as SortKey)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="date">Date</option>
                    <option value="rate-desc">Best attendance %</option>
                    <option value="rate-asc">Worst attendance %</option>
                    <option value="regs">Most registrations</option>
                    <option value="attend">Most attended</option>
                  </select>
                </div>
              </div>

              {/* Column headers */}
              <div className="hidden md:grid grid-cols-12 items-center gap-3 px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <div className="col-span-5">Event</div>
                <div className="col-span-2 text-center">Registered</div>
                <div className="col-span-2 text-center">Attended</div>
                <div className="col-span-3">Attendance</div>
              </div>

              {sortedEvents.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No events match this filter.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sortedEvents.map((e) => (
                    <EventRow
                      key={e.id}
                      e={e}
                      expanded={expandedEvent === e.id}
                      onToggle={() => setExpandedEvent(expandedEvent === e.id ? null : e.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ═══ 4. PARTICIPATION BREAKDOWN ═══ */}
          <section>
            <SectionLabel num={showInsights ? 4 : 3} title="Participation Breakdown" sub="who showed up" primary={PRIMARY} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
              {/* Dept bars */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Students by Course</h3>
                <p className="mt-0.5 text-xs text-slate-500">Courses contributing the most attendees</p>
                {summary.deptBreakdown.length === 0 ? (
                  <p className="mt-6 text-center text-sm text-slate-400 italic">
                    No course data available for attendees.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {summary.deptBreakdown.slice(0, 8).map((d, i) => {
                      const max = summary.deptBreakdown[0].count;
                      return (
                        <div key={i}>
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">{d.dept}</span>
                            <span className="font-bold tabular-nums text-slate-900">{d.count}</span>
                          </div>
                          <div className="mt-1">
                            <ProgressBar
                              value={d.count}
                              max={max}
                              color={d.color || PRIMARY}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Insider / Outsider */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Insider vs Outsider</h3>
                <p className="mt-0.5 text-xs text-slate-500">Christ students vs visitors</p>
                {summary.summary.insiders + summary.summary.outsiders === 0 ? (
                  <p className="mt-6 text-center text-sm text-slate-400 italic">No data yet.</p>
                ) : (
                  <>
                    <InsiderDonut
                      insiders={summary.summary.insiders}
                      outsiders={summary.summary.outsiders}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: PRIMARY }} />
                          <Building2 className="h-3 w-3 text-slate-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Insiders
                          </p>
                        </div>
                        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                          {summary.summary.insiders.toLocaleString()}
                        </p>
                        <p className="text-[10px] tabular-nums text-slate-500">
                          {summary.summary.insiders + summary.summary.outsiders > 0
                            ? (
                                (summary.summary.insiders /
                                  (summary.summary.insiders + summary.summary.outsiders)) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
                          <Globe className="h-3 w-3 text-slate-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Outsiders
                          </p>
                        </div>
                        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                          {summary.summary.outsiders.toLocaleString()}
                        </p>
                        <p className="text-[10px] tabular-nums text-slate-500">
                          {summary.summary.insiders + summary.summary.outsiders > 0
                            ? (
                                (summary.summary.outsiders /
                                  (summary.summary.insiders + summary.summary.outsiders)) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ═══ 5. FEEDBACK ═══ */}
          <section>
            <SectionLabel num={showInsights ? 5 : 4} title="Feedback" sub="five fixed questions, rated 1 to 5" primary={PRIMARY} />
            {feedbackStats ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="mb-1 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Overall Feedback</h3>
                    <p className="text-xs text-slate-500">
                      Across {summary.events.filter((e) => e.feedback.count > 0).length} events ·{" "}
                      {feedbackStats.totalCount.toLocaleString()} responses
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-4xl font-bold leading-none tabular-nums"
                      style={{ color: fbColor(feedbackStats.overall) }}
                    >
                      {feedbackStats.overall.toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">avg · out of 5</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {FB_QUESTIONS.map((q, i) => {
                    const v = feedbackStats.avgs[i];
                    return (
                      <div key={q.id}>
                        <div className="flex items-baseline justify-between gap-3 text-[11px]">
                          <span className="min-w-0 font-semibold leading-snug text-slate-700">
                            <span className="mr-1 tabular-nums text-slate-400">Q{i + 1}.</span>
                            {q.short}
                          </span>
                          <span
                            className="shrink-0 font-bold tabular-nums"
                            style={{ color: fbColor(v) }}
                          >
                            {v.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <ProgressBar value={v} max={5} color={fbColor(v)} />
                        </div>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{q.full}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                <p className="text-sm font-semibold text-slate-500">No feedback collected yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Feedback becomes available after organizers send it to attendees.
                </p>
              </div>
            )}
          </section>

          {/* Footer */}
          <p className="pb-4 text-center text-[11px] text-slate-400">
            Socio · HOD Console · {summary.department} ·{" "}
            {new Date().toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          </>
          )}
        </>
      )}
    </div>
  );
}

// Small shared helper for section labels
function SectionLabel({
  num,
  title,
  sub,
  primary,
}: {
  num: number;
  title: string;
  sub: string;
  primary: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold tabular-nums text-white"
        style={{ background: primary }}
      >
        {num}
      </span>
      <h2 className="text-sm font-bold tracking-tight text-slate-900">{title}</h2>
      <span className="text-xs text-slate-500">— {sub}</span>
    </div>
  );
}
