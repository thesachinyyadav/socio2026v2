import express from "express";
import { queryOne } from "../config/database.js";
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

function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

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

// Enrich a venue_bookings row with entity title + booker display name
async function enrichRow(row, userCache) {
  const entity_title =
    row.entity_type === "standalone"
      ? row.title || "Standalone Booking"
      : (await fetchEntityTitle(row.entity_id, row.entity_type)) || row.entity_id;

  let requested_by_name = userCache.get(row.requested_by);
  if (requested_by_name === undefined) {
    const u = await queryOne("users", { where: { email: row.requested_by } });
    requested_by_name = u?.name || u?.full_name || null;
    userCache.set(row.requested_by, requested_by_name);
  }

  // Return in the shape the venue dashboard expects
  return {
    ...row,
    entity_title,
    requested_by_name,
    // Backwards-compat shim so the old venue/page.tsx still works
    details: {
      venue_name:    row.venue?.name  || row.venue_id,
      date:          row.date,
      start_time:    row.start_time,
      end_time:      row.end_time,
      booking_title: row.title,
      setup_notes:   row.setup_notes,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/service-requests/my-queue
// Proxies to venue_bookings — kept for backward compat with venue/page.tsx
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

      const managerCampus = user.campus || null;

      const { data: pendingRaw, error: pendErr } = await supabase
        .from("venue_bookings")
        .select("*")
        .eq("status", "pending")
        .order("date", { ascending: true });
      if (pendErr) throw pendErr;

      const { data: reviewedRaw, error: revErr } = await supabase
        .from("venue_bookings")
        .select("*")
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (revErr) throw revErr;

      // Attach venue info via explicit lookup (no FK constraint required)
      const allRaw = [...(pendingRaw || []), ...(reviewedRaw || [])];
      const venueIds = [...new Set(allRaw.map(r => r.venue_id).filter(Boolean))];
      const venueMap = new Map();
      if (venueIds.length > 0) {
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id, name, campus, location, capacity, is_approval_needed")
          .in("venue_id", venueIds);
        (venues || []).forEach(v => venueMap.set(v.venue_id, v));
      }
      const attachVenue = rows => (rows || []).map(r => ({ ...r, venue: venueMap.get(r.venue_id) || null }));

      const inScope = (row) => {
        if (user.is_masteradmin && !managerCampus) return true;
        return row.venue?.campus === managerCampus;
      };

      const userCache = new Map();
      const enrich = (rows) =>
        Promise.all((rows || []).filter(inScope).map((r) => enrichRow(r, userCache)));

      const [pending, reviewed] = await Promise.all([
        enrich(attachVenue(pendingRaw)),
        enrich(attachVenue(reviewedRaw)),
      ]);

      return res.json({ pending, reviewed });
    } catch (err) {
      console.error("[ServiceRequests] GET /my-queue error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/service-requests?entity_id=X
// Returns venue bookings linked to an event/fest (approvals page)
// ---------------------------------------------------------------------------
router.get(
  "/service-requests",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { entity_id } = req.query;
      if (!entity_id) {
        return res.status(400).json({ error: "entity_id is required" });
      }

      const { data, error } = await supabase
        .from("venue_bookings")
        .select("*")
        .eq("entity_id", entity_id)
        .limit(10);
      if (error) throw error;

      // Attach venue info via explicit lookup
      const venueIds2 = [...new Set((data || []).map(r => r.venue_id).filter(Boolean))];
      const vMap2 = new Map();
      if (venueIds2.length > 0) {
        const { data: vs } = await supabase.from("venues").select("venue_id, name, campus, location, capacity").in("venue_id", venueIds2);
        (vs || []).forEach(v => vMap2.set(v.venue_id, v));
      }
      const dataWithVenue = (data || []).map(r => ({ ...r, venue: vMap2.get(r.venue_id) || null }));

      // Shape response so existing callers (approvals page) still see a `details` field
      const shaped = dataWithVenue.map((r) => ({
        ...r,
        details: {
          venue_id:      r.venue_id,
          venue_name:    r.venue?.name || r.venue_id,
          date:          r.date,
          start_time:    r.start_time,
          end_time:      r.end_time,
          booking_title: r.title,
          setup_notes:   r.setup_notes,
        },
      }));

      return res.json(shaped);
    } catch (err) {
      console.error("[ServiceRequests] GET /service-requests error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/service-requests
// Accepts old-format body { entity_type, entity_id, details:{...} } and
// writes a venue_bookings row with auto-approve based on is_approval_needed.
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
        return res.status(400).json({ error: "entity_type must be event, fest, or standalone" });
      }
      if (!details || typeof details !== "object") {
        return res.status(400).json({ error: "details object is required" });
      }

      const {
        venue_id, venue_name, date, start_time, end_time,
        booking_title, setup_notes, headcount,
      } = details;

      if (!venue_id || !date || !start_time || !end_time) {
        return res.status(400).json({ error: "details must include venue_id, date, start_time, end_time" });
      }
      if (start_time >= end_time) {
        return res.status(400).json({ error: "start_time must be before end_time" });
      }

      const title = booking_title || venue_name || "Venue booking";

      // For event/fest bookings: check approval record + duplicate guard
      if (entity_type !== "standalone") {
        if (!entity_id) {
          return res.status(400).json({ error: "entity_id is required for event/fest bookings" });
        }
        const { data: approvalRows } = await supabase
          .from("approvals")
          .select("went_live_at")
          .eq("event_or_fest_id", entity_id)
          .eq("type", entity_type)
          .limit(1);
        if (!approvalRows?.[0]?.went_live_at) {
          return res.status(400).json({ error: "Venue can only be requested after the event/fest is fully approved" });
        }

        const { data: existing } = await supabase
          .from("venue_bookings")
          .select("id, status")
          .eq("entity_id", entity_id)
          .limit(1);
        if (existing?.length > 0) {
          return res.status(409).json({ error: "A venue booking already exists for this event/fest", existing: existing[0] });
        }
      }

      // Overlap check against approved bookings for same venue/date
      const { data: approved, error: overlapErr } = await supabase
        .from("venue_bookings")
        .select("id, start_time, end_time")
        .eq("venue_id", venue_id)
        .eq("date", date)
        .eq("status", "approved");
      if (overlapErr) throw overlapErr;

      const conflict = (approved || []).find((b) =>
        timeOverlaps(start_time, end_time, b.start_time, b.end_time)
      );
      if (conflict) {
        return res.status(409).json({
          error: "This time window conflicts with an existing approved booking",
          conflict: { start_time: conflict.start_time, end_time: conflict.end_time },
        });
      }

      // Auto-approve if venue doesn't require approval
      const { data: venueRow } = await supabase
        .from("venues")
        .select("is_approval_needed")
        .eq("venue_id", venue_id)
        .limit(1);
      const needsApproval = Boolean(venueRow?.[0]?.is_approval_needed);

      const { data: booking, error: insertErr } = await supabase
        .from("venue_bookings")
        .insert({
          venue_id,
          requested_by:  user.email,
          date,
          start_time,
          end_time,
          title:         String(title).trim(),
          headcount:     headcount ? Number(headcount) : null,
          setup_notes:   setup_notes ? String(setup_notes).trim() : null,
          entity_type,
          entity_id:     entity_type === "standalone" ? null : entity_id,
          status:        needsApproval ? "pending" : "approved",
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      return res.status(201).json({ success: true, request: booking, auto_approved: !needsApproval });
    } catch (err) {
      console.error("[ServiceRequests] POST /service-requests error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/service-requests/:id/action
// Approve / reject / return — kept for backward compat
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
        .from("venue_bookings")
        .select("*")
        .eq("id", id)
        .limit(1);

      const booking = rows?.[0];
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.status !== "pending") {
        return res.status(409).json({ error: "This booking has already been actioned" });
      }

      // Fetch venue separately (no FK join)
      const { data: venueRows } = await supabase
        .from("venues")
        .select("venue_id, campus, name")
        .eq("venue_id", booking.venue_id)
        .limit(1);
      const bookingVenue = venueRows?.[0] || null;

      let authorized = Boolean(user.is_masteradmin);
      if (!authorized && user.is_vendor_manager) {
        authorized = bookingVenue?.campus === user.campus;
      }
      if (!authorized) {
        return res.status(403).json({ error: "Not authorized to act on this booking" });
      }

      if (action !== "approved" && (!notes || String(notes).trim().length < 10)) {
        return res.status(400).json({ error: "Notes are required (min 10 characters) when rejecting or returning" });
      }

      // Overlap guard at approval time
      if (action === "approved") {
        const { data: existing } = await supabase
          .from("venue_bookings")
          .select("id, start_time, end_time")
          .eq("venue_id", booking.venue_id)
          .eq("date", booking.date)
          .eq("status", "approved");
        const conflict = (existing || []).find(
          (b) => b.id !== booking.id && timeOverlaps(booking.start_time, booking.end_time, b.start_time, b.end_time)
        );
        if (conflict) {
          return res.status(409).json({
            error: "Another booking was approved for this time window",
            conflict: { start_time: conflict.start_time, end_time: conflict.end_time },
          });
        }
      }

      await supabase
        .from("venue_bookings")
        .update({ status: action, decision_notes: notes ? String(notes).trim() : null })
        .eq("id", id);

      return res.json({ success: true });
    } catch (err) {
      console.error("[ServiceRequests] POST /service-requests/:id/action error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
