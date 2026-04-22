import express from "express";
import { queryAll, queryOne, insert, update } from "../config/database.js";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireMasterAdmin,
} from "../middleware/authMiddleware.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/venues?campus=<campus>
// Returns active venues for a campus (any authenticated user)
// ---------------------------------------------------------------------------
router.get(
  "/venues",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { campus, block } = req.query;
      if (!campus) {
        return res.status(400).json({ error: "campus query parameter is required" });
      }

      let query = supabase
        .from("venues")
        .select("id:venue_id, name, capacity, location, is_approval_needed")
        .eq("campus", campus)
        .eq("is_active", true);
      if (block) query = query.eq("location", block);

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error("[Venues] GET /venues error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venues/campuses
// Returns a list of unique campuses that have active venues
// ---------------------------------------------------------------------------
router.get(
  "/venues/campuses",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("campus")
        .eq("is_active", true);

      if (error) throw error;
      
      const distinctCampuses = Array.from(new Set((data || []).map(v => v.campus).filter(Boolean)));
      return res.json({ campuses: distinctCampuses.sort() });
    } catch (err) {
      console.error("[Venues] GET /venues/campuses error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venues/blocks?campus=<campus>
// Returns the distinct `location` (block) values for active venues in a campus.
// Used to populate the Location dropdown on the booking page.
// ---------------------------------------------------------------------------
router.get(
  "/venues/blocks",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { campus } = req.query;
      if (!campus) {
        return res.status(400).json({ error: "campus query parameter is required" });
      }

      const { data, error } = await supabase
        .from("venues")
        .select("location")
        .eq("campus", campus)
        .eq("is_active", true);

      if (error) throw error;

      const blocks = Array.from(
        new Set((data || []).map(v => v.location).filter(b => b && String(b).trim()))
      ).sort();

      return res.json({ blocks });
    } catch (err) {
      console.error("[Venues] GET /venues/blocks error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venues/:id/availability?month=YYYY-MM
// Returns approved bookings (time windows) in the given month for this venue.
// Response: { bookings: [{ date, start_time, end_time, requested_by, full_name, booking_title, entity_type }] }
// ---------------------------------------------------------------------------
router.get(
  "/venues/:id/availability",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { month } = req.query; // expected: "YYYY-MM"

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "month must be in YYYY-MM format" });
      }

      const { data, error } = await supabase
        .from("venue_bookings")
        .select("id, venue_id, requested_by, date, start_time, end_time, title, entity_type")
        .eq("venue_id", id)
        .eq("status", "approved")
        .like("date", `${month}-%`);

      if (error) throw error;

      // Join requested_by → users display name
      const emails = Array.from(new Set((data || []).map((r) => r.requested_by).filter(Boolean)));
      const nameByEmail = new Map();
      if (emails.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("email, name, full_name")
          .in("email", emails);
        (users || []).forEach((u) => {
          nameByEmail.set(u.email, u.name || u.full_name || null);
        });
      }

      const bookings = (data || [])
        .filter((r) => r.date && r.start_time && r.end_time)
        .map((r) => ({
          date: r.date,
          start_time: r.start_time,
          end_time: r.end_time,
          requested_by: r.requested_by,
          full_name: nameByEmail.get(r.requested_by) || null,
          booking_title: r.title || null,
          entity_type: r.entity_type,
        }));

      return res.json({ bookings });
    } catch (err) {
      console.error("[Venues] GET /venues/:id/availability error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/venues — masteradmin only — add a venue
// ---------------------------------------------------------------------------
router.post(
  "/venues",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { campus, name, capacity, location, is_approval_needed } = req.body;
      if (!campus || !name) {
        return res.status(400).json({ error: "campus and name are required" });
      }

      let venue_id = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!venue_id) {
        return res.status(400).json({ error: "name must contain alphanumeric characters" });
      }

      const existingVenueId = await queryOne("venues", { where: { venue_id } });
      if (existingVenueId) {
        return res.status(409).json({ error: `A venue with venue_id "${venue_id}" already exists` });
      }

      const venue = await insert("venues", {
        campus,
        name,
        venue_id,
        capacity: capacity ?? null,
        location: location ?? null,
        is_active: true,
        is_approval_needed: Boolean(is_approval_needed),
      });

      return res.status(201).json({ venue });
    } catch (err) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "A venue with that name already exists for this campus" });
      }
      console.error("[Venues] POST /venues error:", err);
      return res.status(500).json({
        error: err?.message || "Internal server error",
        code: err?.code,
        hint: err?.hint,
        details: err?.details,
      });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/venues/:id — masteradmin only — update a venue
// ---------------------------------------------------------------------------
router.put(
  "/venues/:id",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, capacity, location, is_active, is_approval_needed } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (capacity !== undefined) updates.capacity = capacity;
      if (location !== undefined) updates.location = location;
      if (is_active !== undefined) updates.is_active = is_active;
      if (is_approval_needed !== undefined) updates.is_approval_needed = is_approval_needed;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const venue = await update("venues", updates, { venue_id: id });
      return res.json({ venue });
    } catch (err) {
      console.error("[Venues] PUT /venues/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/venues/:id — masteradmin only — hard delete a venue
// ---------------------------------------------------------------------------
router.delete(
  "/venues/:id",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase.from("venues").delete().eq("venue_id", id);
      if (error) throw error;

      return res.json({ success: true });
    } catch (err) {
      console.error("[Venues] DELETE /venues/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/venues/all — masteradmin only — all venues across all campuses
// ---------------------------------------------------------------------------
router.get(
  "/venues/all",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id:venue_id, campus, name, capacity, location, is_active, is_approval_needed")
        .order("campus", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error("[Venues] GET /venues/all error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
