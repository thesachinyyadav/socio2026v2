"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label,
  AreaChart,
  Area,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Brand Palette ──────────────────────────────────────────────────────────────
const COLORS = [
  "#154CB3", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
  "#F43F5E", "#3B82F6", "#22C55E", "#FFCC00", "#A855F7",
];

const PIE_COLORS_1 = ["#154CB3", "#10B981"];
const PIE_COLORS_2 = ["#10B981", "#F59E0B"];
const PIE_COLORS_3 = ["#6366F1", "#154CB3", "#10B981", "#EF4444"];

// ─── Types ──────────────────────────────────────────────────────────────────────
interface AnalyticsDashboardProps {
  users: Array<{
    id: number;
    email: string;
    name: string;
    is_organiser: boolean;
    is_support: boolean;
    is_masteradmin: boolean;
    created_at: string;
  }>;
  events: Array<{
    event_id: string;
    title: string;
    organizing_dept: string;
    event_date: string;
    created_by: string;
    created_at: string;
    registration_fee: number;
    registration_count?: number;
  }>;
  fests: Array<{
    fest_id: string;
    fest_title: string;
    organizing_dept: string;
    opening_date: string;
    created_by: string;
    created_at: string;
    registration_count?: number;
  }>;
  registrations: Array<{
    registration_id: string;
    event_id: string;
    registration_type: string;
    created_at: string;
    teammates?: any[];
  }>;
}

type DateRange = "7d" | "30d" | "90d" | "1y" | "all";

// ─── Utility: date range filter ─────────────────────────────────────────────────
function getDateCutoff(range: DateRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const map: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  const days = map[range] || 30;
  return new Date(now.getTime() - days * 86400000);
}

function isAfterCutoff(dateStr: string | undefined, cutoff: Date | null): boolean {
  if (!cutoff) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= cutoff;
}

// ─── Utility: CSV Export ────────────────────────────────────────────────────────
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Growth Indicator ───────────────────────────────────────────────────────────
function calcGrowth(current: number, previous: number): { pct: string; up: boolean; neutral: boolean } {
  if (previous === 0 && current === 0) return { pct: "0%", up: false, neutral: true };
  if (previous === 0) return { pct: "+100%", up: true, neutral: false };
  const change = ((current - previous) / previous) * 100;
  return {
    pct: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    up: change > 0,
    neutral: change === 0,
  };
}

// ─── Reusable Components ────────────────────────────────────────────────────────

