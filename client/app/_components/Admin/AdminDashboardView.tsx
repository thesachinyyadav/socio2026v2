"use client";

import React, { useMemo, useState, useCallback } from "react";

const CAMPUSES = [
  "Central Campus (Main)",
  "Bannerghatta Road Campus",
  "Yeshwanthpur Campus",
  "Kengeri Campus",
  "Delhi NCR Campus",
  "Pune Lavasa Campus"
];
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  CalendarDays,
  ClipboardList,
  BarChart2,
  IndianRupee,
  Download,
  ChevronDown,
  CalendarRange,
  Building2,
  UserPlus,
  Calendar,
  Zap,
  Plus,
  History,
} from "lucide-react";
import OrganiserHistoryModal from "./OrganiserHistoryModal";
import {
  addThemedChartsSheet,
  addStructuredSummarySheet,
  addStructuredTableSheet,
  createThemedWorkbook,
  downloadWorkbook,
} from "@/lib/xlsxTheme";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: number;
  email: string;
  name: string;
  is_organiser: boolean;
  is_support: boolean;
  is_masteradmin: boolean;
  created_at: string;
  campus?: string | null;
}
interface Event {
  event_id: string;
  title: string;
  organizing_dept: string;
  event_date: string;
  created_by: string;
  created_at: string;
  registration_fee: number;
  registration_count?: number;
}
interface Fest {
  fest_id: string;
  fest_title: string;
  organizing_dept: string;
  opening_date: string;
  created_by: string;
  created_at: string;
  registration_count?: number;
}
interface Registration {
  registration_id: string;
  event_id: string;
  registration_type: string;
  created_at: string;
  user_email?: string;
  teammates?: any[];
}

type DateRange = "7d" | "30d" | "90d" | "1y" | "all";
type ChartTab = "registrations" | "events" | "department";

