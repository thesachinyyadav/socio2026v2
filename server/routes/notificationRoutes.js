import express from "express";
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Get notifications for a user with pagination
router.get("/notifications", async (req, res) => {
  try {
    const { email, page = 1, limit = 20 } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 50); // Max 50 per page
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email);

    if (countError) throw countError;

    // Get paginated notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    return res.json({ 
      notifications: notifications || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
        hasMore: offset + limitNum < (count || 0)
      }
    });

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
        read: true
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
    const { title, message, type, event_id, event_title, action_url, recipient_email, user_email } = req.body;

    const targetEmail = user_email || recipient_email;

    if (!title || !message || !targetEmail) {
      return res.status(400).json({ 
        error: "title, message, and user_email are required" 
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
        user_email: targetEmail
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
        read: true
      })
      .eq('user_email', email)
      .eq('read', false)
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

// Helper function to send notifications to all users (broadcast)
export async function sendBroadcastNotification({ title, message, type = 'info', event_id = null, event_title = null, action_url = null }) {
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email')
      .not('email', 'is', null);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      console.log('No users found to send notifications');
      return { success: true, sent: 0 };
    }

    // Create notifications for all users
    const notifications = users.map(user => ({
      id: uuidv4().replace(/-/g, ''),
      title,
      message,
      type,
      event_id,
      event_title,
      action_url,
      user_email: user.email,
      read: false
    }));

    // Insert in batches of 100 to avoid query limits
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(batch);

      if (insertError) {
        console.error('Error inserting notification batch:', insertError);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`Sent ${totalInserted} notifications to users`);
    return { success: true, sent: totalInserted };

  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    return { success: false, error: error.message };
  }
}

export default router;