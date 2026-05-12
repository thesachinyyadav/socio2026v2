import express from "express";
import { supabase, queryOne } from "../config/database.js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
} from "../middleware/authMiddleware.js";
import { hasActiveVolunteerAccess, normalizeVolunteerRecords } from "../utils/volunteerAccess.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/volunteer/events/:eventId/access
// Validates whether the authenticated user is an active volunteer for this event.
// Called by ScannerClient before opening the camera. If this returns 403 the
// scanner MUST NOT open — frontend treats this as the authoritative gate.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/events/:eventId/access", authenticateUser, getUserInfo(), checkRoleExpiration, async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = req.userInfo;

    if (!user?.register_number) {
      console.log(`[SecurityAudit] Scanner access denied — no register_number for ${user?.email}`);
      return res.status(403).json({
        authorized: false,
        error: "Only registered university members can volunteer at events.",
      });
    }

    const event = await queryOne("events", {
      where: { event_id: eventId },
      select: "event_id, title, event_date, end_date, venue, volunteers, is_archived",
    });

    if (!event) {
      return res.status(404).json({ authorized: false, error: "Event not found." });
    }

    if (event.is_archived) {
      console.log(`[SecurityAudit] Scanner access denied — archived event ${eventId} for ${user.email}`);
      return res.status(403).json({ authorized: false, error: "This event has ended." });
    }

    const hasAccess = hasActiveVolunteerAccess(event.volunteers, user.register_number);
    if (!hasAccess) {
      console.log(
        `[SecurityAudit] Unauthorized scanner access: ${user.email} (${user.register_number}) → event ${eventId}`
      );
      return res.status(403).json({
        authorized: false,
        error: "You are not assigned to scan for this event.",
      });
    }

    // Fetch this volunteer's own assignment record for expiry display
    const myAssignment = normalizeVolunteerRecords(event.volunteers).find(
      (v) => String(v.register_number).toUpperCase() === String(user.register_number).toUpperCase()
    );

    return res.json({
      authorized: true,
      event: {
        event_id: event.event_id,
        title: event.title,
        event_date: event.event_date,
        end_date: event.end_date,
        venue: event.venue,
        volunteer_assignment: myAssignment || null,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/volunteer/events/:eventId/access:", error);
    return res.status(500).json({ authorized: false, error: "Server error validating access." });
  }
});

// GET /api/volunteer/events
// Fetch all events where the current user is assigned as an active volunteer
router.get("/events", authenticateUser, getUserInfo(), checkRoleExpiration, async (req, res) => {
  try {
    const user = req.userInfo;
    if (!user || !user.register_number) {
      return res.status(403).json({ error: "Only students with a register number can be volunteers." });
    }

    const registerNumber = user.register_number;

    // Fetch events that have at least one volunteer assigned.
    // Using string representation of empty JSON array to filter out empty ones
    const { data: events, error } = await supabase
      .from("events")
      .select("event_id, title, event_date, end_date, venue, campus_hosted_at, volunteers, is_archived")
      .not("volunteers", "eq", "[]");

    if (error) {
      console.error("Error fetching events for volunteer dashboard:", error);
      throw error;
    }

    if (!events || events.length === 0) {
      return res.json({ events: [] });
    }

    const now = new Date();

    // Filter events to only those where the current user is an *active* volunteer
    const assignedEvents = events
      .filter((event) => {
        if (event.is_archived) return false;
        return hasActiveVolunteerAccess(event.volunteers, registerNumber, now);
      })
      .map((event) => {
        // Extract specifically the user's assignment details
        const normalizedVolunteers = normalizeVolunteerRecords(event.volunteers);
        const myAssignment = normalizedVolunteers.find(
          (v) => String(v.register_number).toUpperCase() === String(registerNumber).toUpperCase()
        );

        return {
          event_id: event.event_id,
          title: event.title,
          event_date: event.event_date,
          end_date: event.end_date,
          venue: event.venue,
          campus_hosted_at: event.campus_hosted_at,
          volunteer_assignment: myAssignment || null,
        };
      });

    return res.json({ events: assignedEvents });
  } catch (error) {
    console.error("Error in GET /api/volunteer/events:", error);
    return res.status(500).json({ error: "Failed to fetch assigned volunteer events." });
  }
});

export default router;
