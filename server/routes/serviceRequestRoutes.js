import express from "express";
import { queryOne, insert } from "../config/database.js";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
} from "../middleware/authMiddleware.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function fetchEntityTitle(entityId, entityType) {
  try {
    if (entityType === "event") {
      const row = await queryOne("events", { where: { event_id: entityId } });
      return row?.title || entityId;
    }
    if (entityType === "fest") {
      const row = await queryOne("fests", { where: { fest_id: entityId } });
      return row?.fest_title || row?.title || entityId;
    }
    return null;
  } catch {
    return null;
  }
}

// HH:MM overlap check — two windows overlap iff aStart < bEnd AND aEnd > bStart
function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function getVenueById(venueId) {
  const { data } = await supabase
    .from("venues")
    .select("id, campus, name")
    .eq("id", venueId)
    .limit(1);
  return data?.[0] || null;
}

// Enrich a service_requests row with entity title + booker full_name
async function enrichRow(row, userCache) {
  const entity_title =
    row.entity_type === "standalone"
      ? row.details?.booking_title || "Standalone Booking"
      : (await fetchEntityTitle(row.entity_id, row.entity_type)) || row.entity_id;

  let requested_by_name = userCache.get(row.requested_by);
  if (requested_by_name === undefined) {
    const u = await queryOne("users", { where: { email: row.requested_by } });
    requested_by_name = u?.name || u?.full_name || null;
    userCache.set(row.requested_by, requested_by_name);
  }

  return { ...row, entity_title, requested_by_name };
}

