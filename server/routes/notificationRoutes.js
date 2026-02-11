import express from "express";
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, getUserInfo, checkRoleExpiration, requireOrganiser } from "../middleware/authMiddleware.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ─── HELPERS ────────────────────────────────────────────────────────────────────

// Map a raw notification row into the camelCase shape the client expects
function mapNotification(n, userStatus = null) {
  const isBroadcast = n.is_broadcast === true;
  // For broadcasts, read status comes from the per-user status table
  // For individual notifications, it's on the row itself
  const isRead = isBroadcast
    ? (userStatus?.is_read ?? false)
    : (n.read ?? false);

  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    eventId: n.event_id || null,
    eventTitle: n.event_title || null,
    read: isRead,
    createdAt: n.created_at,
    actionUrl: n.action_url || null,
    isBroadcast: isBroadcast,
  };
}

// ─── ADMIN: NOTIFICATION HISTORY ────────────────────────────────────────────────
// Returns ALL notifications (broadcasts + individual) for the admin panel.
// Sorted by created_at desc. No per-user filtering.

router.get("/notifications/admin/history", async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    return res.json({
      notifications: (notifications || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        event_id: n.event_id || null,
        event_title: n.event_title || null,
        user_email: n.user_email || null,
        is_broadcast: n.is_broadcast || false,
        read: n.read || false,
        created_at: n.created_at,
        action_url: n.action_url || null,
      })),
    });
  } catch (error) {
    console.error("Error fetching admin notification history:", error);
    return res.status(500).json({ error: "Failed to fetch notification history" });
  }
});

// ─── ADMIN: BROADCAST NOTIFICATION (via API) ─────────────────────────────────────
// POST endpoint to let the admin panel send broadcasts without importing the function.

