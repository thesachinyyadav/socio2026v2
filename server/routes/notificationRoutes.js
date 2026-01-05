import express from "express";
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Get notifications for a user (simplified - by email query parameter)
router.get("/notifications", async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({ notifications: notifications || [] });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
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

    const notificationId = uuidv4().replace(/-/g, '');
    
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        id: notificationId,
        title,
        message,
        type: type || 'info',
        event_id: event_id || null,
        event_title: event_title || null,
        action_url: action_url || null,
        recipient_email
      })
      .select()
      .single();

    if (error) throw error;

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

    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('recipient_email', email)
      .eq('is_read', false)
      .select();

    if (error) throw error;

    return res.json({ 
      message: `Marked ${data?.length || 0} notifications as read` 
    });

  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

export default router;