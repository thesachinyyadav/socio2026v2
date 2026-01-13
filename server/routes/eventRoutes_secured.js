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

// GET all events - PUBLIC ACCESS (no auth required)
router.get("/", async (req, res) => {
  try {
    const events = await queryAll("events", { order: { column: "created_at", ascending: false } });

    // Parse JSON fields for each event
    const processedEvents = events.map(event => ({
      ...event,
      department_access: event.department_access ? JSON.parse(event.department_access) : [],
      rules: event.rules ? JSON.parse(event.rules) : [],
      schedule: event.schedule ? JSON.parse(event.schedule) : [],
      prizes: event.prizes ? JSON.parse(event.prizes) : []
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
      department_access: event.department_access ? JSON.parse(event.department_access) : [],
      rules: event.rules ? JSON.parse(event.rules) : [],
      schedule: event.schedule ? JSON.parse(event.schedule) : [],
      prizes: event.prizes ? JSON.parse(event.prizes) : []
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
    { name: "imageFile", maxCount: 1 },
    { name: "bannerFile", maxCount: 1 },
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
    console.log("Headers:", req.headers);
    console.log("Body keys:", Object.keys(req.body));
    console.log("Files:", req.files ? Object.keys(req.files) : 'No files');
    console.log("User ID:", req.userId);
    console.log("User Info:", req.userInfo);

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

      console.log("Validation passed, data:", {
        title: title?.trim(),
        event_date,
        venue,
        category,
        claims_applicable,
        max_participants
      });

      // Generate event ID
      const event_id = uuidv4();
      console.log("Generated event_id:", event_id);

      // Handle file uploads
      const files = req.files;
      try {
        if (files?.imageFile && files.imageFile[0]) {
          uploadedFilePaths.image = await uploadFileToSupabase(files.imageFile[0], "event-images", event_id);
        }
        if (files?.bannerFile && files.bannerFile[0]) {
          uploadedFilePaths.banner = await uploadFileToSupabase(files.bannerFile[0], "event-banners", event_id);
        }
        if (files?.pdfFile && files.pdfFile[0]) {
          uploadedFilePaths.pdf = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", event_id);
        }
      } catch (fileUploadError) {
        console.error("File upload error:", fileUploadError);
        // Continue without file uploads - don't fail the entire event creation
        uploadedFilePaths.image = null;
        uploadedFilePaths.banner = null;
        uploadedFilePaths.pdf = null;
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
        max_participants: parseOptionalInt(max_participants),
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
        created_by: req.userId,
        registration_deadline: req.body.registration_deadline || null,
        total_participants: 0,
      }]);

      if (!created || created.length === 0) {
        throw new Error("Event was not created successfully.");
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
    { name: "imageFile", maxCount: 1 },
    { name: "bannerFile", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  requireOwnership('events', 'eventId', 'created_by'),  // Check ownership
  async (req, res) => {
    // Implementation similar to POST but with UPDATE logic
    // ... (truncated for brevity, but would include full update logic with ownership checks)
    res.status(501).json({ message: "Update endpoint - implementation needed" });
  }
);

// DELETE event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES  
router.delete(
  "/:eventId", 
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  requireOwnership('events', 'eventId', 'created_by'),
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