"use client";

import React from "react";
import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface GlassyCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const GlassyCard = ({ children, className = "", delay = 0 }: GlassyCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
    className={`bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm shadow-slate-200/40 backdrop-blur-xl hover:shadow-xl hover:shadow-slate-200/60 transition-all ${className}`}
  >
    {children}
  </motion.div>
);

interface KPIProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  color?: string;
  delay?: number;
}

export const KPICard = ({ 
  label, 
  value, 
  icon: Icon, 
  trend, 
  trendPositive, 
  color = "#154CB3",
  delay = 0 
}: KPIProps) => (
  <GlassyCard delay={delay} className="flex flex-col justify-between">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div 
          className="h-10 w-10 rounded-2xl flex items-center justify-center" 
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
    </div>
    <div className="mt-6 flex items-baseline gap-3">
      <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</h3>
      {trend && (
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
          trendPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {trend}
        </span>
      )}
    </div>
  </GlassyCard>
);

export const StatusPill = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    draft: "bg-slate-100 text-slate-700 border-slate-200",
  };
  
  const normalized = status.toLowerCase();
  
  return (
    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${styles[normalized] || styles.draft}`}>
      {status}
    </span>
  );
};

export const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-8">
    <h2 className="text-2xl font-black tracking-tighter text-slate-900">{title}</h2>
    {description && <p className="text-sm font-medium text-slate-500 mt-1">{description}</p>}
  </div>
);

export const BentoGrid = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 ${className}`}>
    {children}
  </div>
);
