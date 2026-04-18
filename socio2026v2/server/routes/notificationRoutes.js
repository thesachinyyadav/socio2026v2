import express from "express";
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, getUserInfo, checkRoleExpiration, requireMasterAdmin, requireOrganiser } from "../middleware/authMiddleware.js";
import {
  savePushSubscription,
  disablePushSubscription,
  sendPushToEmail,
  sendPushToAll,
} from "../utils/webPushService.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────

router.post("/notifications/push/subscribe", async (req, res) => {
  try {
    const { email, subscription } = req.body || {};
    if (!email || !subscription) {
      return res.status(400).json({ error: "email and subscription are required" });
    }

    const result = await savePushSubscription(email, subscription);
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to save push subscription" });
    }

    return res.status(201).json({ message: "Push subscription saved" });
  } catch (error) {
    console.error("Error subscribing push notifications:", error);
    return res.status(500).json({ error: "Failed to subscribe push notifications" });
  }
});

router.delete("/notifications/push/unsubscribe", async (req, res) => {
  try {
    const { email, endpoint } = req.body || {};
    if (!email || !endpoint) {
      return res.status(400).json({ error: "email and endpoint are required" });
    }

    const result = await disablePushSubscription(email, endpoint);
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to unsubscribe push notifications" });
    }

    return res.json({ message: "Push subscription removed" });
  } catch (error) {
    console.error("Error unsubscribing push notifications:", error);
    return res.status(500).json({ error: "Failed to unsubscribe push notifications" });
  }
});

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

router.get(
  "/notifications/admin/history",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
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

router.post(
  "/notifications/broadcast",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
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

    await sendPushToAll({
      title,
      body: message,
      tag: data.id,
      actionUrl: action_url || "/notifications",
    });

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

      await sendPushToAll({
        title: tpl.title,
        body: tpl.message,
        tag: data.id,
        actionUrl: `/event/${event.event_id}`,
      });

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
// ONLY shows notifications from when the user joined (created_at onwards)
// Returns them combined, sorted by created_at desc, paginated.

router.get("/notifications", async (req, res) => {
  try {
    const { email, page = 1, limit = 20 } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    console.log(`[Notifications] Fetching for email: ${email}, page: ${page}, limit: ${limit}`);

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const offset = (pageNum - 1) * limitNum;

    // 0. Get user's created_at timestamp to filter notifications
    console.log(`[Notifications] Fetching user creation date for ${email}...`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('created_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.warn(`[Notifications] ⚠️ User not found or error fetching user:`, userError?.message || 'unknown');
      // If user not found, don't show any notifications
      return res.json({
        notifications: [],
        unreadCount: 0,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
          hasMore: false
        }
      });
    }

    const userCreatedAt = user.created_at;
    console.log(`[Notifications] User created at: ${userCreatedAt}`);

    // 1. Individual notifications for this user (not broadcasts) - only from when user joined
    console.log(`[Notifications] Fetching individual notifications for ${email}...`);
    const { data: individual, error: indError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', email)
      .gte('created_at', userCreatedAt)
      .order('created_at', { ascending: false });

    if (indError) {
      console.error(`[Notifications] ❌ Error fetching individual notifications:`, indError);
      throw indError;
    }
    console.log(`[Notifications] ✅ Found ${individual?.length || 0} individual notifications`);

    // 2. Broadcast notifications only from when user joined
    console.log(`[Notifications] Fetching broadcast notifications from user join date...`);
    const { data: broadcasts, error: bcError } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_broadcast', true)
      .gte('created_at', userCreatedAt)
      .order('created_at', { ascending: false });

    if (bcError) {
      console.error(`[Notifications] ❌ Error fetching broadcasts:`, bcError);
      throw bcError;
    }
    console.log(`[Notifications] ✅ Found ${broadcasts?.length || 0} broadcast notifications`);

    // 3. This user's read/dismiss records for broadcasts
    const broadcastIds = (broadcasts || []).map(b => b.id);
    let userStatuses = [];
    if (broadcastIds.length > 0) {
      console.log(`[Notifications] Fetching user status for ${broadcastIds.length} broadcasts...`);
      const { data: statuses, error: statusError } = await supabase
        .from('notification_user_status')
        .select('*')
        .eq('user_email', email)
        .in('notification_id', broadcastIds);

      if (statusError) {
        console.warn(`[Notifications] ⚠️ Error fetching user statuses (non-critical):`, statusError.message);
        // This table might not exist, which is OK - just continue without it
      } else {
        userStatuses = statuses || [];
        console.log(`[Notifications] ✅ Found ${userStatuses.length} user status records`);
      }
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

    console.log(`[Notifications] ✅ Returning ${paginated.length} notifications (${unreadCount} unread) from ${total} total`);

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
    console.error("❌ Error fetching notifications:", error);
    console.error("🔴 Notification error details:", {
      message: error.message,
      code: error.code,
      status: error.status,
      email: req.query.email
    });
    return res.status(500).json({ 
      error: "Failed to fetch notifications",
      details: error.message
    });
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

    await sendPushToEmail(targetEmail, {
      title,
      body: message,
      tag: notification.id,
      actionUrl: action_url || "/notifications",
    });

    return res.status(201).json({ notification });

  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ error: "Failed to create notification" });
  }
});

// ─── CLEAR ALL (for a user) ─────────────────────────────────────────────────────
// Must be defined BEFORE the :id route so Express doesn't match "clear-all" as an :id

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

    await sendPushToAll({
      title,
      body: message,
      tag: data.id,
      actionUrl: action_url || "/notifications",
    });

    console.log(`[BROADCAST] Created 1 broadcast row (id: ${data.id}) — all users will see it`);
    return { success: true, notificationId: data.id };

  } catch (error) {
    console.error('[BROADCAST] Error:', error);
    return { success: false, error: error.message };
  }
}

export default router;