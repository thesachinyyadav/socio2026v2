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
  CalendarRange,
  Clock3,
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
  fetchMasterAdminAnalytics,
  type AnalyticsKpi,
  type MasterAdminAnalyticsBundle,
} from "@/lib/masterAdminAnalyticsApi";

type DatePreset = "30" | "90" | "180" | "365";

type InsightTone = "risk" | "opportunity";

const KPI_ICONS: Record<string, React.ElementType> = {
  participationRate: Users,
  attendanceRate: Target,
  dropOffRate: TrendingDown,
  avgEventsPerStudent: Activity,
  activeStudentsPct: TrendingUp,
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

function InsightCard({ tone, title, statement, confidence }: { tone: InsightTone; title: string; statement: string; confidence: "low" | "medium" | "high" }) {
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
        <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", confidencePill(confidence))}>
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
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={classNames("rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40", className)}>{children}</div>;
}

export default function DataExplorerDashboard() {
  const [preset, setPreset] = useState<DatePreset>("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [bundle, setBundle] = useState<MasterAdminAnalyticsBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    if (customStart || customEnd) {
      return {
        start: customStart || undefined,
        end: customEnd || undefined,
      };
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

        const response = await fetchMasterAdminAnalytics(query);
        setBundle(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load analytics dashboard.");
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

  const monthlyTrend = useMemo(
    () =>
      (bundle?.overview.monthlyTrend ?? []).map((item) => ({
        ...item,
        monthLabel: formatMonth(item.month),
      })),
    [bundle?.overview.monthlyTrend]
  );

  const funnelData = useMemo(() => {
    const funnel = bundle?.events.funnel;
    if (!funnel) return [];
    return [
      { name: "Registered", value: funnel.registered },
      { name: "Attended", value: funnel.attended },
      { name: "Feedback", value: funnel.feedback },
    ];
  }, [bundle?.events.funnel]);

  const segmentationData = useMemo(() => {
    const segmentation = bundle?.students.segmentation;
    if (!segmentation) return [];
    return [
      { name: "Active", value: segmentation.active },
      { name: "Inactive", value: segmentation.inactive },
    ];
  }, [bundle?.students.segmentation]);

  const eventPerformanceGraph = useMemo(
    () =>
      (bundle?.events.attendanceByEvent ?? []).slice(0, 8).map((event) => ({
        name: event.title.length > 18 ? `${event.title.slice(0, 18)}…` : event.title,
        attendanceRate: event.attendanceRate,
        successScore: event.successScore,
        dropOffRate: Math.max(0, 100 - event.attendanceRate),
      })),
    [bundle?.events.attendanceByEvent]
  );

  const categoryPopularityGraph = useMemo(
    () =>
      (bundle?.events.categoryPerformance ?? []).slice(0, 8).map((category) => ({
        category: category.category,
        popularityIndex: category.popularityIndex,
        attendanceRate: category.attendanceRate,
      })),
    [bundle?.events.categoryPerformance]
  );

  const departmentContributionGraph = useMemo(
    () =>
      (bundle?.departments.departments ?? []).slice(0, 10).map((dept) => ({
        department: dept.department,
        participationRate: dept.participationRate,
        contributionIndex: dept.contributionIndex,
        crossDepartmentParticipationRate: dept.crossDepartmentParticipationRate,
      })),
    [bundle?.departments.departments]
  );

  const timingEfficiencyGraph = useMemo(
    () => (bundle?.insights.timingEfficiency ?? []).slice(0, 8),
    [bundle?.insights.timingEfficiency]
  );

  const noShowGraph = useMemo(
    () =>
      (bundle?.students.engagementScores ?? [])
        .slice()
        .sort((a, b) => b.noShowRate - a.noShowRate)
        .slice(0, 8)
        .map((student) => ({
          name: student.name.length > 16 ? `${student.name.slice(0, 16)}…` : student.name,
          noShowRate: student.noShowRate,
          engagementDrop: student.engagementDrop,
        })),
    [bundle?.students.engagementScores]
  );

  const retentionSummary = useMemo(() => {
    const behavior = bundle?.students.behavior;
    return {
      retentionRate: behavior?.retentionRate ?? 0,
      dropDetectionRate: behavior?.dropDetectionRate ?? 0,
      averageNoShowRate: behavior?.averageNoShowRate ?? 0,
      activeRatio: bundle?.students.segmentation.active
        ? (bundle.students.segmentation.active / Math.max(bundle.students.segmentation.inactive, 1)).toFixed(2)
        : "0.00",
    };
  }, [bundle?.students.behavior, bundle?.students.segmentation.active, bundle?.students.segmentation.inactive]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-14 text-center shadow-sm shadow-slate-200/40">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#154CB3]" />
        <p className="text-sm font-semibold text-slate-700">Building analytics intelligence layer...</p>
        <p className="mt-1 text-xs text-slate-500">Preparing engagement, event, and behavior data views.</p>
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
          onClick={() => {
            void loadAnalytics(false);
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="sticky top-3 z-20 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">Socio Engagement Intelligence</p>
            <p className="mt-1 text-xs text-slate-500">Master admin data explorer for participation, performance, behavior, and growth planning.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Data Snapshot</p>
              <p className="text-xs font-medium text-slate-700">{new Date(bundle.overview.generatedAt).toLocaleString()}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadAnalytics(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className={classNames("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_minmax(300px,420px)]">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Window</label>
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
                    preset === value && !customStart && !customEnd ? "bg-[#154CB3] text-white" : "text-slate-600 hover:bg-white"
                  )}
                >
                  {value}D
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Custom Range</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {bundle.overview.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Engagement Trend</h3>
              <p className="text-xs text-slate-500">Tracks registrations, attendance quality, and momentum for strategic planning.</p>
            </div>
            <span className={classNames("rounded-full px-2 py-1 text-xs font-semibold", bundle.overview.growthRate >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
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
                <Line type="monotone" dataKey="registrations" stroke="#154CB3" strokeWidth={2.4} name="Registrations" />
                <Line type="monotone" dataKey="attendanceRate" stroke="#0EA5A4" strokeWidth={2.2} name="Attendance Rate %" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Drop-off Funnel</h3>
            <p className="text-xs text-slate-500">Shows conversion from registration to attendance to feedback completion.</p>
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Event Category Performance</h3>
            <p className="text-xs text-slate-500">Compares category-level success and helps prioritize programming strategy.</p>
          </div>

          {bundle.events.categoryPerformance.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No category performance data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bundle.events.categoryPerformance.slice(0, 8)} margin={{ top: 10, right: 12, left: -16, bottom: 26 }}>
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
            <p className="text-xs text-slate-500">Active vs inactive students, with top engaged and at-risk cohorts.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={segmentationData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82}>
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
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top Engaged Students</p>
                <div className="mt-2 space-y-1.5">
                  {bundle.students.topEngaged.slice(0, 5).map((student) => (
                    <div key={student.studentId} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <p className="text-xs font-semibold text-slate-800">{student.name}</p>
                      <p className="text-[11px] text-slate-600">
                        {student.department} • Score {student.engagementScore.toFixed(1)}
                      </p>
                    </div>
                  ))}
                  {bundle.students.topEngaged.length === 0 && <p className="text-xs text-slate-400">No engaged students found.</p>}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">At-Risk Students</p>
                <div className="mt-2 space-y-1.5">
                  {bundle.students.atRisk.slice(0, 5).map((student) => (
                    <div key={student.studentId} className="rounded-md border border-red-200 bg-red-50 p-2">
                      <p className="text-xs font-semibold text-red-800">{student.name}</p>
                      <p className="text-[11px] text-red-700">{student.atRiskReason || "Low engagement risk"}</p>
                    </div>
                  ))}
                  {bundle.students.atRisk.length === 0 && <p className="text-xs text-slate-400">No at-risk students detected.</p>}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Department Analytics</h3>
            <p className="text-xs text-slate-500">Participation rates, hosted events, and engagement score by department.</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[650px] text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider">Department</th>
                  <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider">Participation</th>
                  <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider">Events Hosted</th>
                  <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider">Engagement</th>
                  <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider">Students</th>
                </tr>
              </thead>
              <tbody>
                {bundle.departments.departments.slice(0, 10).map((dept) => (
                  <tr key={dept.department} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-800">{dept.department}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{toPercent(dept.participationRate)}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{dept.eventsHosted.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{dept.avgEngagementScore.toFixed(1)}</td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {dept.participatingStudents.toLocaleString()} / {dept.totalStudents.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {bundle.departments.departments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-12 text-center text-slate-400">
                      No department analytics available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Insights Engine</h3>
              <p className="text-xs text-slate-500">Automated intelligence generated from live platform data.</p>
            </div>
            <Brain className="h-5 w-5 text-[#154CB3]" />
          </div>

          <div className="space-y-3">
            {bundle.insights.insights.map((insight) => (
              <InsightCard
                key={`${insight.title}-${insight.statement}`}
                tone={insight.type}
                title={insight.title}
                statement={insight.statement}
                confidence={insight.confidence}
              />
            ))}
            {bundle.insights.insights.length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                No insights generated for the selected range.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#154CB3]" />
              <p className="text-xs font-semibold text-slate-800">Peak Attendance Time</p>
            </div>
            <p className="text-xs text-slate-600">
              {bundle.insights.peakAttendanceTime.day} at {bundle.insights.peakAttendanceTime.hour} ({bundle.insights.peakAttendanceTime.attendedCount.toLocaleString()} attended records)
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#154CB3]" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Advanced Analytics Graphs</h3>
            <p className="text-xs text-slate-500">Student engagement, event performance, departments, timing behavior, and retention intelligence.</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Participation Rate</p>
            <p className="text-base font-bold text-slate-900">{toPercent(bundle.overview.stats.participationRate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Events / Student</p>
            <p className="text-base font-bold text-slate-900">{bundle.overview.stats.avgEventsPerStudent.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active : Inactive Ratio</p>
            <p className="text-base font-bold text-slate-900">{retentionSummary.activeRatio}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Retention Rate</p>
            <p className="text-base font-bold text-slate-900">{toPercent(retentionSummary.retentionRate)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Event Performance (Attendance, Success, Drop-off)</p>
            {eventPerformanceGraph.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-400">No event performance data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={eventPerformanceGraph} margin={{ top: 8, right: 8, left: -14, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} angle={-20} textAnchor="end" height={52} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                  <Bar dataKey="attendanceRate" fill="#154CB3" radius={[4, 4, 0, 0]} name="Attendance Rate %" />
                  <Bar dataKey="successScore" fill="#0EA5A4" radius={[4, 4, 0, 0]} name="Success Score" />
                  <Bar dataKey="dropOffRate" fill="#EF4444" radius={[4, 4, 0, 0]} name="Drop-off Rate %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Popularity Index by Category</p>
            {categoryPopularityGraph.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-400">No category popularity data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={categoryPopularityGraph} margin={{ top: 8, right: 8, left: -14, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                  <Line type="monotone" dataKey="popularityIndex" stroke="#154CB3" strokeWidth={2.2} name="Popularity Index" />
                  <Line type="monotone" dataKey="attendanceRate" stroke="#0EA5A4" strokeWidth={2.1} name="Attendance Rate %" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Department Participation, Contribution, Cross-Dept</p>
            {departmentContributionGraph.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-400">No department analytics available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={departmentContributionGraph} margin={{ top: 8, right: 8, left: -14, bottom: 34 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 10, fill: "#64748b" }} angle={-20} textAnchor="end" height={55} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                  <Bar dataKey="participationRate" fill="#154CB3" radius={[4, 4, 0, 0]} name="Dept Participation %" />
                  <Bar dataKey="contributionIndex" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Contribution Index %" />
                  <Bar dataKey="crossDepartmentParticipationRate" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Cross-Dept Participation %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Timing Efficiency by Peak Slots</p>
            {timingEfficiencyGraph.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-400">No timing efficiency data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={timingEfficiencyGraph} margin={{ top: 8, right: 8, left: -14, bottom: 38 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="slot" tick={{ fontSize: 10, fill: "#64748b" }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                  <Bar dataKey="attendanceRate" fill="#0EA5A4" radius={[4, 4, 0, 0]} name="Slot Attendance Rate %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Seasonal Trend and Growth</p>
            {monthlyTrend.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-400">No seasonal trend data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -14, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                  <Line type="monotone" dataKey="registrations" stroke="#154CB3" strokeWidth={2.2} name="Registrations" />
                  <Line type="monotone" dataKey="attendanceRate" stroke="#22C55E" strokeWidth={2.1} name="Attendance Rate %" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">No-Show and Engagement Drop Detection</p>
            {noShowGraph.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-400">No student behavior data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={noShowGraph} margin={{ top: 8, right: 8, left: -14, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} angle={-20} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                  <Bar dataKey="noShowRate" fill="#EF4444" radius={[4, 4, 0, 0]} name="No-show Rate %" />
                  <Bar dataKey="engagementDrop" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Engagement Drop %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Average No-show Rate</p>
            <p className="text-base font-bold text-slate-900">{toPercent(retentionSummary.averageNoShowRate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Drop Detection Rate</p>
            <p className="text-base font-bold text-slate-900">{toPercent(retentionSummary.dropDetectionRate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Peak Engagement Time</p>
            <p className="text-base font-bold text-slate-900">{bundle.insights.peakAttendanceTime.day} • {bundle.insights.peakAttendanceTime.hour}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
