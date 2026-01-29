import express from "express";
import { getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { v4 as uuidv4 } from "uuid";
import { queryAll, queryOne, insert, update, remove } from "../config/database.js";
import { 
  authenticateUser, 
  getUserInfo, 
  checkRoleExpiration,
  requireOrganiser, 
  requireOwnership 
} from "../middleware/authMiddleware.js";
import { sendBroadcastNotification } from "./notificationRoutes.js";

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

const mapFestResponse = (fest) => {
  if (!fest) return fest;
  try {
    return {
      ...fest,
      department_access: normalizeJsonField(fest.department_access),
      event_heads: normalizeJsonField(fest.event_heads)
    };
  } catch (error) {
    console.error("Error mapping fest response:", error.message, fest);
    return fest;
  }
};

// GET all fests
router.get("/", async (req, res) => {
  try {
    console.log("Fetching all fests...");
  const fests = await queryAll("fest", {
      order: { column: "created_at", ascending: false }
    });
    
    console.log(`Found ${fests?.length || 0} fests`);
    
    const processedFests = (fests || []).map(mapFestResponse);
    // OPTIMIZATION: Cache for 5 minutes, allow stale content for 1 hour
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    return res.status(200).json({ fests: processedFests });
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
router.get("/:festId", async (req, res) => {
  try {
    const { festId: festSlug } = req.params;
    if (!festSlug || typeof festSlug !== "string" || festSlug.trim() === "") {
      return res.status(400).json({
        error: "Fest ID (slug) must be provided in the URL path and be a non-empty string.",
      });
    }

  const fest = await queryOne("fest", { where: { fest_id: festSlug } });

    if (!fest) {
      return res.status(404).json({ error: `Fest with ID (slug) '${festSlug}' not found.` });
    }

    // OPTIMIZATION: Cache individual fests for 5 minutes
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    return res.status(200).json({ fest: mapFestResponse(fest) });
  } catch (error) {
    console.error("Error fetching fest:", error);
    return res.status(500).json({ error: "Internal server error while fetching specific fest." });
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
    const existingFest = await queryOne("fest", { where: { fest_id } });
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
      created_by: festData.createdBy || festData.created_by || req.userInfo?.email || req.userId,
      auth_uuid: req.userId
    };

  const inserted = await insert("fest", [festPayload]);
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
      title: '🎊 New Fest Announced!',
      message: `${festPayload.fest_title} - Don't miss this fest!`,
      type: 'info',
      event_id: fest_id,
      event_title: festPayload.fest_title,
      action_url: `/fest/${fest_id}`
    }).then(() => {
      console.log(`✅ Sent notifications for new fest: ${festPayload.fest_title}`);
    }).catch((notifError) => {
      console.error('❌ Failed to send fest notifications:', notifError);
    });

    return res.status(201).json({
      message: "Fest created successfully",
      fest: mapFestResponse(createdFest)
    });

  } catch (error) {
    console.error("Error creating fest:", error);
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
    const { festId } = req.params;
    const updateData = req.body;
    const existingFest = req.resource; // From ownership middleware

    // Get the new title
    const newTitle = updateData.fest_title ?? updateData.festTitle ?? updateData.title;
    
    // Check if title changed and generate new fest_id
    let newFestId = festId; // Default to current ID
    const titleChanged = newTitle && newTitle.trim() !== existingFest.fest_title;
    
    if (titleChanged) {
      // Generate new slug-based ID from new title
      newFestId = newTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      
      if (!newFestId) {
        newFestId = uuidv4().replace(/-/g, "");
      }
      
      // Check if new fest_id already exists (and it's not the same fest)
      if (newFestId !== festId) {
        const existingFestWithId = await queryOne("fest", { where: { fest_id: newFestId } });
        if (existingFestWithId) {
          return res.status(400).json({ 
            error: `A fest with the ID '${newFestId}' already exists. Please use a different title.` 
          });
        }
      }
      
      console.log(`Title changed: Updating fest_id from '${festId}' to '${newFestId}'`);
    }

    const updatePayload = {};

    const mapFields = [
      ["fest_title", updateData.fest_title ?? updateData.festTitle ?? updateData.title],
      ["description", updateData.description ?? updateData.detailed_description ?? updateData.detailedDescription],
      ["opening_date", updateData.opening_date ?? updateData.openingDate],
      ["closing_date", updateData.closing_date ?? updateData.closingDate],
      ["fest_image_url", updateData.fest_image_url ?? updateData.festImageUrl],
      ["organizing_dept", updateData.organizing_dept ?? updateData.organizingDept],
      ["category", updateData.category],
      ["contact_email", updateData.contact_email ?? updateData.contactEmail],
      ["contact_phone", updateData.contact_phone ?? updateData.contactPhone],
      ["department_access", updateData.department_access ?? updateData.departmentAccess],
      ["event_heads", updateData.event_heads ?? updateData.eventHeads]
    ];

    for (const [key, value] of mapFields) {
      if (value !== undefined) {
        updatePayload[key] = key === "department_access" || key === "event_heads" ? value || [] : value;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Add new fest_id to payload if it changed
    if (newFestId !== festId) {
      updatePayload.fest_id = newFestId;
    }
    
    updatePayload.updated_at = new Date().toISOString();

    // If fest_id changed, update related records first
    if (newFestId !== festId) {
      try {
        // Update events that belong to this fest
        await update("events", { fest: newFestId }, { fest: festId });
        console.log(`Updated events from fest '${festId}' to '${newFestId}'`);
      } catch (eventsError) {
        console.log(`No events to update or error: ${eventsError.message}`);
      }
      
      try {
        // Update notifications that reference this fest (only update event_id)
        await update("notifications", { event_id: newFestId }, { event_id: festId });
        console.log(`Updated notifications from fest_id '${festId}' to '${newFestId}'`);
      } catch (notifError) {
        console.log(`No notifications to update or error: ${notifError.message}`);
      }
    }

    const updated = await update("fest", updatePayload, { fest_id: festId });
    const updatedFest = updated?.[0];

    // Grant organiser access to event heads with expiration dates
    const eventHeads = updateData.eventHeads || updateData.event_heads || [];
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

    return res.status(200).json({
      message: "Fest updated successfully",
      fest: mapFestResponse(updatedFest),
      fest_id: newFestId,
      id_changed: newFestId !== festId
    });

  } catch (error) {
    console.error("Error updating fest:", error);
    return res.status(500).json({ error: "Internal server error while updating fest." });
  }
});

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
    const { festId } = req.params;
    const existingFest = req.resource; // From ownership middleware

    // Delete associated events first
    await remove("events", { fest: festId });

    // Delete fest image if exists
    if (existingFest.fest_image_url) {
      const festImagePath = getPathFromStorageUrl(existingFest.fest_image_url, "fest-images");
      if (festImagePath) {
        await deleteFileFromLocal(festImagePath, "fest-images");
      }
    }

    // Delete the fest
  const deleted = await remove("fest", { fest_id: festId });
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