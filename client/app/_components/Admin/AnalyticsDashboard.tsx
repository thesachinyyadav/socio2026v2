"use client";

import React, { useMemo } from "react";
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
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

// ─── Brand Palette ──────────────────────────────────────────────────────────────
const COLORS = [
  "#154CB3",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#6366F1",
  "#14B8A6",
  "#F43F5E",
  "#3B82F6",
  "#22C55E",
  "#FFCC00",
  "#A855F7",
];

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

// ─── Reusable Components ────────────────────────────────────────────────────────

const ChartCard = ({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}
  >
    <div className="mb-3">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      )}
    </div>
    {children}
  </div>
);

const StatCard = ({
  label,
  value,
  subtitle,
  color = "blue",
  icon,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "green" | "yellow" | "purple" | "red";
  icon: React.ReactNode;
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
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-3xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
    {message}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}:{" "}
          <span className="font-bold">{entry.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

// Custom donut center label
const renderCenterLabel = (total: number) => {
  return ({ viewBox }: any) => {
    const { cx, cy } = viewBox;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        <tspan
          x={cx}
          dy="-6"
          className="text-2xl font-bold"
          fill="#1f2937"
        >
          {total.toLocaleString()}
        </tspan>
        <tspan x={cx} dy="18" className="text-[10px]" fill="#9ca3af">
          Total
        </tspan>
      </text>
    );
  };
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({
  users,
  events,
  fests,
  registrations,
}: AnalyticsDashboardProps) {
  // ── Computed Metrics ────────────────────────────────────────────────────────

  const totalRegistrations = registrations.length;

  const totalParticipants = useMemo(() => {
    return registrations.reduce((sum, reg) => {
      if (reg.registration_type === "team") {
        const teammates = Array.isArray(reg.teammates)
          ? reg.teammates.length
          : 0;
        return sum + 1 + teammates;
      }
      return sum + 1;
    }, 0);
  }, [registrations]);

  const avgRegPerEvent = useMemo(() => {
    if (events.length === 0) return "0";
    return (totalRegistrations / events.length).toFixed(1);
  }, [events.length, totalRegistrations]);

  // ── Department Data (combined bar chart) ────────────────────────────────────

  const deptData = useMemo(() => {
    const map: Record<string, { events: number; registrations: number }> = {};
    events.forEach((e) => {
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
      .sort((a, b) => b.Events - a.Events)
      .slice(0, 10);
  }, [events]);

  // ── Top Events by Registrations ─────────────────────────────────────────────

  const topEvents = useMemo(() => {
    return [...events]
      .filter((e) => (e.registration_count || 0) > 0)
      .sort((a, b) => (b.registration_count || 0) - (a.registration_count || 0))
      .slice(0, 8)
      .map((e) => ({
        name:
          e.title.length > 28 ? e.title.substring(0, 28) + "…" : e.title,
        Registrations: e.registration_count || 0,
      }));
  }, [events]);

  // ── Pie: Registration Types ─────────────────────────────────────────────────

  const regTypes = useMemo(() => {
    const individual = registrations.filter(
      (r) => r.registration_type === "individual"
    ).length;
    const team = registrations.filter(
      (r) => r.registration_type === "team"
    ).length;
    return [
      { name: "Individual", value: individual },
      { name: "Team", value: team },
    ].filter((d) => d.value > 0);
  }, [registrations]);

  // ── Pie: Free vs Paid ──────────────────────────────────────────────────────

  const freeVsPaid = useMemo(() => {
    const free = events.filter(
      (e) => !e.registration_fee || e.registration_fee === 0
    ).length;
    const paid = events.filter(
      (e) => e.registration_fee && e.registration_fee > 0
    ).length;
    return [
      { name: "Free", value: free },
      { name: "Paid", value: paid },
    ].filter((d) => d.value > 0);
  }, [events]);

  // ── Pie: User Roles ─────────────────────────────────────────────────────────

  const userRoles = useMemo(() => {
    return [
      {
        name: "Regular",
        value: users.filter(
          (u) => !u.is_organiser && !u.is_support && !u.is_masteradmin
        ).length,
      },
      {
        name: "Organisers",
        value: users.filter((u) => u.is_organiser).length,
      },
      { name: "Support", value: users.filter((u) => u.is_support).length },
      {
        name: "Admins",
        value: users.filter((u) => u.is_masteradmin).length,
      },
    ].filter((d) => d.value > 0);
  }, [users]);

  // ── Timeline: Registrations Over Time ───────────────────────────────────────

  const regTimeline = useMemo(() => {
    const monthly: Record<string, number> = {};
    registrations.forEach((r) => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = (monthly[key] || 0) + 1;
    });

    const keys = Object.keys(monthly).sort();
    if (keys.length === 0) return [];

    // Fill gaps between first and last month
    const result: { month: string; Registrations: number }[] = [];
    const start = new Date(keys[0] + "-01");
    const end = new Date(keys[keys.length - 1] + "-01");
    const current = new Date(start);

    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      result.push({
        month: current.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        Registrations: monthly[key] || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }, [registrations]);

  // ── Events Created Over Time ────────────────────────────────────────────────

  const eventsTimeline = useMemo(() => {
    const monthly: Record<string, number> = {};
    events.forEach((e) => {
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
        month: current.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        Events: monthly[key] || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }, [events]);

  // ── Fest Registrations ──────────────────────────────────────────────────────

  const festData = useMemo(() => {
    return fests
      .map((f) => ({
        name:
          f.fest_title.length > 22
            ? f.fest_title.substring(0, 22) + "…"
            : f.fest_title,
        Registrations: f.registration_count || 0,
      }))
      .sort((a, b) => b.Registrations - a.Registrations);
  }, [fests]);

  // ── Top Organisers ──────────────────────────────────────────────────────────

  const topOrganisers = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      if (e.created_by) {
        map[e.created_by] = (map[e.created_by] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([email, count]) => ({
        name:
          email.length > 25 ? email.substring(0, 25) + "…" : email,
        Events: count,
      }))
      .sort((a, b) => b.Events - a.Events)
      .slice(0, 6);
  }, [events]);

  // ── PIE COLORS ARRAY ───────────────────────────────────────────────────────

  const PIE_COLORS_1 = ["#154CB3", "#10B981"];
  const PIE_COLORS_2 = ["#10B981", "#F59E0B"];
  const PIE_COLORS_3 = ["#6366F1", "#154CB3", "#10B981", "#EF4444"];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Row 1: Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={users.length}
          subtitle={`${users.filter((u) => u.is_organiser).length} organisers`}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Total Events"
          value={events.length}
          subtitle={`${events.filter((e) => !e.registration_fee || e.registration_fee === 0).length} free events`}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Registrations"
          value={totalRegistrations}
          subtitle={`~${totalParticipants} participants total`}
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          }
        />
        <StatCard
          label="Avg / Event"
          value={avgRegPerEvent}
          subtitle={`across ${events.length} events`}
          color="purple"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* ── Row 2: Department Analytics + Top Events ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Events & Registrations by Department"
          subtitle="Top departments by event count"
        >
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Events" fill="#154CB3" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Registrations" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No department data available" />
          )}
        </ChartCard>

        <ChartCard
          title="Top Events by Registrations"
          subtitle="Most popular events"
        >
          {topEvents.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topEvents}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Registrations" radius={[0, 4, 4, 0]} barSize={18}>
                  {topEvents.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
                <Pie
                  data={regTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                >
                  {regTypes.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS_1[i % PIE_COLORS_1.length]} />
                  ))}
                </Pie>
                <Pie
                  data={[{ value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={0}
                  dataKey="value"
                  label={renderCenterLabel(totalRegistrations)}
                />
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
                <Pie
                  data={freeVsPaid}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                >
                  {freeVsPaid.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS_2[i % PIE_COLORS_2.length]} />
                  ))}
                </Pie>
                <Pie
                  data={[{ value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={0}
                  dataKey="value"
                  label={renderCenterLabel(events.length)}
                />
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
                <Pie
                  data={userRoles}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                >
                  {userRoles.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS_3[i % PIE_COLORS_3.length]} />
                  ))}
                </Pie>
                <Pie
                  data={[{ value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={0}
                  dataKey="value"
                  label={renderCenterLabel(users.length)}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No users yet" />
          )}
        </ChartCard>
      </div>

      {/* ── Row 4: Registration Timeline ──────────────────────────────────── */}
      <ChartCard
        title="Registrations Over Time"
        subtitle="Monthly registration trend"
      >
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
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Registrations"
                stroke="#154CB3"
                strokeWidth={2.5}
                fill="url(#regGrad)"
                dot={{ r: 3, fill: "#154CB3" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No registration timeline data" />
        )}
      </ChartCard>

      {/* ── Row 5: Events Timeline + Top Organisers ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Events Created Over Time"
          subtitle="Monthly event creation trend"
        >
          {eventsTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={eventsTimeline}
                margin={{ left: -10, right: 10 }}
              >
                <defs>
                  <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop
                      offset="95%"
                      stopColor="#10B981"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Events"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#eventGrad)"
                  dot={{ r: 3, fill: "#10B981" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No event timeline data" />
          )}
        </ChartCard>

        <ChartCard
          title="Top Organisers"
          subtitle="By number of events created"
        >
          {topOrganisers.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topOrganisers}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Events" radius={[0, 4, 4, 0]} barSize={16}>
                  {topOrganisers.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No organiser data" />
          )}
        </ChartCard>
      </div>

      {/* ── Row 6: Fest Registrations ─────────────────────────────────────── */}
      {festData.length > 0 && (
        <ChartCard
          title="Registrations by Fest"
          subtitle="Total registrations across fest events"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={festData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                angle={-25}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="Registrations"
                radius={[4, 4, 0, 0]}
                barSize={32}
              >
                {festData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
