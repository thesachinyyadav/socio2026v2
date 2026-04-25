import express from "express";
import {
  authenticateUser,
  checkRoleExpiration,
  getUserInfo,
  requireDean,
} from "../middleware/authMiddleware.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();
router.use(authenticateUser, getUserInfo(), checkRoleExpiration, requireDean);

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function avgFbFromData(fbData) {
  const entries = Object.values(fbData || {});
  if (!entries.length) return 0;
  let total = 0, count = 0;
  for (const arr of entries) {
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      if (typeof v === "number" && v > 0) { total += v; count++; }
    }
  }
  return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
}

function perQFromData(fbData) {
  const entries = Object.values(fbData || {});
  if (!entries.length) return { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  const sums = [0, 0, 0, 0, 0];
  let count = 0;
  for (const arr of entries) {
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < 5; i++) sums[i] += arr[i] || 0;
    count++;
  }
  if (!count) return { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  return {
    q1: Math.round((sums[0] / count) * 10) / 10,
    q2: Math.round((sums[1] / count) * 10) / 10,
    q3: Math.round((sums[2] / count) * 10) / 10,
    q4: Math.round((sums[3] / count) * 10) / 10,
    q5: Math.round((sums[4] / count) * 10) / 10,
  };
}

// ── GET /api/dean-analytics/summary ──────────────────────────────────────────
// Institution-wide KPIs + monthly trend + insider/outsider split
router.get("/summary", async (req, res) => {
  try {
    const [festsRes, eventsRes, regsRes, attendRes, feedbacksRes] = await Promise.all([
      supabase.from("fests").select("fest_id").eq("is_archived", false),
      supabase.from("events").select("event_id, event_date"),
      supabase.from("registrations").select("registration_id, event_id, created_at, participant_organization"),
      supabase.from("attendance_status").select("registration_id").eq("status", "attended"),
      supabase.from("feedbacks").select("event_id, data"),
    ]);

    if (festsRes.error) throw festsRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (regsRes.error) throw regsRes.error;
    if (attendRes.error) throw attendRes.error;

    const fests = festsRes.data || [];
    const events = eventsRes.data || [];
    const regs = regsRes.data || [];
    const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));
    const feedbacks = feedbacksRes.data || [];

    const totalFests = fests.length;
    const totalEvents = events.length;
    const totalRegistrations = regs.length;
    const totalAttended = regs.filter((r) => attendedIds.has(r.registration_id)).length;
    const avgAttendanceRate =
      totalRegistrations > 0
        ? Math.round((totalAttended / totalRegistrations) * 1000) / 10
        : 0;

    // Avg feedback across all events
    let fbTotal = 0, fbCount = 0;
    for (const f of feedbacks) {
      const entries = Object.values(f.data || {});
      for (const arr of entries) {
        if (!Array.isArray(arr)) continue;
        for (const v of arr) {
          if (typeof v === "number" && v > 0) { fbTotal += v; fbCount++; }
        }
      }
    }
    const avgFeedback = fbCount > 0 ? Math.round((fbTotal / fbCount) * 10) / 10 : 0;

    // Monthly trend — last 12 months of registrations vs attendance
    const monthMap = {};
    for (const r of regs) {
      if (!r.created_at) continue;
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { registrations: 0, attendance: 0 };
      monthMap[key].registrations++;
      if (attendedIds.has(r.registration_id)) monthMap[key].attendance++;
    }
    const sortedMonths = Object.keys(monthMap).sort().slice(-12);
    const monthlyTrend = sortedMonths.map((key) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", {
        month: "short", year: "numeric",
      });
      return { month: label, registrations: monthMap[key].registrations, attendance: monthMap[key].attendance };
    });

    // Insider / outsider
    const insiders = regs.filter((r) => r.participant_organization === "christ_member").length;
    const outsiders = regs.filter((r) => r.participant_organization === "outsider").length;

    return res.json({
      totalFests,
      totalEvents,
      totalRegistrations,
      totalAttended,
      avgAttendanceRate,
      avgFeedback,
      monthlyTrend,
      insiderOutsider: { insiders, outsiders },
    });
  } catch (err) {
    console.error("[Dean Analytics /summary]", err);
    return res.status(500).json({ error: "Failed to fetch summary", details: err.message });
  }
});