router.post("/notifications/broadcast", async (req, res) => {
  try {
    const { title, message, type = 'info', event_id, event_title, action_url } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "title and message are required" });
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title,
        message,
        type,
        event_id: event_id || null,
        event_title: event_title || null,
        action_url: action_url || null,
        user_email: null,
        is_broadcast: true,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[BROADCAST API] Created broadcast (id: ${data.id}): ${title}`);
    return res.status(201).json({ notification: data });
  } catch (error) {
    console.error("Error sending broadcast:", error);
    return res.status(500).json({ error: "Failed to send broadcast notification" });
  }
});

// ─── ORGANISER EVENT REMINDER ───────────────────────────────────────────────────
// Allows an organiser to send a reminder notification for an event they own.
// Auth chain: authenticateUser → getUserInfo → checkRoleExpiration → requireOrganiser
router.post(
  "/notifications/event-reminder",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  async (req, res) => {
    try {
      const { event_id, template } = req.body;

      if (!event_id || !template) {
        return res.status(400).json({ error: "event_id and template are required" });
      }

      // Verify the organiser owns this event
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("event_id, title, created_by, event_date, event_time, venue")
        .eq("event_id", event_id)
        .single();

      if (eventError || !event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (event.created_by !== req.userInfo.email) {
        return res.status(403).json({ error: "You can only send reminders for events you created" });
      }

      // Pre-set templates
      const templates = {
        reminder: {
          title: `Reminder: ${event.title}`,
          message: `Don't forget — "${event.title}" is coming up soon! Make sure you're registered.`,
          type: "info",
        },
        lastChance: {
          title: `Last Chance to Register!`,
          message: `Registrations for "${event.title}" are closing soon. Don't miss out!`,
          type: "warning",
        },
        tomorrow: {
          title: `Happening Tomorrow: ${event.title}`,
          message: `"${event.title}" is tomorrow${event.venue ? ` at ${event.venue}` : ""}. See you there!`,
          type: "info",
        },
        update: {
          title: `Update: ${event.title}`,
          message: `There's been an update regarding "${event.title}". Check the event page for details.`,
          type: "info",
        },
        thankYou: {
          title: `Thanks for Attending: ${event.title}`,
          message: `Thank you for being part of "${event.title}"! We hope you had a great experience.`,
          type: "success",
        },
      };

      const tpl = templates[template];
      if (!tpl) {
        return res.status(400).json({
          error: `Invalid template. Available: ${Object.keys(templates).join(", ")}`,
        });
      }

      // Send as broadcast
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          title: tpl.title,
          message: tpl.message,
          type: tpl.type,
          event_id: event.event_id,
          event_title: event.title,
          action_url: `/event/${event.event_id}`,
          user_email: null,
          is_broadcast: true,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[EVENT-REMINDER] Organiser ${req.userInfo.email} sent "${template}" for event "${event.title}" (id: ${data.id})`);
      return res.status(201).json({ notification: data, template: template });
    } catch (error) {
      console.error("Error sending event reminder:", error);
      return res.status(500).json({ error: "Failed to send event reminder" });
    }
  }
);

// ─── GET NOTIFICATIONS ──────────────────────────────────────────────────────────
// Merges:
//   1. Individual notifications (user_email = this user, not broadcast)
//   2. Broadcast notifications NOT dismissed by this user
// Returns them combined, sorted by created_at desc, paginated.

router.get("/notifications", async (req, res) => {
  try {
    const { email, page = 1, limit = 20 } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const offset = (pageNum - 1) * limitNum;

    // 1. Individual notifications for this user (not broadcasts)
    const { data: individual, error: indError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', email)
      .or('is_broadcast.is.null,is_broadcast.eq.false')
      .order('created_at', { ascending: false });

    if (indError) throw indError;

    // 2. All broadcast notifications
    const { data: broadcasts, error: bcError } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_broadcast', true)
      .order('created_at', { ascending: false });

    if (bcError) throw bcError;

    // 3. This user's read/dismiss records for broadcasts
    const broadcastIds = (broadcasts || []).map(b => b.id);
    let userStatuses = [];
    if (broadcastIds.length > 0) {
      const { data: statuses, error: statusError } = await supabase
        .from('notification_user_status')
        .select('*')
        .eq('user_email', email)
        .in('notification_id', broadcastIds);

      if (!statusError) userStatuses = statuses || [];
    }

    // Build lookup: notification_id → user status
    const statusMap = {};
    for (const s of userStatuses) {
      statusMap[s.notification_id] = s;
    }

    // 4. Filter out dismissed broadcasts, map everything to camelCase
    const mappedIndividual = (individual || []).map(n => mapNotification(n));
    const mappedBroadcasts = (broadcasts || [])
      .filter(n => !statusMap[n.id]?.is_dismissed)
      .map(n => mapNotification(n, statusMap[n.id] || null));

    // 5. Combine & sort by date descending
    const all = [...mappedIndividual, ...mappedBroadcasts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = all.length;
    const paginated = all.slice(offset, offset + limitNum);
    const unreadCount = all.filter(n => !n.read).length;

    return res.json({
      notifications: paginated,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: offset + limitNum < total
      }
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ─── MARK ONE AS READ ───────────────────────────────────────────────────────────

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    // Check if this notification is a broadcast
    const { data: notif } = await supabase
      .from('notifications')
      .select('is_broadcast')
      .eq('id', id)
      .single();

    if (notif?.is_broadcast && email) {
      // Broadcast → upsert into notification_user_status
      const { error } = await supabase
        .from('notification_user_status')
        .upsert({
          notification_id: id,
          user_email: email,
          is_read: true
        }, { onConflict: 'notification_id,user_email' });

      if (error) throw error;
    } else {
      // Individual → update the notification row directly
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
    }

    return res.json({ message: "Notification marked as read" });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// ─── MARK ALL AS READ ───────────────────────────────────────────────────────────

router.patch("/notifications/mark-read", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // 1. Mark individual notifications as read
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_email', email)
      .eq('read', false);

    // 2. Handle broadcasts — upsert read status for every broadcast
    const { data: broadcasts } = await supabase
      .from('notifications')
      .select('id')
      .eq('is_broadcast', true);

    if (broadcasts && broadcasts.length > 0) {
      const broadcastIds = broadcasts.map(b => b.id);

      // Find which ones already have a user status row
      const { data: existing } = await supabase
        .from('notification_user_status')
        .select('notification_id')
        .eq('user_email', email)
        .in('notification_id', broadcastIds);

      const existingIds = new Set((existing || []).map(e => e.notification_id));

      // Update existing unread rows
      if (existingIds.size > 0) {
        await supabase
          .from('notification_user_status')
          .update({ is_read: true })
          .eq('user_email', email)
          .eq('is_read', false)
          .in('notification_id', broadcastIds);
      }

      // Insert rows for broadcasts that don't have a status entry yet
      const newEntries = broadcastIds
        .filter(id => !existingIds.has(id))
        .map(id => ({
          notification_id: id,
          user_email: email,
          is_read: true,
          is_dismissed: false
        }));

      if (newEntries.length > 0) {
        await supabase
          .from('notification_user_status')
          .insert(newEntries);
      }
    }

    return res.json({ message: "All notifications marked as read" });

  } catch (error) {
    console.error("Error marking all as read:", error);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

// ─── CREATE INDIVIDUAL NOTIFICATION ─────────────────────────────────────────────

router.post("/notifications", async (req, res) => {
  try {
    const { title, message, type, event_id, event_title, action_url, recipient_email, user_email } = req.body;
    const targetEmail = user_email || recipient_email;

    if (!title || !message || !targetEmail) {
      return res.status(400).json({ error: "title, message, and user_email are required" });
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        title,
        message,
        type: type || 'info',
        event_id: event_id || null,
        event_title: event_title || null,
        action_url: action_url || null,
        user_email: targetEmail,
        is_broadcast: false,
        read: false
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

// ─── DISMISS ONE ────────────────────────────────────────────────────────────────
// Broadcast → mark dismissed in user_status (the shared row stays intact)
// Individual → actually delete the row

router.delete("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.query.email;

    // Check if broadcast
    const { data: notif } = await supabase
      .from('notifications')
      .select('is_broadcast')
      .eq('id', id)
      .single();

    if (notif?.is_broadcast && email) {
      // Broadcast — don't delete the shared row, just dismiss for this user
      const { error } = await supabase
        .from('notification_user_status')
        .upsert({
          notification_id: id,
          user_email: email,
          is_dismissed: true,
          is_read: true
        }, { onConflict: 'notification_id,user_email' });

      if (error) throw error;
    } else {
      // Individual — actually delete
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }

    return res.json({ message: "Notification dismissed" });

  } catch (error) {
    console.error("Error dismissing notification:", error);
    return res.status(500).json({ error: "Failed to dismiss notification" });
  }
});

// ─── CLEAR ALL (for a user) ─────────────────────────────────────────────────────

router.delete("/notifications/clear-all", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    // 1. Delete individual notifications for this user
    await supabase
      .from('notifications')
      .delete()
      .eq('user_email', email)
      .or('is_broadcast.is.null,is_broadcast.eq.false');

    // 2. Dismiss all broadcasts for this user
    const { data: broadcasts } = await supabase
      .from('notifications')
      .select('id')
      .eq('is_broadcast', true);

    if (broadcasts && broadcasts.length > 0) {
      const entries = broadcasts.map(b => ({
        notification_id: b.id,
        user_email: email,
        is_dismissed: true,
        is_read: true
      }));

      await supabase
        .from('notification_user_status')
        .upsert(entries, { onConflict: 'notification_id,user_email' });
    }

    return res.json({ message: "All notifications cleared" });

  } catch (error) {
    console.error("Error clearing notifications:", error);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
});

// ─── BROADCAST (creates ONE row, not N) ─────────────────────────────────────────
// Previously this fetched ALL users and inserted one row per user.
// Now it inserts a SINGLE broadcast row. Users see it via the GET endpoint
// which merges broadcasts with their individual notifications and filters
// out anything they've dismissed.

export async function sendBroadcastNotification({ title, message, type = 'info', event_id = null, event_title = null, action_url = null }) {
  console.log('[BROADCAST] Creating single broadcast notification:', { title, event_id });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title,
        message,
        type,
        event_id,
        event_title,
        action_url,
        user_email: null,
        is_broadcast: true,
        read: false
      })
      .select()
      .single();

    if (error) {
      console.error('[BROADCAST] Insert error:', error);
      throw error;
    }

    console.log(`[BROADCAST] Created 1 broadcast row (id: ${data.id}) — all users will see it`);
    return { success: true, notificationId: data.id };

  } catch (error) {
    console.error('[BROADCAST] Error:', error);
    return { success: false, error: error.message };
  }
}

export default router;