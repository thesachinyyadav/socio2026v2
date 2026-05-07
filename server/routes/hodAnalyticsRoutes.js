import express from "express";
import {
  authenticateUser,
  checkRoleExpiration,
  getUserInfo,
  requireHOD,
} from "../middleware/authMiddleware.js";
import { buildHodAnalyticsSnapshot } from "../services/analyticsEngine.js";
import { createClient } from "@supabase/supabase-js";
import "../config/loadEnv.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

router.use(authenticateUser, getUserInfo(), checkRoleExpiration, requireHOD);

function resolveDepartment(req, res) {
  const dept = req.userInfo.department?.trim();
  if (!dept) {
    res.status(400).json({
      error: "Department not configured for this HOD account. Please contact admin.",
    });
    return null;
  }
  return dept;
}

async function getSnapshot(req, res) {
  const dept = resolveDepartment(req, res);
  if (!dept) return null;
  try {
    return await buildHodAnalyticsSnapshot(req.query, dept);
  } catch (err) {
    console.error("[HOD Analytics] Snapshot error:", err);
    res.status(500).json({
      error: "Failed to generate analytics. Please try again later.",
      details: err.message,
    });
    return null;
  }
}

router.get("/overview", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    dataQuality: s.dataQuality,
    kpis: s.overview.kpis,
    stats: s.overview.currentStats,
    previousStats: s.overview.previousStats,
    funnel: s.events.funnel,
    monthlyTrend: s.time.monthlyTrend,
    growthRate: s.time.growthRate,
    insights: s.overview.insights,
    activeTeachers: s.teachers.summary.activeTeachers,
    totalDeptEvents: s.dataQuality.events,
  });
});

router.get("/students", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    segmentation: s.students.segmentation,
    topEngaged: s.students.topEngaged,
    atRisk: s.students.atRisk,
    behavior: s.students.behavior,
    engagementScores: s.students.byStudent,
  });
});

router.get("/teachers", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    teachers: s.teachers,
  });
});

router.get("/events", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    attendanceByEvent: s.events.attendanceByEvent,
    topEvents: s.events.topEvents,
    categoryPerformance: s.events.categoryPerformance,
    funnel: s.events.funnel,
    overallAttendanceRate: s.events.overallAttendanceRate,
  });
});

