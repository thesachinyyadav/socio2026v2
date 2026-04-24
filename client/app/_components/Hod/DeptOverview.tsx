"use client";

import React, { useMemo } from "react";
import { 
  Users, 
  Target, 
  Calendar, 
  TrendingUp, 
  Activity, 
  Sparkles,
  Zap
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  ComposedChart,
  Line,
  Cell
} from "recharts";
import { GlassyCard, KPICard, BentoGrid, SectionHeader } from "./DashboardUI";
import { HodAnalyticsBundle } from "@/lib/hodAnalyticsApi";

interface DeptOverviewProps {
  bundle: HodAnalyticsBundle;
}

const CHART_COLORS = ["#154CB3", "#30A4EF", "#10B981", "#F59E0B", "#EF4444"];

export default function DeptOverview({ bundle }: DeptOverviewProps) {
  const { overview, events, students, teachers } = bundle;

  const radarData = useMemo(() => {
    return events.categoryPerformance.slice(0, 5).map(cat => ({
      subject: cat.category,
      A: cat.avgSuccessScore,
      B: cat.attendanceRate,
      fullMark: 100,
    }));
  }, [events.categoryPerformance]);

  const trendData = useMemo(() => {
    return overview.monthlyTrend.map(m => ({
      name: m.month.split("-")[1], // Just month number
      registrations: m.registrations,
      performance: m.attendanceRate,
    }));
  }, [overview.monthlyTrend]);

  return (
    <div className="space-y-10">
      <SectionHeader 
        title={`${overview.department} Intelligence Hub`} 
        description="High-fidelity departmental performance and engagement snapshots."
      />

      {/* KPI Bento Grid */}
      <BentoGrid>
        <KPICard 
          label="Participation Rate" 
          value={`${overview.stats.participationRate.toFixed(1)}%`} 
          icon={Target}
          trend={`${overview.growthRate >= 0 ? "+" : ""}${overview.growthRate}%`}
          trendPositive={overview.growthRate >= 0}
          delay={0.1}
        />
        <KPICard 
          label="Active Organisers" 
          value={teachers.teachers.summary.activeTeachers} 
          icon={Zap}
          color="#10B981"
          delay={0.2}
        />
        <KPICard 
          label="Dept Events" 
          value={overview.totalDeptEvents} 
          icon={Calendar}
          color="#F59E0B"
          delay={0.3}
        />
        <KPICard 
          label="Total Engaged" 
          value={students.segmentation.active} 
          icon={Users}
          color="#30A4EF"
          delay={0.4}
        />
      </BentoGrid>

      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registration Trend - Area Chart */}
        <GlassyCard className="lg:col-span-2" delay={0.5}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Activity Pulse
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#154CB3" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#154CB3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94A3B8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94A3B8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="registrations" stroke="#154CB3" strokeWidth={3} fillOpacity={1} fill="url(#colorReg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassyCard>

        {/* Category Radar Chart */}
        <GlassyCard delay={0.6}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Category Success
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{fontSize: 9, fontWeight: 700, fill: '#64748B'}} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Success Score" dataKey="A" stroke="#154CB3" fill="#154CB3" fillOpacity={0.5} />
                <Radar name="Attendance %" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassyCard>
      </div>

      {/* Third Row: Composed Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GlassyCard delay={0.7}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Top Performers
            </h3>
          </div>
          <div className="space-y-4">
            {events.topEvents.slice(0, 4).map((event, i) => (
              <div key={event.eventId} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-[#154CB3]/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-400 group-hover:text-[#154CB3]">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{event.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{event.successScore.toFixed(0)} Success Score</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#154CB3]">{event.attendanceRate.toFixed(1)}%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendance</p>
                </div>
              </div>
            ))}
          </div>
        </GlassyCard>

        <GlassyCard delay={0.8}>
           <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Engagement Funnel
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={[
                { name: 'Regd', value: events.funnel.registered, fill: '#154CB3' },
                { name: 'Attnd', value: events.funnel.attended, fill: '#30A4EF' },
                { name: 'Feedbk', value: events.funnel.feedback, fill: '#10B981' }
              ]} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#475569'}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassyCard>
      </div>
    </div>
  );
}
