import express from "express";
import {
  queryAll,
  queryOne,
  insert,
  remove,
} from "../config/database.js";
import { multerUpload } from "../utils/multerConfig.js";
import {
  uploadFileToSupabase,
  getPathFromStorageUrl,
  deleteFileFromLocal,
} from "../utils/fileUtils.js";
import {
  parseOptionalFloat,
  parseOptionalInt,
  parseJsonField,
} from "../utils/parsers.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// GET all events
router.get("/", async (req, res) => {
  try {
    const events = await queryAll("events", {
      order: { column: "created_at", ascending: false },
    });

    const processedEvents = (events || []).map((event) => ({
      ...event,
      department_access: Array.isArray(event.department_access)
        ? event.department_access
        : parseJsonField(event.department_access, []),
      rules: Array.isArray(event.rules)
        ? event.rules
        : parseJsonField(event.rules, []),
      schedule: Array.isArray(event.schedule)
        ? event.schedule
        : parseJsonField(event.schedule, []),
      prizes: Array.isArray(event.prizes)
        ? event.prizes
        : parseJsonField(event.prizes, []),
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

  const event = await queryOne("events", { where: { event_id: eventId } });

    if (!event) {
      return res.status(404).json({ error: `Event with ID '${eventId}' not found.` });
    }

    // Parse JSON fields
    const processedEvent = {
      ...event,
      department_access: Array.isArray(event.department_access)
        ? event.department_access
        : parseJsonField(event.department_access, []),
      rules: Array.isArray(event.rules)
        ? event.rules
        : parseJsonField(event.rules, []),
      schedule: Array.isArray(event.schedule)
        ? event.schedule
        : parseJsonField(event.schedule, []),
      prizes: Array.isArray(event.prizes)
        ? event.prizes
        : parseJsonField(event.prizes, []),
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
    const event = await queryOne("events", { where: { event_id: eventId } });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const filesToDelete = [
      { url: event.event_image_url, bucket: "event-images" },
      { url: event.banner_url, bucket: "event-banners" },
      { url: event.pdf_url, bucket: "event-pdfs" },
    ];

    for (const fileInfo of filesToDelete) {
      if (fileInfo.url) {
        const filePath = getPathFromStorageUrl(fileInfo.url, fileInfo.bucket);
        if (filePath) {
          await deleteFileFromLocal(filePath, fileInfo.bucket);
        }
      }
    }

    await remove("attendance_status", { event_id: eventId });
    await remove("registrations", { event_id: eventId });
    const deleted = await remove("events", { event_id: eventId });

    if (!deleted || deleted.length === 0) {
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

      // Generate slug-based ID from title
      let event_id = eventData.title
        ? eventData.title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "";

      if (!event_id) {
        event_id = uuidv4().replace(/-/g, "");
      }

      // Check for collision (optional but recommended)
      // For this user's request matching the 'green box', we use the simple slug.
      // Ideally we would append a suffix if it exists, but let's stick to the requested format.

      // Upload files if they exist
      let event_image_url = null;
      let banner_url = null;
      let pdf_url = null;

      try {
        if (files.eventImage && files.eventImage[0]) {
          const result = await uploadFileToSupabase(
            files.eventImage[0],
            "event-images",
            event_id
          );
          event_image_url = result?.publicUrl || result?.path || null;
        }

        if (files.bannerImage && files.bannerImage[0]) {
          const result = await uploadFileToSupabase(
            files.bannerImage[0],
            "event-banners",
            event_id
          );
          banner_url = result?.publicUrl || result?.path || null;
        }

        if (files.pdfFile && files.pdfFile[0]) {
          const result = await uploadFileToSupabase(
            files.pdfFile[0],
            "event-pdfs",
            event_id
          );
          pdf_url = result?.publicUrl || result?.path || null;
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
        department_access: Array.isArray(eventData.departmentAccess)
          ? eventData.departmentAccess
          : parseJsonField(eventData.departmentAccess, []),
        claims_applicable: eventData.claimsApplicable === "true" ? 1 : 0,
        registration_fee: parseOptionalFloat(eventData.registrationFee, 0),
        participants_per_team: parseOptionalInt(eventData.participantsPerTeam, 1),
        max_participants: parseOptionalInt(eventData.maxParticipants, null),
        organizer_email: eventData.organizerEmail || "",
        organizer_phone: eventData.organizerPhone || "",
        whatsapp_invite_link: eventData.whatsappInviteLink || "",
        organizing_dept: eventData.organizingDept,
        fest: eventData.fest || null,
        registration_deadline: eventData.registrationDeadline || null,
        // Outsider registration fields
        allow_outsiders: eventData.allowOutsiders === "true" || eventData.allow_outsiders === true ? 1 : 0,
        outsider_registration_fee: parseOptionalFloat(eventData.outsiderRegistrationFee || eventData.outsider_registration_fee, null),
        outsider_max_participants: parseOptionalInt(eventData.outsiderMaxParticipants || eventData.outsider_max_participants, null),
        schedule: Array.isArray(eventData.scheduleItems)
          ? eventData.scheduleItems
          : parseJsonField(eventData.scheduleItems, []),
        rules: Array.isArray(eventData.rules)
          ? eventData.rules
          : parseJsonField(eventData.rules, []),
        prizes: Array.isArray(eventData.prizes)
          ? eventData.prizes
          : parseJsonField(eventData.prizes, []),
        event_image_url: event_image_url,
        banner_url: banner_url,
        pdf_url: pdf_url,
        total_participants: 0,
        created_by: eventData.createdBy || "admin"
      };

      const [createdEvent] = await insert("events", [eventPayload]);

      const responseEvent = {
        ...createdEvent,
        department_access: Array.isArray(createdEvent.department_access)
          ? createdEvent.department_access
          : parseJsonField(createdEvent.department_access, []),
        rules: Array.isArray(createdEvent.rules)
          ? createdEvent.rules
          : parseJsonField(createdEvent.rules, []),
        schedule: Array.isArray(createdEvent.schedule)
          ? createdEvent.schedule
          : parseJsonField(createdEvent.schedule, []),
        prizes: Array.isArray(createdEvent.prizes)
          ? createdEvent.prizes
          : parseJsonField(createdEvent.prizes, []),
      };

      return res.status(201).json({
        message: "Event created successfully",
        event: responseEvent,
      });

    } catch (error) {
      console.error("Error creating event:", error);
      return res.status(500).json({ error: "Internal server error while creating event." });
    }
  }
);

export default router;