import express from "express";
import { createClient } from '@supabase/supabase-js';
import { getPathFromStorageUrl, deleteFileFromLocal } from "../utils/fileUtils.js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// GET all fests
router.get("/", async (req, res) => {
  try {
    const { data: fests, error } = await supabase
      .from('fest')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.send({ fests: fests || [] });
  } catch (error) {
    console.error("Error fetching fests:", error);
    return res.status(500).json({ error: "Internal server error while fetching fests." });
  }
});

// GET specific fest by ID
router.get("/:festId", async (req, res) => {
  try {
    const { festId: festSlug } = req.params;
    if (!festId || typeof festSlug !== "string" || festSlug.trim() === "") {
      return res.status(400).json({
        error: "Fest ID (slug) must be provided in the URL path and be a non-empty string.",
      });
    }

    const { data: fest, error } = await supabase
      .from('fest')
      .select('*')
      .eq('fest_id', festSlug)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    if (!fest) {
      return res.status(404).json({ error: `Fest with ID (slug) '${festSlug}' not found.` });
    }

    return res.status(200).json({ fest });
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
      fest_id: fest_id,
      fest_title: festData.festTitle,
      description: festData.description || "",
      opening_date: festData.openingDate || null,
      closing_date: festData.closingDate || null,
      fest_image_url: festData.festImageUrl || null,
      organizing_dept: festData.organizingDept,
      department_access: JSON.stringify(festData.departmentAccess || []),
      category: festData.category || "",
      contact_email: festData.contactEmail || "",
      contact_phone: festData.contactPhone || "",
      event_heads: JSON.stringify(festData.eventHeads || []),
      created_by: festData.createdBy || "admin"
    };

    const insertStmt = db.prepare(`
      INSERT INTO fests (
        fest_id, fest_title, description, opening_date, closing_date,
        fest_image_url, organizing_dept, department_access, category,
        contact_email, contact_phone, event_heads, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      festPayload.fest_id, festPayload.fest_title, festPayload.description,
      festPayload.opening_date, festPayload.closing_date, festPayload.fest_image_url,
      festPayload.organizing_dept, festPayload.department_access, festPayload.category,
      festPayload.contact_email, festPayload.contact_phone, festPayload.event_heads,
      festPayload.created_by
    );

    // Get the created fest
    const getStmt = db.prepare("SELECT * FROM fests WHERE fest_id = ?");
    const createdFest = getStmt.get(fest_id);

    // Parse JSON fields for response
    const responseFest = {
      ...createdFest,
      department_access: createdFest.department_access ? JSON.parse(createdFest.department_access) : [],
      event_heads: createdFest.event_heads ? JSON.parse(createdFest.event_heads) : []
    };

    return res.status(201).json({
      message: "Fest created successfully",
      fest: responseFest
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
    const checkStmt = db.prepare("SELECT * FROM fests WHERE fest_id = ?");
    const existingFest = checkStmt.get(festId);

    if (!existingFest) {
      return res.status(404).json({ error: "Fest not found" });
    }

    // Build update query dynamically based on provided fields
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'fest_title', 'description', 'opening_date', 'closing_date',
      'fest_image_url', 'organizing_dept', 'category', 'contact_email',
      'contact_phone'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }

    // Handle array fields that need JSON serialization
    if (updateData.departmentAccess !== undefined) {
      updateFields.push('department_access = ?');
      updateValues.push(JSON.stringify(updateData.departmentAccess));
    }

    if (updateData.eventHeads !== undefined) {
      updateFields.push('event_heads = ?');
      updateValues.push(JSON.stringify(updateData.eventHeads));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Add updated_at field
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(festId); // for WHERE clause

    const updateStmt = db.prepare(`
      UPDATE fests 
      SET ${updateFields.join(', ')} 
      WHERE fest_id = ?
    `);

    const result = updateStmt.run(...updateValues);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Fest not found" });
    }

    // Get updated fest
    const getStmt = db.prepare("SELECT * FROM fests WHERE fest_id = ?");
    const updatedFest = getStmt.get(festId);

    // Parse JSON fields for response
    const responseFest = {
      ...updatedFest,
      department_access: updatedFest.department_access ? JSON.parse(updatedFest.department_access) : [],
      event_heads: updatedFest.event_heads ? JSON.parse(updatedFest.event_heads) : []
    };

    return res.status(200).json({
      message: "Fest updated successfully",
      fest: responseFest
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
    const getStmt = db.prepare("SELECT * FROM fests WHERE fest_id = ?");
    const existingFest = getStmt.get(festId);

    if (!existingFest) {
      return res.status(404).json({ error: "Fest not found" });
    }

    // Delete associated events first
    const deleteEventsStmt = db.prepare("DELETE FROM events WHERE fest = ?");
    deleteEventsStmt.run(festId);

    // Delete fest image if exists
    if (existingFest.fest_image_url) {
      const festImagePath = getPathFromStorageUrl(existingFest.fest_image_url, "fest-images");
      if (festImagePath) {
        await deleteFileFromLocal(festImagePath, "fest-images");
      }
    }

    // Delete the fest
    const deleteStmt = db.prepare("DELETE FROM fests WHERE fest_id = ?");
    const result = deleteStmt.run(festId);

    if (result.changes === 0) {
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