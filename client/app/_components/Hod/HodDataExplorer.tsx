"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Brain,
  CalendarDays,
  CalendarRange,
  Download,
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  fetchHodAnalytics,
  type AnalyticsKpi,
  type HodAnalyticsBundle,
} from "@/lib/hodAnalyticsApi";
import { exportHodReport } from "@/lib/xlsxTheme";

type DatePreset = "30" | "90" | "180" | "365";
type InsightTone = "risk" | "opportunity";

const KPI_ICONS: Record<string, React.ElementType> = {
  participationRate: Users,
  attendanceRate: Target,
  dropOffRate: TrendingDown,
  avgEventsPerStudent: Activity,
  activeStudentsPct: TrendingUp,
  activeTeachers: GraduationCap,
  totalDeptEvents: CalendarDays,
};

const CHART_COLORS = ["#154CB3", "#0EA5A4", "#F59E0B", "#EF4444", "#8B5CF6", "#22C55E", "#06B6D4"];

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function toPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function confidencePill(confidence: "low" | "medium" | "high"): string {
  if (confidence === "high") return "bg-emerald-100 text-emerald-700";
  if (confidence === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function InsightCard({
  tone,
  title,
  statement,
  confidence,
}: {
  tone: InsightTone;
  title: string;
  statement: string;
  confidence: "low" | "medium" | "high";
}) {
  return (
    <div
      className={classNames(
        "rounded-xl border p-3",
        tone === "risk" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {tone === "risk" ? (
            <ShieldAlert className="h-4 w-4 text-red-600" />
          ) : (
            <Sparkles className="h-4 w-4 text-emerald-600" />
          )}
          <p className="text-xs font-semibold text-slate-800">{title}</p>
        </div>
        <span
          className={classNames(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            confidencePill(confidence)
          )}
        >
          {confidence}
        </span>
      </div>
      <p className="text-xs text-slate-600">{statement}</p>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: AnalyticsKpi }) {
  const Icon = KPI_ICONS[kpi.key] ?? Activity;
  const isPositive = kpi.changePct >= 0;
  const isDropOff = kpi.key === "dropOffRate";
  const trendPositive = isDropOff ? !isPositive : isPositive;
  const noTrend = kpi.changePct === 0 && (kpi.key === "activeTeachers" || kpi.key === "totalDeptEvents");

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</p>
        <span className="inline-flex rounded-lg bg-slate-100 p-1.5">
          <Icon className="h-4 w-4 text-[#154CB3]" />
        </span>
      </div>

      <p className="text-2xl font-bold tracking-tight text-slate-900">
        {kpi.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        {kpi.unit}
      </p>

      {!noTrend && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ring-slate-200">
          {trendPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          )}
          <p className={classNames("text-xs font-medium", trendPositive ? "text-emerald-700" : "text-red-700")}>
            {Math.abs(kpi.changePct).toFixed(1)}% vs previous period
          </p>
        </div>
      )}
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40",
        className
      )}
    >
      {children}
    </div>
  );
}

