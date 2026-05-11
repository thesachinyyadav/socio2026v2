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

const ORGANISER_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to your dashboard",
    description:
      "This is where you manage everything — fests, events, venue bookings, reports and volunteers. Let us walk you through it.",
    target: null,
  },
  {
    id: "book-venue",
    title: "Book a venue",
    description:
      "Reserve a campus venue for your event — halls, auditoriums and outdoor spaces. Requests go for approval before confirmation.",
    target: '[data-tour="book-venue"]',
    position: "bottom",
  },
  {
    id: "book-catering",
    title: "Book catering",
    description:
      "Arrange food and refreshments through the university catering service. Submit requirements in advance for smooth coordination.",
    target: '[data-tour="book-catering"]',
    position: "bottom",
  },
  {
    id: "book-stall",
    title: "Book stalls",
    description:
      "Set up stalls for exhibitions, food courts or sponsor displays at your fest. Assign slots and manage layouts from here.",
    target: '[data-tour="book-stall"]',
    position: "bottom",
  },
  {
    id: "create-fest",
    title: "Create a fest",
    description:
      "Launch a new fest — set dates, add a banner, write a description and assign student organisers to manage events under it.",
    target: '[data-tour="create-fest"]',
    position: "bottom",
  },
  {
    id: "create-event",
    title: "Create an event",
    description:
      "Add a standalone event or one under an existing fest. Configure registration limits, deadlines, custom fields and publish when ready.",
    target: '[data-tour="create-event"]',
    position: "bottom",
  },
  {
    id: "tab-fests",
    title: "Your fests",
    description:
      "See all your fests, their approval status and quick actions. Click a fest to manage its events, approvals and bookings.",
    target: '[data-tour="tab-fests"]',
    position: "bottom",
  },
  {
    id: "tab-events",
    title: "Your events",
    description:
      "All your events in one place — edit details, send reminders, manage registrations and track attendance.",
    target: '[data-tour="tab-events"]',
    position: "bottom",
  },
  {
    id: "tab-report",
    title: "Reports",
    description:
      "Generate master sheets for NAAC, NBA, AACSB and other accreditation bodies. Export full participation data with one click.",
    target: '[data-tour="tab-report"]',
    position: "bottom",
  },
  {
    id: "tab-volunteers",
    title: "Volunteers",
    description:
      "Assign student organisers to your fests and add event volunteers. Manage expiry dates and revoke access anytime.",
    target: '[data-tour="tab-volunteers"]',
    position: "bottom",
  },
];

const STUDENT_ORGANISER_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome, Student Organiser",
    description:
      "This is your event dashboard. You can create and manage events under the fests your organiser has assigned to you.",
    target: null,
  },
  {
    id: "tab-fests",
    title: "Your assigned fests",
    description:
      "These are the fests you've been added to as a sub-organiser. Browse them to see which events are running under each one.",
    target: '[data-tour="tab-fests"]',
    position: "bottom",
  },
  {
    id: "create-event",
    title: "Create an event",
    description:
      "Add a new event under one of your assigned fests. Fill in the details, set registration limits and publish when ready for approval.",
    target: '[data-tour="create-event"]',
    position: "bottom",
  },
  {
    id: "tab-events",
    title: "Your events",
    description:
      "All events you've created are listed here. Edit details, track registrations, manage attendance and send reminders.",
    target: '[data-tour="tab-events"]',
    position: "bottom",
  },
  {
    id: "tab-volunteers",
    title: "Volunteers",
    description:
      "Add volunteers to help run your events and manage their assignments from this tab.",
    target: '[data-tour="tab-volunteers"]',
    position: "bottom",
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

export function TourGuideManage() {
  const { userData, session, isStudentOrganiser } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);

  const isOrganiser = Boolean(userData?.is_organiser);
  const tourKey = isStudentOrganiser ? "student" : "organiser";
  const steps = isStudentOrganiser ? STUDENT_ORGANISER_STEPS : ORGANISER_STEPS;
  const current = steps[stepIdx];
  const total = steps.length;

  const tourSeen = userData?.tour_seen;
  const hasSeenThisTour =
    typeof tourSeen === "object" &&
    tourSeen !== null &&
    (tourSeen as Record<string, boolean>)[tourKey] === true;

  useEffect(() => {
    if (!userData?.email) return;
    if (!isOrganiser && !isStudentOrganiser) return;
    if (hasSeenThisTour) return;

    const t = setTimeout(() => setActive(true), 1500);
    return () => clearTimeout(t);
  }, [userData?.email, isOrganiser, isStudentOrganiser, hasSeenThisTour]);

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
        body: JSON.stringify({ tourKey }),
      }).catch(() => {});
    }
  }, [userData?.email, session?.access_token, tourKey]);

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
