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
  checkRoleExpiration,
  requireOrganiser,
  requireOrganiserOrSubHead,
  requireOwnership,
  optionalAuth
} from "../middleware/authMiddleware.js";
import { sendBroadcastNotification } from "./notificationRoutes.js";
import { pushEventToGated, shouldPushEventToGated, isGatedEnabled } from "../utils/gatedSync.js";
import { supabase } from "../config/database.js";
import {
  buildVolunteerAssignments,
  normalizeRegisterNumber,
  normalizeVolunteerRecords,
} from "../utils/volunteerAccess.js";

const router = express.Router();
const debugRoutesEnabled = process.env.NODE_ENV !== "production";
const MANUAL_UNARCHIVE_OVERRIDE = "system:manual_unarchive_override";

// HEALTH CHECK - Verify Supabase connection
router.get("/debug/health", async (req, res) => {
  try {
    const result = await queryOne("events", { where: { event_id: "test" } });
    return res.json({
      status: "ok",
      supabase: "connected",
      message: "✅ Supabase connection is working"
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      supabase: "disconnected",
      message: "❌ Supabase connection failed",
      error: error.message
    });
  }
});

// DIAGNOSTIC ENDPOINT - Check authentication and organiser status
if (debugRoutesEnabled) {
  router.get("/debug/status", 
    authenticateUser,
    getUserInfo(),
    checkRoleExpiration,
    async (req, res) => {
      try {
        console.log("[DEBUG] User status request from:", req.userInfo.email);
        
        return res.json({
          authenticated: true,
          userId: req.userInfo.auth_uuid,
          email: req.userInfo.email,
          isOrganiser: req.userInfo.is_organiser,
          organiserExpiresAt: req.userInfo.organiser_expires_at,
          isMasterAdmin: req.userInfo.is_masteradmin,
          isSupport: req.userInfo.is_support,
          message: req.userInfo.is_organiser 
            ? "✅ You have organiser privileges" 
            : "❌ You do NOT have organiser privileges. Contact admin to enable.",
          roles: {
            organiser: req.userInfo.is_organiser,
            masteradmin: req.userInfo.is_masteradmin,
            support: req.userInfo.is_support
          }
        });
      } catch (error) {
        console.error("[DEBUG] Error checking status:", error);
        return res.status(500).json({ 
          error: error.message,
          message: "Error checking authentication status"
        });
      }
  });
}

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

const normalizeStringListField = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === "string" || typeof item === "number")
          .map((item) => String(item).trim())
          .filter(Boolean);
      }

      if (typeof parsed === "string" || typeof parsed === "number") {
        const parsedValue = String(parsed).trim();
        return parsedValue ? [parsedValue] : [];
      }
    } catch {
      if (trimmed.includes(",")) {
        return trimmed
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return [trimmed];
    }
  }

  if (typeof value === "number") {
    return [String(value)];
  }

  return [];
};

const normalizeSingleStringField = (value) => {
  const normalizedList = normalizeStringListField(value);
  return normalizedList[0] || "";
};

const normalizeFestReference = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (lowered === "none" || lowered === "null" || lowered === "undefined") {
    return null;
  }

  return normalized;
};

const getValidDate = (value) => {
  if (!value) return null;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const shouldAutoArchiveEvent = (event) => {
  const parsedEndDate = getValidDate(event?.end_date || event?.event_date);
  if (!parsedEndDate) return false;

  parsedEndDate.setHours(0, 0, 0, 0);

  return getTodayStart().getTime() > parsedEndDate.getTime();
};

const asBoolean = (value) => {
  return value === true || value === 1 || value === "1" || value === "true";
};

const ORGANIZER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ORGANIZER_EMAIL_MAX_LENGTH = 100;

const normalizeEmailAddress = (value) => String(value || "").trim().toLowerCase();
const isValidEmailAddress = (value) => ORGANIZER_EMAIL_REGEX.test(normalizeEmailAddress(value));

const deriveArchiveState = (event) => {
  const manualArchived = asBoolean(event?.is_archived);
  const autoArchived = shouldAutoArchiveEvent(event);

  return {
    is_archived: manualArchived,
    archived_at: event?.archived_at || null,
    archived_effective: manualArchived || autoArchived,
    archive_source: manualArchived ? "manual" : autoArchived ? "auto" : null,
  };
};

const isMissingArchiveColumnsError = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    (message.includes("column") &&
      (message.includes("is_archived") || message.includes("archived_at") || message.includes("archived_by")))
  );
};

const persistAutoArchivedEvents = async (events) => {
  const eventList = Array.isArray(events) ? events : [];
  const nowIso = new Date().toISOString();

  const candidates = eventList.filter((event) => {
    if (asBoolean(event?.is_archived)) return false;
    return shouldAutoArchiveEvent(event);
  });

  if (candidates.length === 0) {
    return eventList;
  }

  const archivedEventIds = new Set();

  for (const event of candidates) {
    const eventId = event?.event_id;
    if (!eventId) continue;

    try {
      await update(
        "events",
        {
          is_archived: true,
          archived_at: nowIso,
          archived_by: "system:auto_end_date",
          updated_at: nowIso,
        },
        { event_id: eventId }
      );
      archivedEventIds.add(eventId);
      continue;
    } catch (error) {
      const code = String(error?.code || "");
      const message = String(error?.message || "").toLowerCase();
      const missingArchivedByColumn = code === "42703" && message.includes("archived_by");

      if (!missingArchivedByColumn) {
        console.warn(`[AutoArchive] Failed to auto-archive ${eventId}:`, error?.message || error);
        continue;
      }
    }

    try {
      await update(
        "events",
        {
          is_archived: true,
          archived_at: nowIso,
          updated_at: nowIso,
        },
        { event_id: eventId }
      );
      archivedEventIds.add(eventId);
    } catch (fallbackError) {
      console.warn(`[AutoArchive] Fallback auto-archive failed for ${eventId}:`, fallbackError?.message || fallbackError);
    }
  }

  if (archivedEventIds.size === 0) {
    return eventList;
  }

  return eventList.map((event) => {
    if (!archivedEventIds.has(event?.event_id)) {
      return event;
    }

    return {
      ...event,
      is_archived: true,
      archived_at: event?.archived_at || nowIso,
      archived_by: event?.archived_by || "system:auto_end_date",
    };
  });
};


