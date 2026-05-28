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
  Building2,
  CalendarRange,
  ChevronDown,
  Clock3,
  Download,
  GraduationCap,
  Layers,
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
  type AnalyticsQuery,
  type MasterAdminAnalyticsBundle,
} from "@/lib/masterAdminAnalyticsApi";
import { christCampuses, organizingSchools, getDepartmentOptionsForSchool } from "@/app/lib/eventFormSchema";
import {
  addStructuredSummarySheet,
  addStructuredTableSheet,
  addThemedChartsSheet,
  createThemedWorkbook,
  downloadWorkbook,
} from "@/lib/xlsxTheme";
import toast from "react-hot-toast";
import InfoHint from "./InfoHint";

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

function formatDate(dateValue: string | null | undefined): string {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-GB");
}

function formatDateTime(dateValue: string | null | undefined): string {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleString("en-GB");
}

function sanitizeFileSegment(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
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
  const [appliedCustomStart, setAppliedCustomStart] = useState("");
  const [appliedCustomEnd, setAppliedCustomEnd] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [appliedCampusFilter, setAppliedCampusFilter] = useState("");
  const [appliedSchoolFilter, setAppliedSchoolFilter] = useState("");
  const [appliedDeptFilter, setAppliedDeptFilter] = useState("");

  const [bundle, setBundle] = useState<MasterAdminAnalyticsBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo<AnalyticsQuery>(() => {
    const base: AnalyticsQuery =
      appliedCustomStart || appliedCustomEnd
        ? { start: appliedCustomStart || undefined, end: appliedCustomEnd || undefined }
        : { days: Number(preset) };
    if (appliedCampusFilter) base.campus = appliedCampusFilter;
    if (appliedSchoolFilter) base.school = appliedSchoolFilter;
    if (appliedDeptFilter) base.department = appliedDeptFilter;
    return base;
  }, [appliedCustomEnd, appliedCustomStart, preset, appliedCampusFilter, appliedSchoolFilter, appliedDeptFilter]);

  const canApplyCustomRange =
    Boolean(customStart) &&
    Boolean(customEnd) &&
    customStart <= customEnd &&
    (customStart !== appliedCustomStart || customEnd !== appliedCustomEnd);

  const canApplyFilters =
    campusFilter !== appliedCampusFilter ||
    schoolFilter !== appliedSchoolFilter ||
    deptFilter !== appliedDeptFilter;

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

  // Hierarchy (same logic as the create-event form): department options come
  // from the selected school's department list; with no school chosen, show
  // every department across all schools. The option value is the department
  // *label* — exactly what create-event stores in `organizing_dept`.
  const departmentOptionsForFilter = useMemo(() => {
    const list = schoolFilter
      ? getDepartmentOptionsForSchool(schoolFilter)
      : organizingSchools.flatMap((school) => getDepartmentOptionsForSchool(school.value));
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

  // Clear a selected department that doesn't belong to the newly chosen school.
  useEffect(() => {
    if (!schoolFilter || !deptFilter) return;
    const allowed = new Set(getDepartmentOptionsForSchool(schoolFilter).map((option) => option.label));
    if (!allowed.has(deptFilter)) setDeptFilter("");
  }, [schoolFilter, deptFilter]);

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

  const exportRangeLabel = useMemo(() => {
    if (!bundle) return "Selected timeline";
    return `${formatDate(bundle.overview.range.current.start)} to ${formatDate(bundle.overview.range.current.end)}`;
  }, [bundle]);

  const activeWindowLabel = useMemo(() => {
    if (appliedCustomStart && appliedCustomEnd) {
      return `Custom range: ${formatDate(appliedCustomStart)} to ${formatDate(appliedCustomEnd)}`;
    }
    return `${preset}-day window`;
  }, [appliedCustomEnd, appliedCustomStart, preset]);

  const handleExportXlsx = useCallback(async () => {
    if (!bundle) return;

    setIsExporting(true);

    try {
      const workbook = createThemedWorkbook("SOCIO Master Admin Analytics");
      const currentRange = bundle.overview.range.current;
      const previousRange = bundle.overview.range.previous;
      const activeTimeline =
        appliedCustomStart && appliedCustomEnd
          ? `Custom range (${formatDate(appliedCustomStart)} to ${formatDate(appliedCustomEnd)})`
          : `${preset} day preset`;

      addStructuredSummarySheet(workbook, {
        title: "SOCIO Intelligent Dashboard Export",
        subtitle: `Generated ${formatDateTime(bundle.overview.generatedAt)} · Active range: ${formatDate(currentRange.start)} to ${formatDate(currentRange.end)}`,
        sections: [
          {
            title: "Export Context",
            rows: [
              { label: "Dashboard", value: "Master Admin Data Explorer" },
              { label: "Selected Timeline", value: activeTimeline },
              { label: "Current Period", value: `${formatDate(currentRange.start)} to ${formatDate(currentRange.end)}` },
              { label: "Previous Period", value: `${formatDate(previousRange.start)} to ${formatDate(previousRange.end)}` },
            ],
          },
          {
            title: "KPI Snapshot",
            rows: bundle.overview.kpis.map((kpi) => ({
              label: kpi.label,
              value: `${kpi.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${kpi.unit} (${kpi.changePct >= 0 ? "+" : ""}${kpi.changePct.toFixed(1)}% vs previous)`,
            })),
          },
          {
            title: "Data Quality and Funnel",
            rows: [
              { label: "Students", value: bundle.overview.dataQuality.students },
              { label: "Events", value: bundle.overview.dataQuality.events },
              { label: "Registrations", value: bundle.overview.dataQuality.registrations },
              { label: "Current Period Registrations", value: bundle.overview.dataQuality.currentPeriodRegistrations },
              { label: "Registered Funnel", value: bundle.events.funnel.registered },
              { label: "Attended Funnel", value: bundle.events.funnel.attended },
              { label: "Feedback Funnel", value: bundle.events.funnel.feedback },
            ],
          },
          {
            title: "Student Behavior Signals",
            rows: [
              { label: "Retention Rate", value: toPercent(retentionSummary.retentionRate) },
              { label: "Drop Detection Rate", value: toPercent(retentionSummary.dropDetectionRate) },
              { label: "Average No-show Rate", value: toPercent(retentionSummary.averageNoShowRate) },
              { label: "Active : Inactive Ratio", value: retentionSummary.activeRatio },
              {
                label: "Peak Attendance Time",
                value: `${bundle.insights.peakAttendanceTime.day} at ${bundle.insights.peakAttendanceTime.hour}`,
              },
            ],
          },
        ],
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Monthly Trend",
        columns: [
          { header: "Month", key: "month", width: 18 },
          { header: "Registrations", key: "registrations", width: 16, kind: "number", horizontal: "right" },
          { header: "Attendance Rate %", key: "attendanceRate", width: 18, kind: "number", horizontal: "right" },
          { header: "Avg Engagement", key: "avgEngagement", width: 16, kind: "number", horizontal: "right" },
        ],
        rows: bundle.overview.monthlyTrend.map((item) => ({
          month: formatMonth(item.month),
          registrations: item.registrations,
          attendanceRate: item.attendanceRate,
          avgEngagement: item.avgEngagement,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Departments",
        columns: [
          { header: "Department", key: "department", width: 26 },
          { header: "Participation %", key: "participationRate", width: 16, kind: "number", horizontal: "right" },
          { header: "Events Hosted", key: "eventsHosted", width: 16, kind: "number", horizontal: "right" },
          { header: "Contribution %", key: "contributionIndex", width: 16, kind: "number", horizontal: "right" },
          { header: "Cross-Dept %", key: "crossDepartmentParticipationRate", width: 16, kind: "number", horizontal: "right" },
          { header: "Cross-Dept Participants", key: "crossDepartmentParticipants", width: 20, kind: "number", horizontal: "right" },
          { header: "Avg Engagement", key: "avgEngagementScore", width: 16, kind: "number", horizontal: "right" },
          { header: "Participating Students", key: "participatingStudents", width: 20, kind: "number", horizontal: "right" },
          { header: "Total Students", key: "totalStudents", width: 16, kind: "number", horizontal: "right" },
        ],
        rows: bundle.departments.departments.map((dept) => ({
          department: dept.department,
          participationRate: dept.participationRate,
          eventsHosted: dept.eventsHosted,
          contributionIndex: dept.contributionIndex,
          crossDepartmentParticipationRate: dept.crossDepartmentParticipationRate,
          crossDepartmentParticipants: dept.crossDepartmentParticipants,
          avgEngagementScore: dept.avgEngagementScore,
          participatingStudents: dept.participatingStudents,
          totalStudents: dept.totalStudents,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Event Performance",
        columns: [
          { header: "Event Title", key: "title", width: 34 },
          { header: "Category", key: "category", width: 18 },
          { header: "Department", key: "department", width: 22 },
          { header: "Registrations", key: "registrations", width: 14, kind: "number", horizontal: "right" },
          { header: "Attended", key: "attended", width: 12, kind: "number", horizontal: "right" },
          { header: "Attendance Rate %", key: "attendanceRate", width: 16, kind: "number", horizontal: "right" },
          { header: "Avg Feedback", key: "avgFeedback", width: 14, kind: "number", horizontal: "right" },
          { header: "Repeat Participation %", key: "repeatParticipation", width: 20, kind: "number", horizontal: "right" },
          { header: "Success Score", key: "successScore", width: 14, kind: "number", horizontal: "right" },
        ],
        rows: bundle.events.attendanceByEvent.map((event) => ({
          title: event.title,
          category: event.category,
          department: event.department,
          registrations: event.registrations,
          attended: event.attended,
          attendanceRate: event.attendanceRate,
          avgFeedback: event.avgFeedback,
          repeatParticipation: event.repeatParticipation,
          successScore: event.successScore,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Categories",
        columns: [
          { header: "Category", key: "category", width: 24 },
          { header: "Events", key: "events", width: 12, kind: "number", horizontal: "right" },
          { header: "Popularity Index", key: "popularityIndex", width: 18, kind: "number", horizontal: "right" },
          { header: "Attendance Rate %", key: "attendanceRate", width: 18, kind: "number", horizontal: "right" },
          { header: "Avg Feedback", key: "avgFeedback", width: 14, kind: "number", horizontal: "right" },
          { header: "Avg Success Score", key: "avgSuccessScore", width: 18, kind: "number", horizontal: "right" },
        ],
        rows: bundle.events.categoryPerformance.map((category) => ({
          category: category.category,
          events: category.events,
          popularityIndex: category.popularityIndex,
          attendanceRate: category.attendanceRate,
          avgFeedback: category.avgFeedback,
          avgSuccessScore: category.avgSuccessScore,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Top Engaged Students",
        columns: [
          { header: "Name", key: "name", width: 28 },
          { header: "Department", key: "department", width: 22 },
          { header: "Year", key: "year", width: 10 },
          { header: "Engagement Score", key: "engagementScore", width: 18, kind: "number", horizontal: "right" },
          { header: "Attended", key: "attendedCount", width: 12, kind: "number", horizontal: "right" },
          { header: "Organized", key: "organizedCount", width: 12, kind: "number", horizontal: "right" },
          { header: "No-shows", key: "noShows", width: 12, kind: "number", horizontal: "right" },
          { header: "No-show Rate %", key: "noShowRate", width: 16, kind: "number", horizontal: "right" },
        ],
        rows: bundle.students.topEngaged.map((student) => ({
          name: student.name,
          department: student.department,
          year: student.year,
          engagementScore: student.engagementScore,
          attendedCount: student.attendedCount,
          organizedCount: student.organizedCount,
          noShows: student.noShows,
          noShowRate: student.noShowRate,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "At Risk Students",
        columns: [
          { header: "Name", key: "name", width: 28 },
          { header: "Department", key: "department", width: 22 },
          { header: "Year", key: "year", width: 10 },
          { header: "Engagement Score", key: "engagementScore", width: 18, kind: "number", horizontal: "right" },
          { header: "Attended", key: "attendedCount", width: 12, kind: "number", horizontal: "right" },
          { header: "Organized", key: "organizedCount", width: 12, kind: "number", horizontal: "right" },
          { header: "No-shows", key: "noShows", width: 12, kind: "number", horizontal: "right" },
          { header: "No-show Rate %", key: "noShowRate", width: 16, kind: "number", horizontal: "right" },
          { header: "Engagement Drop %", key: "engagementDrop", width: 18, kind: "number", horizontal: "right" },
          { header: "Risk Reason", key: "atRiskReason", width: 36 },
          { header: "Last Activity", key: "lastActivityAt", width: 16 },
        ],
        rows: bundle.students.atRisk.map((student) => ({
          name: student.name,
          department: student.department,
          year: student.year,
          engagementScore: student.engagementScore,
          attendedCount: student.attendedCount,
          organizedCount: student.organizedCount,
          noShows: student.noShows,
          noShowRate: student.noShowRate,
          engagementDrop: student.engagementDrop,
          atRiskReason: student.atRiskReason ?? "",
          lastActivityAt: formatDate(student.lastActivityAt),
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Engagement Scores",
        columns: [
          { header: "Name", key: "name", width: 28 },
          { header: "Department", key: "department", width: 22 },
          { header: "Year", key: "year", width: 10 },
          { header: "Status", key: "status", width: 12 },
          { header: "Registered", key: "registeredCount", width: 12, kind: "number", horizontal: "right" },
          { header: "Attended", key: "attendedCount", width: 12, kind: "number", horizontal: "right" },
          { header: "Organized", key: "organizedCount", width: 12, kind: "number", horizontal: "right" },
          { header: "No-shows", key: "noShows", width: 12, kind: "number", horizontal: "right" },
          { header: "No-show Rate %", key: "noShowRate", width: 16, kind: "number", horizontal: "right" },
          { header: "Engagement Score", key: "engagementScore", width: 18, kind: "number", horizontal: "right" },
          { header: "Engagement Drop %", key: "engagementDrop", width: 18, kind: "number", horizontal: "right" },
          { header: "Last Activity", key: "lastActivityAt", width: 16 },
        ],
        rows: bundle.students.engagementScores.map((student) => ({
          name: student.name,
          department: student.department,
          year: student.year,
          status: student.status,
          registeredCount: student.registeredCount,
          attendedCount: student.attendedCount,
          organizedCount: student.organizedCount,
          noShows: student.noShows,
          noShowRate: student.noShowRate,
          engagementScore: student.engagementScore,
          engagementDrop: student.engagementDrop,
          lastActivityAt: formatDate(student.lastActivityAt),
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Timing Efficiency",
        columns: [
          { header: "Slot", key: "slot", width: 24 },
          { header: "Day", key: "day", width: 16 },
          { header: "Hour", key: "hour", width: 14 },
          { header: "Registrations", key: "registrations", width: 14, kind: "number", horizontal: "right" },
          { header: "Attended", key: "attended", width: 12, kind: "number", horizontal: "right" },
          { header: "Attendance Rate %", key: "attendanceRate", width: 16, kind: "number", horizontal: "right" },
        ],
        rows: bundle.insights.timingEfficiency.map((slot) => ({
          slot: slot.slot,
          day: slot.day,
          hour: slot.hour,
          registrations: slot.registrations,
          attended: slot.attended,
          attendanceRate: slot.attendanceRate,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Insights",
        columns: [
          { header: "Type", key: "type", width: 16 },
          { header: "Title", key: "title", width: 28 },
          { header: "Statement", key: "statement", width: 60 },
          { header: "Confidence", key: "confidence", width: 14 },
        ],
        rows: bundle.insights.insights.map((insight) => ({
          type: insight.type,
          title: insight.title,
          statement: insight.statement,
          confidence: insight.confidence,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Attendance Predictions",
        columns: [
          { header: "Event", key: "title", width: 34 },
          { header: "Event Date", key: "eventDate", width: 16 },
          { header: "Predicted Attendance %", key: "predictedAttendanceRate", width: 22, kind: "number", horizontal: "right" },
          { header: "Predicted Drop-off Risk %", key: "predictedDropOffRisk", width: 24, kind: "number", horizontal: "right" },
          { header: "Confidence", key: "confidence", width: 14 },
          { header: "Heuristic", key: "heuristic", width: 48 },
        ],
        rows: bundle.insights.predictions.attendancePrediction.map((prediction) => ({
          title: prediction.title,
          eventDate: formatDate(prediction.eventDate),
          predictedAttendanceRate: prediction.predictedAttendanceRate,
          predictedDropOffRisk: prediction.predictedDropOffRisk,
          confidence: prediction.confidence,
          heuristic: prediction.heuristic,
        })),
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Drop-off Predictions",
        columns: [
          { header: "Event", key: "title", width: 34 },
          { header: "Event Date", key: "eventDate", width: 16 },
          { header: "Risk Score %", key: "riskScore", width: 16, kind: "number", horizontal: "right" },
          { header: "Confidence", key: "confidence", width: 14 },
          { header: "Rationale", key: "rationale", width: 52 },
        ],
        rows: bundle.insights.predictions.dropOffPrediction.map((prediction) => ({
          title: prediction.title,
          eventDate: formatDate(prediction.eventDate),
          riskScore: prediction.riskScore,
          confidence: prediction.confidence,
          rationale: prediction.rationale,
        })),
      });

      addThemedChartsSheet(workbook, {
        title: "Dashboard Visual Overview",
        subtitle: `Trend and student segmentation for ${exportRangeLabel}`,
        sheetName: "Charts Overview",
        primaryChart: {
          title: "Monthly Registrations",
          type: "line",
          data: bundle.overview.monthlyTrend.map((item) => ({
            label: formatMonth(item.month),
            value: item.registrations,
          })),
        },
        secondaryChart: {
          title: "Student Segmentation",
          type: "donut",
          data: [
            { label: "Active", value: bundle.students.segmentation.active, color: "#154CB3" },
            { label: "Inactive", value: bundle.students.segmentation.inactive, color: "#E2E8F0" },
          ],
        },
      });

      addThemedChartsSheet(workbook, {
        title: "Performance Visual Overview",
        subtitle: `Category popularity and department contribution for ${exportRangeLabel}`,
        sheetName: "Charts Performance",
        primaryChart: {
          title: "Popularity by Category",
          type: "bar",
          data: bundle.events.categoryPerformance.slice(0, 10).map((category) => ({
            label: category.category,
            value: category.popularityIndex,
          })),
        },
        secondaryChart: {
          title: "Department Contribution Index",
          type: "bar",
          data: bundle.departments.departments.slice(0, 10).map((dept) => ({
            label: dept.department,
            value: dept.contributionIndex,
          })),
        },
      });

      const fileName = `master_admin_analytics_${sanitizeFileSegment(currentRange.start.slice(0, 10))}_to_${sanitizeFileSegment(currentRange.end.slice(0, 10))}.xlsx`;
      await downloadWorkbook(workbook, fileName);
      toast.success("Analytics dashboard exported successfully.");
    } catch (err) {
      console.error("Failed to export analytics dashboard:", err);
      toast.error(err instanceof Error ? err.message : "Failed to export analytics dashboard.");
    } finally {
      setIsExporting(false);
    }
  }, [appliedCustomEnd, appliedCustomStart, bundle, exportRangeLabel, preset]);

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
      <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#f3f7ff_100%)] p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold tracking-tight text-slate-900">Analytics Data Explorer</p>
                <InfoHint
                  label="Analytics Data Explorer"
                  text="Explore participation, event quality, and student behavior without jumping between separate reports."
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                  {activeWindowLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  Snapshot: {new Date(bundle.overview.generatedAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void loadAnalytics(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCw className={classNames("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                  Refresh
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Filter By</p>
                    <InfoHint
                      size="sm"
                      label="Filter By"
                      text="Drill down by campus, then school, then department."
                    />
                  </div>
                  {(campusFilter || schoolFilter || deptFilter || appliedCampusFilter || appliedSchoolFilter || appliedDeptFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCampusFilter("");
                        setSchoolFilter("");
                        setDeptFilter("");
                        setAppliedCampusFilter("");
                        setAppliedSchoolFilter("");
                        setAppliedDeptFilter("");
                      }}
                      className="text-xs font-semibold text-[#154CB3] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Campus</label>
                    <div className="relative flex items-center rounded-xl border border-slate-200 bg-white">
                      <Building2 className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={campusFilter}
                        onChange={(event) => setCampusFilter(event.target.value)}
                        aria-label="Campus filter"
                        className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-9 pr-8 text-xs text-slate-700 outline-none"
                      >
                        <option value="">All Campuses</option>
                        {christCampuses.map((campus) => (
                          <option key={campus} value={campus}>
                            {campus}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">School</label>
                    <div className="relative flex items-center rounded-xl border border-slate-200 bg-white">
                      <GraduationCap className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={schoolFilter}
                        onChange={(event) => setSchoolFilter(event.target.value)}
                        aria-label="School filter"
                        className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-9 pr-8 text-xs text-slate-700 outline-none"
                      >
                        <option value="">All Schools</option>
                        {organizingSchools.map((school) => (
                          <option key={school.value} value={school.value}>
                            {school.label}
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
                        onChange={(event) => setDeptFilter(event.target.value)}
                        aria-label="Department filter"
                        className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-9 pr-8 text-xs text-slate-700 outline-none"
                      >
                        <option value="">All Departments</option>
                        {departmentOptionsForFilter.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCampusFilter(campusFilter);
                      setAppliedSchoolFilter(schoolFilter);
                      setAppliedDeptFilter(deptFilter);
                    }}
                    disabled={!canApplyFilters}
                    className={classNames(
                      "rounded-xl px-4 py-2 text-xs font-semibold transition-colors",
                      canApplyFilters
                        ? "bg-[#154CB3] text-white hover:bg-[#0f3f95]"
                        : "cursor-not-allowed bg-slate-200 text-slate-400"
                    )}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Custom Range</p>
                  <InfoHint
                    size="sm"
                    label="Custom Range"
                    text="Choose exact dates and apply once ready."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportXlsx();
                    }}
                    disabled={isExporting}
                    className={classNames(
                      "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors",
                      isExporting
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Download className={classNames("h-3.5 w-3.5", isExporting && "animate-pulse")} />
                    {isExporting ? "Exporting..." : "Export XLSX"}
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-end">
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <input
                        type="date"
                        value={customStart}
                        onChange={(event) => setCustomStart(event.target.value)}
                        className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="hidden text-xs font-medium text-slate-400 sm:block">to</div>

                  <div className="min-w-0">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(event) => setCustomEnd(event.target.value)}
                        className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCustomStart(customStart);
                      setAppliedCustomEnd(customEnd);
                    }}
                    disabled={!canApplyCustomRange}
                    className={classNames(
                      "h-fit rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors sm:self-end",
                      canApplyCustomRange
                        ? "bg-[#154CB3] text-white hover:bg-[#0f3f95]"
                        : "cursor-not-allowed bg-slate-200 text-slate-400"
                    )}
                  >
                    Apply Range
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Range</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(["30", "90", "180", "365"] as DatePreset[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setPreset(value);
                        setCustomStart("");
                        setCustomEnd("");
                        setAppliedCustomStart("");
                        setAppliedCustomEnd("");
                      }}
                      className={classNames(
                        "min-w-[64px] rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all",
                        preset === value && !appliedCustomStart && !appliedCustomEnd
                          ? "border-[#154CB3] bg-[#154CB3] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      )}
                    >
                      {value} Days
                    </button>
                  ))}
                </div>
              </div>
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Monthly Engagement Trend</h3>
              <InfoHint
                label="Monthly Engagement Trend"
                text="Tracks registrations, attendance quality, and momentum for strategic planning."
              />
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
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Drop-off Funnel</h3>
            <InfoHint
              label="Drop-off Funnel"
              text="Shows conversion from registration to attendance to feedback completion."
            />
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

      <div className="grid grid-cols-1 gap-6">
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Event Category Performance</h3>
            <InfoHint
              label="Event Category Performance"
              text="Compares category-level success and helps prioritize programming strategy."
            />
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Department Analytics</h3>
            <InfoHint
              label="Department Analytics"
              text="Participation rates, hosted events, and engagement score by department."
            />
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Insights Engine</h3>
              <InfoHint
                label="Insights Engine"
                text="Automated intelligence generated from live platform data."
              />
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
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Advanced Analytics Graphs</h3>
            <InfoHint
              label="Advanced Analytics Graphs"
              text="Student engagement, event performance, departments, timing behavior, and retention intelligence."
            />
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
