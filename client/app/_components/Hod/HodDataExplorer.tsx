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
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart
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
import { GlassyCard, KPICard, BentoGrid, SectionHeader } from "./DashboardUI";

type DatePreset = "30" | "90" | "180" | "365";
type InsightTone = "risk" | "opportunity";

const KPI_ICONS: Record<string, any> = {
  participationRate: Users,
  attendanceRate: Target,
  dropOffRate: TrendingDown,
  avgEventsPerStudent: Activity,
  activeStudentsPct: TrendingUp,
  activeTeachers: GraduationCap,
  totalDeptEvents: CalendarDays,
};

const CHART_COLORS = ["#154CB3", "#30A4EF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
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
        if (silent) setIsRefreshing(true);
        else setIsLoading(true);
        const response = await fetchHodAnalytics(query);
        setBundle(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load intelligence.");
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

  const monthlyTrend = useMemo(
    () => (bundle?.overview.monthlyTrend ?? []).map((item) => ({
      ...item,
      monthLabel: formatMonth(item.month),
    })),
    [bundle?.overview.monthlyTrend]
  );

  const radarData = useMemo(() => {
    if (!bundle) return [];
    return bundle.events.categoryPerformance.slice(0, 6).map(cat => ({
      subject: cat.category,
      A: cat.avgSuccessScore,
      B: cat.attendanceRate,
    }));
  }, [bundle]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#154CB3]" />
        <p className="text-sm font-bold text-slate-700 uppercase tracking-widest">Building Intelligence...</p>
      </div>
    );
  }

  if (!bundle) return null;

  return (
    <div className="space-y-10">
      {/* Control Bar */}
      <GlassyCard className="flex flex-wrap items-center justify-between gap-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
           <div className="bg-slate-50 border border-slate-200 rounded-2xl p-1 flex items-center">
              {(["30", "90", "180", "365"] as DatePreset[]).map((val) => (
                <button
                  key={val}
                  onClick={() => { setPreset(val); setCustomStart(""); setCustomEnd(""); }}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${
                    preset === val && !customStart ? "bg-[#154CB3] text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {val}D
                </button>
              ))}
           </div>
           
           <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2">
              <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)} 
                className="bg-transparent border-none text-[10px] font-bold text-slate-700 focus:ring-0 w-24" 
              />
              <span className="text-slate-300">/</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)} 
                className="bg-transparent border-none text-[10px] font-bold text-slate-700 focus:ring-0 w-24" 
              />
           </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadAnalytics(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2 rounded-2xl bg-[#154CB3] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export Intelligence
          </button>
        </div>
      </GlassyCard>

      <BentoGrid>
        {bundle.overview.kpis.map((kpi, idx) => (
          <KPICard 
            key={kpi.key}
            label={kpi.label}
            value={`${kpi.value.toFixed(1)}${kpi.unit}`}
            icon={KPI_ICONS[kpi.key] || Activity}
            trend={`${kpi.changePct >= 0 ? "+" : ""}${kpi.changePct.toFixed(1)}%`}
            trendPositive={kpi.key === "dropOffRate" ? kpi.changePct < 0 : kpi.changePct >= 0}
            delay={0.1 * idx}
          />
        ))}
      </BentoGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Engagement Fluid Trend */}
        <GlassyCard delay={0.4}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Monthly Engagement Fluid</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                   <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#154CB3" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#154CB3" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="registrations" stroke="#154CB3" strokeWidth={4} fill="url(#grad1)" />
                <Area type="monotone" dataKey="attendanceRate" stroke="#10B981" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassyCard>

        {/* Radar of Performance */}
        <GlassyCard delay={0.5}>
           <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Category Vectors</h3>
          </div>
          <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{fontSize: 9, fontWeight: 800, fill: '#475569'}} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Success" dataKey="A" stroke="#154CB3" fill="#154CB3" fillOpacity={0.6} dot />
                  <Radar name="Attendance" dataKey="B" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} dot />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                </RadarChart>
             </ResponsiveContainer>
          </div>
        </GlassyCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Composed Chart */}
        <GlassyCard delay={0.6}>
           <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Participation Dynamics</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bundle.events.attendanceByEvent.slice(0, 10)}>
                <XAxis dataKey="title" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <Tooltip />
                <Bar dataKey="registrations" barSize={30} fill="#E2E8F0" radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey="attended" stroke="#154CB3" strokeWidth={3} dot={{r: 4, fill: '#154CB3'}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassyCard>

        {/* Funnel of Engagement */}
        <GlassyCard delay={0.7}>
           <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Drop-off Intelligence</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Funnel dataKey="value" data={[
                  { name: 'Registrations', value: bundle.overview.funnel.registered, fill: '#154CB3' },
                  { name: 'Attendance', value: bundle.overview.funnel.attended, fill: '#30A4EF' },
                  { name: 'Feedback', value: bundle.overview.funnel.feedback, fill: '#10B981' },
                ]} isAnimationActive>
                  <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" style={{fontSize: '11px', fontWeight: 800}} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </GlassyCard>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassyCard className="lg:col-span-1" delay={0.8}>
           <div className="flex items-center gap-3 mb-6">
             <Brain className="h-5 w-5 text-[#154CB3]" />
             <h3 className="font-extrabold text-slate-900 tracking-tight">Intelligence Engine</h3>
           </div>
           <div className="space-y-4">
              {bundle.overview.insights.map((insight, i) => (
                <div key={i} className={`p-4 rounded-2xl border ${insight.type === 'risk' ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                   <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${insight.type === 'risk' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {insight.type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{insight.confidence} confidence</span>
                   </div>
                   <p className="text-xs font-bold text-slate-800 mb-1">{insight.title}</p>
                   <p className="text-[11px] font-medium text-slate-600 leading-relaxed">{insight.statement}</p>
                </div>
              ))}
           </div>
        </GlassyCard>

        {/* Segmentation & Behavior */}
        <GlassyCard className="lg:col-span-2" delay={0.9}>
           <div className="flex items-center gap-3 mb-6">
             <Sparkles className="h-5 w-5 text-[#154CB3]" />
             <h3 className="font-extrabold text-slate-900 tracking-tight">Behavioral Segmentation</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Top Catalysts (Students)</p>
                 {bundle.students.topEngaged.slice(0, 4).map(st => (
                   <div key={st.studentId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all">
                      <p className="text-xs font-bold text-slate-700">{st.name}</p>
                      <span className="text-xs font-black text-[#154CB3]">{st.engagementScore.toFixed(0)}</span>
                   </div>
                 ))}
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Organiser Pulse</p>
                 {bundle.teachers.teachers.byTeacher.slice(0, 4).map(t => (
                   <div key={t.teacherId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-all">
                      <div className="min-w-0">
                         <p className="text-xs font-bold text-slate-700 truncate">{t.name}</p>
                         <p className="text-[9px] font-bold text-slate-400">{t.eventsOrganized} events</p>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600">{(t.avgAttendanceRate).toFixed(0)}%</span>
                   </div>
                 ))}
              </div>
           </div>
        </GlassyCard>
      </div>
    </div>
  );
}
