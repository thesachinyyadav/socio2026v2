"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarRange,
  ChevronDown,
  GraduationCap,
  Layers,
  RefreshCw,
  Star,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  fetchCampusDirectorOverview,
  type CampusDirectorQuery,
  type CampusDirectorSnapshot,
} from "@/lib/campusDirectorAnalyticsApi";
import { organizingSchools, getDepartmentOptionsForSchool } from "@/app/lib/eventFormSchema";
import InfoHint from "@/app/_components/Admin/InfoHint";
import CampusHierarchyExplorer from "./CampusHierarchyExplorer";

const PRIMARY = "#154CB3";
const ACCENT = "#0EA5A4";
const WARN = "#F59E0B";
const VIOLET = "#8B5CF6";
const CHART_COLORS = [PRIMARY, ACCENT, WARN, "#EF4444", VIOLET, "#22C55E"];

type DatePreset = "30" | "90" | "180" | "365";

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const num = (n: number) => (Number(n) || 0).toLocaleString("en-IN");
const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

function cx(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function HeadlineCard({
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${accent}1a`, color: accent }}
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none text-[#063168]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  info,
  right,
  children,
  className,
}: {
  title: string;
  info?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#063168]">{title}</h2>
          {info ? <InfoHint label={title} text={info} /> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function CampusDirectorAnalyticsDashboard() {
  const [data, setData] = useState<CampusDirectorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range controls
  const [preset, setPreset] = useState<DatePreset>("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");

  // School / department filters
  const [schoolFilter, setSchoolFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [appliedSchool, setAppliedSchool] = useState("");
  const [appliedDept, setAppliedDept] = useState("");

  const query = useMemo<CampusDirectorQuery>(() => {
    const base: CampusDirectorQuery =
      appliedStart && appliedEnd ? { start: appliedStart, end: appliedEnd } : { days: Number(preset) };
    if (appliedSchool) base.school = appliedSchool;
    if (appliedDept) base.department = appliedDept;
    return base;
  }, [appliedStart, appliedEnd, preset, appliedSchool, appliedDept]);

  const departmentOptions = useMemo(() => {
    const list = schoolFilter
      ? getDepartmentOptionsForSchool(schoolFilter)
      : organizingSchools.flatMap((s) => getDepartmentOptionsForSchool(s.value));
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const option of list) {
      if (!seen.has(option.label)) {
        seen.add(option.label);
        labels.push(option.label);
      }
    }
    return labels;
  }, [schoolFilter]);

  useEffect(() => {
    if (!schoolFilter || !deptFilter) return;
    const allowed = new Set(getDepartmentOptionsForSchool(schoolFilter).map((o) => o.label));
    if (!allowed.has(deptFilter)) setDeptFilter("");
  }, [schoolFilter, deptFilter]);

  const canApplyRange =
    Boolean(customStart) &&
    Boolean(customEnd) &&
    customStart <= customEnd &&
    (customStart !== appliedStart || customEnd !== appliedEnd);

  const canApplyFilters = schoolFilter !== appliedSchool || deptFilter !== appliedDept;
  const hasActiveFilters =
    schoolFilter || deptFilter || appliedSchool || appliedDept || appliedStart || appliedEnd;

  const initialised = useRef(false);
  const load = useCallback(
    async (silent: boolean) => {
      setError(null);
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        setData(await fetchCampusDirectorOverview(query));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query]
  );

  useEffect(() => {
    load(initialised.current);
    initialised.current = true;
  }, [load]);

  const activeWindowLabel = useMemo(() => {
    if (appliedStart && appliedEnd) return `${formatDate(appliedStart)} – ${formatDate(appliedEnd)}`;
    return `${preset}-day window`;
  }, [appliedStart, appliedEnd, preset]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[#154CB3]" />
        Loading campus analytics…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
        <p className="font-semibold text-red-700">Could not load analytics</p>
        <p className="mt-1 text-sm text-red-600">{error || "No data available."}</p>
        <button
          onClick={() => load(false)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }

  const { overview, events, students, time, financials, audience, feedback, dataQuality } = data;

  const segmentationData = [
    { name: "Active", value: students.segmentation.active },
    { name: "Inactive", value: students.segmentation.inactive },
  ];
  const audienceData = [
    { name: "Christ members", value: audience.insiders },
    { name: "Outsiders", value: audience.outsiders },
  ];
  const funnelData = [
    { name: "Registered", value: events.funnel.registered },
    { name: "Attended", value: events.funnel.attended },
    { name: "Feedback", value: events.funnel.feedback },
  ];

  // Date range only (the explorer ignores the school/department dropdowns).
  const hierarchyDateProps =
    appliedStart && appliedEnd ? { start: appliedStart, end: appliedEnd } : { days: Number(preset) };

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#154CB3]/10 text-[#154CB3]">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#063168]">Campus Director</h1>
                <InfoHint
                  size="sm"
                  label="Campus Director analytics"
                  text="Campus-wide engagement, event quality, student behaviour, and budgets — filterable by school, department, and time range."
                />
              </div>
              <p className="text-xs text-slate-500">{data.campus} · campus-wide analytics</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[#154CB3] px-4 py-2 text-sm font-medium text-[#154CB3] transition-all hover:bg-[#154CB3] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Controls: filters + time range */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Filter by */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Filter By</p>
                  <InfoHint
                    size="sm"
                    label="Filter By"
                    text="Drill down within this campus by school, then department."
                  />
                </div>
                {hasActiveFilters ? (
                  <button
                    onClick={() => {
                      setSchoolFilter("");
                      setDeptFilter("");
                      setAppliedSchool("");
                      setAppliedDept("");
                      setPreset("90");
                      setCustomStart("");
                      setCustomEnd("");
                      setAppliedStart("");
                      setAppliedEnd("");
                    }}
                    className="text-xs font-semibold text-[#154CB3] hover:underline"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">School</label>
                  <div className="relative flex items-center rounded-xl border border-slate-200 bg-white">
                    <GraduationCap className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={schoolFilter}
                      onChange={(e) => setSchoolFilter(e.target.value)}
                      aria-label="School filter"
                      className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-9 pr-8 text-xs text-slate-700 outline-none"
                    >
                      <option value="">All Schools</option>
                      {organizingSchools.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Department</label>
                  <div className="relative flex items-center rounded-xl border border-slate-200 bg-white">
                    <Layers className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      aria-label="Department filter"
                      className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-9 pr-8 text-xs text-slate-700 outline-none"
                    >
                      <option value="">All Departments</option>
                      {departmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setAppliedSchool(schoolFilter);
                  setAppliedDept(deptFilter);
                }}
                disabled={!canApplyFilters}
                className={cx(
                  "mt-2.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors",
                  canApplyFilters
                    ? "bg-[#154CB3] text-white hover:bg-[#0f3f95]"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                )}
              >
                Apply Filters
              </button>
            </div>

            {/* Time range */}
            <div className="lg:border-l lg:border-slate-100 lg:pl-5">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Time Range</p>
                <InfoHint
                  size="sm"
                  label="Time Range"
                  text="Pick a quick window or an exact custom date range. All metrics and the vs-previous comparison update accordingly."
                />
                <span className="ml-auto rounded-full bg-[#063168] px-3 py-1 text-[11px] font-semibold text-white">
                  {activeWindowLabel}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(["30", "90", "180", "365"] as DatePreset[]).map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setPreset(value);
                      setCustomStart("");
                      setCustomEnd("");
                      setAppliedStart("");
                      setAppliedEnd("");
                    }}
                    className={cx(
                      "min-w-[60px] rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                      preset === value && !appliedStart && !appliedEnd
                        ? "border-[#154CB3] bg-[#154CB3] text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    )}
                  >
                    {value} Days
                  </button>
                ))}
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAppliedStart(customStart);
                    setAppliedEnd(customEnd);
                  }}
                  disabled={!canApplyRange}
                  className={cx(
                    "rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors",
                    canApplyRange
                      ? "bg-[#154CB3] text-white hover:bg-[#0f3f95]"
                      : "cursor-not-allowed bg-slate-200 text-slate-400"
                  )}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
          {refreshing ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
            </p>
          ) : null}
        </section>

        {/* Headline counts */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <HeadlineCard icon={<Calendar className="h-4 w-4" />} label="Fests" value={num(dataQuality.fests)} accent={PRIMARY} />
          <HeadlineCard icon={<Ticket className="h-4 w-4" />} label="Events" value={num(dataQuality.events)} accent={ACCENT} />
          <HeadlineCard icon={<Users className="h-4 w-4" />} label="Registrations" value={num(dataQuality.registrations)} accent={PRIMARY} />
          <HeadlineCard
            icon={<Star className="h-4 w-4" />}
            label="Avg Feedback"
            value={feedback.avgFeedback ? feedback.avgFeedback.toFixed(1) : "—"}
            sub="out of 5"
            accent={WARN}
          />
          <HeadlineCard
            icon={<Wallet className="h-4 w-4" />}
            label="Total Budget"
            value={inr(financials.totalBudget)}
            sub={`${num(financials.approvalCount)} approvals`}
            accent="#10B981"
          />
        </div>

        {/* Engagement KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {overview.kpis.map((k) => {
            const positive = k.changePct >= 0;
            const trendUp = k.key === "dropOffRate" ? !positive : positive;
            return (
              <div key={k.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{k.label}</p>
                <p className="mt-1 text-[22px] font-bold leading-none text-[#063168]">
                  {num(k.value)}
                  {k.unit}
                </p>
                <p className={cx("mt-2 flex items-center gap-1 text-xs font-medium", trendUp ? "text-emerald-600" : "text-red-500")}>
                  {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(k.changePct).toFixed(1)}% vs prev.
                </p>
              </div>
            );
          })}
        </div>

        {/* Trend + student segmentation */}
        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            title="Engagement Trend"
            info="Registrations and attendance quality across the last 12 months."
            className="lg:col-span-2"
            right={
              <span
                className={cx(
                  "rounded-full px-2 py-1 text-xs font-semibold",
                  time.growthRate >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                )}
              >
                Growth {time.growthRate >= 0 ? "+" : ""}
                {time.growthRate.toFixed(1)}%
              </span>
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={time.monthlyTrend} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <defs>
                  <linearGradient id="cdReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="registrations" name="Registrations" stroke={PRIMARY} fill="url(#cdReg)" />
                <Area type="monotone" dataKey="attendanceRate" name="Attendance %" stroke={ACCENT} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Student Mix" info="Active vs inactive students within the current scope.">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={segmentationData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  <Cell fill={PRIMARY} />
                  <Cell fill="#E2E8F0" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Retention</p>
                <p className="text-sm font-bold text-[#063168]">{pct(students.behavior.retentionRate)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg no-show</p>
                <p className="text-sm font-bold text-[#063168]">{pct(students.behavior.averageNoShowRate)}</p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Funnel + audience */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Drop-off Funnel" info="Conversion from registration to attendance to feedback completion.">
            <ResponsiveContainer width="100%" height={240}>
              <FunnelChart>
                <Tooltip formatter={(value: number) => num(value)} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
                  {funnelData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Participant Mix" info="Split of Christ members vs external participants across scoped events.">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={audienceData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  <Cell fill={PRIMARY} />
                  <Cell fill={WARN} />
                </Pie>
                <Tooltip formatter={(value: number) => num(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* Campus explorer — school → department → fest → events drill-down (date-range scoped; ignores the school/dept filters) */}
        <CampusHierarchyExplorer {...hierarchyDateProps} />

        <p className="pt-2 text-center text-xs text-slate-400">
          Generated {new Date(data.generatedAt).toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}