interface Props {
  users: User[];
  events: Event[];
  fests: Fest[];
  registrations: Registration[];
  onViewPerformanceInsights?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY = "#154cb3";
const PRICING_COLORS = ["#154cb3", "#e2e8f0"];
const ROLE_COLORS = ["#154cb3", "#10b981", "#f59e0b", "#8b5cf6"];
const PRICING_COLOR_CLASSES = ["bg-[#154cb3]", "bg-[#e2e8f0]"];
const ROLE_COLOR_CLASSES = ["bg-[#154cb3]", "bg-[#10b981]", "bg-[#f59e0b]", "bg-[#8b5cf6]"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateCutoff(range: DateRange): Date {
  if (range === "all") return new Date(0); // Epoch
  const now = new Date();
  const days: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  return new Date(now.getTime() - (days[range] || 0) * 86400000);
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const content = [headers, ...rows].map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const GrowthBadge = ({ value }: { value: number }) => {
  const isUp = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
        isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      }`}
    >
      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {isUp ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
};

// Mini sparkline bar (5-bar preview inside KPI cards)
const MiniBarChart = ({ data, color = PRIMARY }: { data: number[]; color?: string }) => {
  const chartData = data.map((value, index) => ({
    index,
    value,
    fill: index === data.length - 1 ? color : `${color}4d`,
  }));

  return (
    <div className="h-7 w-14">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-slate-900 mb-1">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} className="text-xs text-[#154cb3]">
          {e.name}: <span className="font-bold">{e.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboardView({
  users,
  events,
  fests,
  registrations,
  onViewPerformanceInsights,
}: Props) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [chartTab, setChartTab] = useState<ChartTab>("registrations");
  const [campusFilter, setCampusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedOrganiser, setSelectedOrganiser] = useState<string | null>(null);

  const openOrganiserHistory = useCallback((email?: string | null) => {
    if (email) {
      setSelectedOrganiser(email);
    }
    setIsHistoryModalOpen(true);
  }, []);

  const closeOrganiserHistory = useCallback(() => {
    setIsHistoryModalOpen(false);
    setSelectedOrganiser(null);
  }, []);

  const handleOrganiserSelection = useCallback((email: string | null) => {
    setSelectedOrganiser(email);
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const cutoff = useMemo(() => (startDate ? new Date(startDate) : getDateCutoff(dateRange)), [dateRange, startDate]);
  const endCutoff = useMemo(() => (endDate ? new Date(endDate) : null), [endDate]);
  const prevCutoff = useMemo(() => {
    const days: Record<DateRange, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650 };
    const d = days[dateRange];
    const now = new Date();
    return { start: new Date(now.getTime() - 2 * d * 86400000), end: cutoff };
  }, [dateRange, cutoff]);

  const campuses = useMemo(() => {
    const fromUsers = users.map((u) => u.campus).filter(Boolean) as string[];
    return Array.from(new Set([...CAMPUSES, ...fromUsers])).sort();
  }, [users]);
  const allDepts = useMemo(() => Array.from(new Set(events.map((e) => e.organizing_dept).filter(Boolean) as string[])).sort(), [events]);

  // Filtered data
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const d = new Date(e.created_at);
      const ok = d >= cutoff && (!endCutoff || d <= endCutoff);
      
      const matchCampus = campusFilter === "all" || (() => {
        const campusUsers = new Set(users.filter((u) => u.campus === campusFilter).map((u) => u.email));
        return campusUsers.has(e.created_by);
      })();

      const matchDept = deptFilter === "all" || e.organizing_dept === deptFilter;

      return ok && matchCampus && matchDept;
    });
  }, [events, cutoff, endCutoff, campusFilter, deptFilter, users]);

  const filteredRegs = useMemo(
    () => registrations.filter((r) => new Date(r.created_at) >= cutoff && (!endCutoff || new Date(r.created_at) <= endCutoff)),
    [registrations, cutoff, endCutoff]
  );

  const filteredUsers = useMemo(() => users.filter((u) => new Date(u.created_at) >= cutoff), [users, cutoff]);

  // Previous period
  const prevEvents = useMemo(
    () => events.filter((e) => { const d = new Date(e.created_at); return d >= prevCutoff.start && d < prevCutoff.end; }),
    [events, prevCutoff]
  );
  const prevRegs = useMemo(
    () => registrations.filter((r) => { const d = new Date(r.created_at); return d >= prevCutoff.start && d < prevCutoff.end; }),
    [registrations, prevCutoff]
  );
  const prevUsers = useMemo(
    () => users.filter((u) => { const d = new Date(u.created_at); return d >= prevCutoff.start && d < prevCutoff.end; }),
    [users, prevCutoff]
  );

  const growthPct = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

  const totalRevenue = useMemo(
    () => filteredEvents.reduce((s, e) => s + (e.registration_fee || 0) * (e.registration_count || 0), 0),
    [filteredEvents]
  );
  const avgPerEvent = filteredEvents.length > 0 ? (filteredRegs.length / filteredEvents.length).toFixed(1) : "0";

  // Sparklines (last 7 days per day)
  const spark = useCallback((items: { created_at: string }[]) => {
    const buckets = Array(7).fill(0);
    const now = Date.now();
    items.forEach((i) => {
      const diff = now - new Date(i.created_at).getTime();
      const dayIdx = Math.floor(diff / 86400000);
      if (dayIdx >= 0 && dayIdx < 7) buckets[6 - dayIdx]++;
    });
    return buckets;
  }, []);

  // Area chart data (daily for 7d, weekly for 30d+)
  const areaData = useMemo(() => {
    const days: Record<DateRange, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 52, "all": 52 };
    const bucketCount = days[dateRange];
    const isWeekly = dateRange !== "7d";
    const now = new Date();
    const result: { label: string; Registrations: number; Events: number }[] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = new Date(now);
      const bucketEnd = new Date(now);
      if (isWeekly) {
        bucketStart.setDate(bucketStart.getDate() - (i + 1) * (dateRange === "30d" ? 1 : dateRange === "90d" ? 7 : 7));
        bucketEnd.setDate(bucketEnd.getDate() - i * (dateRange === "30d" ? 1 : dateRange === "90d" ? 7 : 7));
      } else {
        bucketStart.setDate(bucketStart.getDate() - (i + 1));
        bucketEnd.setDate(bucketEnd.getDate() - i);
      }
      const label = isWeekly
        ? bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      result.push({
        label,
        Registrations: registrations.filter((r) => { const d = new Date(r.created_at); return d >= bucketStart && d < bucketEnd; }).length,
        Events: events.filter((e) => { const d = new Date(e.created_at); return d >= bucketStart && d < bucketEnd; }).length,
      });
    }
    return result;
  }, [dateRange, registrations, events]);

  // Dept bar data
  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      const dept = e.organizing_dept || "Unknown";
      map[dept] = (map[dept] || 0) + (e.registration_count || 0);
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, Registrations: count }))
      .sort((a, b) => b.Registrations - a.Registrations)
      .slice(0, 8);
  }, [filteredEvents]);

  // Pie: pricing
  const freeCount = filteredEvents.filter((e) => !e.registration_fee || e.registration_fee === 0).length;
  const paidCount = filteredEvents.filter((e) => e.registration_fee && e.registration_fee > 0).length;
  const totalPricing = freeCount + paidCount || 1;
  const pricingData = [
    { name: "Free", value: freeCount },
    { name: "Paid", value: paidCount },
  ];

  // Pie: user roles
  const roleData = useMemo(() => [
    { name: "Regular", value: users.filter((u) => !u.is_organiser && !u.is_support && !u.is_masteradmin).length },
    { name: "Organiser", value: users.filter((u) => u.is_organiser).length },
    { name: "Admin", value: users.filter((u) => u.is_masteradmin).length },
    { name: "Support", value: users.filter((u) => u.is_support).length },
  ].filter((d) => d.value > 0), [users]);
  const totalRoles = roleData.reduce((s, d) => s + d.value, 0) || 1;

  // Top organisers
  const topOrganisers = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => e.created_by && (map[e.created_by] = (map[e.created_by] || 0) + 1));
    return Object.entries(map)
      .map(([email, count]) => ({ email, initials: email.slice(0, 2).toUpperCase(), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [events]);

  const organiserOptions = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.created_by).filter(Boolean))).sort();
  }, [events]);

  // Recent activity
  const recentActivity = useMemo(() => {
    type Item = { icon: "user" | "event" | "fest"; text: string; sub: string; time: Date; isNew?: boolean };
    const items: Item[] = [];
    users.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3).forEach((u) => {
      items.push({ icon: "user", text: `${u.name || u.email} joined the platform`, sub: u.campus ? `${u.campus} Campus` : "System", time: new Date(u.created_at), isNew: Date.now() - new Date(u.created_at).getTime() < 7 * 86400000 });
    });
    events.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3).forEach((e) => {
      items.push({ icon: "event", text: `Event "${e.title}" was created`, sub: e.organizing_dept || "System Admin", time: new Date(e.created_at) });
    });
    fests.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 2).forEach((f) => {
      items.push({ icon: "fest", text: `${f.fest_title} schedule updated`, sub: f.organizing_dept || "System Admin", time: new Date(f.created_at) });
    });
    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
  }, [users, events, fests]);

  const activityIcon = (type: "user" | "event" | "fest") => {
    const styles = { user: "bg-blue-100 text-blue-600", event: "bg-purple-100 text-purple-600", fest: "bg-amber-100 text-amber-600" };
    const icons = { user: <UserPlus className="w-3.5 h-3.5" />, event: <Calendar className="w-3.5 h-3.5" />, fest: <Zap className="w-3.5 h-3.5" /> };
    return <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${styles[type]}`}>{icons[type]}</div>;
  };