// GET all events - PUBLIC ACCESS (no auth required)
router.get("/", optionalAuth, checkRoleExpiration, async (req, res) => {
  try {
    const { page, pageSize, search, status, sortBy, sortOrder, archive, include_drafts } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const includeDraftsRequested =
      typeof include_drafts === "string" && include_drafts.toLowerCase() === "true";
    const canViewDrafts = Boolean(req.userInfo?.is_masteradmin || req.userInfo?.is_organiser);
    const shouldIncludeDrafts = includeDraftsRequested && canViewDrafts;
    
    let queryOptions = { 
      order: { column: "created_at", ascending: false } 
    };

    // Push basic status filtering to database
    if (status === "upcoming" || status === "active") {
      queryOptions.filters = [{ column: "event_date", operator: "gte", value: today }];
    } else if (status === "past") {
      queryOptions.filters = [{ column: "event_date", operator: "lt", value: today }];
    }

    const events = await queryAll("events", queryOptions);
    const eventsWithAutoArchive = await persistAutoArchivedEvents(events);

    // Build registration counts once so both sorting and UI display use the same value.
    const registrations = await queryAll("registrations", { select: "event_id" });
    const eventRegistrationCounts = {};
    (registrations || []).forEach((reg) => {
      if (reg.event_id) {
        eventRegistrationCounts[reg.event_id] = (eventRegistrationCounts[reg.event_id] || 0) + 1;
      }
    });

    // Parse JSON fields for each event
    let processedEvents = eventsWithAutoArchive.map((event) => {
      const archiveState = deriveArchiveState(event);
      return {
        ...event,
        fest: event.fest_id || null, // Map fest_id to fest for frontend compatibility
        department_access: normalizeJsonField(event.department_access),
        rules: normalizeJsonField(event.rules),
        schedule: normalizeJsonField(event.schedule),
        prizes: normalizeJsonField(event.prizes),
        custom_fields: normalizeJsonField(event.custom_fields),
        volunteers: normalizeVolunteerRecords(event.volunteers),
        campus_hosted_at: normalizeSingleStringField(event.campus_hosted_at),
        allowed_campuses: normalizeStringListField(event.allowed_campuses),
        registration_count: eventRegistrationCounts[event.event_id] || 0,
        ...archiveState,
      };
    });

    const normalizedSearch = typeof search === "string" ? search.trim().toLowerCase() : "";
    if (normalizedSearch) {
      processedEvents = processedEvents.filter((event) =>
        event.title?.toLowerCase().includes(normalizedSearch) ||
        event.organizing_dept?.toLowerCase().includes(normalizedSearch)
      );
    }

    const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "all";
    if (normalizedStatus !== "all" && normalizedStatus !== "active") {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Normalize to start of day
      
      processedEvents = processedEvents.filter((event) => {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(0, 0, 0, 0); // Normalize to start of day
        
        const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        
        if (normalizedStatus === "past") return diffDays < 0;
        if (normalizedStatus === "live") return Math.abs(diffDays) < 1;
        if (normalizedStatus === "thisweek") return diffDays >= 0 && diffDays <= 7;
        if (normalizedStatus === "upcoming") return diffDays >= 0;
        return true;
      });
    }

    const normalizedArchive = typeof archive === "string" ? archive.toLowerCase() : "all";
    if (normalizedArchive === "archived") {
      processedEvents = processedEvents.filter((event) => event.archived_effective);
    } else if (normalizedArchive === "active") {
      processedEvents = processedEvents.filter((event) => !event.archived_effective);
    }

    if (!shouldIncludeDrafts) {
      processedEvents = processedEvents.filter((event) => !asBoolean(event.is_draft));
    }

    const normalizedSortBy = typeof sortBy === "string" ? sortBy : "date";
    const normalizedSortOrder = sortOrder === "asc" ? "asc" : "desc";
    processedEvents.sort((a, b) => {
      let result = 0;
      switch (normalizedSortBy) {
        case "title":
          result = (a.title || "").localeCompare(b.title || "");
          break;
        case "dept":
        case "organizing_dept":
          result = (a.organizing_dept || "").localeCompare(b.organizing_dept || "");
          break;
        case "registrations":
        case "registration_count":
          result = (a.registration_count || 0) - (b.registration_count || 0);
          break;
        case "date":
        case "event_date":
          result = new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime();
          break;
        case "created_at":
          result = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        default:
          result = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
      }
      return normalizedSortOrder === "asc" ? result : -result;
    });

    const shouldPaginate = page !== undefined || pageSize !== undefined;
    if (!shouldPaginate) {
      return res.status(200).json({ events: processedEvents });
    }

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 200);
    const totalItems = processedEvents.length;
    const totalPages = Math.max(Math.ceil(totalItems / parsedPageSize), 1);
    const safePage = Math.min(parsedPage, totalPages);
    const start = (safePage - 1) * parsedPageSize;
    const pagedEvents = processedEvents.slice(start, start + parsedPageSize);

    return res.status(200).json({
      events: pagedEvents,
      pagination: {
        page: safePage,
        pageSize: parsedPageSize,
        totalItems,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1
      },
      filters: {
        search: normalizedSearch,
        status: normalizedStatus,
        archive: normalizedArchive,
      },
      sort: {
        by: normalizedSortBy,
        order: normalizedSortOrder
      }
    });
  } catch (error) {
    console.error("Server error GET /api/events:", error);
    return res.status(500).json({ error: "Internal server error while fetching events." });
  }
});

// ─── IT REQUESTS DASHBOARD ────────────────────────────────────────────────────
// Returns events that have an IT support request AND whose blocking approval
// stages (Stage 1) are all approved/skipped — i.e. phase 1 is complete.

router.get(
  "/it-requests",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      if (!user.is_it_support && !user.is_masteradmin) {
        return res.status(403).json({ error: "IT Support role required." });
      }

      // 1. Fetch events with an IT description
      let eventsQuery = supabase
        .from("events")
        .select("event_id, title, event_date, venue, campus_hosted_at, it_info, organizing_dept, organizing_school, created_by, created_at, is_draft")
        .not("it_info", "is", null);

      if (user.is_it_support && !user.is_masteradmin && user.campus) {
        eventsQuery = eventsQuery.eq("campus_hosted_at", user.campus);
      }

      eventsQuery = eventsQuery.order("created_at", { ascending: false });

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;
      if (!events || events.length === 0) return res.json({ requests: [] });

      // 2. Fetch approval records for those events
      const eventIds = events.map((e) => e.event_id);
      const { data: approvals, error: approvalsError } = await supabase
        .from("approvals")
        .select("event_or_fest_id, stages")
        .in("event_or_fest_id", eventIds)
        .eq("type", "event");

      if (approvalsError) throw approvalsError;

      // Build a lookup: eventId → stages array
      const approvalMap = {};
      for (const a of approvals || []) {
        approvalMap[a.event_or_fest_id] = a.stages || [];
      }

      // 3. Only surface events where all blocking stages are approved/skipped
      const phase1Complete = (stages) =>
        stages
          .filter((s) => s.blocking)
          .every((s) => s.status === "approved" || s.status === "skipped");

      const ready = events.filter((e) => {
        const stages = approvalMap[e.event_id];
        // No approval record → no blocking gates, so allow through
        if (!stages) return true;
        return phase1Complete(stages);
      });

      return res.json({ requests: ready });
    } catch (error) {
      console.error("Error fetching IT requests:", error);
      return res.status(500).json({ error: "Failed to fetch IT requests." });
    }
  }
);