const ChartCard = ({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
    {children}
  </div>
);

const GrowthBadge = ({ pct, up, neutral }: { pct: string; up: boolean; neutral: boolean }) => {
  if (neutral) return <span className="text-[10px] text-gray-400 font-medium">— no change</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
      up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
    }`}>
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
          d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
      {pct}
    </span>
  );
};

const StatCard = ({
  label,
  value,
  subtitle,
  color = "blue",
  icon,
  growth,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "green" | "yellow" | "purple" | "red";
  icon: React.ReactNode;
  growth?: { pct: string; up: boolean; neutral: boolean };
}) => {
  const colorMap = {
    blue: "bg-blue-50 text-[#154CB3]",
    green: "bg-emerald-50 text-emerald-600",
    yellow: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colorMap[color]}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-3xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {growth && <GrowthBadge {...growth} />}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">{message}</div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

const renderCenterLabel = (total: number) => (props: any) => {
  const { viewBox } = props || {};
  if (!viewBox || viewBox.cx == null || viewBox.cy == null) return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-6" fontSize={22} fontWeight={700} fill="#1f2937">
        {total.toLocaleString()}
      </tspan>
      <tspan x={cx} dy="20" fontSize={10} fill="#9ca3af">Total</tspan>
    </text>
  );
};

// ─── Collapsible Data Table ─────────────────────────────────────────────────────
const DataTable = ({
  headers,
  rows,
  maxVisible = 5,
}: {
  headers: string[];
  rows: string[][];
  maxVisible?: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, maxVisible);
  const hasMore = rows.length > maxVisible;

  return (
    <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2 text-xs font-medium text-[#154CB3] hover:bg-blue-50 transition-colors border-t border-gray-100"
        >
          {expanded ? `Show less ↑` : `View all ${rows.length} rows ↓`}
        </button>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({
  users,
  events,
  fests,
  registrations,
}: AnalyticsDashboardProps) {
  // ── Filters ─────────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [chartTopN, setChartTopN] = useState(10);

  const cutoff = useMemo(() => getDateCutoff(dateRange), [dateRange]);

  // Previous-period cutoff for growth calculation
  const prevCutoff = useMemo(() => {
    if (dateRange === "all") return null;
    const map: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
    const days = map[dateRange] || 30;
    const now = new Date();
    return {
      start: new Date(now.getTime() - 2 * days * 86400000),
      end: new Date(now.getTime() - days * 86400000),
    };
  }, [dateRange]);

  // ── Filtered Data ───────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(e => isAfterCutoff(e.created_at, cutoff));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        e => e.title.toLowerCase().includes(q) ||
             e.organizing_dept?.toLowerCase().includes(q) ||
             e.created_by?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [events, cutoff, searchQuery]);

  const filteredRegistrations = useMemo(() => {
    const eventIds = new Set(filteredEvents.map(e => e.event_id));
    return registrations.filter(r => {
      if (!isAfterCutoff(r.created_at, cutoff)) return false;
      if (searchQuery && eventIds.size > 0) return eventIds.has(r.event_id);
      return true;
    });
  }, [registrations, cutoff, searchQuery, filteredEvents]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => isAfterCutoff(u.created_at, cutoff));
  }, [users, cutoff]);

  const filteredFests = useMemo(() => {
    let filtered = fests.filter(f => isAfterCutoff(f.created_at, cutoff));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        f => f.fest_title.toLowerCase().includes(q) ||
             f.organizing_dept?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [fests, cutoff, searchQuery]);

  // ── Previous period data for growth calc ──────────────────────────────────
  const prevEvents = useMemo(() => {
    if (!prevCutoff) return [];
    return events.filter(e => {
      const d = new Date(e.created_at);
      return !isNaN(d.getTime()) && d >= prevCutoff.start && d < prevCutoff.end;
    });
  }, [events, prevCutoff]);

  const prevRegistrations = useMemo(() => {
    if (!prevCutoff) return [];
    return registrations.filter(r => {
      const d = new Date(r.created_at);
      return !isNaN(d.getTime()) && d >= prevCutoff.start && d < prevCutoff.end;
    });
  }, [registrations, prevCutoff]);

  const prevUsers = useMemo(() => {
    if (!prevCutoff) return [];
    return users.filter(u => {
      const d = new Date(u.created_at);
      return !isNaN(d.getTime()) && d >= prevCutoff.start && d < prevCutoff.end;
    });
  }, [users, prevCutoff]);

  // ── Computed Metrics ────────────────────────────────────────────────────────
  const totalRegistrations = filteredRegistrations.length;
  const totalParticipants = useMemo(() => {
    return filteredRegistrations.reduce((sum, r) => {
      if (r.registration_type === "team") {
        return sum + 1 + (Array.isArray(r.teammates) ? r.teammates.length : 0);
      }
      return sum + 1;
    }, 0);
  }, [filteredRegistrations]);

  const avgRegPerEvent = useMemo(() => {
    if (filteredEvents.length === 0) return "0";
    return (totalRegistrations / filteredEvents.length).toFixed(1);
  }, [filteredEvents.length, totalRegistrations]);

  const totalRevenue = useMemo(() => {
    return filteredEvents.reduce((sum, e) => {
      return sum + ((e.registration_fee || 0) * (e.registration_count || 0));
    }, 0);
  }, [filteredEvents]);

  const activeEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents.filter(e => new Date(e.event_date) >= now).length;
  }, [filteredEvents]);

  // ── Growth Indicators ───────────────────────────────────────────────────────
  const userGrowth = useMemo(() => dateRange !== "all" ? calcGrowth(filteredUsers.length, prevUsers.length) : undefined, [filteredUsers.length, prevUsers.length, dateRange]);
  const eventGrowth = useMemo(() => dateRange !== "all" ? calcGrowth(filteredEvents.length, prevEvents.length) : undefined, [filteredEvents.length, prevEvents.length, dateRange]);
  const regGrowth = useMemo(() => dateRange !== "all" ? calcGrowth(totalRegistrations, prevRegistrations.length) : undefined, [totalRegistrations, prevRegistrations.length, dateRange]);

  // ── Department Data ─────────────────────────────────────────────────────────
  const deptDataFull = useMemo(() => {
    const map: Record<string, { events: number; registrations: number }> = {};
    filteredEvents.forEach(e => {
      const dept = e.organizing_dept || "Unknown";
      if (!map[dept]) map[dept] = { events: 0, registrations: 0 };
      map[dept].events += 1;
      map[dept].registrations += e.registration_count || 0;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name: name.length > 18 ? name.substring(0, 18) + "…" : name,
        fullName: name,
        Events: d.events,
        Registrations: d.registrations,
      }))
      .sort((a, b) => b.Events - a.Events);
  }, [filteredEvents]);

  const deptData = useMemo(() => deptDataFull.slice(0, chartTopN), [deptDataFull, chartTopN]);

  // ── Top Events ──────────────────────────────────────────────────────────────
  const topEventsFull = useMemo(() => {
    return [...filteredEvents]
      .filter(e => (e.registration_count || 0) > 0)
      .sort((a, b) => (b.registration_count || 0) - (a.registration_count || 0))
      .map(e => ({
        name: e.title.length > 28 ? e.title.substring(0, 28) + "…" : e.title,
        fullTitle: e.title,
        Registrations: e.registration_count || 0,
        dept: e.organizing_dept,
        date: e.event_date,
      }));
  }, [filteredEvents]);

  const topEvents = useMemo(() => topEventsFull.slice(0, 8), [topEventsFull]);

  // ── Pie Data ────────────────────────────────────────────────────────────────
  const regTypes = useMemo(() => {
    const individual = filteredRegistrations.filter(r => r.registration_type === "individual").length;
    const team = filteredRegistrations.filter(r => r.registration_type === "team").length;
    return [
      { name: "Individual", value: individual },
      { name: "Team", value: team },
    ].filter(d => d.value > 0);
  }, [filteredRegistrations]);

  const freeVsPaid = useMemo(() => {
    const free = filteredEvents.filter(e => !e.registration_fee || e.registration_fee === 0).length;
    const paid = filteredEvents.filter(e => e.registration_fee && e.registration_fee > 0).length;
    return [
      { name: "Free", value: free },
      { name: "Paid", value: paid },
    ].filter(d => d.value > 0);
  }, [filteredEvents]);

  const userRoles = useMemo(() => {
    return [
      { name: "Regular", value: users.filter(u => !u.is_organiser && !u.is_support && !u.is_masteradmin).length },
      { name: "Organisers", value: users.filter(u => u.is_organiser).length },
      { name: "Support", value: users.filter(u => u.is_support).length },
      { name: "Admins", value: users.filter(u => u.is_masteradmin).length },
    ].filter(d => d.value > 0);
  }, [users]);

  // ── Timelines ───────────────────────────────────────────────────────────────
  const regTimeline = useMemo(() => {
    const monthly: Record<string, number> = {};
    filteredRegistrations.forEach(r => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = (monthly[key] || 0) + 1;
    });
    const keys = Object.keys(monthly).sort();
    if (keys.length === 0) return [];
    const result: { month: string; Registrations: number }[] = [];
    const start = new Date(keys[0] + "-01");
    const end = new Date(keys[keys.length - 1] + "-01");
    const current = new Date(start);
    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      result.push({
        month: current.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        Registrations: monthly[key] || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }, [filteredRegistrations]);

  const eventsTimeline = useMemo(() => {
    const monthly: Record<string, number> = {};
    filteredEvents.forEach(e => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = (monthly[key] || 0) + 1;
    });
    const keys = Object.keys(monthly).sort();
    if (keys.length === 0) return [];
    const result: { month: string; Events: number }[] = [];
    const start = new Date(keys[0] + "-01");
    const end = new Date(keys[keys.length - 1] + "-01");
    const current = new Date(start);
    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      result.push({
        month: current.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        Events: monthly[key] || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }, [filteredEvents]);

  // ── Fest Data ───────────────────────────────────────────────────────────────
  const festData = useMemo(() => {
    return filteredFests
      .map(f => ({
        name: f.fest_title.length > 22 ? f.fest_title.substring(0, 22) + "…" : f.fest_title,
        Registrations: f.registration_count || 0,
      }))
      .sort((a, b) => b.Registrations - a.Registrations);
  }, [filteredFests]);

  // ── Top Organisers ──────────────────────────────────────────────────────────
  const topOrganisers = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEvents.forEach(e => {
      if (e.created_by) map[e.created_by] = (map[e.created_by] || 0) + 1;
    });
    return Object.entries(map)
      .map(([email, count]) => ({
        name: email.length > 25 ? email.substring(0, 25) + "…" : email,
        fullEmail: email,
        Events: count,
      }))
      .sort((a, b) => b.Events - a.Events)
      .slice(0, 6);
  }, [filteredEvents]);

  // ── Export Handlers ─────────────────────────────────────────────────────────
  const exportEvents = useCallback(() => {
    downloadCSV(
      "events_report",
      ["Title", "Department", "Date", "Fee", "Registrations", "Created By", "Created At"],
      filteredEvents.map(e => [
        e.title, e.organizing_dept,
        new Date(e.event_date).toLocaleDateString(),
        String(e.registration_fee || 0),
        String(e.registration_count || 0),
        e.created_by,
        new Date(e.created_at).toLocaleDateString(),
      ])
    );
  }, [filteredEvents]);

  const exportUsers = useCallback(() => {
    downloadCSV(
      "users_report",
      ["Name", "Email", "Organiser", "Support", "MasterAdmin", "Joined"],
      users.map(u => [
        u.name, u.email,
        u.is_organiser ? "Yes" : "No",
        u.is_support ? "Yes" : "No",
        u.is_masteradmin ? "Yes" : "No",
        new Date(u.created_at).toLocaleDateString(),
      ])
    );
  }, [users]);

  const exportRegistrations = useCallback(() => {
    downloadCSV(
      "registrations_report",
      ["Registration ID", "Event ID", "Type", "Team Size", "Registered At"],
      filteredRegistrations.map(r => [
        r.registration_id, r.event_id, r.registration_type,
        r.registration_type === "team" ? String(1 + (r.teammates?.length || 0)) : "1",
        new Date(r.created_at).toLocaleDateString(),
      ])
    );
  }, [filteredRegistrations]);

  // ── Event status helper ─────────────────────────────────────────────────────
  const getEventStatus = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return { label: "Past", cls: "bg-gray-100 text-gray-600" };
    if (diff < 86400000) return { label: "Live", cls: "bg-green-100 text-green-700 animate-pulse" };
    if (diff < 7 * 86400000) return { label: "This Week", cls: "bg-amber-100 text-amber-700" };
    return { label: "Upcoming", cls: "bg-blue-100 text-blue-700" };
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Toolbar: Filters, Search, Export ──────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
            {([
              ["7d", "7D"],
              ["30d", "30D"],
              ["90d", "90D"],
              ["1y", "1Y"],
              ["all", "All"],
            ] as [DateRange, string][]).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setDateRange(val)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  dateRange === val
                    ? "bg-[#154CB3] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search events, departments, organisers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Top-N Selector */}
          <select
            value={chartTopN}
            onChange={e => setChartTopN(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 focus:ring-2 focus:ring-[#154CB3] flex-shrink-0"
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>

          {/* Export Dropdown */}
          <div className="relative group flex-shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px] py-1">
              <button onClick={exportEvents} className="w-full px-4 py-2 text-xs text-left text-gray-700 hover:bg-gray-50">
                Export Events ({filteredEvents.length})
              </button>
              <button onClick={exportRegistrations} className="w-full px-4 py-2 text-xs text-left text-gray-700 hover:bg-gray-50">
                Export Registrations ({filteredRegistrations.length})
              </button>
              <button onClick={exportUsers} className="w-full px-4 py-2 text-xs text-left text-gray-700 hover:bg-gray-50">
                Export All Users ({users.length})
              </button>
            </div>
          </div>
        </div>

        {/* Active filter summary */}
        {(dateRange !== "all" || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span className="font-medium">Showing:</span>
            {dateRange !== "all" && (
              <span className="bg-blue-50 text-[#154CB3] px-2 py-0.5 rounded-md font-medium">
                Last {dateRange === "7d" ? "7 days" : dateRange === "30d" ? "30 days" : dateRange === "90d" ? "90 days" : "1 year"}
              </span>
            )}
            {searchQuery && (
              <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md font-medium">
                &quot;{searchQuery}&quot;
              </span>
            )}
            <span className="ml-auto">
              {filteredEvents.length} events · {filteredRegistrations.length} registrations · {filteredUsers.length} users
            </span>
            <button
              onClick={() => { setDateRange("all"); setSearchQuery(""); }}
              className="text-red-500 hover:text-red-700 font-medium ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Row 1: Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Users"
          value={users.length}
          subtitle={`${filteredUsers.length} in period · ${users.filter(u => u.is_organiser).length} organisers`}
          color="blue"
          growth={userGrowth}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          label="Total Events"
          value={filteredEvents.length}
          subtitle={`${activeEvents} upcoming · ${filteredEvents.filter(e => !e.registration_fee || e.registration_fee === 0).length} free`}
          color="green"
          growth={eventGrowth}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          label="Registrations"
          value={totalRegistrations}
          subtitle={`~${totalParticipants} participants total`}
          color="yellow"
          growth={regGrowth}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>}
        />
        <StatCard
          label="Avg / Event"
          value={avgRegPerEvent}
          subtitle={`across ${filteredEvents.length} events`}
          color="purple"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <StatCard
          label="Est. Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          subtitle={`${filteredEvents.filter(e => e.registration_fee > 0).length} paid events`}
          color="red"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* ── Row 2: Department Analytics + Top Events ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Events & Registrations by Department"
          subtitle={`Top ${Math.min(chartTopN, deptDataFull.length)} of ${deptDataFull.length} departments`}
        >
          {deptData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} angle={-35} textAnchor="end" height={70} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Events" fill="#154CB3" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Registrations" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
              {deptDataFull.length > 0 && (
                <DataTable
                  headers={["Department", "Events", "Registrations"]}
                  rows={deptDataFull.map(d => [d.fullName, String(d.Events), String(d.Registrations)])}
                />
              )}
            </>
          ) : (
            <EmptyState message="No department data available" />
          )}
        </ChartCard>

        <ChartCard
          title="Top Events by Registrations"
          subtitle={`${topEventsFull.length} events with registrations`}
        >
          {topEvents.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topEvents} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Registrations" radius={[0, 4, 4, 0]} barSize={18}>
                    {topEvents.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <DataTable
                headers={["Event", "Registrations", "Department", "Date", "Status"]}
                rows={topEventsFull.map(e => {
                  const status = getEventStatus(e.date);
                  return [e.fullTitle, String(e.Registrations), e.dept || "—", new Date(e.date).toLocaleDateString(), status.label];
                })}
              />
            </>
          ) : (
            <EmptyState message="No registration data available" />
          )}
        </ChartCard>
      </div>

      {/* ── Row 3: Three Distribution Pies ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChartCard title="Registration Types" subtitle="Individual vs Team">
          {regTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={regTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}>
                  {regTypes.map((_, i) => (<Cell key={i} fill={PIE_COLORS_1[i % PIE_COLORS_1.length]} />))}
                  <Label content={renderCenterLabel(totalRegistrations)} position="center" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No registrations yet" />
          )}
        </ChartCard>

        <ChartCard title="Event Pricing" subtitle="Free vs Paid events">
          {freeVsPaid.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={freeVsPaid} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}>
                  {freeVsPaid.map((_, i) => (<Cell key={i} fill={PIE_COLORS_2[i % PIE_COLORS_2.length]} />))}
                  <Label content={renderCenterLabel(filteredEvents.length)} position="center" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No events yet" />
          )}
        </ChartCard>

        <ChartCard title="User Roles" subtitle="Role distribution">
          {userRoles.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={userRoles} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}>
                  {userRoles.map((_, i) => (<Cell key={i} fill={PIE_COLORS_3[i % PIE_COLORS_3.length]} />))}
                  <Label content={renderCenterLabel(users.length)} position="center" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No users yet" />
          )}
        </ChartCard>
      </div>

      {/* ── Row 4: Registration Timeline ──────────────────────────────────── */}
      <ChartCard title="Registrations Over Time" subtitle="Monthly registration trend">
        {regTimeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={regTimeline} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#154CB3" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#154CB3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Registrations" stroke="#154CB3" strokeWidth={2.5} fill="url(#regGrad)" dot={{ r: 3, fill: "#154CB3" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No registration timeline data" />
        )}
      </ChartCard>

      {/* ── Row 5: Events Timeline + Top Organisers ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Events Created Over Time" subtitle="Monthly event creation trend">
          {eventsTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={eventsTimeline} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Events" stroke="#10B981" strokeWidth={2.5} fill="url(#eventGrad)" dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No event timeline data" />
          )}
        </ChartCard>

        <ChartCard title="Top Organisers" subtitle="By number of events created">
          {topOrganisers.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topOrganisers} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Events" radius={[0, 4, 4, 0]} barSize={16}>
                    {topOrganisers.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <DataTable
                headers={["Email", "Events Created"]}
                rows={topOrganisers.map(o => [o.fullEmail, String(o.Events)])}
              />
            </>
          ) : (
            <EmptyState message="No organiser data" />
          )}
        </ChartCard>
      </div>

      {/* ── Row 6: Fest Registrations ─────────────────────────────────────── */}
      {festData.length > 0 && (
        <ChartCard title="Registrations by Fest" subtitle="Total registrations across fest events">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={festData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} angle={-25} textAnchor="end" height={60} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Registrations" radius={[4, 4, 0, 0]} barSize={32}>
                {festData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
