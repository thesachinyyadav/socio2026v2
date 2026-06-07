"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Layers,
  RefreshCw,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import {
  fetchCampusDirectorHierarchy,
  type CampusDirectorHierarchy,
  type HierarchyDepartment,
  type HierarchyFest,
} from "@/lib/campusDirectorAnalyticsApi";
import {
  organizingSchools,
  getDepartmentOptionsForSchool,
  inferSchoolFromDepartment,
} from "@/app/lib/eventFormSchema";
import InfoHint from "@/app/_components/Admin/InfoHint";

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const num = (n: number) => (Number(n) || 0).toLocaleString("en-IN");
const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

function cx(...v: Array<string | false | undefined>) {
  return v.filter(Boolean).join(" ");
}

function rateColor(rate: number) {
  if (rate >= 80) return "#10B981";
  if (rate >= 60) return "#F59E0B";
  return "#EF4444";
}

// A school is the canonical school from eventFormSchema; its departments are
// grouped from the data via the department → school mapping (same source the
// "Filter by" dropdowns use), so the school list and the departments under each
// are always proper regardless of the raw organizing_school stored on the data.
type SchoolGroup = {
  school: string;
  departments: number;
  fests: number;
  events: number;
  registrations: number;
  attended: number;
  attendanceRate: number;
  budgetTotal: number;
  departmentList: HierarchyDepartment[];
};

const canon = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");

function emptyDept(label: string): HierarchyDepartment {
  return {
    department: label,
    fests: 0,
    events: 0,
    registrations: 0,
    attended: 0,
    attendanceRate: 0,
    budgetTotal: 0,
    festList: [],
  };
}

function buildSchools(departments: HierarchyDepartment[]): SchoolGroup[] {
  const bySchool = new Map<string, HierarchyDepartment[]>();
  for (const d of departments) {
    const school = inferSchoolFromDepartment(d.department) || "Other";
    if (!bySchool.has(school)) bySchool.set(school, []);
    bySchool.get(school)!.push(d);
  }
  // Show every canonical school (so the list matches the filter dropdown), plus
  // an "Other" bucket for departments that don't map to a known school.
  const names = organizingSchools.map((s) => s.label);
  if (bySchool.has("Other")) names.push("Other");

  const sum = (arr: HierarchyDepartment[], k: "fests" | "events" | "registrations" | "attended" | "budgetTotal") =>
    arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);

  return names
    .map((school) => {
      const dataDepts = bySchool.get(school) || [];
      const dataByCanon = new Map<string, HierarchyDepartment>();
      for (const d of dataDepts) dataByCanon.set(canon(d.department), d);

      // Every canonical department for this school (matches the filter dropdown),
      // populated with data where present, zero-filled otherwise.
      const used = new Set<string>();
      const fromCanonical = getDepartmentOptionsForSchool(school).map((opt) => {
        const match = dataByCanon.get(canon(opt.label)) || dataByCanon.get(canon(opt.value));
        if (match) {
          used.add(canon(match.department));
          return { ...match, department: opt.label };
        }
        return emptyDept(opt.label);
      });
      // Departments present in the data but not in the canonical list for this school.
      const orphans = dataDepts.filter((d) => !used.has(canon(d.department)));
      const departmentList = [...fromCanonical, ...orphans].sort((a, b) => b.attended - a.attended);

      const registrations = sum(departmentList, "registrations");
      const attended = sum(departmentList, "attended");
      return {
        school,
        departments: departmentList.length,
        fests: sum(departmentList, "fests"),
        events: sum(departmentList, "events"),
        registrations,
        attended,
        attendanceRate: registrations ? Math.round((attended / registrations) * 1000) / 10 : 0,
        budgetTotal: Math.round(sum(departmentList, "budgetTotal") * 100) / 100,
        departmentList,
      };
    })
    .sort((a, b) => b.attended - a.attended);
}

type Props = {
  days?: number;
  start?: string;
  end?: string;
};

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#154CB3]/10 text-[#154CB3]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="truncate text-sm font-bold text-[#063168]">{value}</p>
      </div>
    </div>
  );
}

function RateBadge({ rate }: { rate: number }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ background: `${rateColor(rate)}1a`, color: rateColor(rate) }}
    >
      {pct(rate)} attended
    </span>
  );
}

