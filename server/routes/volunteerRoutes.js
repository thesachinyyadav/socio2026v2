import express from "express";
import { supabase } from "../config/database.js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
} from "../middleware/authMiddleware.js";
import { hasActiveVolunteerAccess, normalizeVolunteerRecords } from "../utils/volunteerAccess.js";

const router = express.Router();

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
      .not("volunteers", "is", null);

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
