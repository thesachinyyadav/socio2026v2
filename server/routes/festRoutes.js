import express from "express";
import { getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { v4 as uuidv4 } from "uuid";
import { queryAll, queryOne, insert, update, remove } from "../config/database.js";

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

    return res.status(200).json({ fest: mapFestResponse(fest) });
  } catch (error) {
    console.error("Error fetching fest:", error);
    return res.status(500).json({ error: "Internal server error while fetching specific fest." });
  }
});

// POST - Create new fest
router.post("/", async (req, res) => {
  try {
    // For now, simplified without authentication checks
    const festData = req.body;

    // Basic validation
    if (!festData.festTitle || !festData.organizingDept) {
      return res.status(400).json({ error: "Fest title and organizing department are required" });
    }

    // Generate unique fest ID
    const fest_id = uuidv4().replace(/-/g, '');

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
      created_by: festData.createdBy || festData.created_by || "admin"
    };

  const inserted = await insert("fest", [festPayload]);
    const createdFest = inserted?.[0];

    return res.status(201).json({
      message: "Fest created successfully",
      fest: mapFestResponse(createdFest)
    });

  } catch (error) {
    console.error("Error creating fest:", error);
    return res.status(500).json({ error: "Internal server error while creating fest." });
  }
});

// PUT - Update fest
router.put("/:festId", async (req, res) => {
  try {
    const { festId } = req.params;
    const updateData = req.body;

    // Check if fest exists
  const existingFest = await queryOne("fest", { where: { fest_id: festId } });

    if (!existingFest) {
      return res.status(404).json({ error: "Fest not found" });
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

    updatePayload.updated_at = new Date().toISOString();

  const updated = await update("fest", updatePayload, { fest_id: festId });
    const updatedFest = updated?.[0];

    return res.status(200).json({
      message: "Fest updated successfully",
      fest: mapFestResponse(updatedFest)
    });

  } catch (error) {
    console.error("Error updating fest:", error);
    return res.status(500).json({ error: "Internal server error while updating fest." });
  }
});

// DELETE fest
router.delete("/:festId", async (req, res) => {
  try {
    const { festId } = req.params;

    // Get fest details first
  const existingFest = await queryOne("fest", { where: { fest_id: festId } });

    if (!existingFest) {
      return res.status(404).json({ error: "Fest not found" });
    }

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