import express from "express";
import db from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Get notifications for a user (simplified - by email query parameter)
router.get("/notifications", async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE recipient_email = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
    const notifications = stmt.all(email);

    return res.json({ notifications });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ message: "Notification marked as read" });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// Create a notification (for internal use)
router.post("/notifications", async (req, res) => {
  try {
    const { title, message, type, event_id, event_title, action_url, recipient_email } = req.body;

    if (!title || !message || !recipient_email) {
      return res.status(400).json({ 
        error: "title, message, and recipient_email are required" 
      });
    }

    const stmt = db.prepare(`
      INSERT INTO notifications (id, title, message, type, event_id, event_title, action_url, recipient_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const notificationId = uuidv4().replace(/-/g, '');
    
    const result = stmt.run(
      notificationId,
      title,
      message,
      type || 'info',
      event_id || null,
      event_title || null,
      action_url || null,
      recipient_email
    );

    // Get the created notification
    const getStmt = db.prepare("SELECT * FROM notifications WHERE id = ?");
    const notification = getStmt.get(notificationId);

    return res.status(201).json({ notification });

  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ error: "Failed to create notification" });
  }
});

// Mark multiple notifications as read
router.patch("/notifications/mark-read", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE recipient_email = ? AND is_read = 0
    `);
    
    const result = stmt.run(email);

    return res.json({ 
      message: `Marked ${result.changes} notifications as read` 
    });

  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

export default router;