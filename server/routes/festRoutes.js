import express from "express";
import { getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { v4 as uuidv4 } from "uuid";
import { queryAll, queryOne, insert, update, remove } from "../config/database.js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership,
  optionalAuth
} from "../middleware/authMiddleware.js";
import { sendBroadcastNotification } from "./notificationRoutes.js";
import { pushFestToGated, isGatedEnabled } from "../utils/gatedSync.js";
import { getFestTableForDatabase } from "../utils/festTableResolver.js";

const router = express.Router();

const normalizeJsonField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to parse JSON field:", error.message);
      return [];
    }
  }
  if (typeof value === "object" && value !== null) {
    return Array.isArray(value) ? value : [];
  }
  return [];
};

const pickDefined = (...values) => values.find((value) => value !== undefined);

const parseJsonLikeField = (value, fallbackValue) => {
  if (value === undefined) return undefined;
  if (value === null) return fallbackValue;

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return fallbackValue;

    try {
      return JSON.parse(trimmedValue);
    } catch (error) {
      console.warn("Failed to parse JSON update field:", error.message);
      return fallbackValue;
    }
  }

  return value;
};

const parseComparableDate = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      parsed.setHours(0, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isMissingColumnError = (error) => String(error?.code || "") === "42703";
const isMissingRelationError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
};
const FEST_TABLE_CANDIDATES = ["fests", "fest"];
const resolveFestTableCandidates = (primaryTable) =>
  Array.from(new Set([primaryTable, ...FEST_TABLE_CANDIDATES].filter(Boolean)));
const normalizeFestKey = (value) => String(value || "").trim().toLowerCase();

