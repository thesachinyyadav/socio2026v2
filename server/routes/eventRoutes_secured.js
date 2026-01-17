import express from "express";
import {
  queryAll,
  queryOne,
  insert,
  update,
  remove,
} from "../config/database.js";
import { multerUpload } from "../utils/multerConfig.js";
import { uploadFileToSupabase, getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { parseOptionalFloat, parseOptionalInt, parseJsonField } from "../utils/parsers.js";
import { v4 as uuidv4 } from "uuid";
import { 
  authenticateUser, 
  getUserInfo, 
  requireOrganiser, 
  requireOwnership, 
  optionalAuth 
} from "../middleware/authMiddleware.js";

const router = express.Router();

const normalizeJsonField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value; // Already an object/array
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed;
    } catch (e) {
      console.warn("JSON Parse warning for value:", value, e.message);
      return []; // fallback
    }
  }
  return [];
};


// GET all events - PUBLIC ACCESS (no auth required)
router.get("/", async (req, res) => {
  try {
    const events = await queryAll("events", { order: { column: "created_at", ascending: false } });

    // Parse JSON fields for each event
    const processedEvents = events.map(event => ({
      ...event,
      department_access: normalizeJsonField(event.department_access),
      rules: normalizeJsonField(event.rules),
      schedule: normalizeJsonField(event.schedule),
      prizes: normalizeJsonField(event.prizes)
    }));

    return res.status(200).json({ events: processedEvents });
  } catch (error) {
    console.error("Server error GET /api/events:", error);
    return res.status(500).json({ error: "Internal server error while fetching events." });
  }
});

// GET specific event by ID - PUBLIC ACCESS
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
      department_access: normalizeJsonField(event.department_access),
      rules: normalizeJsonField(event.rules),
      schedule: normalizeJsonField(event.schedule),
      prizes: normalizeJsonField(event.prizes)
    };

    return res.status(200).json({ event: processedEvent });
  } catch (error) {
    console.error("Server error GET /api/events/:eventId:", error);
    return res.status(500).json({ error: "Internal server error while fetching event." });
  }
});

