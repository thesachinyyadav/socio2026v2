import express from "express";
import { authenticateUser, checkRoleExpiration, getUserInfo, requireMasterAdmin } from "../middleware/authMiddleware.js";
import { buildAnalyticsSnapshot, clearAnalyticsCache } from "../services/analyticsEngine.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo(), checkRoleExpiration, requireMasterAdmin);

async function resolveAnalytics(req, res) {
  try {
    const snapshot = await buildAnalyticsSnapshot(req.query);
    return snapshot;
  } catch (error) {
    console.error("[Analytics] Failed to build snapshot:", error);
    res.status(500).json({ error: "Failed to generate analytics snapshot", details: error.message });
    return null;
  }
}

router.get("/overview", async (req, res) => {
  const snapshot = await resolveAnalytics(req, res);
  if (!snapshot) return;

  return res.status(200).json({
    generatedAt: snapshot.generatedAt,
    range: snapshot.range,
    dataQuality: snapshot.dataQuality,
    kpis: snapshot.overview.kpis,
    stats: snapshot.overview.currentStats,
    previousStats: snapshot.overview.previousStats,
    funnel: snapshot.events.funnel,
    monthlyTrend: snapshot.time.monthlyTrend,
    growthRate: snapshot.time.growthRate,
  });
});

router.get("/students", async (req, res) => {
  const snapshot = await resolveAnalytics(req, res);
  if (!snapshot) return;

  return res.status(200).json({
    generatedAt: snapshot.generatedAt,
    range: snapshot.range,
    segmentation: snapshot.students.segmentation,
    topEngaged: snapshot.students.topEngaged,
    atRisk: snapshot.students.atRisk,
    behavior: snapshot.students.behavior,
    engagementScores: snapshot.students.byStudent,
  });
});

router.get("/events", async (req, res) => {
  const snapshot = await resolveAnalytics(req, res);
  if (!snapshot) return;

  return res.status(200).json({
    generatedAt: snapshot.generatedAt,
    range: snapshot.range,
    attendanceByEvent: snapshot.events.attendanceByEvent,
    topEvents: snapshot.events.topEvents,
    categoryPerformance: snapshot.events.categoryPerformance,
    funnel: snapshot.events.funnel,
    predictions: snapshot.predictions,
  });
});

router.get("/departments", async (req, res) => {
  const snapshot = await resolveAnalytics(req, res);
  if (!snapshot) return;

  return res.status(200).json({
    generatedAt: snapshot.generatedAt,
    range: snapshot.range,
    departments: snapshot.departments,
  });
});

router.get("/insights", async (req, res) => {
  const snapshot = await resolveAnalytics(req, res);
  if (!snapshot) return;

  return res.status(200).json({
    generatedAt: snapshot.generatedAt,
    range: snapshot.range,
    insights: snapshot.insights,
    peakAttendanceTime: snapshot.time.peakAttendanceTime,
    timingEfficiency: snapshot.time.timingEfficiency,
    predictions: snapshot.predictions,
  });
});

router.post("/refresh", (req, res) => {
  clearAnalyticsCache();
  return res.status(200).json({ message: "Analytics cache cleared." });
});

export default router;
