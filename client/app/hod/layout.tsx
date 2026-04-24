"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  BarChart3, 
  Layers, 
  ClipboardCheck, 
  MonitorDot, 
  Calendar, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Suspense } from "react";

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
}

const NavItem = ({ href, icon: Icon, label, active, collapsed }: NavItemProps) => (
  <Link
    href={href}
    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
      active 
        ? "bg-[#154CB3] text-white shadow-lg shadow-blue-500/20" 
        : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
    }`}
  >
    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-white" : "group-hover:text-[#154CB3]"}`} />
    {!collapsed && <span className="text-sm font-semibold tracking-tight">{label}</span>}
  </Link>
);

function BreadcrumbView() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "Overview";
  return <span className="text-slate-900 font-bold capitalize">{view}</span>;
}

export default function HodLayout({ children }: { children: React.ReactNode }) {
  const { userData, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>}>
      <HodLayoutContent collapsed={collapsed} setCollapsed={setCollapsed} pathname={pathname} userData={userData} signOut={signOut}>
        {children}
      </HodLayoutContent>
    </Suspense>
  );
}

function HodLayoutContent({ 
  children, 
  collapsed, 
  setCollapsed, 
  pathname, 
  userData, 
  signOut 
}: { 
  children: React.ReactNode; 
  collapsed: boolean; 
  setCollapsed: (v: boolean) => void;
  pathname: string;
  userData: any;
  signOut: () => void;
}) {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "overview";

  const navItems = [
    { href: "/hod", icon: LayoutDashboard, label: "Overview", view: "overview" },
    { href: "/hod?view=analytics", icon: BarChart3, label: "Intelligence", view: "analytics" },
    { href: "/hod?view=queue", icon: ClipboardCheck, label: "Approvals", view: "queue" },
    { href: "/hod?view=logistics", icon: MonitorDot, label: "Logistics", view: "logistics" },
    { href: "/hod?view=roadmap", icon: Calendar, label: "Dept Roadmap", view: "roadmap" },
  ];

  const departmentName = userData?.department || "Department";

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside 
        className={`relative flex flex-col bg-white border-r border-slate-200/60 transition-all duration-300 ease-in-out z-30 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-500" /> : <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />}
        </button>

        {/* Header */}
        <div className={`p-6 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#154CB3] to-[#30A4EF] flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
            <Layers className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</p>
              <h1 className="text-sm font-extrabold text-slate-900 truncate uppercase mt-0.5">{departmentName}</h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1.5 mt-4">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={currentView === item.view}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 mt-auto border-t border-slate-100">
          {!collapsed && (
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-xs font-bold text-slate-900 truncate">{userData?.name || "HOD"}</p>
                  <p className="text-[10px] font-medium text-slate-500 truncate">{userData?.email}</p>
                </div>
              </div>
            </div>
          )}
          <button 
            onClick={() => signOut()}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-semibold">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header/Breadcrumbs */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-8 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <span>Workspace</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <BreadcrumbView />
          </div>
          <div className="flex items-center gap-4">
             {/* Stats/Quick Actions can go here */}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 scroll-smooth">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
