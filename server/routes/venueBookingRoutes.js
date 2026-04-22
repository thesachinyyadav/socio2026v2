import express from "express";
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

function pad2(n) { return String(n).padStart(2, "0"); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// Fetch a single venue by venue_id (text slug)
async function getVenue(venueId) {
  const { data } = await supabase
    .from("venues")
    .select("venue_id, name, campus, location, capacity, is_approval_needed, is_active")
    .eq("venue_id", venueId)
    .limit(1);
  return data?.[0] || null;
}

// Fetch multiple venues at once and return a Map<venue_id, venue>
async function getVenueMap(venueIds) {
  const ids = [...new Set(venueIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("venues")
    .select("venue_id, name, campus, location, capacity, is_approval_needed")
    .in("venue_id", ids);
  const m = new Map();
  (data || []).forEach(v => m.set(v.venue_id, v));
  return m;
}

// Fetch display names for a list of emails and return a Map<email, name>
async function getNameMap(emails) {
  const uniq = [...new Set(emails.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await supabase
    .from("users")
    .select("email, name, full_name")
    .in("email", uniq);
  const m = new Map();
  (data || []).forEach(u => m.set(u.email, u.name || u.full_name || null));
  return m;
}

// ---------------------------------------------------------------------------
// POST /api/venue-bookings
// Creates a venue booking. Auto-approves when is_approval_needed = false.
// ---------------------------------------------------------------------------
router.post(
  "/venue-bookings",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      const {
        venue_id, date, start_time, end_time,
        title, headcount, setup_notes,
        entity_type = "standalone", entity_id = null,
      } = req.body;

      if (!venue_id || !date || !start_time || !end_time || !title) {
        return res.status(400).json({
          error: "venue_id, date, start_time, end_time, and title are required",
        });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "date must be YYYY-MM-DD" });
      }
      if (start_time >= end_time) {
        return res.status(400).json({ error: "start_time must be before end_time" });
      }
      if (String(title).trim().length < 3) {
        return res.status(400).json({ error: "title must be at least 3 characters" });
      }
      if (!["standalone", "event", "fest"].includes(entity_type)) {
        return res.status(400).json({ error: "entity_type must be standalone, event, or fest" });
      }

      const venue = await getVenue(venue_id);
      if (!venue) {
        return res.status(404).json({ error: "Venue not found or inactive" });
      }

      if (venue.capacity != null && headcount != null && headcount > venue.capacity) {
        return res.status(400).json({
          error: `Headcount ${headcount} exceeds venue capacity ${venue.capacity}`,
        });
      }

      // Overlap check against approved bookings only (pending bookings don't block submission)
      const { data: approved, error: overlapErr } = await supabase
        .from("venue_bookings")
        .select("id, start_time, end_time, title")
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
          conflict: { start_time: conflict.start_time, end_time: conflict.end_time, title: conflict.title || null },
        });
      }

      const needsApproval = Boolean(venue.is_approval_needed);
      const status = needsApproval ? "pending" : "approved";

      const { data: booking, error: insertErr } = await supabase
        .from("venue_bookings")
        .insert({
          venue_id,
          requested_by: user.email,
          date,
          start_time,
          end_time,
          title: String(title).trim(),
          headcount: headcount ? Number(headcount) : null,
          setup_notes: setup_notes ? String(setup_notes).trim() : null,
          entity_type,
          entity_id: entity_type === "standalone" ? null : entity_id,
          status,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      return res.status(201).json({ booking, auto_approved: !needsApproval });
    } catch (err) {
      console.error("[VenueBookings] POST error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venue-bookings?venue_id=X&page=1&limit=20
// Masteradmin: all bookings for a specific venue (all statuses, all time)
// ---------------------------------------------------------------------------
router.get(
  "/venue-bookings",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      if (!user.is_masteradmin) return res.status(403).json({ error: "Masteradmin only" });

      const { venue_id, page = "1", limit = "25" } = req.query;
      if (!venue_id) return res.status(400).json({ error: "venue_id is required" });

      const pageNum  = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const from = (pageNum - 1) * limitNum;

      const { data, error, count } = await supabase
        .from("venue_bookings")
        .select("*", { count: "exact" })
        .eq("venue_id", venue_id)
        .order("date",       { ascending: false })
        .order("start_time", { ascending: false })
        .range(from, from + limitNum - 1);
      if (error) throw error;

      // Fetch requester names
      const nameMap = await getNameMap((data || []).map(r => r.requested_by));

      const rows = (data || []).map(r => ({
        ...r,
        requested_by_name: nameMap.get(r.requested_by) || null,
      }));

      return res.json({
        bookings:   rows,
        total:      count ?? 0,
        page:       pageNum,
        totalPages: Math.ceil((count ?? 0) / limitNum),
        hasNext:    pageNum * limitNum < (count ?? 0),
        hasPrev:    pageNum > 1,
      });
    } catch (err) {
      console.error("[VenueBookings] GET /?venue_id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venue-bookings/mine
// Returns the current user's bookings split into upcoming and past.
// ---------------------------------------------------------------------------
router.get(
  "/venue-bookings/mine",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;

      const { data, error } = await supabase
        .from("venue_bookings")
        .select("*")
        .eq("requested_by", user.email)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });
      if (error) throw error;

      // Attach venue info via explicit lookup (no FK join needed)
      const venueMap = await getVenueMap((data || []).map(r => r.venue_id));
      const rows = (data || []).map(r => ({ ...r, venue: venueMap.get(r.venue_id) || null }));

      const today = todayStr();
      const upcoming = [];
      const past = [];
      rows.forEach((row) => {
        if (row.date >= today) upcoming.push(row);
        else past.push(row);
      });
      upcoming.reverse(); // sort upcoming ASC

      return res.json({ upcoming, past });
    } catch (err) {
      console.error("[VenueBookings] GET /mine error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venue-bookings/queue
// Venue manager's approval queue — only bookings for venues in their campus.
// Masteradmin without a campus sees everything.
// Only returns bookings for venues that require approval.
// ---------------------------------------------------------------------------
router.get(
  "/venue-bookings/queue",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      if (!user.is_vendor_manager && !user.is_masteradmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch pending bookings
      const { data: pending, error: pErr } = await supabase
        .from("venue_bookings")
        .select("*")
        .eq("status", "pending")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (pErr) throw pErr;

      // Fetch recently reviewed bookings
      const { data: reviewed, error: rErr } = await supabase
        .from("venue_bookings")
        .select("*")
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (rErr) throw rErr;

      // Attach venue info via explicit lookup (no FK required)
      const allRows = [...(pending || []), ...(reviewed || [])];
      const venueMap = await getVenueMap(allRows.map(r => r.venue_id));
      const withVenue = r => ({ ...r, venue: venueMap.get(r.venue_id) || null });

      const pendingWithVenue  = (pending  || []).map(withVenue);
      const reviewedWithVenue = (reviewed || []).map(withVenue);

      // Scope to campus
      const managerCampus = user.campus || null;
      const inScope = (row) => {
        if (user.is_masteradmin && !managerCampus) return true;
        return row.venue?.campus === managerCampus;
      };

      // Only include venues that require approval
      const requiresApproval = (row) => Boolean(row.venue?.is_approval_needed);

      const pendingFiltered  = pendingWithVenue.filter(inScope).filter(requiresApproval);
      const reviewedFiltered = reviewedWithVenue.filter(inScope);

      // Detect overlapping pending bookings for same venue + date + time
      const overlappingIds = new Set();
      for (let i = 0; i < pendingFiltered.length; i++) {
        for (let j = i + 1; j < pendingFiltered.length; j++) {
          const a = pendingFiltered[i];
          const b = pendingFiltered[j];
          if (
            a.venue_id === b.venue_id &&
            a.date     === b.date     &&
            timeOverlaps(a.start_time, a.end_time, b.start_time, b.end_time)
          ) {
            overlappingIds.add(a.id);
            overlappingIds.add(b.id);
          }
        }
      }

      // Fetch requester display names
      const nameMap = await getNameMap([...pendingFiltered, ...reviewedFiltered].map(r => r.requested_by));

      return res.json({
        pending: pendingFiltered.map(r => ({
          ...r,
          has_overlap:       overlappingIds.has(r.id),
          requested_by_name: nameMap.get(r.requested_by) || null,
        })),
        reviewed: reviewedFiltered.map(r => ({
          ...r,
          has_overlap:       false,
          requested_by_name: nameMap.get(r.requested_by) || null,
        })),
      });
    } catch (err) {
      console.error("[VenueBookings] GET /queue error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/venue-bookings/:id/action
// Approve / reject / return_for_revision. Scoped to campus.
// ---------------------------------------------------------------------------
router.post(
  "/venue-bookings/:id/action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      const { id } = req.params;
      const { action, notes } = req.body;

      if (!["approved", "rejected", "returned_for_revision"].includes(action)) {
        return res.status(400).json({
          error: "action must be approved, rejected, or returned_for_revision",
        });
      }

      // Fetch the booking (no FK join — fetch venue separately)
      const { data: rows, error: fetchErr } = await supabase
        .from("venue_bookings")
        .select("*")
        .eq("id", id)
        .limit(1);
      if (fetchErr) throw fetchErr;

      const booking = rows?.[0];
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.status !== "pending") {
        return res.status(409).json({ error: "This booking has already been actioned" });
      }

      // Fetch venue separately
      const venue = await getVenue(booking.venue_id);

      // Authorization: vendor_manager must match campus
      let authorized = Boolean(user.is_masteradmin);
      if (!authorized && user.is_vendor_manager) {
        authorized = venue?.campus === user.campus;
      }
      if (!authorized) {
        return res.status(403).json({ error: "Not authorized to act on this booking" });
      }

      if (action !== "approved") {
        if (!notes || String(notes).trim().length < 10) {
          return res.status(400).json({
            error: "Notes are required (min 10 characters) when rejecting or returning",
          });
        }
      }

      // Overlap guard at approval time
      if (action === "approved") {
        const { data: existing } = await supabase
          .from("venue_bookings")
          .select("id, start_time, end_time, title")
          .eq("venue_id", booking.venue_id)
          .eq("date",     booking.date)
          .eq("status",   "approved");

        const conflict = (existing || []).find(
          (b) => b.id !== booking.id && timeOverlaps(booking.start_time, booking.end_time, b.start_time, b.end_time)
        );
        if (conflict) {
          return res.status(409).json({
            error: "Another booking was approved for this time window",
            conflict: { start_time: conflict.start_time, end_time: conflict.end_time, title: conflict.title || null },
          });
        }
      }

      // Apply the action
      const { error: updateErr } = await supabase
        .from("venue_bookings")
        .update({
          status:         action,
          decision_notes: notes ? String(notes).trim() : null,
        })
        .eq("id", id);
      if (updateErr) throw updateErr;

      // When approving: auto-reject other pending bookings that overlap this slot
      if (action === "approved") {
        const { data: otherPending } = await supabase
          .from("venue_bookings")
          .select("id, start_time, end_time")
          .eq("venue_id", booking.venue_id)
          .eq("date",     booking.date)
          .eq("status",   "pending")
          .neq("id",      id);

        const toReject = (otherPending || []).filter(b =>
          timeOverlaps(booking.start_time, booking.end_time, b.start_time, b.end_time)
        );
        if (toReject.length > 0) {
          await supabase
            .from("venue_bookings")
            .update({ status: "rejected", decision_notes: "Another booking was approved for this time slot." })
            .in("id", toReject.map(b => b.id));
        }
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("[VenueBookings] POST /:id/action error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
