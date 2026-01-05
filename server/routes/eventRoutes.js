import express from "express";
import { queryAll, queryOne, executeQuery } from "../config/database.js";
import { multerUpload } from "../utils/multerConfig.js";
import { uploadFileToSupabase, getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { parseOptionalFloat, parseOptionalInt, parseJsonField } from "../utils/parsers.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// GET all events
router.get("/", async (req, res) => {
  try {
    const events = await queryAll("SELECT * FROM events ORDER BY created_at DESC");

    // Parse JSON fields for each event
    const processedEvents = events.map(event => ({
      ...event,
      department_access: event.department_access || [],
      rules: event.rules || [],
      schedule: event.schedule || [],
      prizes: event.prizes || []
    }));

    return res.status(200).json({ events: processedEvents });
  } catch (error) {
    console.error("Server error GET /api/events:", error);
    return res.status(500).json({ error: "Internal server error while fetching events." });
  }
});

// GET specific event by ID
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
      return res.status(400).json({
        error: "Event ID must be provided in the URL path and be a non-empty string.",
      });
    }

    const event = await queryOne("SELECT * FROM events WHERE event_id = ?", [eventId]);

    if (!event) {
      return res.status(404).json({ error: `Event with ID '${eventId}' not found.` });
    }

    // Parse JSON fields
    const processedEvent = {
      ...event,
      department_access: event.department_access ? JSON.parse(event.department_access) : [],
      rules: event.rules ? JSON.parse(event.rules) : [],
      schedule: event.schedule ? JSON.parse(event.schedule) : [],
      prizes: event.prizes ? JSON.parse(event.prizes) : []
    };

    return res.status(200).json({ event: processedEvent });
  } catch (error) {
    console.error(`Server error GET /api/events/${req.params.eventId}:`, error);
    return res.status(500).json({ error: "Internal server error while fetching specific event." });
  }
});

// DELETE event
router.delete("/:eventId", async (req, res) => {
  const { eventId } = req.params;

  try {
    // Get event to find associated files
    const getStmt = db.prepare("SELECT * FROM events WHERE event_id = ?");
    const event = getStmt.get(eventId);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Delete associated files
    const filesToDelete = [
      { url: event.event_image_url, bucket: "event-images" },
      { url: event.banner_url, bucket: "event-banners" },
      { url: event.pdf_url, bucket: "event-pdfs" }
    ];

    for (const fileInfo of filesToDelete) {
      if (fileInfo.url) {
        const filePath = getPathFromStorageUrl(fileInfo.url, fileInfo.bucket);
        if (filePath) {
          await deleteFileFromLocal(filePath, fileInfo.bucket);
        }
      }
    }

    // Delete related registrations and attendance records
    db.prepare("DELETE FROM attendance_status WHERE event_id = ?").run(eventId);
    db.prepare("DELETE FROM registrations WHERE event_id = ?").run(eventId);
    
    // Delete the event
    const deleteResult = db.prepare("DELETE FROM events WHERE event_id = ?").run(eventId);

    if (deleteResult.changes === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json({ message: "Event deleted successfully" });

  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "Internal server error while deleting event." });
  }
});

// POST - Create new event (with file uploads)
router.post("/", multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("POST /api/events - Creating new event");
      
      const eventData = req.body;
      const files = req.files;

      // Simple validation - just check for required fields
      const requiredFields = ["title", "eventDate", "category", "organizingDept", "venue"];
      for (const field of requiredFields) {
        if (!eventData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Generate unique event ID
      const event_id = uuidv4().replace(/-/g, '');

      // Upload files if they exist
      let event_image_url = null;
      let banner_url = null;
      let pdf_url = null;

      try {
        if (files.eventImage && files.eventImage[0]) {
          const result = await uploadFileToSupabase(files.eventImage[0], "event-images", event_id);
          event_image_url = result.publicUrl;
        }

        if (files.bannerImage && files.bannerImage[0]) {
          const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", event_id);
          banner_url = result.publicUrl;
        }

        if (files.pdfFile && files.pdfFile[0]) {
          const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", event_id);
          pdf_url = result.publicUrl;
        }
      } catch (fileError) {
        console.error("File upload error:", fileError);
        return res.status(500).json({ error: "Failed to upload files" });
      }

      // Prepare event payload
      const eventPayload = {
        event_id: event_id,
        title: eventData.title,
        description: eventData.description || "",
        event_date: eventData.eventDate,
        event_time: eventData.eventTime || null,
        end_date: eventData.endDate || null,
        venue: eventData.venue,
        category: eventData.category,
        department_access: JSON.stringify(parseJsonField(eventData.departmentAccess, [])),
        claims_applicable: eventData.claimsApplicable === "true" ? 1 : 0,
        registration_fee: parseOptionalFloat(eventData.registrationFee, 0),
        participants_per_team: parseOptionalInt(eventData.participantsPerTeam, 1),
        organizer_email: eventData.organizerEmail || "",
        organizer_phone: eventData.organizerPhone || "",
        whatsapp_invite_link: eventData.whatsappInviteLink || "",
        organizing_dept: eventData.organizingDept,
        fest: eventData.fest || null,
        registration_deadline: eventData.registrationDeadline || null,
        schedule: JSON.stringify(parseJsonField(eventData.scheduleItems, [])),
        rules: JSON.stringify(parseJsonField(eventData.rules, [])),
        prizes: JSON.stringify(parseJsonField(eventData.prizes, [])),
        event_image_url: event_image_url,
        banner_url: banner_url,
        pdf_url: pdf_url,
        total_participants: 0,
        created_by: eventData.createdBy || "admin"
      };

      // Insert event into database
      const insertStmt = db.prepare(`
        INSERT INTO events (
          event_id, title, description, event_date, event_time, end_date, venue, 
          category, department_access, claims_applicable, registration_fee, 
          participants_per_team, organizer_email, organizer_phone, whatsapp_invite_link,
          organizing_dept, fest, registration_deadline, schedule, rules, prizes,
          event_image_url, banner_url, pdf_url, total_participants, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        eventPayload.event_id, eventPayload.title, eventPayload.description,
        eventPayload.event_date, eventPayload.event_time, eventPayload.end_date,
        eventPayload.venue, eventPayload.category, eventPayload.department_access,
        eventPayload.claims_applicable, eventPayload.registration_fee,
        eventPayload.participants_per_team, eventPayload.organizer_email,
        eventPayload.organizer_phone, eventPayload.whatsapp_invite_link,
        eventPayload.organizing_dept, eventPayload.fest, eventPayload.registration_deadline,
        eventPayload.schedule, eventPayload.rules, eventPayload.prizes,
        eventPayload.event_image_url, eventPayload.banner_url, eventPayload.pdf_url,
        eventPayload.total_participants, eventPayload.created_by
      );

      // Get the created event
      const getStmt = db.prepare("SELECT * FROM events WHERE event_id = ?");
      const createdEvent = getStmt.get(event_id);

      // Parse JSON fields for response
      const responseEvent = {
        ...createdEvent,
        department_access: createdEvent.department_access ? JSON.parse(createdEvent.department_access) : [],
        rules: createdEvent.rules ? JSON.parse(createdEvent.rules) : [],
        schedule: createdEvent.schedule ? JSON.parse(createdEvent.schedule) : [],
        prizes: createdEvent.prizes ? JSON.parse(createdEvent.prizes) : []
      };

      return res.status(201).json({
        message: "Event created successfully",
        event: responseEvent
      });

    } catch (error) {
      console.error("Error creating event:", error);
      return res.status(500).json({ error: "Internal server error while creating event." });
    }
  }
);

export default router;