// ─── Fest Dashboard: list fests for HOD's department ─────────────────────────
router.get("/fests", async (req, res) => {
  const dept = resolveDepartment(req, res);
  if (!dept) return;

  try {
    const { data: fests, error } = await supabase
      .from("fests")
      .select("fest_id, fest_title, opening_date, closing_date")
      .ilike("organizing_dept", dept)
      .neq("is_archived", true)
      .eq("is_draft", false)
      .order("opening_date", { ascending: false });

    if (error) throw error;

    const fmt = (d) => {
      if (!d) return "";
      return new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    const result = (fests || []).map((f) => ({
      id: f.fest_id,
      name: f.fest_title,
      dates:
        f.opening_date && f.closing_date
          ? `${fmt(f.opening_date)} – ${fmt(f.closing_date)}`
          : f.opening_date
          ? fmt(f.opening_date)
          : "",
    }));

    return res.status(200).json({ fests: result, department: dept });
  } catch (err) {
    console.error("[HOD Fests] Error:", err);
    return res.status(500).json({ error: "Failed to fetch fests. Please try again later." });
  }
});

// ─── Fest Dashboard: full summary for a selected fest ─────────────────────────
router.get("/fest-summary", async (req, res) => {
  const dept = resolveDepartment(req, res);
  if (!dept) return;

  const { festId } = req.query;
  if (!festId) {
    return res.status(400).json({ error: "festId query parameter is required" });
  }

  try {
    // 1. Fetch the fest record
    const { data: festRow, error: festErr } = await supabase
      .from("fests")
      .select("fest_id, fest_title, opening_date, closing_date")
      .eq("fest_id", festId)
      .ilike("organizing_dept", dept)
      .single();

    if (festErr || !festRow) {
      return res.status(404).json({ error: "Fest not found for this department" });
    }

    // 2. Fetch events for this fest in this dept
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("event_id, title, category, event_date, description")
      .eq("fest_id", festId)
      .ilike("organizing_dept", dept)
      .eq("is_archived", false)
      .eq("is_draft", false);

    if (evErr) throw evErr;

    const eventList = events || [];
    const eventIds = eventList.map((e) => e.event_id);

    if (eventIds.length === 0) {
      const fmt = (d) =>
        d
          ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "";
      return res.status(200).json({
        fest: {
          id: festRow.fest_id,
          name: festRow.fest_title,
          dates:
            festRow.opening_date && festRow.closing_date
              ? `${fmt(festRow.opening_date)} – ${fmt(festRow.closing_date)}`
              : "",
        },
        department: dept,
        summary: { events: 0, registrations: 0, attendance: 0, attendanceRate: 0, dropOff: 0, insiders: 0, outsiders: 0, feedbackRate: 0 },
        events: [],
        deptBreakdown: [],
      });
    }

    // 3. Parallel data fetch
    const [regsResult, attendResult, feedbackResult] = await Promise.all([
      supabase
        .from("registrations")
        .select("registration_id, event_id, individual_email, team_leader_email, participant_organization")
        .in("event_id", eventIds),
      supabase
        .from("attendance_status")
        .select("registration_id, event_id")
        .in("event_id", eventIds)
        .eq("status", "attended"),
      supabase
        .from("feedbacks")
        .select("event_id, data")
        .in("event_id", eventIds),
    ]);

    if (regsResult.error) throw regsResult.error;
    if (attendResult.error) throw attendResult.error;
    if (feedbackResult.error && feedbackResult.error.code !== "PGRST116") throw feedbackResult.error;

    const allRegs = regsResult.data || [];
    const allAttended = attendResult.data || [];
    const allFeedbacks = feedbackResult.data || [];

    // 4. Build lookup maps
    const attendedRegIds = new Set(allAttended.map((a) => a.registration_id));
    const regsByEvent = {};
    const attendedByEvent = {};
    for (const r of allRegs) {
      if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
      regsByEvent[r.event_id].push(r);
    }
    for (const a of allAttended) {
      if (!attendedByEvent[a.event_id]) attendedByEvent[a.event_id] = [];
      attendedByEvent[a.event_id].push(a);
    }
    const feedbackByEvent = {};
    for (const f of allFeedbacks) {
      feedbackByEvent[f.event_id] = f.data || {};
    }

    // 5. Dept breakdown — look up courses for attendees
    const attendedRegs = allRegs.filter((r) => attendedRegIds.has(r.registration_id));
    const attendeeEmails = [
      ...new Set(
        attendedRegs
          .flatMap((r) => [r.individual_email, r.team_leader_email])
          .filter(Boolean)
      ),
    ];

    let userCourseMap = {};
    if (attendeeEmails.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("email, course")
        .in("email", attendeeEmails);
      for (const u of users || []) {
        if (u.course) userCourseMap[u.email] = u.course;
      }
    }

    const courseCounts = {};
    for (const r of attendedRegs) {
      const email = r.individual_email || r.team_leader_email;
      const course = email && userCourseMap[email];
      if (course) {
        courseCounts[course] = (courseCounts[course] || 0) + 1;
      }
    }

    const DEPT_COLORS = [
      "#154CB3", "#1E5BC6", "#3473D7", "#0EA5A4", "#22C5C0",
      "#A855F7", "#F59E0B", "#10B981", "#EF4444", "#0284C7",
    ];
    const deptBreakdown = Object.entries(courseCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, count], i) => ({ dept, count, color: DEPT_COLORS[i % DEPT_COLORS.length] }));

    // 6. Compute per-event stats
    const FB_QUESTIONS = ["q1", "q2", "q3", "q4", "q5"];

    const fmt = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";

    const eventResults = eventList.map((ev) => {
      const evRegs = regsByEvent[ev.event_id] || [];
      const evAttended = attendedByEvent[ev.event_id] || [];
      const regs = evRegs.length;
      const attend = evAttended.length;
      const rate = regs > 0 ? Math.round((attend / regs) * 1000) / 10 : 0;

      const insiders = evRegs.filter((r) => r.participant_organization === "christ_member").length;
      const outsiders = evRegs.filter((r) => r.participant_organization === "outsider").length;

      const fbData = feedbackByEvent[ev.event_id] || {};
      const fbEntries = Object.values(fbData);
      const fbCount = fbEntries.length;

      const fbAvgs = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
      if (fbCount > 0) {
        for (const qi of FB_QUESTIONS) {
          const idx = parseInt(qi.slice(1)) - 1;
          const sum = fbEntries.reduce((s, arr) => s + (Array.isArray(arr) ? (arr[idx] || 0) : 0), 0);
          fbAvgs[qi] = Math.round((sum / fbCount) * 10) / 10;
        }
      }
      const scores = Object.values(fbAvgs);
      const fbScore =
        fbCount > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

      return {
        id: ev.event_id,
        name: ev.title,
        cat: ev.category || "Other",
        date: fmt(ev.event_date),
        regs,
        attend,
        rate,
        insiders,
        outsiders,
        description: ev.description || "",
        feedback: { count: fbCount, ...fbAvgs, score: fbScore },
      };
    });

    // 7. Overall summary
    const totalRegs = eventResults.reduce((s, e) => s + e.regs, 0);
    const totalAttend = eventResults.reduce((s, e) => s + e.attend, 0);
    const totalInsiders = eventResults.reduce((s, e) => s + e.insiders, 0);
    const totalOutsiders = eventResults.reduce((s, e) => s + e.outsiders, 0);
    const totalFbCount = eventResults.reduce((s, e) => s + e.feedback.count, 0);

    const festFmt = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";

    return res.status(200).json({
      fest: {
        id: festRow.fest_id,
        name: festRow.fest_title,
        dates:
          festRow.opening_date && festRow.closing_date
            ? `${festFmt(festRow.opening_date)} – ${festFmt(festRow.closing_date)}`
            : "",
      },
      department: dept,
      summary: {
        events: eventResults.length,
        registrations: totalRegs,
        attendance: totalAttend,
        attendanceRate: totalRegs > 0 ? Math.round((totalAttend / totalRegs) * 1000) / 10 : 0,
        dropOff: totalRegs - totalAttend,
        insiders: totalInsiders,
        outsiders: totalOutsiders,
        feedbackRate:
          totalAttend > 0 ? Math.round((totalFbCount / totalAttend) * 1000) / 10 : 0,
      },
      events: eventResults,
      deptBreakdown,
    });
  } catch (err) {
    console.error("[HOD Fest Summary] Error:", err);
    return res.status(500).json({ error: "Failed to fetch fest summary. Please try again later." });
  }
});

export default router;
