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

const BASE_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Socio",
    description:
      "Your platform for discovering and registering for events, fests, and activities at your university. Let us show you around — takes under a minute.",
    target: null,
  },
  {
    id: "campus-filter",
    title: "Find events near you",
    description:
      "Switch between campuses using this dropdown. Events, fests and clubs are filtered to your selected location.",
    target: '[data-tour="campus-filter"]',
    position: "bottom",
  },
  {
    id: "trending-events",
    title: "What's trending",
    description:
      "See the most popular events happening at your campus right now. Click any card to view details and register.",
    target: '[data-tour="trending-events"]',
    position: "top",
  },
  {
    id: "categories",
    title: "Browse by category",
    description: "Academic, Cultural, Sports and more — filter by what interests you most.",
    target: '[data-tour="categories"]',
    position: "top",
  },
  {
    id: "profile-menu",
    title: "Your profile",
    description: "Access your registered events, badges and account settings here.",
    target: '[data-tour="profile-menu"]',
    position: "bottom",
  },
];

const ORGANISER_STEP: TourStep = {
  id: "organiser-pill",
  title: "Your organiser panel",
  description:
    "Jump to your event management dashboard anytime — create events, manage registrations and track attendance.",
  target: '[data-tour="organiser-pill"]',
  position: "bottom",
};

const MASTERADMIN_STEP: TourStep = {
  id: "admin-pill",
  title: "Your admin dashboard",
  description:
    "Full control from here — manage users, roles, events, fests, approvals and platform-wide settings.",
  target: '[data-tour="admin-pill"]',
  position: "bottom",
};

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
      return { top: Math.min(rect.top + rect.height + PAD, window.innerHeight - 200), left: clampedLeft };
  }
}

export function TourGuide() {
  const { userData, session, isMasterAdmin, isSupport, isStudentOrganiser } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);

  const isOrganiser = Boolean(userData?.is_organiser) || isStudentOrganiser;
  const steps = [
    ...BASE_STEPS,
    ...(isOrganiser ? [ORGANISER_STEP] : []),
    ...(isMasterAdmin ? [MASTERADMIN_STEP] : []),
  ];
  const current = steps[stepIdx];
  const total = steps.length;

  useEffect(() => {
    if (!userData?.email) return;
    if (userData.tour_seen) return;

    // Show if organiser, masteradmin, or plain student.
    // Only skip for support/hod/dean/etc. who have none of these roles.
    const isPlainStudent =
      !isMasterAdmin &&
      !isSupport &&
      !userData.is_hod &&
      !userData.is_dean &&
      !userData.is_cfo &&
      !userData.is_campus_director &&
      !userData.is_accounts_office &&
      !userData.is_venue_manager;

    if (!isOrganiser && !isMasterAdmin && !isPlainStudent) return;

    const t = setTimeout(() => setActive(true), 1500);
    return () => clearTimeout(t);
  }, [userData?.email, userData?.tour_seen, isOrganiser]);

  const updateRect = useCallback(() => {
    if (!current?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.target);
    if (!el) {
      setRect(null);
      return;
    }
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
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
  }, [userData?.email, session?.access_token]);

  const next = () => {
    if (stepIdx < total - 1) setStepIdx((s) => s + 1);
    else finish();
  };

  const back = () => setStepIdx((s) => Math.max(0, s - 1));

  if (!active) return null;

  const tooltipStyle = computeTooltipStyle(rect, current.position);

  return (
    <>
      {/* Full-screen backdrop — blocks interaction with page */}
      <div className="fixed inset-0 z-[9997]" />

      {/* Welcome step dimmer (no spotlight) */}
      {!rect && <div className="fixed inset-0 z-[9997] bg-black/55" />}

      {/* Spotlight ring around the target element */}
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

      {/* Tooltip card */}
      <div
        className="fixed z-[9999] w-72 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-5"
        style={tooltipStyle}
      >
        {/* Progress dots + counter */}
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