// ─── IT ACTION ────────────────────────────────────────────────────────────────
// IT support person approves / rejects / returns for revision an IT request.
// Updates events.it_info, patches the IT stage in approvals.stages, notifies organizer.
router.patch(
  "/:eventId/it-action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { action, note } = req.body;
      const user = req.userInfo;

      if (!user.is_it_support && !user.is_masteradmin) {
        return res.status(403).json({ error: "IT Support role required." });
      }

      const VALID_ACTIONS = ["approve", "reject", "return_for_revision"];
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ error: "action must be 'approve', 'reject', or 'return_for_revision'" });
      }

      const { data: event, error: eventErr } = await supabase
        .from("events")
        .select("event_id, title, it_info, created_by")
        .eq("event_id", eventId)
        .single();

      if (eventErr || !event) return res.status(404).json({ error: "Event not found." });
      if (!event.it_info) return res.status(400).json({ error: "This event has no IT request." });

      const statusMap = {
        approve:              "approved",
        reject:               "declined",
        return_for_revision:  "returned_for_revision",
      };

      const updatedItInfo = {
        ...event.it_info,
        status:       statusMap[action],
        note:         note || null,
        actioned_by:  user.email,
        actioned_at:  new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from("events")
        .update({ it_info: updatedItInfo })
        .eq("event_id", eventId);

      if (updateErr) throw updateErr;

      // Patch the IT operational stage in the approvals record (if one exists)
      const { data: approvalRecord } = await supabase
        .from("approvals")
        .select("*")
        .eq("event_or_fest_id", eventId)
        .eq("type", "event")
        .maybeSingle();

      if (approvalRecord) {
        const stages = approvalRecord.stages || [];
        const itStageIdx = stages.findIndex(s => s.role === "it");

        // return_for_revision keeps the approval stage "pending"; approve/reject update it
        const approvalStageStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
        const approvedBy = action !== "return_for_revision" ? (user.name || user.email) : null;

        const newStages = itStageIdx >= 0
          ? stages.map((s, idx) =>
              idx === itStageIdx ? { ...s, status: approvalStageStatus, approved_by: approvedBy } : s
            )
          : stages;

        const logEntry = {
          step_index: itStageIdx,
          step:       "it",
          action,
          by:         user.name || user.email,
          byEmail:    user.email,
          note:       note || null,
          at:         new Date().toISOString(),
        };

        await supabase
          .from("approvals")
          .update({
            stages:      newStages,
            action_log:  [...(approvalRecord.action_log || []), logEntry],
            updated_at:  new Date().toISOString(),
          })
          .eq("id", approvalRecord.id);
      }

      // Notify the event organizer
      if (event.created_by) {
        const actionLabels = {
          approve:             "approved",
          reject:              "declined",
          return_for_revision: "returned for revision",
        };
        await supabase.from("notifications").insert({
          user_email:  event.created_by,
          title:       `IT Support — ${action === "approve" ? "Approved" : action === "reject" ? "Declined" : "Returned for Revision"}`,
          message:     `Your IT support request for "${event.title}" has been ${actionLabels[action]}${note ? `: "${note}"` : "."}`,
          type:        "info",
          event_id:    eventId,
          event_title: event.title,
          action_url:  `/approvals/${eventId}?type=event`,
          is_broadcast: false,
          read:        false,
        });
      }

      return res.json({ success: true, it_info: updatedItInfo });
    } catch (error) {
      console.error("Error processing IT action:", error);
      return res.status(500).json({ error: "Failed to process IT action." });
    }
  }
);

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
    const archiveState = deriveArchiveState(event);
    const processedEvent = {
      ...event,
      fest: event.fest_id || null, // Map fest_id to fest for frontend compatibility
      department_access: normalizeJsonField(event.department_access),
      rules: normalizeJsonField(event.rules),
      schedule: normalizeJsonField(event.schedule),
      prizes: normalizeJsonField(event.prizes),
      custom_fields: normalizeJsonField(event.custom_fields),
      volunteers: normalizeVolunteerRecords(event.volunteers),
      campus_hosted_at: normalizeSingleStringField(event.campus_hosted_at),
      allowed_campuses: normalizeStringListField(event.allowed_campuses),
      ...archiveState,
    };

    return res.status(200).json({ event: processedEvent });
  } catch (error) {
    console.error("Server error GET /api/events/:eventId:", error);
    return res.status(500).json({ error: "Internal server error while fetching event." });
  }
});