// ── GET /api/dean-analytics/departments ──────────────────────────────────────
// Per-department breakdown for sortable table
router.get("/departments", async (req, res) => {
  try {
    const [eventsRes, regsRes, attendRes] = await Promise.all([
      supabase.from("events").select("event_id, organizing_dept"),
      supabase.from("registrations").select("registration_id, event_id"),
      supabase.from("attendance_status").select("registration_id").eq("status", "attended"),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (regsRes.error) throw regsRes.error;
    if (attendRes.error) throw attendRes.error;

    const events = eventsRes.data || [];
    const regs = regsRes.data || [];
    const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));

    // Group events by department
    const deptMap = {};
    for (const ev of events) {
      const dept = (ev.organizing_dept || "Unknown").trim();
      if (!deptMap[dept]) deptMap[dept] = { events: new Set(), regCount: 0, attendCount: 0 };
      deptMap[dept].events.add(ev.event_id);
    }

    // Map regs → event → dept
    const eventToDept = {};
    for (const ev of events) eventToDept[ev.event_id] = (ev.organizing_dept || "Unknown").trim();
    for (const r of regs) {
      const dept = eventToDept[r.event_id];
      if (!dept || !deptMap[dept]) continue;
      deptMap[dept].regCount++;
      if (attendedIds.has(r.registration_id)) deptMap[dept].attendCount++;
    }

    const departments = Object.entries(deptMap)
      .map(([name, d]) => ({
        name,
        events: d.events.size,
        registrations: d.regCount,
        attendance: d.attendCount,
        attendanceRate:
          d.regCount > 0 ? Math.round((d.attendCount / d.regCount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.registrations - a.registrations);

    return res.json({ departments });
  } catch (err) {
    console.error("[Dean Analytics /departments]", err);
    return res.status(500).json({ error: "Failed to fetch departments", details: err.message });
  }
});

// ── GET /api/dean-analytics/fests ────────────────────────────────────────────
// Per-fest breakdown + highlights
router.get("/fests", async (req, res) => {
  try {
    const [festsRes, eventsRes, regsRes, attendRes, feedbacksRes] = await Promise.all([
      supabase.from("fests").select("fest_id, fest_title").eq("is_archived", false),
      supabase.from("events").select("event_id, fest_id"),
      supabase.from("registrations").select("registration_id, event_id"),
      supabase.from("attendance_status").select("registration_id").eq("status", "attended"),
      supabase.from("feedbacks").select("event_id, data"),
    ]);

    if (festsRes.error) throw festsRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (regsRes.error) throw regsRes.error;
    if (attendRes.error) throw attendRes.error;

    const festList = festsRes.data || [];
    const events = eventsRes.data || [];
    const regs = regsRes.data || [];
    const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));
    const feedbacks = feedbacksRes.data || [];

    const eventToFest = {};
    for (const ev of events) if (ev.fest_id) eventToFest[ev.event_id] = ev.fest_id;

    const fbByEvent = {};
    for (const f of feedbacks) fbByEvent[f.event_id] = f.data || {};

    const festMap = {};
    for (const f of festList) {
      festMap[f.fest_id] = { name: f.fest_title, events: new Set(), regCount: 0, attendCount: 0, fbTotal: 0, fbCount: 0 };
    }

    for (const ev of events) {
      if (!ev.fest_id || !festMap[ev.fest_id]) continue;
      festMap[ev.fest_id].events.add(ev.event_id);
      // add feedback contribution
      const fbData = fbByEvent[ev.event_id] || {};
      const entries = Object.values(fbData);
      for (const arr of entries) {
        if (!Array.isArray(arr)) continue;
        for (const v of arr) {
          if (typeof v === "number" && v > 0) { festMap[ev.fest_id].fbTotal += v; festMap[ev.fest_id].fbCount++; }
        }
      }
    }

    for (const r of regs) {
      const festId = eventToFest[r.event_id];
      if (!festId || !festMap[festId]) continue;
      festMap[festId].regCount++;
      if (attendedIds.has(r.registration_id)) festMap[festId].attendCount++;
    }

    const fests = Object.entries(festMap)
      .filter(([, d]) => d.events.size > 0)
      .map(([id, d]) => ({
        id,
        name: d.name,
        events: d.events.size,
        registrations: d.regCount,
        attendance: d.attendCount,
        attendanceRate: d.regCount > 0 ? Math.round((d.attendCount / d.regCount) * 1000) / 10 : 0,
        avgFeedback: d.fbCount > 0 ? Math.round((d.fbTotal / d.fbCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.registrations - a.registrations);

    // Highlights
    const bestAttendance = fests.length
      ? fests.reduce((a, b) => (b.attendance > a.attendance ? b : a))
      : null;
    const bestFeedback = fests.filter((f) => f.avgFeedback > 0).length
      ? fests.filter((f) => f.avgFeedback > 0).reduce((a, b) => (b.avgFeedback > a.avgFeedback ? b : a))
      : null;
    const worstTurnout = fests.filter((f) => f.registrations > 0).length
      ? fests.filter((f) => f.registrations > 0).reduce((a, b) => (b.attendanceRate < a.attendanceRate ? b : a))
      : null;
    const lowestAttendance = fests.length
      ? fests.reduce((a, b) => (b.attendance < a.attendance ? b : a))
      : null;

    return res.json({ fests, highlights: { bestAttendance, bestFeedback, worstTurnout, lowestAttendance } });
  } catch (err) {
    console.error("[Dean Analytics /fests]", err);
    return res.status(500).json({ error: "Failed to fetch fests", details: err.message });
  }
});

// ── GET /api/dean-analytics/drill ────────────────────────────────────────────
// Step 1: no params          → list all departments
// Step 2: ?dept=...          → fests under that department
// Step 3: ?dept=...&festId=. → events under that fest+dept
// Step 4: ?eventId=...       → single event detail
router.get("/drill", async (req, res) => {
  const { dept, festId, eventId } = req.query;

  // ── Step 4: Event detail ────────────────────────────────────────────────────
  if (eventId) {
    try {
      const [eventRes, regsRes, attendRes, fbRes] = await Promise.all([
        supabase.from("events").select("event_id, title, category, organizing_dept, event_date, description, fest_id").eq("event_id", eventId).single(),
        supabase.from("registrations").select("registration_id, participant_organization").eq("event_id", eventId),
        supabase.from("attendance_status").select("registration_id").eq("event_id", eventId).eq("status", "attended"),
        supabase.from("feedbacks").select("data").eq("event_id", eventId).maybeSingle(),
      ]);

      if (eventRes.error) throw eventRes.error;
      const ev = eventRes.data;
      const regs = regsRes.data || [];
      const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));
      const fbData = fbRes.data?.data || {};
      const perQ = perQFromData(fbData);
      const fbEntries = Object.values(fbData);
      const fbCount = fbEntries.length;
      const insiders = regs.filter((r) => r.participant_organization === "christ_member").length;
      const outsiders = regs.filter((r) => r.participant_organization === "outsider").length;
      const attended = regs.filter((r) => attendedIds.has(r.registration_id)).length;

      return res.json({
        event: {
          id: ev.event_id,
          name: ev.title,
          cat: ev.category || "Other",
          date: fmtDate(ev.event_date),
          festId: ev.fest_id,
          department: ev.organizing_dept,
          description: ev.description || "",
          regs: regs.length,
          attend: attended,
          rate: regs.length > 0 ? Math.round((attended / regs.length) * 1000) / 10 : 0,
          insiders,
          outsiders,
          feedback: { count: fbCount, ...perQ, score: avgFbFromData(fbData) },
        },
      });
    } catch (err) {
      console.error("[Dean Drill /event]", err);
      return res.status(500).json({ error: "Failed to fetch event detail", details: err.message });
    }
  }

  // ── Step 3: Events under fest + dept ────────────────────────────────────────
  if (dept && festId) {
    try {
      const { data: evList, error: evErr } = await supabase
        .from("events")
        .select("event_id, title, category, event_date")
        .eq("fest_id", festId)
        .ilike("organizing_dept", dept);

      if (evErr) throw evErr;
      const eventIds = (evList || []).map((e) => e.event_id);
      if (!eventIds.length) return res.json({ events: [] });

      const [regsRes, attendRes, fbsRes] = await Promise.all([
        supabase.from("registrations").select("registration_id, event_id").in("event_id", eventIds),
        supabase.from("attendance_status").select("registration_id, event_id").in("event_id", eventIds).eq("status", "attended"),
        supabase.from("feedbacks").select("event_id, data").in("event_id", eventIds),
      ]);

      if (regsRes.error) throw regsRes.error;

      const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));
      const regsByEv = {}, attendByEv = {};
      for (const r of regsRes.data || []) {
        if (!regsByEv[r.event_id]) regsByEv[r.event_id] = 0;
        regsByEv[r.event_id]++;
      }
      for (const a of attendRes.data || []) {
        if (!attendByEv[a.event_id]) attendByEv[a.event_id] = 0;
        attendByEv[a.event_id]++;
      }
      const fbByEv = {};
      for (const f of fbsRes.data || []) fbByEv[f.event_id] = f.data || {};

      const events = (evList || []).map((ev) => {
        const r = regsByEv[ev.event_id] || 0;
        const a = attendByEv[ev.event_id] || 0;
        return {
          id: ev.event_id,
          name: ev.title,
          cat: ev.category || "Other",
          date: fmtDate(ev.event_date),
          regs: r,
          attend: a,
          rate: r > 0 ? Math.round((a / r) * 1000) / 10 : 0,
          avgFeedback: avgFbFromData(fbByEv[ev.event_id]),
        };
      });

      return res.json({ events });
    } catch (err) {
      console.error("[Dean Drill /events-in-fest]", err);
      return res.status(500).json({ error: "Failed to fetch events", details: err.message });
    }
  }

  // ── Step 2: Fests under a department ────────────────────────────────────────
  if (dept) {
    try {
      const { data: evList, error: evErr } = await supabase
        .from("events")
        .select("event_id, fest_id")
        .ilike("organizing_dept", dept)
        .not("fest_id", "is", null);

      if (evErr) throw evErr;
      const festIds = [...new Set((evList || []).map((e) => e.fest_id).filter(Boolean))];
      if (!festIds.length) return res.json({ fests: [] });

      const [festsRes, regsRes, attendRes] = await Promise.all([
        supabase.from("fests").select("fest_id, fest_title").in("fest_id", festIds),
        supabase.from("registrations").select("registration_id, event_id").in("event_id", (evList || []).map((e) => e.event_id)),
        supabase.from("attendance_status").select("registration_id").in("event_id", (evList || []).map((e) => e.event_id)).eq("status", "attended"),
      ]);

      if (festsRes.error) throw festsRes.error;

      const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));
      const evToFest = {};
      for (const e of evList || []) evToFest[e.event_id] = e.fest_id;
      const evCountByFest = {};
      for (const e of evList || []) {
        if (!evCountByFest[e.fest_id]) evCountByFest[e.fest_id] = 0;
        evCountByFest[e.fest_id]++;
      }
      const festStats = {};
      for (const r of regsRes.data || []) {
        const fId = evToFest[r.event_id];
        if (!fId) continue;
        if (!festStats[fId]) festStats[fId] = { regs: 0, attend: 0 };
        festStats[fId].regs++;
        if (attendedIds.has(r.registration_id)) festStats[fId].attend++;
      }

      const fests = (festsRes.data || []).map((f) => {
        const s = festStats[f.fest_id] || { regs: 0, attend: 0 };
        return {
          id: f.fest_id,
          name: f.fest_title,
          events: evCountByFest[f.fest_id] || 0,
          registrations: s.regs,
          attendance: s.attend,
          attendanceRate: s.regs > 0 ? Math.round((s.attend / s.regs) * 1000) / 10 : 0,
        };
      });

      return res.json({ fests });
    } catch (err) {
      console.error("[Dean Drill /fests-by-dept]", err);
      return res.status(500).json({ error: "Failed to fetch fests by dept", details: err.message });
    }
  }

  // ── Step 1: All departments ──────────────────────────────────────────────────
  try {
    const [eventsRes, regsRes, attendRes] = await Promise.all([
      supabase.from("events").select("event_id, organizing_dept, fest_id"),
      supabase.from("registrations").select("registration_id, event_id"),
      supabase.from("attendance_status").select("registration_id").eq("status", "attended"),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (regsRes.error) throw regsRes.error;
    if (attendRes.error) throw attendRes.error;

    const events = eventsRes.data || [];
    const regs = regsRes.data || [];
    const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));

    const deptMap = {};
    for (const ev of events) {
      const d = (ev.organizing_dept || "Unknown").trim();
      if (!deptMap[d]) deptMap[d] = { events: 0, fests: new Set(), regs: 0, attend: 0 };
      deptMap[d].events++;
      if (ev.fest_id) deptMap[d].fests.add(ev.fest_id);
    }
    const evToDept = {};
    for (const ev of events) evToDept[ev.event_id] = (ev.organizing_dept || "Unknown").trim();
    for (const r of regs) {
      const d = evToDept[r.event_id];
      if (!d || !deptMap[d]) continue;
      deptMap[d].regs++;
      if (attendedIds.has(r.registration_id)) deptMap[d].attend++;
    }

    const departments = Object.entries(deptMap)
      .map(([name, d]) => ({
        name,
        events: d.events,
        fests: d.fests.size,
        registrations: d.regs,
        attendance: d.attend,
        attendanceRate: d.regs > 0 ? Math.round((d.attend / d.regs) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.registrations - a.registrations);

    return res.json({ departments });
  } catch (err) {
    console.error("[Dean Drill /departments]", err);
    return res.status(500).json({ error: "Failed to fetch departments", details: err.message });
  }
});

// ── GET /api/dean-analytics/fest-detail?festId=... ───────────────────────────
// Full fest detail: stats + budget (from approvals) + events with feedback
router.get("/fest-detail", async (req, res) => {
  const { festId } = req.query;
  if (!festId) return res.status(400).json({ error: "festId required" });

  try {
    const [festRes, approvalRes, eventsRes] = await Promise.all([
      supabase.from("fests").select("fest_id, fest_title, opening_date, closing_date, description").eq("fest_id", festId).single(),
      supabase.from("approvals").select("budget_items").eq("event_or_fest_id", festId).eq("type", "fest").maybeSingle(),
      supabase.from("events").select("event_id, title, category, event_date, description").eq("fest_id", festId).eq("is_archived", false),
    ]);

    if (festRes.error) throw festRes.error;
    const fest = festRes.data;
    const budgetItems = approvalRes.data?.budget_items || [];
    const eventList = eventsRes.data || [];
    const eventIds = eventList.map((e) => e.event_id);

    if (!eventIds.length) {
      return res.json({
        fest: { id: fest.fest_id, name: fest.fest_title, dates: `${fmtDate(fest.opening_date)} – ${fmtDate(fest.closing_date)}`, description: fest.description || "" },
        budgetItems,
        budgetTotal: budgetItems.reduce((s, b) => s + (b.quantity || 1) * (b.unitPrice || 0), 0),
        summary: { events: 0, registrations: 0, attendance: 0, attendanceRate: 0, insiders: 0, outsiders: 0 },
        events: [],
      });
    }

    const [regsRes, attendRes, fbsRes] = await Promise.all([
      supabase.from("registrations").select("registration_id, event_id, participant_organization").in("event_id", eventIds),
      supabase.from("attendance_status").select("registration_id, event_id").in("event_id", eventIds).eq("status", "attended"),
      supabase.from("feedbacks").select("event_id, data").in("event_id", eventIds),
    ]);

    if (regsRes.error) throw regsRes.error;

    const attendedIds = new Set((attendRes.data || []).map((a) => a.registration_id));
    const regsByEv = {}, attendByEv = {}, insidersByEv = {}, outsidersByEv = {};
    for (const r of regsRes.data || []) {
      if (!regsByEv[r.event_id]) { regsByEv[r.event_id] = 0; insidersByEv[r.event_id] = 0; outsidersByEv[r.event_id] = 0; }
      regsByEv[r.event_id]++;
      if (r.participant_organization === "christ_member") insidersByEv[r.event_id]++;
      else outsidersByEv[r.event_id]++;
    }
    for (const a of attendRes.data || []) {
      if (!attendByEv[a.event_id]) attendByEv[a.event_id] = 0;
      attendByEv[a.event_id]++;
    }
    const fbByEv = {};
    for (const f of fbsRes.data || []) fbByEv[f.event_id] = f.data || {};

    const events = eventList.map((ev) => {
      const r = regsByEv[ev.event_id] || 0;
      const a = attendByEv[ev.event_id] || 0;
      const fbData = fbByEv[ev.event_id] || {};
      const perQ = perQFromData(fbData);
      const fbEntries = Object.values(fbData);
      return {
        id: ev.event_id,
        name: ev.title,
        cat: ev.category || "Other",
        date: fmtDate(ev.event_date),
        description: ev.description || "",
        regs: r,
        attend: a,
        rate: r > 0 ? Math.round((a / r) * 1000) / 10 : 0,
        insiders: insidersByEv[ev.event_id] || 0,
        outsiders: outsidersByEv[ev.event_id] || 0,
        feedback: { count: fbEntries.length, ...perQ, score: avgFbFromData(fbData) },
      };
    });

    const totalRegs = events.reduce((s, e) => s + e.regs, 0);
    const totalAttend = events.reduce((s, e) => s + e.attend, 0);
    const totalInsiders = events.reduce((s, e) => s + e.insiders, 0);
    const totalOutsiders = events.reduce((s, e) => s + e.outsiders, 0);

    return res.json({
      fest: {
        id: fest.fest_id,
        name: fest.fest_title,
        dates: `${fmtDate(fest.opening_date)} – ${fmtDate(fest.closing_date)}`,
        description: fest.description || "",
      },
      budgetItems,
      budgetTotal: budgetItems.reduce((s, b) => s + (b.quantity || 1) * (b.unitPrice || 0), 0),
      summary: {
        events: events.length,
        registrations: totalRegs,
        attendance: totalAttend,
        attendanceRate: totalRegs > 0 ? Math.round((totalAttend / totalRegs) * 1000) / 10 : 0,
        insiders: totalInsiders,
        outsiders: totalOutsiders,
      },
      events,
    });
  } catch (err) {
    console.error("[Dean /fest-detail]", err);
    return res.status(500).json({ error: "Failed to fetch fest detail", details: err.message });
  }
});

export default router;