// POST create new event - REQUIRES AUTHENTICATION + ORGANISER PRIVILEGES
router.post(
  "/",
  multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  authenticateUser,           // Verify JWT token
  getUserInfo(),           // Get user info from DB via helper
  requireOrganiser,          // Check if user is organiser
  async (req, res) => {
    const uploadedFilePaths = {
      image: null,
      banner: null,
      pdf: null,
    };

    console.log("POST /api/events - Request received");
    console.log("Content-Type:", req.headers['content-type']); // Log content type
    
    if (req.files) {
      console.log("Files keys:", Object.keys(req.files));
      if (req.files.eventImage) console.log("eventImage:", req.files.eventImage[0].originalname, req.files.eventImage[0].mimetype, req.files.eventImage[0].size);
      if (req.files.bannerImage) console.log("bannerImage:", req.files.bannerImage[0].originalname, req.files.bannerImage[0].mimetype, req.files.bannerImage[0].size);
    } else {
      console.log("No files in req.files");
    }

    try {
      const {
        title,
        description,
        event_date,
        event_time,
        venue,
        category,
        claims_applicable,
        registration_fee,
        organizing_dept,
        fest,
        department_access,
        rules,
        schedule,
        prizes,
        max_participants
      } = req.body;

      // Validation
      if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and must be a non-empty string." });
      }

      // Generate slug-based ID from title
      let event_id = title
        ? title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "";

      if (!event_id) {
        event_id = uuidv4().replace(/-/g, "");
      }
      console.log("Generated event_id:", event_id);

      // Handle file uploads
      const files = req.files;
      
      // Upload Event Image
      if (files?.eventImage && files.eventImage[0]) {
        // Removed try/catch to ensure errors bubble up to the user
        console.log(`Attempting to upload eventImage: ${files.eventImage[0].originalname}`);
        const result = await uploadFileToSupabase(files.eventImage[0], "event-images", event_id);
        uploadedFilePaths.image = result?.publicUrl || null;
        console.log(`Successfully uploaded event image: ${uploadedFilePaths.image}`);
      } else {
        console.warn("WARNING: No eventImage found in request files.");
      }

      // Upload Banner Image
      if (files?.bannerImage && files.bannerImage[0]) {
          console.log(`Attempting to upload bannerImage: ${files.bannerImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", event_id);
          uploadedFilePaths.banner = result?.publicUrl || null;
          console.log(`Successfully uploaded banner image: ${uploadedFilePaths.banner}`);
      }

      // Upload PDF
      if (files?.pdfFile && files.pdfFile[0]) {
          console.log(`Attempting to upload pdfFile: ${files.pdfFile[0].originalname}`);
          const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", event_id);
          uploadedFilePaths.pdf = result?.publicUrl || null;
          console.log(`Successfully uploaded PDF for event ${event_id}: ${uploadedFilePaths.pdf}`);
      }

      // Parse and validate JSON fields
      const parsedDepartmentAccess = parseJsonField(department_access, []);
      const parsedRules = parseJsonField(rules, []);
      const parsedSchedule = parseJsonField(schedule, []);
      const parsedPrizes = parseJsonField(prizes, []);

      console.log("About to insert into database with params:", {
        event_id,
        title: title?.trim(),
        description: description || null,
        event_date: event_date || null,
        max_participants_parsed: parseOptionalInt(max_participants, 1),
        uploadedFiles: uploadedFilePaths
      });

      // Insert event with creator's auth_uuid
      const created = await insert("events", [{
        event_id,
        title: title.trim(),
        description: description || null,
        event_date: event_date || null,
        event_time: event_time || null,
        end_date: req.body.end_date || null,
        venue: venue || null,
        category: category || null,
        department_access: parsedDepartmentAccess,
        claims_applicable: claims_applicable === "true" || claims_applicable === true,
        registration_fee: parseOptionalFloat(registration_fee),
        participants_per_team: parseOptionalInt(max_participants, 1),
        event_image_url: uploadedFilePaths.image,
        banner_url: uploadedFilePaths.banner,
        pdf_url: uploadedFilePaths.pdf,
        rules: parsedRules,
        schedule: parsedSchedule,
        prizes: parsedPrizes,
        organizer_email: req.body.organizer_email || req.userInfo?.email || null,
        organizer_phone: req.body.organizer_phone || null,
        whatsapp_invite_link: req.body.whatsapp_invite_link || null,
        organizing_dept: organizing_dept || null,
        fest: fest || null,
        created_by: req.body.created_by || req.userInfo?.email || req.userId, // Prefer email for created_by
        auth_uuid: req.userId, // Store UUID in auth_uuid
        registration_deadline: req.body.registration_deadline || null,
        total_participants: 0,
      }]);

      if (!created || created.length === 0) {
        throw new Error("Event was not created successfully.");
      }

      // Send notifications to all users about the new event
      try {
        await sendBroadcastNotification({
          title: '🎉 New Event Published!',
          message: `${title} - Check out this new event!`,
          type: 'info',
          event_id: event_id,
          event_title: title,
          action_url: `/event/${event_id}`
        });
        console.log(`Sent notifications for new event: ${title}`);
      } catch (notifError) {
        console.error('Failed to send event notifications:', notifError);
        // Don't fail the event creation if notifications fail
      }

      return res.status(201).json({ 
        message: "Event created successfully", 
        event_id,
        created_by: req.userInfo.email 
      });

    } catch (error) {
      console.error("Server error POST /api/events:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBody: Object.keys(req.body),
        userId: req.userId,
        userInfo: req.userInfo?.email
      });
      
      // Clean up uploaded files on error
      try {
        for (const [key, filePath] of Object.entries(uploadedFilePaths)) {
          if (filePath) {
            await deleteFileFromLocal(getPathFromStorageUrl(filePath, `event-${key}s`), `event-${key}s`);
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }

      return res.status(500).json({ 
        error: "Internal server error while creating event.",
        details: error.message // Include error message for debugging
      });
    }
  }
);

// PUT update event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.put(
  "/:eventId",
  multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  requireOwnership('events', 'eventId', 'auth_uuid'),  // Check ownership using auth_uuid
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const event = req.resource; // Existing event from middleware
      const files = req.files;
      
      // DEBUG: Log what we received
      console.log("=== PUT EVENT RECEIVED ===");
      console.log("req.body:", JSON.stringify(req.body, null, 2));
      console.log("req.body.title:", req.body.title);
      console.log("typeof req.body.title:", typeof req.body.title);
      console.log("files:", files ? Object.keys(files) : "no files");
      console.log("=== END ===");
      
      const uploadedFilePaths = {
        image: event.event_image_url,
        banner: event.banner_url,
        pdf: event.pdf_url,
      };

      // Handle file uploads if new files are provided
      if (files?.eventImage && files.eventImage[0]) {
        // Delete old image if exists (optional extended feature: strictly clean up old files)
        // Here we just overwrite the reference
        const result = await uploadFileToSupabase(files.eventImage[0], "event-images", eventId);
        uploadedFilePaths.image = result?.publicUrl || null;
      }

      if (files?.bannerImage && files.bannerImage[0]) {
        const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", eventId);
        uploadedFilePaths.banner = result?.publicUrl || null;
      }
      
      if (files?.pdfFile && files.pdfFile[0]) {
        const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", eventId);
        uploadedFilePaths.pdf = result?.publicUrl || null;
      }

      const {
        title,
        description,
        event_date,
        event_time,
        venue,
        category,
        claims_applicable,
        registration_fee,
        organizing_dept,
        fest,
        department_access,
        rules,
        schedule,
        prizes,
        max_participants
      } = req.body;

      if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and must be a non-empty string." });
      }

      // Parse JSON fields
      const parsedDepartmentAccess = parseJsonField(department_access, []);
      const parsedRules = parseJsonField(rules, []);
      const parsedSchedule = parseJsonField(schedule, []);
      const parsedPrizes = parseJsonField(prizes, []);

      // Prepare update payload
      const updateData = {
        title: title.trim(),
        description: description || null,
        event_date: event_date || null,
        event_time: event_time || null,
        end_date: req.body.end_date || null,
        venue: venue || null,
        category: category || null,
        department_access: parsedDepartmentAccess,
        claims_applicable: claims_applicable === "true" || claims_applicable === true,
        registration_fee: parseOptionalFloat(registration_fee),
        participants_per_team: parseOptionalInt(max_participants, 1),
        event_image_url: uploadedFilePaths.image,
        banner_url: uploadedFilePaths.banner,
        pdf_url: uploadedFilePaths.pdf,
        rules: parsedRules,
        schedule: parsedSchedule,
        prizes: parsedPrizes,
        organizer_email: req.body.organizer_email || null,
        organizer_phone: req.body.organizer_phone || null,
        whatsapp_invite_link: req.body.whatsapp_invite_link || null,
        organizing_dept: organizing_dept || null,
        fest: fest || null,
        registration_deadline: req.body.registration_deadline || null,
        total_participants: 0, // Should typically not reset total_participants on edit, but preserving logic
        updated_at: new Date().toISOString(),
        updated_by: req.userInfo.email
      };

      const updated = await update("events", updateData, { event_id: eventId });

      if (!updated || updated.length === 0) {
        throw new Error("Event update failed.");
      }

      return res.status(200).json({ 
        message: "Event updated successfully", 
        event: updated[0] 
      });

    } catch (error) {
      console.error("Server error PUT /api/events/:eventId:", error);
      return res.status(500).json({ error: "Internal server error while updating event." });
    }
  }
);

// DELETE event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES  
router.delete(
  "/:eventId", 
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  requireOwnership('events', 'eventId', 'auth_uuid'),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const event = req.resource; // From ownership middleware

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

      await remove("attendance_status", { event_id: eventId });
      await remove("registrations", { event_id: eventId });
      const deleted = await remove("events", { event_id: eventId });

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ error: "Event not found or already deleted." });
      }

      return res.status(200).json({ 
        message: "Event deleted successfully",
        deleted_by: req.userInfo.email 
      });

    } catch (error) {
      console.error("Server error DELETE /api/events/:eventId:", error);
      return res.status(500).json({ error: "Internal server error while deleting event." });
    }
  }
);

export default router;