// POST create new event - REQUIRES AUTHENTICATION + ORGANISER OR SUB-HEAD PRIVILEGES
router.post(
  "/",
  multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  authenticateUser,
  getUserInfo(),
  requireOrganiserOrSubHead,  // Full organiser OR active sub-head of a fest
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
        end_time,
        venue,
        category,
        claims_applicable,
        registration_fee,
        organizing_school,
        organizing_dept,
        fest,
        fest_id,
        department_access,
        rules,
        schedule,
        prizes,
        max_participants,
        send_notifications,
        is_draft,
        is_archived,
        save_as_draft
      } = req.body;

      const shouldSaveAsDraft =
        asBoolean(is_draft) ||
        asBoolean(save_as_draft);
      const shouldArchiveOnCreate =
        asBoolean(is_archived) && !shouldSaveAsDraft;
      const hasExplicitNotificationPreference =
        send_notifications !== undefined &&
        send_notifications !== null &&
        String(send_notifications).trim() !== "";
      const shouldSendNotifications =
        !shouldSaveAsDraft &&
        (hasExplicitNotificationPreference ? asBoolean(send_notifications) : true);
      const organizerEmailInput = normalizeSingleStringField(req.body.organizer_email || "");
      const fallbackOrganizerEmail = normalizeEmailAddress(req.userInfo?.email || "");
      const organizerEmail = normalizeEmailAddress(
        organizerEmailInput || fallbackOrganizerEmail
      );

      if (!organizerEmail) {
        return res.status(400).json({
          error: "Organizer contact email is required.",
        });
      }

      if (organizerEmail.length > ORGANIZER_EMAIL_MAX_LENGTH) {
        return res.status(400).json({
          error: "Organizer contact email must be 100 characters or fewer.",
        });
      }

      if (!isValidEmailAddress(organizerEmail)) {
        return res.status(400).json({
          error: "Please provide a valid organizer contact email.",
        });
      }

      // Validation
      if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and must be a non-empty string." });
      }

      console.log("✅ Title validation passed:", title);

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

      // Validate event_id uniqueness
      const existingEvent = await queryOne("events", { where: { event_id } });
      if (existingEvent) {
        return res.status(400).json({
          error: `An event with the title "${title}" already exists. Please use a different title.`
        });
      }

      console.log("✅ Event ID uniqueness checked");

      // Handle file uploads
      const files = req.files;
      
      // Upload Event Image
      if (files?.eventImage && files.eventImage[0]) {
        try {
          console.log(`📁 Uploading eventImage: ${files.eventImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.eventImage[0], "event-images", event_id);
          uploadedFilePaths.image = result?.publicUrl || null;
          console.log(`✅ Event image uploaded: ${uploadedFilePaths.image}`);
        } catch (imgError) {
          console.error("❌ Event image upload failed:", imgError.message);
          throw new Error(`Failed to upload event image: ${imgError.message}`);
        }
      } else {
        console.log("⚠️  No event image provided (optional)");
      }

      // Upload Banner Image
      if (files?.bannerImage && files.bannerImage[0]) {
        try {
          console.log(`📁 Uploading bannerImage: ${files.bannerImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", event_id);
          uploadedFilePaths.banner = result?.publicUrl || null;
          console.log(`✅ Banner image uploaded: ${uploadedFilePaths.banner}`);
        } catch (bannerError) {
          console.error("❌ Banner image upload failed:", bannerError.message);
          // Don't throw - banner is optional
        }
      } else {
        console.log("⚠️  No banner image provided (optional)");
      }

      // Upload PDF
      if (files?.pdfFile && files.pdfFile[0]) {
        try {
          console.log(`📁 Uploading pdfFile: ${files.pdfFile[0].originalname}`);
          const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", event_id);
          uploadedFilePaths.pdf = result?.publicUrl || null;
          console.log(`✅ PDF uploaded: ${uploadedFilePaths.pdf}`);
        } catch (pdfError) {
          console.error("❌ PDF upload failed:", pdfError.message);
          // Don't throw - PDF is optional
        }
      } else {
        console.log("⚠️  No PDF provided (optional)");
      }

      // Parse and validate JSON fields
      const parsedDepartmentAccess = parseJsonField(department_access, []);
      const parsedRules = parseJsonField(rules, []);
      const parsedSchedule = parseJsonField(schedule, []);
      const parsedPrizes = parseJsonField(prizes, []);
      const parsedCustomFields = parseJsonField(req.body.custom_fields, []);
      const parsedVolunteers = await buildVolunteerAssignments(req.body.volunteers, {
        endDate: req.body.end_date,
        eventDate: event_date,
        endTime: end_time || req.body.endTime,
        assignedBy: req.userInfo?.email,
      });
      const campusHostedAt = normalizeSingleStringField(
        req.body.campus_hosted_at || req.body.campusHostedAt || ""
      );
      const parsedAllowedCampuses = normalizeStringListField(
        req.body.allowed_campuses
      );

      if (!campusHostedAt) {
        return res.status(400).json({
          error: "Campus hosted at is required.",
        });
      }

      if (!Array.isArray(parsedAllowedCampuses) || parsedAllowedCampuses.length === 0) {
        return res.status(400).json({
          error: "At least one allowed campus is required.",
        });
      }

      // Sub-head restriction: must create event under one of their assigned fests
      let matchedSubHeadFest = null;
      if (req.isSubHead) {
        const incomingFestId = normalizeFestReference(fest_id ?? fest);
        matchedSubHeadFest = (req.subHeadFests || []).find((f) => f.fest_id === incomingFestId) || null;
        if (!incomingFestId || !matchedSubHeadFest) {
          const allowed = (req.subHeadFests || []).map((f) => f.fest_id).join(", ");
          return res.status(403).json({
            error: `Sub-heads can only create events under their assigned fest(s): ${allowed}.`,
          });
        }
      }

      const createdByValue = req.isSubHead
        ? { event_creator: req.userInfo.email, fest_creator: matchedSubHeadFest.created_by, fest_id: matchedSubHeadFest.fest_id }
        : { event_creator: req.userInfo?.email };

      console.log("✅ JSON fields parsed successfully");
      console.log("About to insert event into database with:", {
        event_id,
        title: title?.trim(),
        organizing_dept,
        created_by: createdByValue,
        fileUrls: uploadedFilePaths
      });

      // Insert event with creator's auth_uuid
      const created = await insert("events", [{
        event_id,
        title: title.trim(),
        description: description || null,
        event_date: event_date || null,
        event_time: event_time || null,
        end_time: end_time || req.body.endTime || null,
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
        custom_fields: parsedCustomFields,
        volunteers: parsedVolunteers,
        organizer_email: organizerEmail,
        organizer_phone: req.body.organizer_phone || null,
        whatsapp_invite_link: req.body.whatsapp_invite_link || null,
        organizing_school:
          normalizeSingleStringField(organizing_school || req.body.organizingSchool || "") || null,
        organizing_dept: organizing_dept || null,
        fest_id: normalizeFestReference(fest_id ?? fest),
        created_by: createdByValue,
        auth_uuid: req.userId,
        registration_deadline: req.body.registration_deadline || null,
        total_participants: 0,
        is_draft: shouldSaveAsDraft,
        is_archived: shouldArchiveOnCreate,
        archived_at: shouldArchiveOnCreate ? new Date().toISOString() : null,
        archived_by: shouldArchiveOnCreate
          ? req.userInfo?.email || req.userId || "system:create_archive"
          : null,
        // Outsider & campus fields
        allow_outsiders: req.body.allow_outsiders === "true" || req.body.allow_outsiders === true ? 1 : 0,
        on_spot: req.body.on_spot === "true" || req.body.on_spot === true ? 1 : 0,
        outsider_registration_fee: parseOptionalFloat(req.body.outsider_registration_fee || req.body.outsiderRegistrationFee, null),
        outsider_max_participants: parseOptionalInt(req.body.outsider_max_participants || req.body.outsiderMaxParticipants, null),
        campus_hosted_at: campusHostedAt,
        allowed_campuses: parsedAllowedCampuses,
        min_participants: parseOptionalInt(req.body.min_participants || req.body.minParticipants, 1),
        it_info: (req.body.it_enabled === "true" || req.body.it_enabled === true) && req.body.it_description
          ? { description: req.body.it_description, status: "pending" }
          : null,
      }]);

      if (!created || created.length === 0) {
        throw new Error("Event was not created successfully (no rows returned from insert).");
      }

      console.log("✅ Event inserted successfully:", event_id);

      // Notify IT managers if IT support was requested (non-blocking)
      const itEnabled = req.body.it_enabled === "true" || req.body.it_enabled === true;
      const itDescription = req.body.it_description || null;
      if (itEnabled && itDescription && campusHostedAt) {
        (async () => {
          try {
            const { data: itManagers } = await supabase
              .from("users")
              .select("email")
              .eq("is_it_support", true)
              .eq("campus", campusHostedAt);
            if (itManagers && itManagers.length > 0) {
              const notifications = itManagers.map(u => ({
                title: "IT Support Request",
                message: `${title} needs IT support: ${itDescription}`,
                type: "info",
                event_id: event_id,
                event_title: title,
                action_url: `/it-dashboard`,
                user_email: u.email,
                is_broadcast: false,
                read: false,
              }));
              await supabase.from("notifications").insert(notifications);
            }
          } catch (notifErr) {
            console.error("❌ Failed to send IT support notifications:", notifErr.message);
          }
        })();
      }

      // Send notifications to all users about the new event (non-blocking)
      if (shouldSendNotifications) {
        sendBroadcastNotification({
          title: 'New Event Published',
          message: `${title} — Check out this new event!`,
          type: 'info',
          event_id: event_id,
          event_title: title,
          action_url: `/event/${event_id}`
        }).then(() => {
          console.log(`✅ Sent notifications for new event: ${title}`);
        }).catch((notifError) => {
          console.error('❌ Failed to send event notifications:', notifError);
        });
      } else {
        console.log(`ℹ️ Notifications skipped for event ${event_id} (draft or notifications disabled).`);
      }

      // Push to UniversityGated if outsiders are enabled (non-blocking)
      if (!shouldSaveAsDraft && !shouldArchiveOnCreate && isGatedEnabled()) {
        const createdEvent = created[0];
        shouldPushEventToGated(createdEvent, queryOne).then(async (shouldPush) => {
          if (shouldPush) {
            try {
              await pushEventToGated(
                createdEvent,
                req.userInfo?.email || req.body.organizer_email,
                req.userInfo?.name || 'SOCIO Organiser'
              );
              console.log(`✅ Pushed event "${title}" to UniversityGated`);
            } catch (gatedError) {
              console.error(`❌ Failed to push event to Gated:`, gatedError.message);
            }
          }
        }).catch((err) => {
          console.error('❌ Error checking Gated push eligibility:', err.message);
        });
      }

      return res.status(201).json({ 
        message: "Event created successfully", 
        event_id,
        created_by: req.userInfo.email 
      });

    } catch (error) {
      console.error("❌ Server error POST /api/events:", error);
      console.error("🔴 Detailed error info:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBodyKeys: Object.keys(req.body || {}),
        userId: req.userId,
        userEmail: req.userInfo?.email,
        isOrganiser: req.userInfo?.is_organiser
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

      // Return detailed error information
      let errorDetail = error.message || "Unknown error occurred";
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: errorDetail });
      }
      
      // Truncate stack trace for response
      const stackLines = (error.stack || "").split("\n").slice(0, 3).join(" | ");
      
      return res.status(500).json({ 
        error: "Internal server error while creating event",
        details: errorDetail,
        context: {
          endpoint: "/api/events",
          method: "POST",
          userId: req.userId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// PATCH archive/unarchive event - REQUIRES AUTHENTICATION + OWNERSHIP OR MASTER ADMIN
router.patch(
  "/:eventId/archive",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    if (req.userInfo?.is_masteradmin || req.userInfo?.is_organiser) {
      return next();
    }
    return res.status(403).json({ error: "Access denied: Organiser privileges required" });
  },
  requireOwnership("events", "eventId", "auth_uuid"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const rawArchiveValue = req.body?.archive;
      const shouldArchive =
        rawArchiveValue === true || rawArchiveValue === "true" || rawArchiveValue === 1 || rawArchiveValue === "1";
      const shouldUnarchive =
        rawArchiveValue === false || rawArchiveValue === "false" || rawArchiveValue === 0 || rawArchiveValue === "0";

      if (!shouldArchive && !shouldUnarchive) {
        return res.status(400).json({
          error: "Invalid payload: 'archive' must be a boolean (true or false).",
        });
      }

      const archiveValue = shouldArchive;
      const nowIso = new Date().toISOString();
      const buildArchivePayload = (includeArchivedBy = true) => ({
        is_archived: archiveValue,
        archived_at: archiveValue ? nowIso : null,
        ...(includeArchivedBy
          ? {
              archived_by: archiveValue
                ? req.userInfo?.email || req.userId || null
                : MANUAL_UNARCHIVE_OVERRIDE,
            }
          : {}),
        updated_at: nowIso,
      });

      let updatedRows;
      try {
        updatedRows = await update("events", buildArchivePayload(true), { event_id: eventId });
      } catch (error) {
        const code = String(error?.code || "");
        const message = String(error?.message || "").toLowerCase();
        const missingArchivedByColumn = code === "42703" && message.includes("archived_by");

        if (!missingArchivedByColumn) {
          throw error;
        }

        console.warn("[Archive] 'archived_by' column missing; retrying archive update without it.");
        updatedRows = await update("events", buildArchivePayload(false), { event_id: eventId });
      }

      if (!updatedRows || updatedRows.length === 0) {
        return res.status(404).json({ error: "Event not found." });
      }

      const updatedEvent = updatedRows[0];
      const archiveState = deriveArchiveState(updatedEvent);

      return res.status(200).json({
        message: archiveValue ? "Event archived successfully." : "Event restored successfully.",
        event: {
          ...updatedEvent,
          fest: updatedEvent.fest_id || null, // Map fest_id to fest for frontend compatibility
          ...archiveState,
        },
      });
    } catch (error) {
      if (isMissingArchiveColumnsError(error)) {
        return res.status(500).json({
          error: "Archive columns are missing. Run latest DB migrations and retry.",
        });
      }

      console.error("Server error PATCH /api/events/:eventId/archive:", error);
      return res.status(500).json({ error: "Internal server error while updating archive state." });
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
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('events', 'eventId', 'auth_uuid'),  // Check ownership using auth_uuid (master admin bypass built-in)
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

      console.log("📁 Initial file paths from existing event:");
      console.log(`  image: ${uploadedFilePaths.image}`);
      console.log(`  banner: ${uploadedFilePaths.banner}`);
      console.log(`  pdf: ${uploadedFilePaths.pdf}`);

      // Handle file uploads if new files are provided
      try {
        if (files?.eventImage && files.eventImage[0]) {
          console.log(`📤 Uploading new event image: ${files.eventImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.eventImage[0], "event-images", eventId);
          if (result?.publicUrl) {
            console.log(`✅ Event image uploaded successfully: ${result.publicUrl}`);
            uploadedFilePaths.image = result.publicUrl;
          } else {
            console.warn(`⚠️ Event image upload returned no URL - keeping existing image`);
          }
        } else if (req.body.removeImageFile === "true") {
          console.log(`🗑️ Event image removal requested.`);
          uploadedFilePaths.image = null;
        }

        if (files?.bannerImage && files.bannerImage[0]) {
          console.log(`📤 Uploading new banner image: ${files.bannerImage[0].originalname}`);
          const result = await uploadFileToSupabase(files.bannerImage[0], "event-banners", eventId);
          if (result?.publicUrl) {
            console.log(`✅ Banner image uploaded successfully: ${result.publicUrl}`);
            uploadedFilePaths.banner = result.publicUrl;
          } else {
            console.warn(`⚠️ Banner image upload returned no URL - keeping existing banner`);
          }
        } else if (req.body.removeBannerFile === "true") {
          console.log(`🗑️ Banner image removal requested.`);
          uploadedFilePaths.banner = null;
        }
        
        if (files?.pdfFile && files.pdfFile[0]) {
          console.log(`📤 Uploading new PDF: ${files.pdfFile[0].originalname}`);
          const result = await uploadFileToSupabase(files.pdfFile[0], "event-pdfs", eventId);
          if (result?.publicUrl) {
            console.log(`✅ PDF uploaded successfully: ${result.publicUrl}`);
            uploadedFilePaths.pdf = result.publicUrl;
          } else {
            console.warn(`⚠️ PDF upload returned no URL - keeping existing PDF`);
          }
        } else if (req.body.removePdfFile === "true") {
          console.log(`🗑️ PDF removal requested.`);
          uploadedFilePaths.pdf = null;
        }
      } catch (fileError) {
        console.error("❌ File upload error during event update:", fileError.message);
        throw fileError; // Re-throw to be caught by main try-catch
      }

      console.log("📁 Updated file paths after upload:");
      console.log(`  image: ${uploadedFilePaths.image}`);
      console.log(`  banner: ${uploadedFilePaths.banner}`);
      console.log(`  pdf: ${uploadedFilePaths.pdf}`);

      const {
        title,
        description,
        event_date,
        event_time,
        end_time,
        venue,
        category,
        claims_applicable,
        registration_fee,
        organizing_school,
        organizing_dept,
        fest,
        fest_id,
        department_access,
        rules,
        schedule,
        prizes,
        max_participants,
        send_notifications,
        is_draft,
        is_archived,
        save_as_draft
      } = req.body;

      const rawArchivePreference =
        is_archived !== undefined && is_archived !== null && String(is_archived).trim() !== ""
          ? is_archived
          : undefined;
      const hasArchivePreference =
        rawArchivePreference !== undefined &&
        rawArchivePreference !== null &&
        String(rawArchivePreference).trim() !== "";
      const shouldArchiveFromRequest = asBoolean(rawArchivePreference);
      const rawDraftPreference =
        is_draft !== undefined && is_draft !== null && String(is_draft).trim() !== ""
          ? is_draft
          : save_as_draft;
      const hasDraftPreference =
        rawDraftPreference !== undefined &&
        rawDraftPreference !== null &&
        String(rawDraftPreference).trim() !== "";
      const shouldDraftFromRequest = asBoolean(rawDraftPreference);
      const hasExplicitNotificationPreference =
        send_notifications !== undefined &&
        send_notifications !== null &&
        String(send_notifications).trim() !== "";
      const wasDraftBeforeUpdate = asBoolean(event?.is_draft);
      const isPublishTransition =
        hasDraftPreference && !shouldDraftFromRequest && wasDraftBeforeUpdate;
      const shouldSendPublishNotifications =
        isPublishTransition &&
        (hasExplicitNotificationPreference ? asBoolean(send_notifications) : true);
      const organizerEmailInput = normalizeSingleStringField(req.body.organizer_email || "");
      const resolvedOrganizerEmail = normalizeEmailAddress(
        organizerEmailInput || event?.organizer_email || req.userInfo?.email || ""
      );

      if (!resolvedOrganizerEmail) {
        return res.status(400).json({
          error: "Organizer contact email is required.",
        });
      }

      if (resolvedOrganizerEmail.length > ORGANIZER_EMAIL_MAX_LENGTH) {
        return res.status(400).json({
          error: "Organizer contact email must be 100 characters or fewer.",
        });
      }

      if (!isValidEmailAddress(resolvedOrganizerEmail)) {
        return res.status(400).json({
          error: "Please provide a valid organizer contact email.",
        });
      }

      // ─── AUTO-UNARCHIVE LOGIC ───────────────────────────────────────────
      // If an event was auto-archived (date passed) but then the date is changed
      // to a future date, automatically unarchive it
      const newEventDate = getValidDate(event_date || req.body.end_date);
      const isDateChangedToFuture = newEventDate && newEventDate > getTodayStart();
      const wasAutoArchivedBySystem = asBoolean(event?.is_archived) && 
        (event?.archived_by?.includes("system:auto_end_date") || !event?.archived_by);
      const shouldAutoUnarchive = isDateChangedToFuture && wasAutoArchivedBySystem && asBoolean(event?.is_archived);
      
      if (shouldAutoUnarchive) {
        console.log(`[AutoUnarchive] Event ${eventId} date changed to future (${event_date}). Auto-unarchiving.`);
      }

      if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and must be a non-empty string." });
      }

      // Check if title changed and generate new event_id
      let newEventId = eventId; // Default to current ID
      const titleChanged = title.trim() !== event.title;
      
      if (titleChanged) {
        // Generate new slug-based ID from new title
        newEventId = title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");
        
        if (!newEventId) {
          newEventId = uuidv4().replace(/-/g, "");
        }
        
        // Check if new event_id already exists (and it's not the same event)
        if (newEventId !== eventId) {
          const existingEvent = await queryOne("events", { where: { event_id: newEventId } });
          if (existingEvent) {
            return res.status(400).json({ 
              error: `An event with the ID '${newEventId}' already exists. Please use a different title.` 
            });
          }
        }
        
        console.log(`Title changed: Updating event_id from '${eventId}' to '${newEventId}'`);
      }

      // Parse JSON fields
      const parsedDepartmentAccess = parseJsonField(department_access, []);
      const parsedRules = parseJsonField(rules, []);
      const parsedSchedule = parseJsonField(schedule, []);
      const parsedPrizes = parseJsonField(prizes, []);
      const parsedCustomFields = parseJsonField(req.body.custom_fields, []);
      const hasVolunteerPayload = Object.prototype.hasOwnProperty.call(req.body, "volunteers");
      const parsedVolunteers = hasVolunteerPayload
        ? await buildVolunteerAssignments(req.body.volunteers, {
            endDate: req.body.end_date,
            eventDate: event_date,
            endTime: end_time || req.body.endTime,
            assignedBy: req.userInfo?.email,
            existingVolunteers: event.volunteers,
          })
        : normalizeVolunteerRecords(event.volunteers);
      const campusHostedAt = normalizeSingleStringField(
        req.body.campus_hosted_at || req.body.campusHostedAt || ""
      );
      const parsedAllowedCampuses = normalizeStringListField(
        req.body.allowed_campuses
      );

      if (!campusHostedAt) {
        return res.status(400).json({
          error: "Campus hosted at is required.",
        });
      }

      if (!Array.isArray(parsedAllowedCampuses) || parsedAllowedCampuses.length === 0) {
        return res.status(400).json({
          error: "At least one allowed campus is required.",
        });
      }

      // Prepare update payload
      // Note: Only include event_id if it's NOT changing (to avoid primary key update issues)
      const archiveOverridePayload = hasArchivePreference
        ? {
            is_archived: shouldArchiveFromRequest,
            archived_at: shouldArchiveFromRequest ? new Date().toISOString() : null,
            archived_by: shouldArchiveFromRequest
              ? req.userInfo?.email || req.userId || "system:manual_archive"
              : MANUAL_UNARCHIVE_OVERRIDE,
          }
        : shouldAutoUnarchive
          ? { is_archived: false, archived_at: null, archived_by: null }
          : {};

      const draftOverridePayload = hasDraftPreference
        ? shouldDraftFromRequest
          ? { is_draft: true, is_archived: false, archived_at: null, archived_by: null }
          : {
              is_draft: false,
              ...(wasDraftBeforeUpdate
                ? { is_archived: false, archived_at: null, archived_by: null }
                : {}),
            }
        : {};

      const updateData = {
        title: title.trim(),
        description: description || null,
        event_date: event_date || null,
        event_time: event_time || null,
        end_time: end_time || req.body.endTime || null,
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
        custom_fields: parsedCustomFields,
        volunteers: parsedVolunteers,
        organizer_email: resolvedOrganizerEmail,
        organizer_phone: req.body.organizer_phone || null,
        whatsapp_invite_link: req.body.whatsapp_invite_link || null,
        organizing_school:
          normalizeSingleStringField(organizing_school || req.body.organizingSchool || "") || null,
        organizing_dept: organizing_dept || null,
        fest_id: normalizeFestReference(fest_id ?? fest),
        registration_deadline: req.body.registration_deadline || null,
        // Preserve existing total_participants unless there is a specific admin action to modify it.
        // Include outsider-related settings so toggles persist from the client.
        allow_outsiders: req.body.allow_outsiders === "true" || req.body.allow_outsiders === true ? 1 : 0,
        on_spot: req.body.on_spot === "true" || req.body.on_spot === true ? 1 : 0,
        outsider_registration_fee: parseOptionalFloat(req.body.outsider_registration_fee || req.body.outsiderRegistrationFee, null),
        outsider_max_participants: parseOptionalInt(req.body.outsider_max_participants || req.body.outsiderMaxParticipants, null),
        campus_hosted_at: campusHostedAt,
        allowed_campuses: parsedAllowedCampuses,
        min_participants: parseOptionalInt(req.body.min_participants || req.body.minParticipants, 1),
        updated_at: new Date().toISOString(),
        ...archiveOverridePayload,
        ...draftOverridePayload
      };

      console.log("🔄 UPDATE DATA - File URLs being saved to database:");
      console.log(`  event_image_url: ${updateData.event_image_url}`);
      console.log(`  banner_url: ${updateData.banner_url}`);
      console.log(`  pdf_url: ${updateData.pdf_url}`);

      // If event_id changed, update related records first
      if (newEventId !== eventId) {
        try {
          // Update registrations to point to new event_id
          await update("registrations", { event_id: newEventId }, { event_id: eventId });
          console.log(`Updated registrations from event_id '${eventId}' to '${newEventId}'`);
        } catch (regError) {
          console.log(`No registrations to update or error: ${regError.message}`);
        }
        
        try {
          // Update attendance_status to point to new event_id
          await update("attendance_status", { event_id: newEventId }, { event_id: eventId });
          console.log(`Updated attendance_status from event_id '${eventId}' to '${newEventId}'`);
        } catch (attError) {
          console.log(`No attendance records to update or error: ${attError.message}`);
        }
        
        try {
          // Update notifications: event_id, event_title, and action_url so links stay valid
          await update("notifications", { 
            event_id: newEventId, 
            event_title: title.trim(),
            action_url: `/event/${newEventId}` 
          }, { event_id: eventId });
          console.log(`Updated notifications from event_id '${eventId}' to '${newEventId}'`);
        } catch (notifError) {
          console.log(`No notifications to update or error: ${notifError.message}`);
        }
      }

      const updated = await update("events", updateData, { event_id: eventId });

      const notifyPublishIfNeeded = (eventRecord) => {
        if (!shouldSendPublishNotifications) {
          return;
        }

        const eventTitle = eventRecord?.title || title.trim() || "An event";
        const publishedEventId = eventRecord?.event_id || newEventId || eventId;
        sendBroadcastNotification({
          title: "Event Published",
          message: `${eventTitle} is now live! Check it out.`,
          type: "info",
          event_id: publishedEventId,
          event_title: eventTitle,
          action_url: `/event/${publishedEventId}`,
        })
          .then(() => {
            console.log(
              `✅ Sent publish notifications for updated event: ${eventTitle}`
            );
          })
          .catch((notifError) => {
            console.error(
              "❌ Failed to send publish notifications during update:",
              notifError
            );
          });
      };

      console.log("💾 Database update result:");
      if (updated && updated.length > 0) {
        console.log(`✅ Event updated successfully`);
        console.log(`  Saved image URL: ${updated[0].event_image_url}`);
        console.log(`  Saved banner URL: ${updated[0].banner_url}`);
        console.log(`  Saved PDF URL: ${updated[0].pdf_url}`);
      }

      if (!updated || updated.length === 0) {
        console.warn("⚠️ Update query returned no data, fetching event from database...");
        try {
          const refetchedEvent = await queryOne("events", { where: { event_id: eventId } });
          if (!refetchedEvent) {
            throw new Error("Could not fetch updated event after update");
          }
          console.log(`✅ Event updated and refetched successfully: ${eventId}`);
          notifyPublishIfNeeded(refetchedEvent);
          
          // Push to UniversityGated if outsiders were enabled/changed (non-blocking)
          if (isGatedEnabled() && !asBoolean(refetchedEvent?.is_draft)) {
            shouldPushEventToGated(refetchedEvent, queryOne).then(async (shouldPush) => {
              if (shouldPush) {
                try {
                  await pushEventToGated(
                    refetchedEvent,
                    req.userInfo?.email || req.body.organizer_email,
                    req.userInfo?.name || 'SOCIO Organiser'
                  );
                  console.log(`✅ Pushed updated event "${refetchedEvent.title}" to UniversityGated`);
                } catch (gatedError) {
                  console.error(`❌ Failed to push updated event to Gated:`, gatedError.message);
                }
              }
            }).catch((err) => {
              console.error('❌ Error checking Gated push eligibility on update:', err.message);
            });
          }

          return res.status(200).json({ 
            message: "Event updated successfully", 
            event: refetchedEvent,
            event_id: newEventId,
            id_changed: newEventId !== eventId
          });
        } catch (refetchError) {
          console.error("❌ Failed to refetch event after update:", refetchError.message);
          throw new Error("Event update failed - could not verify update");
        }
      }

      // At this point, updated is guaranteed to have data (either from update or refetch)
      const updatedEvent = updated[0];
      notifyPublishIfNeeded(updatedEvent);

      // Push to UniversityGated if outsiders were enabled/changed (non-blocking)
      if (isGatedEnabled() && !asBoolean(updatedEvent?.is_draft)) {
        shouldPushEventToGated(updatedEvent, queryOne).then(async (shouldPush) => {
          if (shouldPush) {
            try {
              await pushEventToGated(
                updatedEvent,
                req.userInfo?.email || req.body.organizer_email,
                req.userInfo?.name || 'SOCIO Organiser'
              );
              console.log(`✅ Pushed updated event "${updatedEvent.title}" to UniversityGated`);
            } catch (gatedError) {
              console.error(`❌ Failed to push updated event to Gated:`, gatedError.message);
            }
          }
        }).catch((err) => {
          console.error('❌ Error checking Gated push eligibility on update:', err.message);
        });
      }

      return res.status(200).json({ 
        message: "Event updated successfully", 
        event: updatedEvent,
        event_id: newEventId,
        id_changed: newEventId !== eventId
      });

    } catch (error) {
      console.error("❌ Server error PUT /api/events/:eventId:", error);
      console.error("🔴 Detailed error info:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBodyKeys: Object.keys(req.body || {}),
        userId: req.userId,
        userEmail: req.userInfo?.email,
        isOrganiser: req.userInfo?.is_organiser,
        eventId: req.params.eventId,
        supabaseError: error.status || error.statusCode || "N/A",
        errorType: error.constructor.name
      });

      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      
      // More detailed logging for debugging
      if (error.message && error.message.includes('Supabase')) {
        console.error("🔴 Supabase-specific error detected - checking connectivity...");
      }
      
      return res.status(500).json({ 
        error: "Internal server error while updating event.",
        details: error.message,
        context: {
          endpoint: `/api/events/${req.params.eventId}`,
          method: "PUT",
          userId: req.userId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// POST add a single volunteer - REQUIRES AUTHENTICATION + OWNERSHIP OR MASTER ADMIN
router.post(
  "/:eventId/volunteers",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    if (req.userInfo?.is_masteradmin || req.userInfo?.is_organiser) return next();
    return res.status(403).json({ error: "Access denied: Organiser privileges required." });
  },
  requireOwnership("events", "eventId", "auth_uuid"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const targetRegisterNumber = normalizeRegisterNumber(req.body.register_number);

      if (!targetRegisterNumber) {
        return res.status(400).json({ error: "Register number is required." });
      }

      const event = req.resource;
      const existingVolunteers = normalizeVolunteerRecords(event.volunteers);

      if (existingVolunteers.some((v) => v.register_number === targetRegisterNumber)) {
        return res.status(409).json({ error: "Volunteer already assigned to this event." });
      }

      const parsedVolunteers = await buildVolunteerAssignments(
        [
          ...existingVolunteers.map((v) => ({ register_number: v.register_number })),
          { register_number: targetRegisterNumber },
        ],
        {
          endDate: event.end_date,
          eventDate: event.event_date,
          endTime: event.end_time,
          assignedBy: req.userInfo?.email,
          existingVolunteers: event.volunteers,
        }
      );

      const updatedRows = await update(
        "events",
        { volunteers: parsedVolunteers, updated_at: new Date().toISOString() },
        { event_id: eventId }
      );

      return res.status(200).json({
        message: "Volunteer added successfully.",
        event: updatedRows?.[0]
          ? {
              ...updatedRows[0],
              volunteers: normalizeVolunteerRecords(updatedRows[0].volunteers),
            }
          : null,
      });
    } catch (error) {
      console.error("Server error POST /api/events/:eventId/volunteers:", error);
      if (error.statusCode === 400) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error while adding volunteer." });
    }
  }
);

// DELETE volunteer access - REQUIRES AUTHENTICATION + OWNERSHIP OR MASTER ADMIN
router.delete(
  "/:eventId/volunteers/:registerNumber",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    if (req.userInfo?.is_masteradmin || req.userInfo?.is_organiser) {
      return next();
    }
    return res.status(403).json({ error: "Access denied: Organiser privileges required" });
  },
  requireOwnership("events", "eventId", "auth_uuid"),
  async (req, res) => {
    try {
      const { eventId, registerNumber } = req.params;
      const targetRegisterNumber = normalizeRegisterNumber(registerNumber);

      if (!targetRegisterNumber) {
        return res.status(400).json({ error: "Volunteer register number is required." });
      }

      const existingVolunteers = normalizeVolunteerRecords(req.resource?.volunteers);
      const updatedVolunteers = existingVolunteers.filter(
        (volunteer) => volunteer.register_number !== targetRegisterNumber
      );

      if (updatedVolunteers.length === existingVolunteers.length) {
        return res.status(404).json({ error: "Volunteer assignment not found." });
      }

      const updatedRows = await update(
        "events",
        {
          volunteers: updatedVolunteers,
          updated_at: new Date().toISOString(),
        },
        { event_id: eventId }
      );

      return res.status(200).json({
        message: "Volunteer access revoked successfully.",
        event: updatedRows?.[0]
          ? {
              ...updatedRows[0],
              volunteers: normalizeVolunteerRecords(updatedRows[0].volunteers),
            }
          : null,
      });
    } catch (error) {
      console.error("Server error DELETE /api/events/:eventId/volunteers/:registerNumber:", error);
      return res.status(500).json({ error: "Internal server error while revoking volunteer access." });
    }
  }
);

// DELETE event - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES  
router.delete(
  "/:eventId", 
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('events', 'eventId', 'auth_uuid'),  // Master admin bypass built-in
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