// Horizontal comparison bar chart (good for long school/department names).
function CompareChart({
  data,
  nameKey,
}: {
  data: Array<{ name: string; attended: number; rate: number }>;
  nameKey: string;
}) {
  if (!data.length) return null;
  const height = Math.max(140, data.length * 44 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={150}
          tick={{ fontSize: 11, fill: "#475569" }}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
        />
        <Tooltip formatter={(value: number) => num(value)} />
        <Bar dataKey="attended" name="Attended" radius={[0, 6, 6, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={rateColor(d.rate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function CampusHierarchyExplorer({ days, start, end }: Props) {
  const [data, setData] = useState<CampusDirectorHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [school, setSchool] = useState<SchoolGroup | null>(null);
  const [dept, setDept] = useState<HierarchyDepartment | null>(null);
  const [expandedFest, setExpandedFest] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCampusDirectorHierarchy({ days, start, end }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load hierarchy");
    } finally {
      setLoading(false);
    }
  }, [days, start, end]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset the drill-down whenever the data reloads (date range changed).
  useEffect(() => {
    setSchool(null);
    setDept(null);
    setExpandedFest(null);
  }, [data]);

  const level: 1 | 2 | 3 = dept ? 3 : school ? 2 : 1;

  const Header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-[#063168]">Campus Explorer</h2>
        <InfoHint
          label="Campus Explorer"
          text="Drill down through the campus: schools, then the departments under each, then the fests they host and the events inside. Reflects the selected date range; not affected by the school/department filters above."
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {Header}
        <div className="flex items-center justify-center py-16 text-slate-500">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[#154CB3]" /> Loading campus explorer…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {Header}
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
          <p className="font-semibold text-red-700">Could not load the explorer</p>
          <p className="mt-1 text-sm text-red-600">{error || "No data available."}</p>
          <button
            onClick={load}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const schools = buildSchools(data.departments);

  const Breadcrumb = (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      <button
        onClick={() => {
          setSchool(null);
          setDept(null);
          setExpandedFest(null);
        }}
        className={cx(
          "rounded-md px-2 py-1 font-semibold",
          level === 1 ? "bg-[#063168] text-white" : "text-[#154CB3] hover:underline"
        )}
      >
        All Schools
      </button>
      {school && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => {
              setDept(null);
              setExpandedFest(null);
            }}
            className={cx(
              "max-w-[260px] truncate rounded-md px-2 py-1 font-semibold",
              level === 2 ? "bg-[#063168] text-white" : "text-[#154CB3] hover:underline"
            )}
            title={school.school}
          >
            {school.school}
          </button>
        </>
      )}
      {dept && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="max-w-[260px] truncate rounded-md bg-[#063168] px-2 py-1 font-semibold text-white" title={dept.department}>
            {dept.department}
          </span>
        </>
      )}
    </nav>
  );

  // ── Level 1: all schools ─────────────────────────────────────────────────
  const renderSchools = () => {
    if (!schools.some((s) => s.events > 0)) {
      return <p className="py-12 text-center text-sm text-slate-400">No fest or event activity in this date range.</p>;
    }
    const chartData = schools.map((s) => ({ name: s.school, attended: s.attended, rate: s.attendanceRate }));
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Attendance by school</p>
          <CompareChart data={chartData} nameKey="name" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((s) => (
            <button
              key={s.school}
              onClick={() => {
                setSchool(s);
                setExpandedFest(null);
              }}
              className={cx(
                "group rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:border-[#154CB3] hover:shadow-md",
                s.events > 0 ? "border-slate-200" : "border-slate-100 opacity-70"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#154CB3]/10 text-[#154CB3]">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <p className="font-bold leading-tight text-[#063168]">{s.school}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#154CB3]" />
              </div>
              <div className="mb-3"><RateBadge rate={s.attendanceRate} /></div>
              <div className="grid grid-cols-2 gap-2.5">
                <Metric icon={<Layers className="h-4 w-4" />} label="Departments" value={num(s.departments)} />
                <Metric icon={<CalendarDays className="h-4 w-4" />} label="Fests" value={num(s.fests)} />
                <Metric icon={<Ticket className="h-4 w-4" />} label="Events" value={num(s.events)} />
                <Metric icon={<Users className="h-4 w-4" />} label="Attended" value={`${num(s.attended)} / ${num(s.registrations)}`} />
                <Metric icon={<Wallet className="h-4 w-4" />} label="Budget" value={inr(s.budgetTotal)} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Level 2: departments within the selected school ──────────────────────
  const renderDepartments = () => {
    if (!school) return null;
    if (!school.departmentList.length) {
      return <p className="py-12 text-center text-sm text-slate-400">No departments listed for this school.</p>;
    }
    const chartData = school.departmentList.map((d) => ({ name: d.department, attended: d.attended, rate: d.attendanceRate }));
    return (
      <div className="space-y-5">
        {chartData.length > 0 && (
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Attendance by department</p>
            <CompareChart data={chartData} nameKey="name" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {school.departmentList.map((d) => (
            <button
              key={d.department}
              onClick={() => {
                setDept(d);
                setExpandedFest(null);
              }}
              className={cx(
                "group rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:border-[#154CB3] hover:shadow-md",
                d.events > 0 ? "border-slate-200" : "border-slate-100 opacity-70"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#154CB3]/10 text-[#154CB3]">
                    <Layers className="h-4 w-4" />
                  </span>
                  <p className="font-bold leading-tight text-[#063168]">{d.department}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#154CB3]" />
              </div>
              <div className="mb-3"><RateBadge rate={d.attendanceRate} /></div>
              <div className="grid grid-cols-2 gap-2.5">
                <Metric icon={<CalendarDays className="h-4 w-4" />} label="Fests" value={num(d.fests)} />
                <Metric icon={<Ticket className="h-4 w-4" />} label="Events" value={num(d.events)} />
                <Metric icon={<Users className="h-4 w-4" />} label="Attended" value={`${num(d.attended)} / ${num(d.registrations)}`} />
                <Metric icon={<Wallet className="h-4 w-4" />} label="Budget" value={inr(d.budgetTotal)} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Level 3: fests (expandable to events) within the selected department ──
  const renderFests = () => {
    if (!dept) return null;
    if (!dept.festList.length) {
      return <p className="py-12 text-center text-sm text-slate-400">No fests or events for this department.</p>;
    }
    return (
      <div className="space-y-3">
        {dept.festList.map((f) => (
          <FestRow
            key={f.festId ?? f.name}
            fest={f}
            expanded={expandedFest === (f.festId ?? f.name)}
            onToggle={() =>
              setExpandedFest((prev) => (prev === (f.festId ?? f.name) ? null : f.festId ?? f.name))
            }
          />
        ))}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {Header}
      {Breadcrumb}
      {level === 1 && renderSchools()}
      {level === 2 && renderDepartments()}
      {level === 3 && renderFests()}
    </section>
  );
}

function FestRow({
  fest,
  expanded,
  onToggle,
}: {
  fest: HierarchyFest;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-slate-50/60 px-4 py-3 text-left hover:bg-slate-100/70"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown className={cx("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")} />
          <CalendarDays className="h-4 w-4 shrink-0 text-[#154CB3]" />
          <span className="truncate font-bold text-[#063168]" title={fest.name}>{fest.name}</span>
          {fest.standalone && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">standalone</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
          <span>{num(fest.events)} events</span>
          {fest.budgetTotal > 0 && <span className="hidden md:inline">{inr(fest.budgetTotal)}</span>}
          <RateBadge rate={fest.attendanceRate} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          {fest.eventList.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="py-1.5 text-left font-medium">Event</th>
                    <th className="py-1.5 text-left font-medium">Category</th>
                    <th className="py-1.5 text-right font-medium">Regs / Attended</th>
                    <th className="py-1.5 text-right font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {fest.eventList.map((e) => (
                    <tr key={e.eventId} className="border-b border-slate-50">
                      <td className="max-w-[220px] truncate py-1.5 text-slate-800" title={e.title}>{e.title}</td>
                      <td className="py-1.5 text-slate-500">{e.category}</td>
                      <td className="py-1.5 text-right text-slate-600">{num(e.registrations)} / {num(e.attended)}</td>
                      <td className="py-1.5 text-right text-slate-600">
                        {e.feedback.count ? `${e.feedback.score.toFixed(1)} ★` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">No events under this fest in range.</p>
          )}
        </div>
      )}
    </div>
  );
}