// ---------------------------------------------------------------------------
// GET /api/service-requests/my-queue
// Shared pool: any vendor manager on a campus sees every request for that campus
// ---------------------------------------------------------------------------
router.get(
  "/service-requests/my-queue",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      if (!user.is_vendor_manager && !user.is_masteradmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Masteradmin without a campus sees everything; otherwise scope to manager's campus
      const managerCampus = user.campus || null;

      // Fetch all pending + recent reviewed rows, then filter by campus via venues lookup
      const { data: pendingRaw, error: pendErr } = await supabase
        .from("service_requests")
        .select("*")
        .eq("service_type", "venue")
        .eq("status", "pending")
        .order("id", { ascending: false });
      if (pendErr) throw pendErr;

      const { data: reviewedRaw, error: revErr } = await supabase
        .from("service_requests")
        .select("*")
        .eq("service_type", "venue")
        .neq("status", "pending")
        .order("id", { ascending: false })
        .limit(50);
      if (revErr) throw revErr;

      // Build venue id → campus map for campus filtering
      const venueIds = new Set();
      [...(pendingRaw || []), ...(reviewedRaw || [])].forEach((r) => {
        const vid = r.details?.venue_id;
        if (vid) venueIds.add(vid);
      });
      let venueCampusMap = new Map();
      if (venueIds.size > 0) {
        const { data: vs } = await supabase
          .from("venues")
          .select("id, campus")
          .in("id", Array.from(venueIds));
        (vs || []).forEach((v) => venueCampusMap.set(v.id, v.campus));
      }

      const inScope = (row) => {
        if (user.is_masteradmin && !managerCampus) return true;
        const c = venueCampusMap.get(row.details?.venue_id);
        return c && managerCampus && c === managerCampus;
      };

      const userCache = new Map();
      const enriched = async (rows) =>
        Promise.all((rows || []).filter(inScope).map((r) => enrichRow(r, userCache)));

      const pending = await enriched(pendingRaw);
      const reviewed = await enriched(reviewedRaw);

      return res.json({ pending, reviewed });
    } catch (err) {
      console.error("[ServiceRequests] GET /my-queue error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/service-requests?entity_id=&service_type=venue
// ---------------------------------------------------------------------------
router.get(
  "/service-requests",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { entity_id, service_type } = req.query;
      if (!entity_id) {
        return res.status(400).json({ error: "entity_id is required" });
      }

      let query = supabase.from("service_requests").select("*").eq("entity_id", entity_id);
      if (service_type) query = query.eq("service_type", service_type);

      const { data, error } = await query.limit(10);
      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error("[ServiceRequests] GET /service-requests error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/service-requests
// entity_type: 'event' | 'fest' | 'standalone'
// ---------------------------------------------------------------------------
router.post(
  "/service-requests",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      const { entity_type, entity_id, details } = req.body;

      if (!entity_type || !["event", "fest", "standalone"].includes(entity_type)) {
        return res.status(400).json({ error: "entity_type must be 'event', 'fest', or 'standalone'" });
      }
      if (!details || typeof details !== "object") {
        return res.status(400).json({ error: "details object is required" });
      }
      const { venue_id, venue_name, date, start_time, end_time } = details;
      if (!venue_id || !venue_name || !date || !start_time || !end_time) {
        return res.status(400).json({
          error: "details must include venue_id, venue_name, date, start_time, end_time",
        });
      }
      if (start_time >= end_time) {
        return res.status(400).json({ error: "start_time must be before end_time" });
      }

      // Event/fest-linked: enforce full approval + duplicate guard
      if (entity_type !== "standalone") {
        if (!entity_id) {
          return res.status(400).json({ error: "entity_id is required for event/fest bookings" });
        }

        const { data: approvalRows } = await supabase
          .from("approvals")
          .select("went_live_at, organizing_campus_snapshot")
          .eq("event_or_fest_id", entity_id)
          .eq("type", entity_type)
          .limit(1);

        const approval = approvalRows?.[0];
        if (!approval) {
          return res.status(400).json({ error: "No approval record found for this entity" });
        }
        if (!approval.went_live_at) {
          return res.status(400).json({
            error: "Venue can only be requested after the event/fest is fully approved",
          });
        }

        const { data: existing } = await supabase
          .from("service_requests")
          .select("id, status")
          .eq("entity_id", entity_id)
          .eq("service_type", "venue")
          .limit(1);

        if (existing && existing.length > 0) {
          return res.status(409).json({
            error: "A venue request already exists for this event/fest",
            existing: existing[0],
          });
        }
      } else {
        if (!details.booking_title || String(details.booking_title).trim().length < 3) {
          return res.status(400).json({ error: "booking_title is required (min 3 characters)" });
        }
      }

      // Time-window overlap check against APPROVED rows for the same venue/date
      const { data: approvedSlots, error: slotErr } = await supabase
        .from("service_requests")
        .select("id, details")
        .eq("service_type", "venue")
        .eq("status", "approved")
        .filter("details->>venue_id", "eq", venue_id)
        .filter("details->>date", "eq", date);
      if (slotErr) throw slotErr;

      const conflict = (approvedSlots || []).find((r) =>
        timeOverlaps(start_time, end_time, r.details?.start_time || "", r.details?.end_time || "")
      );
      if (conflict) {
        return res.status(409).json({
          error: "This time window conflicts with an existing approved booking",
          conflict: {
            start_time: conflict.details?.start_time,
            end_time: conflict.details?.end_time,
          },
        });
      }

      const newRequest = await insert("service_requests", {
        entity_type,
        entity_id: entity_type === "standalone" ? null : entity_id,
        service_type: "venue",
        details,
        assigned_incharge_email: null,
        status: "pending",
        requested_by: user.email,
      });

      return res.status(201).json({ success: true, request: newRequest });
    } catch (err) {
      console.error("[ServiceRequests] POST /service-requests error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/service-requests/:id/action
// Authorized by role (is_vendor_manager) + campus match — shared pool
// ---------------------------------------------------------------------------
router.post(
  "/service-requests/:id/action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      const { id } = req.params;
      const { action, notes } = req.body;

      if (!["approved", "rejected", "returned_for_revision"].includes(action)) {
        return res.status(400).json({ error: "action must be approved, rejected, or returned_for_revision" });
      }

      const { data: rows } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id)
        .limit(1);

      const request = rows?.[0];
      if (!request) return res.status(404).json({ error: "Service request not found" });

      // Authorize: masteradmin, or vendor_manager on same campus as the venue
      let authorized = Boolean(user.is_masteradmin);
      if (!authorized && user.is_vendor_manager) {
        const venue = await getVenueById(request.details?.venue_id);
        if (venue && user.campus && venue.campus === user.campus) authorized = true;
      }
      if (!authorized) {
        return res.status(403).json({ error: "You are not authorized to act on this request" });
      }

      if (action !== "approved") {
        if (!notes || String(notes).trim().length < 20) {
          return res.status(400).json({ error: "Notes are required (min 20 characters) when rejecting or returning" });
        }
      }

      // Re-check overlap at approval time to avoid double-approving conflicting slots
      if (action === "approved") {
        const d = request.details || {};
        const { data: approvedSlots } = await supabase
          .from("service_requests")
          .select("id, details")
          .eq("service_type", "venue")
          .eq("status", "approved")
          .filter("details->>venue_id", "eq", d.venue_id)
          .filter("details->>date", "eq", d.date);

        const conflict = (approvedSlots || []).find(
          (r) =>
            r.id !== request.id &&
            timeOverlaps(
              d.start_time || "",
              d.end_time || "",
              r.details?.start_time || "",
              r.details?.end_time || ""
            )
        );
        if (conflict) {
          return res.status(409).json({
            error: "Another booking was approved for this time slot. Please return this request with a note.",
            conflict: {
              start_time: conflict.details?.start_time,
              end_time: conflict.details?.end_time,
            },
          });
        }
      }

      const updates = { status: action };
      if (notes) updates.decision_notes = String(notes).trim();

      await supabase.from("service_requests").update(updates).eq("id", id);

      return res.json({ success: true });
    } catch (err) {
      console.error("[ServiceRequests] POST /service-requests/:id/action error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