export default function HodDataExplorer() {
  const [preset, setPreset] = useState<DatePreset>("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [bundle, setBundle] = useState<HodAnalyticsBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    if (customStart || customEnd) {
      return { start: customStart || undefined, end: customEnd || undefined };
    }
    return { days: Number(preset) };
  }, [customEnd, customStart, preset]);

  const loadAnalytics = useCallback(
    async (silent = false) => {
      try {
        setError(null);
        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        const response = await fetchHodAnalytics(query);
        setBundle(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load department analytics.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [query]
  );

  useEffect(() => {
    void loadAnalytics(false);
  }, [loadAnalytics]);

  async function handleExport() {
    if (!bundle) return;
    setIsExporting(true);
    try {
      await exportHodReport(bundle, bundle.overview.department);
    } finally {
      setIsExporting(false);
    }
  }

  const hodKpis = useMemo<AnalyticsKpi[]>(() => {
    if (!bundle) return [];
    return [
      ...bundle.overview.kpis,
      { key: "activeTeachers", label: "Active Organisers", value: bundle.overview.activeTeachers, unit: "", changePct: 0 },
      { key: "totalDeptEvents", label: "Dept Events", value: bundle.overview.totalDeptEvents, unit: "", changePct: 0 },
    ];
  }, [bundle]);

  const monthlyTrend = useMemo(
    () =>
      (bundle?.overview.monthlyTrend ?? []).map((item) => ({
        ...item,
        monthLabel: formatMonth(item.month),
      })),
    [bundle?.overview.monthlyTrend]
  );

  const funnelData = useMemo(() => {
    const funnel = bundle?.overview.funnel;
    if (!funnel) return [];
    return [
      { name: "Registered", value: funnel.registered },
      { name: "Attended", value: funnel.attended },
      { name: "Feedback", value: funnel.feedback },
    ];
  }, [bundle?.overview.funnel]);

  const segmentationData = useMemo(() => {
    const seg = bundle?.students.segmentation;
    if (!seg) return [];
    return [
      { name: "Active", value: seg.active },
      { name: "Inactive", value: seg.inactive },
    ];
  }, [bundle?.students.segmentation]);

  const retentionSummary = useMemo(() => {
    const behavior = bundle?.students.behavior;
    return {
      retentionRate: behavior?.retentionRate ?? 0,
      dropDetectionRate: behavior?.dropDetectionRate ?? 0,
      averageNoShowRate: behavior?.averageNoShowRate ?? 0,
      activeRatio: bundle?.students.segmentation.active
        ? (
            bundle.students.segmentation.active /
            Math.max(bundle.students.segmentation.inactive, 1)
          ).toFixed(2)
        : "0.00",
    };
  }, [bundle?.students.behavior, bundle?.students.segmentation]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-14 text-center shadow-sm shadow-slate-200/40">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#154CB3]" />
        <p className="text-sm font-semibold text-slate-700">Building department analytics...</p>
        <p className="mt-1 text-xs text-slate-500">Preparing engagement, event, and teacher data.</p>
      </div>
    );
  }

  if (error?.includes("Department not configured")) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <GraduationCap className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <p className="font-semibold text-amber-800">Department not configured</p>
        <p className="mt-1 text-sm text-amber-600">
          Ask your administrator to set your department in user settings before using analytics.
        </p>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50/80 p-7">
        <h3 className="text-base font-semibold text-red-800">Analytics engine unavailable</h3>
        <p className="mt-1 text-sm text-red-700">{error ?? "Unable to load analytics."}</p>
        <button
          type="button"
          onClick={() => void loadAnalytics(false)}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const department = bundle.overview.department;

  return (
    <div className="space-y-7">
      {/* Sticky header */}
      <div className="sticky top-3 z-20 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">
              {department} Department Intelligence
            </p>
            <p className="mt-1 text-xs text-slate-500">
              HOD data explorer — event performance, student engagement, and teacher participation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Data Snapshot</p>
              <p className="text-xs font-medium text-slate-700">
                {new Date(bundle.overview.generatedAt).toLocaleString()}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadAnalytics(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className={classNames("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-lg border border-[#154CB3] bg-[#154CB3] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f3d96] disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_minmax(300px,420px)]">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Date Window
            </label>
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["30", "90", "180", "365"] as DatePreset[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPreset(value);
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className={classNames(
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    preset === value && !customStart && !customEnd
                      ? "bg-[#154CB3] text-white"
                      : "text-slate-600 hover:bg-white"
                  )}
                >
                  {value}D
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Custom Range
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards — 5 from engine + 2 synthetic */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {hodKpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* Row 1: Monthly Trend + Funnel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Engagement Trend</h3>
              <p className="text-xs text-slate-500">
                Registrations and attendance quality from {department} over time.
              </p>
            </div>
            <span
              className={classNames(
                "rounded-full px-2 py-1 text-xs font-semibold",
                bundle.overview.growthRate >= 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              )}
            >
              Growth {bundle.overview.growthRate >= 0 ? "+" : ""}
              {bundle.overview.growthRate.toFixed(1)}%
            </span>
          </div>

          {monthlyTrend.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No monthly trend data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 12, left: -20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                <Line
                  type="monotone"
                  dataKey="registrations"
                  stroke="#154CB3"
                  strokeWidth={2.4}
                  name="Registrations"
                />
                <Line
                  type="monotone"
                  dataKey="attendanceRate"
                  stroke="#0EA5A4"
                  strokeWidth={2.2}
                  name="Attendance Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Drop-off Funnel</h3>
            <p className="text-xs text-slate-500">
              Conversion from registration to attendance to feedback for dept events.
            </p>
          </div>

          {funnelData.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No funnel data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <FunnelChart>
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
                  {funnelData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Row 2: Category Performance + Student Segmentation */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Event Category Performance</h3>
            <p className="text-xs text-slate-500">
              Success score and attendance rate by category for {department} events.
            </p>
          </div>

          {bundle.events.categoryPerformance.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No category performance data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={bundle.events.categoryPerformance.slice(0, 8)}
                margin={{ top: 10, right: 12, left: -16, bottom: 26 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                <Bar dataKey="avgSuccessScore" radius={[6, 6, 0, 0]} fill="#154CB3" name="Success Score" />
                <Bar dataKey="attendanceRate" radius={[6, 6, 0, 0]} fill="#0EA5A4" name="Attendance Rate %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Student Segmentation</h3>
            <p className="text-xs text-slate-500">
              Active vs inactive {department} students with top engaged and at-risk cohorts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segmentationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={82}
                  >
                    {segmentationData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Top Engaged Students
                </p>
                <div className="mt-2 space-y-1.5">
                  {bundle.students.topEngaged.slice(0, 5).map((student) => (
                    <div
                      key={student.studentId}
                      className="rounded-md border border-slate-200 bg-slate-50 p-2"
                    >
                      <p className="text-xs font-semibold text-slate-800">{student.name}</p>
                      <p className="text-[11px] text-slate-600">
                        Score {student.engagementScore.toFixed(1)} • {student.attendedCount} attended
                      </p>
                    </div>
                  ))}
                  {bundle.students.topEngaged.length === 0 && (
                    <p className="text-xs text-slate-400">No engaged students found.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  At-Risk Students
                </p>
                <div className="mt-2 space-y-1.5">
                  {bundle.students.atRisk.slice(0, 4).map((student) => (
                    <div
                      key={student.studentId}
                      className="rounded-md border border-red-200 bg-red-50 p-2"
                    >
                      <p className="text-xs font-semibold text-red-800">{student.name}</p>
                      <p className="text-[11px] text-red-700">
                        {student.atRiskReason || "Low engagement risk"}
                      </p>
                    </div>
                  ))}
                  {bundle.students.atRisk.length === 0 && (
                    <p className="text-xs text-slate-400">No at-risk students detected.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Teacher Performance */}
      <SectionCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[#154CB3]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Teacher / Organiser Performance</h3>
              <p className="text-xs text-slate-500">
                All organisers in {department} — events run, registrations, and attendance outcomes.
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-slate-600">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              <span className="font-semibold text-slate-900">
                {bundle.teachers.teachers.summary.totalTeachers}
              </span>{" "}
              organisers
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              <span className="font-semibold text-slate-900">
                {bundle.teachers.teachers.summary.activeTeachers}
              </span>{" "}
              active
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              Avg{" "}
              <span className="font-semibold text-slate-900">
                {bundle.teachers.teachers.summary.avgAttendanceRate.toFixed(1)}%
              </span>{" "}
              attendance
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Name</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Events</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Registrations</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Attended</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Attendance %</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {bundle.teachers.teachers.byTeacher.map((teacher) => (
                <tr key={teacher.teacherId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{teacher.name}</p>
                    {teacher.email && (
                      <p className="text-[11px] text-slate-500">{teacher.email}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {teacher.eventsOrganized.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {teacher.totalRegistrations.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {teacher.totalAttended.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={classNames(
                        "rounded-full px-2 py-0.5 font-semibold",
                        teacher.avgAttendanceRate >= 70
                          ? "bg-emerald-100 text-emerald-700"
                          : teacher.avgAttendanceRate >= 40
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {toPercent(teacher.avgAttendanceRate)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {teacher.lastActiveAt
                      ? new Date(teacher.lastActiveAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
              {bundle.teachers.teachers.byTeacher.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                    No organisers found in {department}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Quick stats row */}
      <SectionCard>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#154CB3]" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Department Engagement Summary</h3>
            <p className="text-xs text-slate-500">Key behavioral metrics for {department} students.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Participation Rate
            </p>
            <p className="text-base font-bold text-slate-900">
              {toPercent(bundle.overview.stats?.participationRate ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Avg Events / Student
            </p>
            <p className="text-base font-bold text-slate-900">
              {(bundle.overview.stats?.avgEventsPerStudent ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Active : Inactive Ratio
            </p>
            <p className="text-base font-bold text-slate-900">{retentionSummary.activeRatio}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Retention Rate
            </p>
            <p className="text-base font-bold text-slate-900">
              {toPercent(retentionSummary.retentionRate)}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Insights Engine */}
      <SectionCard>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Insights Engine</h3>
            <p className="text-xs text-slate-500">
              Automated intelligence for {department} generated from live platform data.
            </p>
          </div>
          <Brain className="h-5 w-5 text-[#154CB3]" />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {bundle.overview.insights.map((insight) => (
            <InsightCard
              key={`${insight.title}-${insight.statement}`}
              tone={insight.type}
              title={insight.title}
              statement={insight.statement}
              confidence={insight.confidence}
            />
          ))}
          {bundle.overview.insights.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 xl:col-span-2">
              No insights generated for the selected range.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
