"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string | null;
  position?: "top" | "bottom" | "left" | "right";
}

const MASTERADMIN_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Admin Control",
    description:
      "This is your platform-wide control centre. You have full visibility and control over users, events, fests, roles, venues and more.",
    target: null,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description:
      "Your live analytics overview — KPIs, registration trends, revenue estimates and activity feed across all campuses and departments.",
    target: '[data-tour="admin-tab-dashboard"]',
    position: "right",
  },
  {
    id: "users",
    title: "Users",
    description:
      "Browse, search and manage every user on the platform. Edit roles, view registration history and delete accounts from here.",
    target: '[data-tour="admin-tab-users"]',
    position: "right",
  },
  {
    id: "events",
    title: "Events",
    description:
      "Full visibility into every event across all organisers — view registrations, edit details, archive or delete events platform-wide.",
    target: '[data-tour="admin-tab-events"]',
    position: "right",
  },
  {
    id: "fests",
    title: "Fests",
    description:
      "Manage all fests across the university. Review, edit or archive any fest regardless of which organiser created it.",
    target: '[data-tour="admin-tab-fests"]',
    position: "right",
  },
  {
    id: "notifications",
    title: "Notifications",
    description:
      "Broadcast announcements to all users, specific campuses or targeted groups. Use for urgent updates or platform-wide reminders.",
    target: '[data-tour="admin-tab-notifications"]',
    position: "right",
  },
  {
    id: "report",
    title: "Reports",
    description:
      "Generate master participation sheets formatted for NAAC, NBA, AACSB and other accreditation bodies — export in one click.",
    target: '[data-tour="admin-tab-report"]',
    position: "right",
  },
  {
    id: "roles",
    title: "Roles",
    description:
      "Grant or revoke elevated roles — HOD, Dean, CFO, Campus Director, IT Support, Venue Manager and more. Set expiry dates for time-limited access.",
    target: '[data-tour="admin-tab-roles"]',
    position: "right",
  },
  {
    id: "venues",
    title: "Venues",
    description:
      "Add and manage campus venues. Control which venues require approval for bookings and review all pending venue requests.",
    target: '[data-tour="admin-tab-venues"]',
    position: "right",
  },
  {
    id: "caterers",
    title: "Catering",
    description:
      "Register catering providers, manage their availability and oversee all catering requests linked to events and fests.",
    target: '[data-tour="admin-tab-caterers"]',
    position: "right",
  },
];

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

type SpotRect = { top: number; left: number; width: number; height: number };

function computeTooltipStyle(
  rect: SpotRect | null,
  position: TourStep["position"]
): React.CSSProperties {
  if (!rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  const PAD = 16;
  const TW = 288;
  const centerX = rect.left + rect.width / 2;
  const clampedLeft = Math.max(PAD, Math.min(centerX - TW / 2, window.innerWidth - TW - PAD));

  switch (position) {
    case "top":
      return { bottom: window.innerHeight - rect.top + PAD, left: clampedLeft };
    case "left":
      return { top: rect.top + rect.height / 2 - 80, right: window.innerWidth - rect.left + PAD };
    case "right":
      return { top: rect.top + rect.height / 2 - 80, left: rect.left + rect.width + PAD };
    case "bottom":
    default:
      return { top: Math.min(rect.top + rect.height + PAD, window.innerHeight - 220), left: clampedLeft };
  }
}

export function TourGuideMasterAdmin() {
  const { userData, session, isMasterAdmin } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);

  const steps = MASTERADMIN_STEPS;
  const current = steps[stepIdx];
  const total = steps.length;

  const tourSeen = userData?.tour_seen;
  const hasSeenThisTour =
    typeof tourSeen === "object" &&
    tourSeen !== null &&
    (tourSeen as Record<string, boolean>).masteradmin === true;

  useEffect(() => {
    if (!userData?.email) return;
    if (!isMasterAdmin) return;
    if (hasSeenThisTour) return;

    const t = setTimeout(() => setActive(true), 1500);
    return () => clearTimeout(t);
  }, [userData?.email, isMasterAdmin, hasSeenThisTour]);

  const updateRect = useCallback(() => {
    if (!current?.target) { setRect(null); return; }
    const el = document.querySelector(current.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current?.target]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, updateRect]);

  useEffect(() => {
    if (!active || !current?.target) return;
    const el = document.querySelector(current.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = setTimeout(updateRect, 420);
      return () => clearTimeout(t);
    }
  }, [stepIdx, active]);

  const finish = useCallback(() => {
    setActive(false);
    if (userData?.email && session?.access_token) {
      fetch(`${API_URL}/api/users/${encodeURIComponent(userData.email)}/tour-seen`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tourKey: "masteradmin" }),
      }).catch(() => {});
    }
  }, [userData?.email, session?.access_token]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  const next = () => {
    if (stepIdx < total - 1) setStepIdx((s) => s + 1);
    else finish();
  };
  const back = () => setStepIdx((s) => Math.max(0, s - 1));

  if (!active) return null;

  const tooltipStyle = computeTooltipStyle(rect, current.position);

  return (
    <>
      <div className="fixed inset-0 z-[9997]" />
      {!rect && <div className="fixed inset-0 z-[9997] bg-black/55" />}
      {rect && (
        <div
          className="fixed z-[9998] rounded-lg pointer-events-none"
          style={{
            top: rect.top - 5,
            left: rect.left - 5,
            width: rect.width + 10,
            height: rect.height + 10,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            outline: "2px solid rgba(139,92,246,0.7)",
            outlineOffset: "2px",
          }}
        />
      )}
      <div
        className="fixed z-[9999] w-72 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-5"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === stepIdx ? "w-4 bg-violet-500" : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-500 font-medium tabular-nums">
            {stepIdx + 1} / {total}
          </span>
        </div>
        <h3 className="text-sm font-bold text-white mb-1.5">{current.title}</h3>
        <p className="text-[12px] text-gray-400 leading-relaxed mb-4">{current.description}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={finish}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors shrink-0"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                onClick={back}
                className="text-[11px] font-medium text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={next}
              className="text-[11px] font-semibold bg-white text-[#18181b] px-3.5 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              {stepIdx === total - 1 ? "Done" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