  const handleExportCSV = () => {
    downloadCSV("admin_dashboard", ["Metric", "Value"], [
      ["Total Users", String(users.length)],
      ["Total Events", String(events.length)],
      ["Registrations (period)", String(filteredRegs.length)],
      ["Avg/Event", avgPerEvent],
      ["Est. Revenue (₹)", String(totalRevenue)],
    ]);
    setShowExport(false);
  };

  const exportEventsXlsx = useCallback(async () => {
    type DashboardEventExportRow = {
      event_id: string;
      title: string;
      department: string;
      event_date: string;
      created_by: string;
      created_at: string;
      registration_fee: number;
      registrations: number;
      status: string;
    };

    const now = new Date();
    const workbook = createThemedWorkbook("SOCIO - Main Dashboard");

    addStructuredSummarySheet(workbook, {
      title: "Main Dashboard Events Export",
      subtitle: "Unified XLSX structure, spacing, and theme colors.",
      sections: [
        {
          title: "Report Metadata",
          rows: [
            { label: "Generated On", value: now.toLocaleString("en-GB") },
            { label: "Module", value: "Master Admin Dashboard" },
            { label: "Rows Exported", value: filteredEvents.length },
          ],
        },
        {
          title: "Active Filters",
          rows: [
            {
              label: "Date Window",
              value:
                startDate || endDate
                  ? `${startDate || "Any start"} to ${endDate || "Any end"}`
                  : dateRange,
            },
            { label: "Campus Filter", value: campusFilter === "all" ? "All Campuses" : campusFilter },
            { label: "Department Filter", value: deptFilter === "all" ? "All Departments" : deptFilter },
          ],
        },
        {
          title: "KPI Snapshot",
          rows: [
            { label: "Total Users", value: users.length },
            { label: "Total Events", value: events.length },
            { label: "Registrations (period)", value: filteredRegs.length },
            { label: "Estimated Revenue", value: `INR ${totalRevenue.toLocaleString("en-IN")}` },
          ],
        },
      ],
    });

    const eventRows: DashboardEventExportRow[] = filteredEvents.map((event) => {
      const eventDate = event.event_date ? new Date(event.event_date) : null;
      const status =
        !eventDate || Number.isNaN(eventDate.getTime())
          ? "unmarked"
          : eventDate < now
            ? "absent"
            : "pending";

      return {
        event_id: event.event_id,
        title: event.title,
        department: event.organizing_dept || "N/A",
        event_date: eventDate ? eventDate.toLocaleDateString("en-GB") : "N/A",
        created_by: event.created_by || "N/A",
        created_at: event.created_at ? new Date(event.created_at).toLocaleString("en-GB") : "N/A",
        registration_fee: Number(event.registration_fee || 0),
        registrations: Number(event.registration_count || 0),
        status,
      };
    });

    addStructuredTableSheet(workbook, {
      sheetName: "Events",
      columns: [
        { header: "Event ID", key: "event_id", width: 22 },
        { header: "Title", key: "title", width: 32 },
        { header: "Department", key: "department", width: 24 },
        { header: "Event Date", key: "event_date", width: 16, horizontal: "center" },
        { header: "Created By", key: "created_by", width: 28 },
        { header: "Created At", key: "created_at", width: 22 },
        { header: "Registration Fee", key: "registration_fee", width: 16, kind: "currency" },
        { header: "Registrations", key: "registrations", width: 14, kind: "number" },
        { header: "Status", key: "status", width: 12, kind: "status" },
      ],
      rows: eventRows,
    });

    const deptChartData = Object.entries(
      eventRows.reduce<Record<string, number>>((acc, row) => {
        const dept = row.department || "Unknown";
        acc[dept] = (acc[dept] || 0) + row.registrations;
        return acc;
      }, {})
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const pricingChartData = [
      { label: "Free Events", value: eventRows.filter((row) => row.registration_fee <= 0).length },
      { label: "Paid Events", value: eventRows.filter((row) => row.registration_fee > 0).length },
    ];

    addThemedChartsSheet(workbook, {
      title: "Events Visual Overview",
      subtitle: "Chart snapshots are embedded in the workbook for quick analysis.",
      primaryChart: {
        title: "Registrations by Department",
        type: "bar",
        data: deptChartData,
      },
      secondaryChart: {
        title: "Event Pricing Mix",
        type: "donut",
        data: pricingChartData,
      },
    });

    await downloadWorkbook(workbook, `dashboard_events_${now.toISOString().slice(0, 10)}.xlsx`);
    setShowExport(false);
  }, [
    campusFilter,
    dateRange,
    deptFilter,
    endDate,
    events.length,
    filteredEvents,
    filteredRegs.length,
    startDate,
    totalRevenue,
    users.length,
  ]);

  const dateRangeLabel = () => {
    const n = new Date();
    const days: Record<DateRange, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650 };
    const start = new Date(n.getTime() - days[dateRange] * 86400000);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${n.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  // ─── KPI Cards ─────────────────────────────────────────────────────────────
  const kpiCards = [
    {
      label: "TOTAL USERS",
      value: users.length,
      sub: "vs. previous period",
      growth: growthPct(filteredUsers.length, prevUsers.length),
      icon: <Users className="w-4 h-4" />,
      spark: spark(users),
    },
    {
      label: "TOTAL EVENTS",
      value: events.length,
      sub: "Active instances",
      growth: growthPct(filteredEvents.length, prevEvents.length),
      icon: <CalendarDays className="w-4 h-4" />,
      spark: spark(events),
    },
    {
      label: "REGISTRATIONS",
      value: filteredRegs.length,
      sub: "New this period",
      growth: growthPct(filteredRegs.length, prevRegs.length),
      icon: <ClipboardList className="w-4 h-4" />,
      spark: spark(registrations),
    },
    {
      label: "AVG / EVENT",
      value: avgPerEvent,
      sub: "Users per event",
      growth: null,
      icon: <BarChart2 className="w-4 h-4" />,
      spark: null,
      badge: "Hold",
    },
    {
      label: "EST. REVENUE",
      value: `₹${totalRevenue.toLocaleString("en-IN")}`,
      sub: "Processed funds",
      growth: null,
      icon: <IndianRupee className="w-4 h-4" />,
      spark: null,
      badge: "Audit",
    },
  ];

  return (
    <div className="p-6 space-y-5 min-w-0">
      {/* ── Header Row ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Overview</h1>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Live</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => openOrganiserHistory(null)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold border-2 border-[#154cb3] bg-white text-[#154cb3] px-3.5 py-2 rounded-full hover:bg-blue-50 transition-all"
          >
            <History className="w-4 h-4" /> Event Backtracking
          </button>
          <Link
            href="/create/event"
            className="inline-flex items-center gap-1.5 text-sm font-semibold border-2 border-[#154cb3] text-[#154cb3] bg-white px-3.5 py-2 rounded-full hover:bg-blue-50 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Event
          </Link>
          <Link
            href="/create/fest"
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-[#154cb3] border-2 border-[#154cb3] text-white px-3.5 py-2 rounded-full hover:bg-[#1240a0] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Fest
          </Link>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period toggles */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
          {(["7d", "30d", "90d", "1y", "all"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => { setDateRange(r); setStartDate(""); setEndDate(""); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                dateRange === r && !startDate ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >{r.toUpperCase()}</button>
          ))}
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date filter"
            title="Start date filter"
            className="text-xs text-slate-600 bg-transparent outline-none w-28"
          />
          <span className="text-slate-300 text-xs">–</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date filter"
            title="End date filter"
            className="text-xs text-slate-600 bg-transparent outline-none w-28"
          />
        </div>

        {/* Campus dropdown */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            aria-label="Campus filter"
            title="Campus filter"
            className="text-[11px] text-slate-600 bg-transparent outline-none appearance-none pr-4"
          >
            <option value="all">All Campuses</option>
            {campuses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 -ml-3" />
        </div>

        {/* Dept dropdown */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Department filter"
            title="Department filter"
            className="text-[11px] text-slate-600 bg-transparent outline-none appearance-none pr-4"
          >
            <option value="all">All Departments</option>
            {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 -ml-3" />
        </div>

        {/* Export */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowExport((v) => !v)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 min-w-[180px] py-1.5 overflow-hidden">
              <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">Export Dashboard Summary</button>
              <button onClick={() => { void exportEventsXlsx(); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">Export Events XLSX ({filteredEvents.length})</button>
              <button onClick={() => { downloadCSV("users", ["Name", "Email", "Role"], users.map((u) => [u.name, u.email, u.is_masteradmin ? "Admin" : u.is_organiser ? "Organiser" : u.is_support ? "Support" : "Regular"])); setShowExport(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">Export Users ({users.length})</button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.map((kpi, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{kpi.label}</p>
              {kpi.growth !== null && kpi.growth !== undefined ? (
                <GrowthBadge value={kpi.growth} />
              ) : kpi.badge ? (
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{kpi.badge}</span>
              ) : null}
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">{typeof kpi.value === "number" ? kpi.value.toLocaleString("en-IN") : kpi.value}</p>
            <div className="flex items-end justify-between">
              <p className="text-xs text-slate-400">{kpi.sub}</p>
              {kpi.spark && <MiniBarChart data={kpi.spark} />}
            </div>
          </Card>
        ))}
      </div>

      {/* ── Charts Middle Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Registrations Over Time */}
        <Card className="col-span-12 xl:col-span-8 p-5">
          {/* Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-0 border-b border-slate-100 w-full">
              {([
                { id: "registrations", label: "Registrations Over Time" },
                { id: "events", label: "Events Created" },
                { id: "department", label: "By Department" },
              ] as { id: ChartTab; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setChartTab(t.id)}
                  className={`px-4 pb-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                    chartTab === t.id
                      ? "border-[#154cb3] text-[#154cb3]"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {chartTab === "department" ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptData} margin={{ top: 4, right: 8, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Registrations" fill={PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-2xl font-bold text-slate-900">
                  {chartTab === "registrations" ? filteredRegs.length.toLocaleString() : filteredEvents.length.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chartTab === "registrations" ? "Total registrations in period" : "Events created in period"} · {dateRangeLabel()}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={chartTab === "registrations" ? "Registrations" : "Events"}
                    stroke={PRIMARY}
                    strokeWidth={2.5}
                    fill="url(#areaGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: PRIMARY }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>

        {/* Right column: two stacked cards */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
          {/* Event Pricing donut */}
          <Card className="p-5 flex-1">
            <p className="text-sm font-bold text-slate-900 mb-4">Event Pricing</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={pricingData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" strokeWidth={0}>
                    {pricingData.map((_, i) => <Cell key={i} fill={PRICING_COLORS[i % PRICING_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {pricingData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${PRICING_COLOR_CLASSES[i % PRICING_COLOR_CLASSES.length]}`} />
                      <span className="text-xs text-slate-600">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900">{Math.round((d.value / totalPricing) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* User Roles donut */}
          <Card className="p-5 flex-1">
            <p className="text-sm font-bold text-slate-900 mb-4">User Roles</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" strokeWidth={0}>
                    {roleData.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {roleData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${ROLE_COLOR_CLASSES[i % ROLE_COLOR_CLASSES.length]}`} />
                      <span className="text-[11px] text-slate-600">{d.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-900">{Math.round((d.value / totalRoles) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">Recent Activity</p>
            <button className="text-xs font-medium text-[#154cb3] hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No recent activity</p>
            ) : (
              recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  {activityIcon(item.icon)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800 leading-snug">
                      <span className="font-semibold">{item.text.split(" ").slice(0, 1).join(" ")}</span>{" "}
                      {item.text.split(" ").slice(1).join(" ")}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatTimeAgo(item.time)} · {item.sub}
                    </p>
                  </div>
                  {item.isNew && (
                    <span className="flex-shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">New</span>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Top Organisers */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">Top Organisers</p>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-x-4 mb-2 px-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organiser Email</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Events</p>
            </div>
            <div className="space-y-1">
              {topOrganisers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No data available</p>
              ) : (
                topOrganisers.map((org, i) => (
                  <div key={i} className={`flex items-center gap-3 px-1 py-2.5 rounded-lg ${i % 2 === 0 ? "" : ""} hover:bg-slate-50 transition-colors`}>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-slate-500">{org.initials}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openOrganiserHistory(org.email)}
                      className="text-xs text-slate-700 flex-1 truncate text-left hover:text-[#154cb3] hover:underline"
                      title={`View full event history for ${org.email}`}
                    >
                      {org.email}
                    </button>
                    <button
                      type="button"
                      onClick={() => openOrganiserHistory(org.email)}
                      className="rounded-md p-1 text-slate-400 hover:bg-blue-50 hover:text-[#154cb3]"
                      aria-label={`View event history for ${org.email}`}
                      title="View event history"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                    <p className={`text-sm font-bold flex-shrink-0 ${org.count > 0 ? "text-slate-900" : "text-slate-300"}`}>{org.count}</p>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={onViewPerformanceInsights}
              disabled={!onViewPerformanceInsights}
              className={`w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-center pt-2 border-t border-slate-100 ${
                onViewPerformanceInsights
                  ? "text-[#154cb3] hover:underline"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              View performance insights
            </button>
          </div>
        </Card>
      </div>

      <OrganiserHistoryModal
        isOpen={isHistoryModalOpen}
        organiserIdentifier={selectedOrganiser}
        organiserOptions={organiserOptions}
        onOrganiserChange={handleOrganiserSelection}
        onClose={closeOrganiserHistory}
      />
    </div>
  );
}