const getMergedFestsFromCandidates = async (queryOptions, primaryTable) => {
  const tables = resolveFestTableCandidates(primaryTable);
  const festById = new Map();

  for (const tableName of tables) {
    try {
      const rows = await queryAll(tableName, queryOptions);
      for (const fest of rows || []) {
        const key = String(fest?.fest_id || "").trim();
        if (!key) continue;
        if (!festById.has(key)) {
          festById.set(key, fest);
        }
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      // Legacy table variants may not support newer filter/order columns.
      if (isMissingColumnError(error)) {
        try {
          const fallbackRows = await queryAll(tableName, { select: "*" });
          for (const fest of fallbackRows || []) {
            const key = String(fest?.fest_id || "").trim();
            if (!key) continue;
            if (!festById.has(key)) {
              festById.set(key, fest);
            }
          }
          continue;
        } catch (fallbackError) {
          if (isMissingRelationError(fallbackError) || isMissingColumnError(fallbackError)) {
            continue;
          }
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  return Array.from(festById.values());
};

const getFestByIdFromCandidates = async (festId, primaryTable) => {
  const tables = resolveFestTableCandidates(primaryTable);

  for (const tableName of tables) {
    try {
      const fest = await queryOne(tableName, { where: { fest_id: festId } });
      if (fest) {
        return fest;
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }
      throw error;
    }
  }

  return null;
};

const deriveFestsFromEvents = (events, festRegistrationCounts = {}) => {
  const derivedFestMap = new Map();
  const asBoolean = (value) => value === true || value === 1 || value === "1" || value === "true";

  for (const event of events || []) {
    const festKey = String(event?.fest_id || event?.fest || "").trim();
    if (!festKey) continue;

    if (!derivedFestMap.has(festKey)) {
      derivedFestMap.set(festKey, {
        fest_id: festKey,
        fest_title: festKey,
        organizing_dept: event?.organizing_dept || null,
        opening_date: event?.event_date || null,
        closing_date: event?.event_date || null,
        created_at: event?.created_at || null,
        registration_count: festRegistrationCounts[festKey] || 0,
        _eventCount: 0,
        _activeEventCount: 0,
      });
    }

    const entry = derivedFestMap.get(festKey);
    entry._eventCount += 1;
    if (!asBoolean(event?.is_archived)) {
      entry._activeEventCount += 1;
    }

    if (!entry.organizing_dept && event?.organizing_dept) {
      entry.organizing_dept = event.organizing_dept;
    }

    if (!entry.opening_date && event?.event_date) {
      entry.opening_date = event.event_date;
    }

    if (!entry.closing_date && event?.event_date) {
      entry.closing_date = event.event_date;
    }

    if (!entry.created_at && event?.created_at) {
      entry.created_at = event.created_at;
    }
  }

  return Array.from(derivedFestMap.values()).map((fest) => ({
    fest_id: fest.fest_id,
    fest_title: fest.fest_title,
    organizing_dept: fest.organizing_dept,
    opening_date: fest.opening_date,
    closing_date: fest.closing_date,
    created_at: fest.created_at,
    registration_count: fest.registration_count,
    is_archived: fest._eventCount > 0 && fest._activeEventCount === 0,
  }));
};

const mapFestResponse = (fest) => {
  if (!fest) return fest;
  try {
    return {
      ...fest,
      department_access: normalizeJsonField(fest.department_access),
      event_heads: normalizeJsonField(fest.event_heads),
      timeline: normalizeJsonField(fest.timeline),
      sponsors: normalizeJsonField(fest.sponsors),
      social_links: normalizeJsonField(fest.social_links),
      faqs: normalizeJsonField(fest.faqs),
      custom_fields: normalizeJsonField(fest.custom_fields)
    };
  } catch (error) {
    console.error("Error mapping fest response:", error.message, fest);
    return fest;
  }
};

// GET all fests
router.get("/", optionalAuth, checkRoleExpiration, async (req, res) => {
  try {
    const { page, pageSize, search, status, archive, sortBy, sortOrder } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let queryOptions = {
      order: { column: "created_at", ascending: false }
    };

    // Optimization: Filter by date in database if status is upcoming
    if (status === "upcoming") {
      queryOptions.filters = [
        { column: "closing_date", operator: "gte", value: today }
      ];
    } else if (status === "past") {
      queryOptions.filters = [
        { column: "closing_date", operator: "lt", value: today }
      ];
    }

    console.log(`Fetching fests with status: ${status || 'all'}...`);
    let fests = [];
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      fests = await getMergedFestsFromCandidates(queryOptions, festTable);
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
      console.warn("[Fests] Fest tables not available; falling back to event-derived fests.");
      fests = [];
    }

    let events = [];
    try {
      events = await queryAll("events", {
        select: "event_id, fest, fest_id, organizing_dept, event_date, created_at, is_archived",
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        events = [];
      } else if (isMissingColumnError(error)) {
        try {
          events = await queryAll("events", {
            select: "event_id, fest_id, organizing_dept, event_date, created_at, is_archived",
          });
        } catch (fallbackError) {
          if (isMissingRelationError(fallbackError) || isMissingColumnError(fallbackError)) {
            events = [];
          } else {
            throw fallbackError;
          }
        }
      } else {
        throw error;
      }
    }

    let registrations = [];
    try {
      registrations = await queryAll("registrations", { select: "event_id" });
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        registrations = [];
      } else {
        throw error;
      }
    }

    const eventRegistrationCounts = {};
    (registrations || []).forEach((reg) => {
      if (reg.event_id) {
        eventRegistrationCounts[reg.event_id] = (eventRegistrationCounts[reg.event_id] || 0) + 1;
      }
    });

    console.log(`Found ${fests?.length || 0} fests`);

    const festTitleToId = new Map((fests || []).map((fest) => [fest.fest_title, fest.fest_id]));
    const festRegistrationCounts = {};
    (events || []).forEach((event) => {
      const linkedFestKey = event.fest || event.fest_id;
      if (!linkedFestKey) return;
      const matchedFestId = festTitleToId.get(linkedFestKey) || linkedFestKey;
      const eventCount = eventRegistrationCounts[event.event_id] || 0;
      festRegistrationCounts[matchedFestId] = (festRegistrationCounts[matchedFestId] || 0) + eventCount;
    });

    let processedFests = (fests || []).map((fest) => ({
      ...mapFestResponse(fest),
      registration_count: festRegistrationCounts[fest.fest_id] || 0
    }));

    const hasCanonicalFestRows = processedFests.length > 0;
    if (!hasCanonicalFestRows && (events || []).length > 0) {
      processedFests = deriveFestsFromEvents(events, festRegistrationCounts);
    }

    const normalizedSearch = typeof search === "string" ? search.trim().toLowerCase() : "";
    if (normalizedSearch) {
      processedFests = processedFests.filter((fest) =>
        fest.fest_title?.toLowerCase().includes(normalizedSearch) ||
        fest.organizing_dept?.toLowerCase().includes(normalizedSearch)
      );
    }

    const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "all";
    if (normalizedStatus !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      processedFests = processedFests.filter((fest) => {
        const openingDate = parseComparableDate(fest.opening_date);
        const closingDate = parseComparableDate(fest.closing_date) || openingDate;

        if (!openingDate && !closingDate) {
          return false;
        }

        const referenceEndDate = closingDate || openingDate;
        if (!referenceEndDate) {
          return false;
        }

        if (normalizedStatus === "past") {
          return referenceEndDate.getTime() < today.getTime();
        }

        if (normalizedStatus === "ongoing") {
          if (!openingDate || !closingDate) return false;
          return openingDate.getTime() <= today.getTime() && closingDate.getTime() >= today.getTime();
        }

        if (normalizedStatus === "upcoming") {
          return referenceEndDate.getTime() >= today.getTime();
        }

        return true;
      });
    }

    const normalizedArchive = typeof archive === "string" ? archive.toLowerCase() : "all";

    // Filter out archived fests for non-organizers/admins
    const userInfo = req.userInfo;
    const isAdminOrOrganizer = userInfo && (userInfo.is_masteradmin || userInfo.is_organiser);
    
    if (!isAdminOrOrganizer) {
      processedFests = processedFests.filter((fest) => !fest.is_archived);

      console.log(`[Archive Filter] Non-organizer viewing ${processedFests.length} non-archived fests`);
    } else {
      console.log(`[Archive Filter] Organizer/Admin viewing all ${processedFests.length} fests (incl. archived)`);
    }

    if (normalizedArchive === "archived") {
      processedFests = processedFests.filter((fest) => Boolean(fest.is_archived));
    } else if (normalizedArchive === "active") {
      processedFests = processedFests.filter((fest) => !fest.is_archived);
    }

    const hasExplicitSortBy = typeof sortBy === "string" && sortBy.trim() !== "";
    const hasExplicitSortOrder = sortOrder === "asc" || sortOrder === "desc";
    const normalizedSortBy = hasExplicitSortBy
      ? sortBy
      : normalizedStatus === "upcoming"
        ? "opening_date"
        : "date";
    const normalizedSortOrder = hasExplicitSortOrder
      ? sortOrder
      : normalizedStatus === "upcoming"
        ? "asc"
        : "desc";
    processedFests.sort((a, b) => {
      let result = 0;
      switch (normalizedSortBy) {
        case "title":
          result = (a.fest_title || "").localeCompare(b.fest_title || "");
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
        case "opening_date":
          result =
            (parseComparableDate(a.opening_date)?.getTime() || 0) -
            (parseComparableDate(b.opening_date)?.getTime() || 0);
          break;
        case "created_at":
          result =
            (parseComparableDate(a.created_at)?.getTime() || 0) -
            (parseComparableDate(b.created_at)?.getTime() || 0);
          break;
        default:
          result =
            (parseComparableDate(a.created_at)?.getTime() || 0) -
            (parseComparableDate(b.created_at)?.getTime() || 0);
          break;
      }
      return normalizedSortOrder === "asc" ? result : -result;
    });

    const shouldPaginate = page !== undefined || pageSize !== undefined;
    if (!shouldPaginate) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).json({ fests: processedFests });
    }

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 200);
    const totalItems = processedFests.length;
    const totalPages = Math.max(Math.ceil(totalItems / parsedPageSize), 1);
    const safePage = Math.min(parsedPage, totalPages);
    const start = (safePage - 1) * parsedPageSize;
    const pagedFests = processedFests.slice(start, start + parsedPageSize);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({
      fests: pagedFests,
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
    console.error("Error fetching fests:", error);
    console.error("Error details:", error.message, error.stack);
    return res.status(500).json({
      error: "Internal server error while fetching fests.",
      details: error.message
    });
  }
});

// GET specific fest by ID
router.get("/:festId", optionalAuth, checkRoleExpiration, async (req, res) => {
  try {
    const { festId: festSlug } = req.params;
    console.log(`[Fest GET] Fetching fest: ${festSlug}`);
    
    if (!festSlug || typeof festSlug !== "string" || festSlug.trim() === "") {
      return res.status(400).json({
        error: "Fest ID (slug) must be provided in the URL path and be a non-empty string.",
      });
    }

    console.log(`[Fest GET] Getting fest table...`);
    let fest = null;
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      console.log(`[Fest GET] Querying ${festTable} table for fest_id: ${festSlug}`);
      fest = await getFestByIdFromCandidates(festSlug, festTable);
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
      console.warn(`[Fest GET] Fest tables unavailable while querying ${festSlug}; returning not found.`);
      fest = null;
    }

    if (!fest) {
      console.warn(`[Fest GET] Fest not found: ${festSlug}`);
      return res.status(404).json({ error: `Fest with ID (slug) '${festSlug}' not found.` });
    }

    // Check if fest is archived
    if (fest.is_archived) {
      const userInfo = req.userInfo;
      const isAdminOrOrganizer = userInfo && (userInfo.is_masteradmin || userInfo.is_organiser);
      
      if (!isAdminOrOrganizer) {
        console.warn(`[Fest GET] Archived fest access denied: ${festSlug}`);
        return res.status(403).json({ error: "This fest is archived and not available" });
      }
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({ fest: mapFestResponse(fest) });
  } catch (error) {
    console.error("❌ Error fetching fest:", error);
    console.error("🔴 Fest GET error details:", {
      message: error.message,
      stack: error.stack,
      festId: req.params.festId
    });
    return res.status(500).json({ 
      error: "Internal server error while fetching specific fest.",
      details: error.message
    });
  }
});

// POST - Create new fest - REQUIRES AUTHENTICATION + ORGANISER PRIVILEGES
router.post(
  "/",
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const festData = req.body;

      // Basic validation
      const title = festData.festTitle || festData.title;
      const dept = festData.organizingDept || festData.organizing_dept;

      if (!title || !dept) {
        console.log("Validation failed. Received:", JSON.stringify(festData));
        return res.status(400).json({ error: "Fest title and organizing department are required" });
      }

      // Generate slug-based ID from title
      const titleForSlug = festData.festTitle || festData.title || "";
      let fest_id = titleForSlug
        ? titleForSlug
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
        : "";

      if (!fest_id) {
        fest_id = uuidv4().replace(/-/g, "");
      }

      // Validate fest_id uniqueness
      const existingFest = await queryOne(festTable, { where: { fest_id } });
      if (existingFest) {
        return res.status(400).json({
          error: `A fest with the title "${title}" already exists (ID: '${fest_id}'). Please use a different title.`
        });
      }

      // Proceed with insertion
      const festPayload = {
        fest_id,
        fest_title: festData.festTitle || festData.title || "",
        description: festData.description || festData.detailed_description || festData.detailedDescription || "",
        opening_date: festData.openingDate || festData.opening_date || null,
        closing_date: festData.closingDate || festData.closing_date || null,
        fest_image_url: festData.festImageUrl || festData.fest_image_url || null,
        organizing_dept: festData.organizingDept || festData.organizing_dept || "",
        department_access: festData.departmentAccess || festData.department_access || [],
        category: festData.category || "",
        contact_email: festData.contactEmail || festData.contact_email || "",
        contact_phone: festData.contactPhone || festData.contact_phone || "",
        event_heads: festData.eventHeads || festData.event_heads || [],
        created_by: req.userInfo?.email,
        auth_uuid: req.userId,
        // New enhanced fest fields
        venue: festData.venue || null,
        status: festData.status || "upcoming",
        registration_deadline: festData.registration_deadline || null,
        timeline: festData.timeline || [],
        sponsors: festData.sponsors || [],
        social_links: festData.social_links || [],
        faqs: festData.faqs || [],
        custom_fields: parseJsonLikeField(
          pickDefined(festData.custom_fields, festData.customFields),
          []
        ),
        campus_hosted_at: festData.campus_hosted_at || festData.campusHostedAt || null,
        allowed_campuses: festData.allowed_campuses || festData.allowedCampuses || [],
        department_hosted_at: festData.department_hosted_at || festData.departmentHostedAt || null,
        allow_outsiders: festData.allow_outsiders === true || festData.allow_outsiders === 'true' || festData.allowOutsiders === true || festData.allowOutsiders === 'true' ? true : false,
      };

      const inserted = await insert(festTable, [festPayload]);
      const createdFest = inserted?.[0];

      // Grant organiser access to event heads with expiration dates
      const eventHeads = festData.eventHeads || festData.event_heads || [];
      for (const head of eventHeads) {
        if (head && head.email) {
          try {
            // Find the user by email
            const user = await queryOne("users", { where: { email: head.email } });
            if (user) {
              // Update user's organiser status with expiration
              await update("users", {
                is_organiser: true,
                organiser_expires_at: head.expiresAt || null
              }, { email: head.email });
              console.log(`Granted organiser access to ${head.email} (expires: ${head.expiresAt || 'never'})`);
            } else {
              console.log(`User ${head.email} not found, will be granted access when they sign up`);
            }
          } catch (userError) {
            console.error(`Error updating organiser status for ${head.email}:`, userError);
          }
        }
      }

      // Send notifications to all users about the new fest (non-blocking)
      sendBroadcastNotification({
        title: 'New Fest Announced',
        message: `${festPayload.fest_title} — Don't miss this fest!`,
        type: 'info',
        event_id: fest_id,
        event_title: festPayload.fest_title,
        action_url: `/fest/${fest_id}`
      }).then(() => {
        console.log(`✅ Sent notifications for new fest: ${festPayload.fest_title}`);
      }).catch((notifError) => {
        console.error('❌ Failed to send fest notifications:', notifError);
      });

      // Push to UniversityGated if outsiders are enabled (non-blocking)
      if (isGatedEnabled() && festPayload.allow_outsiders) {
        pushFestToGated(
          festPayload,
          req.userInfo?.email || festPayload.created_by,
          req.userInfo?.name || 'SOCIO Organiser'
        ).then(() => {
          console.log(`✅ Pushed fest "${festPayload.fest_title}" to UniversityGated`);
        }).catch((gatedError) => {
          console.error(`❌ Failed to push fest to Gated:`, gatedError.message);
        });
      }

      return res.status(201).json({
        message: "Fest created successfully",
        fest: mapFestResponse(createdFest)
      });

    } catch (error) {
      console.error("Error creating fest:", error);

      const missingCustomFieldsColumn =
        isMissingColumnError(error) &&
        String(error?.message || "").toLowerCase().includes("custom_fields");

      if (missingCustomFieldsColumn) {
        return res.status(500).json({
          error:
            "Database migration required: fests.custom_fields is missing. Run server migrations before creating fests with custom fields.",
        });
      }

      return res.status(500).json({ error: "Internal server error while creating fest." });
    }
  });

// PUT - Update fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.put(
  "/:festId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),  // Master admin bypass built-in
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const { festId } = req.params;
      const updateData = req.body;
      const existingFest = req.resource; // From ownership middleware

      // Get the new title
      const newTitle = updateData.fest_title ?? updateData.festTitle ?? updateData.title;
      const titleChanged = newTitle && newTitle.trim() !== existingFest.fest_title;

      const departmentAccessInput = pickDefined(updateData.department_access, updateData.departmentAccess);
      const eventHeadsInput = pickDefined(updateData.event_heads, updateData.eventHeads);
      const customFieldsInput = pickDefined(updateData.custom_fields, updateData.customFields);
      const campusHostedAtInput = pickDefined(updateData.campus_hosted_at, updateData.campusHostedAt);
      const allowedCampusesInput = pickDefined(updateData.allowed_campuses, updateData.allowedCampuses);
      const departmentHostedAtInput = pickDefined(updateData.department_hosted_at, updateData.departmentHostedAt);
      const allowOutsidersInput = pickDefined(updateData.allow_outsiders, updateData.allowOutsiders);

      const updatePayload = {};

      // Determine the image URL to save:
      // - If festImageUrl key exists in body (even as null), use that value explicitly
      // - This allows clearing the image by sending festImageUrl: null
      const incomingImageUrl = 'festImageUrl' in updateData
        ? updateData.festImageUrl
        : ('fest_image_url' in updateData ? updateData.fest_image_url : undefined);

      console.log(`[Fest Update] Image URL received: ${JSON.stringify(incomingImageUrl)} (type: ${typeof incomingImageUrl})`);
      console.log(`[Fest Update] 'festImageUrl' in body: ${'festImageUrl' in updateData}`);

      const mapFields = [
        ["fest_title", newTitle],
        ["description", updateData.description ?? updateData.detailed_description ?? updateData.detailedDescription],
        ["opening_date", updateData.opening_date ?? updateData.openingDate],
        ["closing_date", updateData.closing_date ?? updateData.closingDate],
        ["fest_image_url", incomingImageUrl],
        ["organizing_dept", updateData.organizing_dept ?? updateData.organizingDept],
        ["category", updateData.category],
        ["contact_email", updateData.contact_email ?? updateData.contactEmail],
        ["contact_phone", updateData.contact_phone ?? updateData.contactPhone],
        ["department_access", parseJsonLikeField(departmentAccessInput, [])],
        ["event_heads", parseJsonLikeField(eventHeadsInput, [])],
        ["custom_fields", parseJsonLikeField(customFieldsInput, [])],
        // New enhanced fest fields - parse JSON safely
        ["venue", updateData.venue],
        ["status", updateData.status],
        ["registration_deadline", updateData.registration_deadline],
        ["timeline", parseJsonLikeField(updateData.timeline, [])],
        ["sponsors", parseJsonLikeField(updateData.sponsors, [])],
        ["social_links", parseJsonLikeField(updateData.social_links, [])],
        ["faqs", parseJsonLikeField(updateData.faqs, [])],
        ["campus_hosted_at", campusHostedAtInput],
        ["allowed_campuses", parseJsonLikeField(allowedCampusesInput, [])],
        ["department_hosted_at", departmentHostedAtInput],
        ["allow_outsiders", allowOutsidersInput !== undefined ? (allowOutsidersInput === true || allowOutsidersInput === 'true') : undefined],
      ];

      for (const [key, value] of mapFields) {
        // Include the field if value is not undefined (null IS included to allow clearing fields)
        if (value !== undefined) {
          updatePayload[key] = value;
        }
      }

      console.log(`[Fest Update] fest_image_url in updatePayload: ${JSON.stringify(updatePayload.fest_image_url)}`);

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      updatePayload.updated_at = new Date().toISOString();
      
      console.log(`[Fest Update] Payload for ${festId}:`, JSON.stringify(updatePayload, null, 2));
      console.log(`[Fest Update] Using table: ${festTable}`);

      if (titleChanged) {
        try {
          // Update notifications event_title so they match the new name
          const updatedTitle = newTitle.trim();
          await update("notifications", {
            event_title: updatedTitle,
          }, { event_id: festId });
          console.log(`Updated notification titles for fest_id '${festId}' to '${updatedTitle}'`);
        } catch (notifError) {
          console.log(`No notifications to update or error: ${notifError.message}`);
        }

        // Update any legacy events that might be referencing the fest by its OLD title
        try {
          await update("events", { fest_id: festId }, { fest: existingFest.fest_title });
        } catch (eventsError) { }
      }

      const updated = await update(festTable, updatePayload, { fest_id: festId }).catch(async (updateError) => {
        console.error("[Fest Update ERROR] Supabase update failed:", {
          errorMessage: updateError.message,
          errorCode: updateError.code,
          errorDetails: JSON.stringify(updateError, null, 2),
          tableName: festTable,
          festId: festId,
          payloadKeys: Object.keys(updatePayload)
        });
        throw updateError;
      });
      
      let updatedFest = updated?.[0];
      
      // If update didn't return data, try fetching the updated fest
      if (!updatedFest) {
        console.warn("⚠️ Update query returned no data, fetching fest from database...");
        try {
          updatedFest = await queryOne(festTable, { where: { fest_id: festId } });
          if (!updatedFest) {
            throw new Error("Could not fetch updated fest after update");
          }
          console.log(`✅ Fest updated and refetched successfully: ${festId}`);
        } catch (refetchError) {
          console.error("❌ Failed to refetch fest after update:", refetchError.message);
          throw new Error("Fest update failed - could not verify update");
        }
      } else {
        console.log(`✅ Fest updated successfully: ${festId}`);
      }

      // Push to UniversityGated if outsiders are now enabled (non-blocking)
      if (isGatedEnabled() && updatedFest) {
        const outsidersEnabled = updatedFest.allow_outsiders === true || updatedFest.allow_outsiders === 'true';
        if (outsidersEnabled) {
          pushFestToGated(
            updatedFest,
            req.userInfo?.email || updatedFest.created_by,
            req.userInfo?.name || 'SOCIO Organiser'
          ).then(() => {
            console.log(`✅ Pushed updated fest "${updatedFest.fest_title}" to UniversityGated`);
          }).catch((gatedError) => {
            console.error(`❌ Failed to push updated fest to Gated:`, gatedError.message);
          });
        }
      }

      // Grant organiser access to event heads with expiration dates
      try {
        const eventHeads = updateData.eventHeads || updateData.event_heads || [];
        console.log(`[EventHeads] Processing ${eventHeads.length} event heads`);
        
        for (const head of eventHeads) {
          if (head && head.email) {
            try {
              console.log(`[EventHeads] Looking up user: ${head.email}`);
              // Find the user by email
              const user = await queryOne("users", { where: { email: head.email } });
              if (user) {
                console.log(`[EventHeads] Found user, updating organiser status...`);
                // Update user's organiser status with expiration
                await update("users", {
                  is_organiser: true,
                  organiser_expires_at: head.expiresAt || null
                }, { email: head.email });
                console.log(`✅ Granted organiser access to ${head.email} (expires: ${head.expiresAt || 'never'})`);
              } else {
                console.log(`[EventHeads] ⚠️ User ${head.email} not found, will be granted access when they sign up`);
              }
            } catch (userError) {
              console.error(`❌ Error updating organiser status for ${head.email}:`, userError.message);
              // Continue processing other heads even if one fails
            }
          }
        }
      } catch (eventHeadsError) {
        console.error(`❌ Error processing event heads:`, eventHeadsError.message);
        // Don't fail the entire update, just log and continue
      }

      console.log(`[response] About to send success response for fest ${festId}`);
      return res.status(200).json({
        message: "Fest updated successfully",
        fest: mapFestResponse(updatedFest),
        fest_id: festId,
        id_changed: false
      });

    } catch (error) {
      console.error("❌ Error updating fest:", error);
      console.error("🔴 Detailed error info:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        requestBodyKeys: Object.keys(req.body || {}),
        userId: req.userId,
        userEmail: req.userInfo?.email,
        isOrganiser: req.userInfo?.is_organiser,
        festId: req.params.festId
      });

      const missingCustomFieldsColumn =
        isMissingColumnError(error) &&
        String(error?.message || "").toLowerCase().includes("custom_fields");

      if (missingCustomFieldsColumn) {
        return res.status(500).json({
          error:
            "Database migration required: fests.custom_fields is missing. Run server migrations before updating fest custom fields.",
        });
      }

      return res.status(500).json({ 
        error: "Internal server error while updating fest.",
        details: error.message,
        context: {
          endpoint: `/api/fests/${req.params.festId}`,
          method: "PUT",
          userId: req.userId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

// PATCH archive/unarchive fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER
// When archiving a fest, all associated events are also archived
router.patch(
  "/:festId/archive",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    if (req.userInfo?.is_masteradmin || req.userInfo?.is_organiser) {
      return next();
    }
    return res.status(403).json({ error: "Access denied: Organiser privileges required" });
  },
  requireOwnership('fests', 'festId', 'auth_uuid'),
  async (req, res) => {
    try {
      const { festId } = req.params;
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

      // Archive/unarchive the fest
      const festTable = await getFestTableForDatabase(queryAll);
      const updatedFests = await update(
        festTable,
        {
          is_archived: archiveValue,
          archived_at: archiveValue ? nowIso : null,
          archived_by: archiveValue ? req.userInfo?.email || req.userId || null : null,
          updated_at: nowIso,
        },
        { fest_id: festId }
      );

      if (!updatedFests || updatedFests.length === 0) {
        return res.status(404).json({ error: "Fest not found." });
      }

      const updatedFest = updatedFests[0];

      // Also archive/unarchive all events linked to this fest.
      // We support both canonical fest_id links and legacy fest-title links.
      let allEvents = [];
      try {
        allEvents = await queryAll("events", { select: "event_id, fest_id, fest" });
      } catch (error) {
        if (isMissingRelationError(error)) {
          allEvents = [];
        } else if (isMissingColumnError(error)) {
          try {
            allEvents = await queryAll("events", { select: "event_id, fest_id" });
          } catch (fallbackError) {
            if (isMissingRelationError(fallbackError) || isMissingColumnError(fallbackError)) {
              allEvents = [];
            } else {
              throw fallbackError;
            }
          }
        } else {
          throw error;
        }
      }

      const matchKeys = new Set(
        [normalizeFestKey(festId), normalizeFestKey(updatedFest?.fest_title)].filter(Boolean)
      );

      const eventsToUpdate = (allEvents || []).filter((event) => {
        const matchesByFestId = matchKeys.has(normalizeFestKey(event?.fest_id));
        const matchesByLegacyFest = Object.prototype.hasOwnProperty.call(event || {}, "fest")
          ? matchKeys.has(normalizeFestKey(event?.fest))
          : false;

        return matchesByFestId || matchesByLegacyFest;
      });

      let eventsAffected = 0;
      if (eventsToUpdate.length > 0) {
        const buildEventArchivePayload = (includeArchivedBy = true) => ({
          is_archived: archiveValue,
          archived_at: archiveValue ? nowIso : null,
          ...(includeArchivedBy
            ? { archived_by: archiveValue ? req.userInfo?.email || req.userId || null : null }
            : {}),
          updated_at: nowIso,
        });

        for (const event of eventsToUpdate) {
          const eventId = String(event?.event_id || "").trim();
          if (!eventId) continue;

          try {
            const updatedRows = await update("events", buildEventArchivePayload(true), { event_id: eventId });
            if (Array.isArray(updatedRows) && updatedRows.length > 0) {
              eventsAffected += 1;
            }
            continue;
          } catch (error) {
            const code = String(error?.code || "");
            const message = String(error?.message || "").toLowerCase();
            const missingArchivedByColumn = code === "42703" && message.includes("archived_by");

            if (!missingArchivedByColumn) {
              throw error;
            }
          }

          const fallbackRows = await update("events", buildEventArchivePayload(false), { event_id: eventId });
          if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
            eventsAffected += 1;
          }
        }

        console.log(`✅ ${archiveValue ? "Archived" : "Unarchived"} ${eventsAffected} events for fest ${festId}`);
      }

      return res.status(200).json({
        message: archiveValue 
          ? `Fest and ${eventsAffected} associated events archived successfully.` 
          : "Fest and associated events moved back to active list.",
        fest: mapFestResponse(updatedFest),
        events_affected: eventsAffected,
      });
    } catch (error) {
      console.error("Server error PATCH /api/fests/:festId/archive:", error);
      return res.status(500).json({ error: "Internal server error while updating archive state." });
    }
  }
);

// DELETE fest - REQUIRES AUTHENTICATION + OWNERSHIP + ORGANISER PRIVILEGES
router.delete(
  "/:festId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),  // Master admin bypass built-in
  async (req, res) => {
    try {
      const festTable = await getFestTableForDatabase(queryAll);
      const { festId } = req.params;
      const existingFest = req.resource; // From ownership middleware

      // Delete associated events first (support both legacy and newer schemas)
      try {
        await remove("events", { fest_id: festId });
      } catch (eventDeleteError) {
        if (!isMissingColumnError(eventDeleteError)) {
          throw eventDeleteError;
        }
      }

      try {
        await remove("events", { fest: existingFest?.fest_title || festId });
      } catch (eventDeleteError) {
        if (!isMissingColumnError(eventDeleteError)) {
          throw eventDeleteError;
        }
      }

      // Delete fest image if exists
      if (existingFest.fest_image_url) {
        const festImagePath = getPathFromStorageUrl(existingFest.fest_image_url, "fest-images");
        if (festImagePath) {
          await deleteFileFromLocal(festImagePath, "fest-images");
        }
      }

      // Delete the fest
      const deleted = await remove(festTable, { fest_id: festId });
      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ error: "Fest not found" });
      }

      return res.status(200).json({
        message: "Fest and associated events deleted successfully"
      });

    } catch (error) {
      console.error("Error deleting fest:", error);
      return res.status(500).json({ error: "Internal server error while deleting fest." });
    }
  });

export default router;