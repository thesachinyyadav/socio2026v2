import express from "express";
import {
  authenticateUser,
  checkRoleExpiration,
  getUserInfo,
  requireCampusDirector,
} from "../middleware/authMiddleware.js";
import {
  buildCampusDirectorAnalyticsSnapshot,
  buildCampusDirectorHierarchy,
} from "../services/analyticsEngine.js";
import "../config/loadEnv.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo(), checkRoleExpiration, requireCampusDirector);

function resolveCampus(req, res) {
  const campus = req.userInfo.campus?.trim();
  if (!campus) {
    res.status(400).json({
      error: "Campus not configured for this Campus Director account. Please contact admin.",
    });
    return null;
  }
  return campus;
}

// ── GET /api/campus-director-analytics/overview ──────────────────────────────
// Full campus-scoped snapshot: KPIs, events/fests, departments, student
// engagement and financials. Summaries only (no per-fest/per-event drill-down).
router.get("/overview", async (req, res) => {
  const campus = resolveCampus(req, res);
  if (!campus) return;
  try {
    const snapshot = await buildCampusDirectorAnalyticsSnapshot(req.query, campus);
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error("[Campus Director Analytics] Snapshot error:", err);
    return res.status(500).json({
      error: "Failed to generate campus analytics",
      details: err.message,
    });
  }
});

// ── GET /api/campus-director-analytics/hierarchy ─────────────────────────────
// Campus-wide school → department → fest → events drill-down tree. Scoped only
// by the date range (days/start/end); ignores the school/department filters.
router.get("/hierarchy", async (req, res) => {
  const campus = resolveCampus(req, res);
  if (!campus) return;
  try {
    const tree = await buildCampusDirectorHierarchy(req.query, campus);
    return res.status(200).json(tree);
  } catch (err) {
    console.error("[Campus Director Analytics] Hierarchy error:", err);
    return res.status(500).json({
      error: "Failed to generate campus hierarchy",
      details: err.message,
    });
  }
});

export default router;
