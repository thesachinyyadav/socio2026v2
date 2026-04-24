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
// GET /api/stall-bookings/my-options
// Returns the organiser's own events and fests for the booking form dropdown
// ---------------------------------------------------------------------------
router.get(
  "/stall-bookings/my-options",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      if (!u.is_organiser && !u.is_masteradmin) {
        return res.status(403).json({ error: "Organiser role required" });
      }

      const [eventsResult, festsResult] = await Promise.all([
        supabase
          .from("events")
          .select("event_id, title, event_date")
          .or(`organizer_email.eq.${u.email},created_by.eq.${u.email}`)
          .neq("is_archived", true)
          .order("event_date", { ascending: false }),
        supabase
          .from("fests")
          .select("fest_id, fest_title, opening_date")
          .eq("created_by", u.email)
          .neq("is_archived", true)
          .order("opening_date", { ascending: false }),
      ]);

      return res.json({
        events: eventsResult.data || [],
        fests: festsResult.data || [],
      });
    } catch (err) {
      console.error("[StallBookings] GET /stall-bookings/my-options error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/stall-bookings/mine
// Returns the current user's stall bookings, enriched with event/fest titles
// ---------------------------------------------------------------------------
router.get(
  "/stall-bookings/mine",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      if (!u.email) return res.status(401).json({ error: "Unauthenticated" });

      const { data: bookings, error } = await supabase
        .from("stall_booking")
        .select("*")
        .eq("requested_by", u.email)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const eventFestIds = Array.from(
        new Set((bookings || []).map((b) => b.event_fest_id).filter(Boolean))
      );

      let eventsById = new Map();
      let festsById = new Map();

      if (eventFestIds.length) {
        const [evRes, ftRes] = await Promise.all([
          supabase
            .from("events")
            .select("event_id, title, event_date")
            .in("event_id", eventFestIds),
          supabase
            .from("fests")
            .select("fest_id, fest_title, opening_date")
            .in("fest_id", eventFestIds),
        ]);
        eventsById = new Map((evRes.data || []).map((e) => [e.event_id, e]));
        festsById = new Map((ftRes.data || []).map((f) => [f.fest_id, f]));
      }

      const enriched = (bookings || []).map((b) => ({
        ...b,
        event_title: b.event_fest_id ? eventsById.get(b.event_fest_id)?.title || null : null,
        event_date: b.event_fest_id ? eventsById.get(b.event_fest_id)?.event_date || null : null,
        fest_title: b.event_fest_id ? festsById.get(b.event_fest_id)?.fest_title || null : null,
        fest_date: b.event_fest_id ? festsById.get(b.event_fest_id)?.opening_date || null : null,
      }));

      return res.json({ bookings: enriched });
    } catch (err) {
      console.error("[StallBookings] GET /stall-bookings/mine error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/stall-bookings/queue
// Stall manager sees pending + reviewed bookings scoped to their campus
// ---------------------------------------------------------------------------
router.get(
  "/stall-bookings/queue",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      if (!u.is_stalls && !u.is_masteradmin) {
        return res.status(403).json({ error: "Stalls role required" });
      }

      let query = supabase
        .from("stall_booking")
        .select("*")
        .order("created_at", { ascending: false });

      if (!u.is_masteradmin || u.campus) {
        query = query.eq("campus", u.campus);
      }

      const { data: bookings, error } = await query;
      if (error) throw error;

      const eventFestIds = Array.from(
        new Set((bookings || []).map((b) => b.event_fest_id).filter(Boolean))
      );

      let eventsById = new Map();
      let festsById = new Map();

      if (eventFestIds.length) {
        const [evRes, ftRes] = await Promise.all([
          supabase
            .from("events")
            .select("event_id, title, event_date")
            .in("event_id", eventFestIds),
          supabase
            .from("fests")
            .select("fest_id, fest_title, opening_date")
            .in("fest_id", eventFestIds),
        ]);
        eventsById = new Map((evRes.data || []).map((e) => [e.event_id, e]));
        festsById = new Map((ftRes.data || []).map((f) => [f.fest_id, f]));
      }

      const enriched = (bookings || []).map((b) => ({
        ...b,
        event_title: b.event_fest_id ? eventsById.get(b.event_fest_id)?.title || null : null,
        event_date: b.event_fest_id ? eventsById.get(b.event_fest_id)?.event_date || null : null,
        fest_title: b.event_fest_id ? festsById.get(b.event_fest_id)?.fest_title || null : null,
        fest_date: b.event_fest_id ? festsById.get(b.event_fest_id)?.opening_date || null : null,
      }));

      const pending = enriched.filter((b) => b.status === "pending");
      const reviewed = enriched.filter((b) => b.status !== "pending");

      return res.json({ pending, reviewed });
    } catch (err) {
      console.error("[StallBookings] GET /stall-bookings/queue error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/stall-bookings
// Organiser submits a stall booking request
// ---------------------------------------------------------------------------
router.post(
  "/stall-bookings",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      if (!u.is_organiser && !u.is_masteradmin) {
        return res.status(403).json({ error: "Organiser role required to book a stall" });
      }

      const { description, hardboard_stalls, canopy_stalls, campus, event_fest_id } =
        req.body || {};

      if (!description || !String(description).trim()) {
        return res.status(400).json({ error: "description is required" });
      }
      if (!campus || !String(campus).trim()) {
        return res.status(400).json({ error: "campus is required" });
      }
      if (
        hardboard_stalls !== undefined &&
        (isNaN(Number(hardboard_stalls)) || Number(hardboard_stalls) < 0)
      ) {
        return res
          .status(400)
          .json({ error: "hardboard_stalls must be a non-negative number" });
      }
      if (
        canopy_stalls !== undefined &&
        (isNaN(Number(canopy_stalls)) || Number(canopy_stalls) < 0)
      ) {
        return res
          .status(400)
          .json({ error: "canopy_stalls must be a non-negative number" });
      }

      // Validate event_fest_id against either table
      let resolvedEventFestId = null;
      if (event_fest_id) {
        const [evRes, ftRes] = await Promise.all([
          supabase
            .from("events")
            .select("event_id")
            .eq("event_id", event_fest_id)
            .maybeSingle(),
          supabase
            .from("fests")
            .select("fest_id")
            .eq("fest_id", event_fest_id)
            .maybeSingle(),
        ]);
        if (!evRes.data && !ftRes.data) {
          return res
            .status(400)
            .json({ error: "event_fest_id does not match any event or fest" });
        }
        resolvedEventFestId = event_fest_id;
      }

      const descriptionValue = {
        notes: String(description).trim(),
        hardboard_stalls: Number(hardboard_stalls) || 0,
        canopy_stalls: Number(canopy_stalls) || 0,
      };

      const { data, error } = await supabase
        .from("stall_booking")
        .insert({
          description: descriptionValue,
          requested_by: u.email,
          campus: String(campus).trim(),
          event_fest_id: resolvedEventFestId,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23503") {
          return res.status(400).json({
            error:
              "The selected event or fest could not be linked due to a database constraint. Try submitting without the event/fest link.",
          });
        }
        throw error;
      }

      return res.status(201).json({ booking: data });
    } catch (err) {
      console.error("[StallBookings] POST /stall-bookings error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/stall-bookings/:id/action
// Stall manager accepts or declines a pending booking
// ---------------------------------------------------------------------------
router.patch(
  "/stall-bookings/:id/action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      if (!u.is_stalls && !u.is_masteradmin) {
        return res.status(403).json({ error: "Stalls role required" });
      }

      const { id } = req.params;
      const { action } = req.body || {};

      if (!["accept", "decline"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
      }

      const { data: booking } = await supabase
        .from("stall_booking")
        .select("stall_id, campus, status")
        .eq("stall_id", id)
        .maybeSingle();

      if (!booking) {
        return res.status(404).json({ error: "Stall booking not found" });
      }

      if (!u.is_masteradmin && booking.campus !== u.campus) {
        return res.status(403).json({ error: "Not authorized for this campus" });
      }

      if (booking.status !== "pending") {
        return res.status(409).json({ error: `Booking is already ${booking.status}` });
      }

      const newStatus = action === "accept" ? "accepted" : "declined";

      const { data, error } = await supabase
        .from("stall_booking")
        .update({ status: newStatus })
        .eq("stall_id", id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ booking: data });
    } catch (err) {
      console.error("[StallBookings] PATCH /stall-bookings/:id/action error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

export default router;
