import express from "express";
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, getUserInfo, checkRoleExpiration, requireMasterAdmin, requireOrganiserOrSubHead, extractCreatorEmails } from "../middleware/authMiddleware.js";
import {
  sendPush,
} from "../utils/webPushService.js";
import { isQueueReady } from "../services/queueService.js";
import { notifLog, newReqId, normalizeEmail } from "../utils/notificationLogger.js";
import {
  cacheGet,
  cacheSet,
  CACHE_KEYSPACE,
  safeStringify,
  safeParse,
} from "../services/cacheService.js";

const sendPushToAll = async (payload) => {
  console.log("[PUSH] sendPushToAll bypassed (lightweight database-free mode). Payload:", payload);
  return { success: true, bypassed: true };
};
const sendPushToEmail = async (email, payload) => {
  console.log(`[PUSH] sendPushToEmail bypassed for ${email} (lightweight database-free mode). Payload:`, payload);
  return { success: true, bypassed: true };
};
const sendOneSignalToAll = async (payload) => {
  console.log("[PUSH] sendOneSignalToAll bypassed (OneSignal purged). Payload:", payload);
  return { success: true, bypassed: true };
};
const sendOneSignalToEmail = async (email, payload) => {
  console.log(`[PUSH] sendOneSignalToEmail bypassed for ${email} (OneSignal purged). Payload:`, payload);
  return { success: true, bypassed: true };
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────

router.post("/notifications/push/subscribe", async (req, res) => {
  // Database-free no-op in lightweight VAPID mode
  console.log("[PUSH] Subscription registered (local-only, skipped backend DB)");
  return res.status(201).json({ message: "Push subscription registered" });
});

router.delete("/notifications/push/unsubscribe", async (req, res) => {
  // Database-free no-op in lightweight VAPID mode
  console.log("[PUSH] Subscription removed (local-only, skipped backend DB)");
  return res.json({ message: "Push subscription removed" });
});

router.post("/notifications/send-direct", async (req, res) => {
  try {
    const { subscription, payload } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription details." });
    }
    if (!payload || (!payload.title && !payload.notification?.title)) {
      return res.status(400).json({ error: "Invalid notification payload (title is required)." });
    }

    const title = payload.title || payload.notification?.title;
    const body = payload.body || payload.notification?.body || "";
    const resolvedLink = payload.url || payload.deepLink || payload.actionUrl || payload.notification?.click_action || "/notifications";

    const pushPayload = {
      title,
      body,
      tag: payload.tag || payload.notificationId || undefined,
      deepLink: resolvedLink,
      actionUrl: resolvedLink,
      category: payload.category || "general",
      priority: payload.priority || "high",
      metadata: payload.metadata || {},
    };

    console.log("[PUSH] Sending direct web push notification...");
    const result = await sendPush(pushPayload, subscription);

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to send web push notification" });
    }

    return res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("[PUSH] Error sending direct web push:", error);
    return res.status(500).json({ error: "Failed to send direct web push notification" });
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
    type: n.category || n.type, // migrate to category
    eventId: n.event_id || null,
    eventTitle: n.event_title || null,
    read: isRead,
    createdAt: n.created_at,
    actionUrl: n.deep_link || n.action_url || null, // fallback for legacy
    deepLink: n.deep_link || n.action_url || null,
    priority: n.priority || "normal",
    category: n.category || n.type,
    metadata: n.metadata || {},
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
  const reqId = newReqId();
  try {
    notifLog.info(reqId, "Incoming broadcast request", { sender: req.userInfo?.email, body: req.body });
    const { title, message, type = 'info', event_id, event_title, action_url, deepLink, category, priority, metadata } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ error: "title and message are required", reqId });
    }

    const resolvedType = category || type;
    const resolvedLink = deepLink || action_url || null;

    const insertPayload = {
      title,
      message,
      type: resolvedType,
      category: resolvedType,
      event_id: event_id || null,
      event_title: event_title || null,
      action_url: resolvedLink,
      deep_link: resolvedLink,
      priority: priority || "high",
      metadata: metadata || {},
      user_email: null,
      is_broadcast: true,
      read: false,
    };
    notifLog.info(reqId, "DB insert (broadcast) payload", insertPayload);

    const { data, error } = await supabase
      .from('notifications')
      .insert(insertPayload)
      .select();

    if (error) {
      notifLog.error(reqId, "Supabase insert error", error);
      return res.status(500).json({
        error: `Supabase insert failed: ${error.message || error.code || 'unknown'}`,
        reqId,
        supabase: { code: error.code, hint: error.hint, details: error.details },
      });
    }

    const dataRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!dataRow) {
      notifLog.error(reqId, "Insert returned no rows.");
      return res.status(500).json({ error: "Insert succeeded but returned no rows (check RLS / select grants).", reqId });
    }
    notifLog.info(reqId, `DB insert success id=${dataRow.id}`);

    const webPushResult = await sendPushToAll({
      title,
      body: message,
      tag: dataRow.id,
      actionUrl: resolvedLink || "/notifications",
    });
    notifLog.info(reqId, "webPush(all) result", webPushResult);

    const oneSignalResult = await sendOneSignalToAll({
      title,
      body: message,
      actionUrl: resolvedLink || "/notifications",
      reqId,
      data: {
        notificationId: dataRow.id,
        category: resolvedType,
        priority: priority || "high",
        ...(metadata || {}),
      },
    });
    notifLog.info(reqId, "OneSignal enqueue(broadcast) result", oneSignalResult);

    notifLog.info(reqId, `broadcast complete id=${dataRow.id} title="${title}"`);
    return res.status(201).json({
      notification: dataRow,
      delivery: { webPush: webPushResult, oneSignal: oneSignalResult },
      reqId,
    });
  } catch (error) {
    notifLog.error(reqId, "Error sending broadcast", { message: error?.message, stack: error?.stack });
    return res.status(500).json({ error: error?.message || "Failed to send broadcast notification", reqId });
  }
});

// ─── STAFF WELCOME BROADCAST ───────────────────────────────────────────────────
// Hardcoded "Hi, Welcome to Socio!" broadcast that any staff member can trigger.
// Distinct from /notifications/broadcast (masteradmin-only, arbitrary content)
// because broadening access to that endpoint would let any organiser send any
// message — this endpoint can only ever send the canned welcome push.

router.post(
  "/notifications/staff-welcome-broadcast",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    const reqId = newReqId();
    try {
      const u = req.userInfo;
      const isStaff = !!(
        u && (
          u.is_masteradmin || u.is_organiser || u.is_hod || u.is_dean ||
          u.is_cfo || u.is_campus_director || u.is_accounts_office || u.is_support
        )
      );
      if (!isStaff) {
        notifLog.warn(reqId, `Staff welcome broadcast denied for ${u?.email}`);
        return res.status(403).json({ error: "Staff role required", reqId });
      }

      notifLog.info(reqId, `Staff welcome broadcast triggered by ${u.email}`);

      const result = await sendBroadcastNotification({
        title: "Hi, Welcome to Socio!",
        message: "Glad to have you on SOCIO — your hub for campus events, fests, and clubs.",
        type: "info",
        priority: "high",
        metadata: { source: "staff-welcome-broadcast", sender: u.email },
      });

      if (!result?.success) {
        notifLog.error(reqId, "Broadcast failed", result);
        return res.status(500).json({ error: result?.error || "Broadcast failed", reqId });
      }

      // Surface per-channel delivery state so the client can show a real toast.
      // Push delivery can fail even when the broadcast row is inserted (e.g.
      // OneSignal 401 on a misconfigured key) — without this the client would
      // see "success" while every device gets nothing.
      const delivery = result.delivery || {};
      const oneSignalOk = delivery.oneSignal?.success !== false;
      const webPushOk = delivery.webPush?.success !== false;
      const oneSignalRecipients =
        delivery.oneSignal?.result?.recipients ??
        delivery.oneSignal?.recipients ??
        null;
      const webPushSent = delivery.webPush?.sent ?? null;
      const anyChannelDelivered =
        (oneSignalOk && (oneSignalRecipients === null || oneSignalRecipients > 0)) ||
        (webPushOk && (webPushSent === null || webPushSent > 0));

      return res.status(201).json({
        ok: true,
        notificationId: result.notificationId,
        delivery,
        delivered: anyChannelDelivered,
        reqId,
      });
    } catch (error) {
      notifLog.error(reqId, "Staff welcome broadcast fatal error", { message: error?.message, stack: error?.stack });
      return res.status(500).json({ error: error?.message || "Broadcast failed", reqId });
    }
  }
);

// ─── ORGANISER EVENT REMINDER ───────────────────────────────────────────────────
// Allows an organiser to send a reminder notification for an event they own.
// Auth chain: authenticateUser → getUserInfo → checkRoleExpiration → requireOrganiser
router.post(
  "/notifications/event-reminder",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiserOrSubHead,
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

      const creatorEmails = extractCreatorEmails(event.created_by).map(e => e.toLowerCase());
      if (!creatorEmails.includes((req.userInfo.email || "").toLowerCase()) && !req.userInfo.is_masteradmin) {
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

      // 1. Web Push (VAPID)
      await sendPushToAll({
        title: tpl.title,
        body: tpl.message,
        tag: data.id,
        actionUrl: `/event/${event.event_id}`,
      });

      // 2. Mobile Push (OneSignal)
      await sendOneSignalToAll({
        title: tpl.title,
        body: tpl.message,
        actionUrl: `/event/${event.event_id}`,
        data: { notificationId: data.id, eventId: event.event_id }
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
// Returns individual notifications for this user + all broadcasts since they joined.
// Read/dismiss state is managed client-side via localStorage — no notification_user_status query.

router.get("/notifications", async (req, res) => {
  const reqId = newReqId();
  try {
    const { email: rawEmail, page = 1, limit = 20 } = req.query;

    if (!rawEmail) {
      return res.status(400).json({ error: "Email parameter is required", reqId });
    }

    const email = normalizeEmail(rawEmail);
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const offset = (pageNum - 1) * limitNum;

    notifLog.info(reqId, `GET /notifications email=${email} page=${pageNum} limit=${limitNum}`);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('created_at, email')
      .ilike('email', email)
      .maybeSingle();

    if (userError) {
      notifLog.error(reqId, "users lookup failed", { code: userError.code, message: userError.message });
    }
    if (!user) {
      notifLog.warn(reqId, `No users row matched email=${email}. Returning empty list.`);
      return res.json({
        notifications: [],
        unreadCount: 0,
        pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0, hasMore: false },
        debug: { reqId, reason: "user_not_found_in_users_table", queriedEmail: email },
      });
    }

    const userCreatedAt = user.created_at;
    notifLog.info(reqId, `User found, created_at=${userCreatedAt}`);

    const [{ data: individual, error: indError }, { data: broadcasts, error: bcError }] =
      await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .ilike('user_email', email)
          .gte('created_at', userCreatedAt)
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .eq('is_broadcast', true)
          .gte('created_at', userCreatedAt)
          .order('created_at', { ascending: false }),
      ]);

    if (indError) {
      notifLog.error(reqId, "individual fetch failed", { code: indError.code, message: indError.message });
      throw indError;
    }
    if (bcError) {
      notifLog.error(reqId, "broadcast fetch failed", { code: bcError.code, message: bcError.message });
      throw bcError;
    }

    const indCount = (individual || []).length;
    const bcCount = (broadcasts || []).length;
    notifLog.info(reqId, `Fetched individual=${indCount} broadcasts=${bcCount} (since ${userCreatedAt})`);

    const all = [
      ...(individual || []).map((n) => mapNotification(n)),
      ...(broadcasts || []).map((n) => mapNotification(n)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = all.length;
    const paginated = all.slice(offset, offset + limitNum);

    return res.json({
      notifications: paginated,
      unreadCount: all.filter((n) => !n.read).length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: offset + limitNum < total,
      },
      debug: { reqId, queriedEmail: email, userCreatedAt, individualCount: indCount, broadcastCount: bcCount, returned: paginated.length },
    });
  } catch (error) {
    notifLog.error(reqId, "GET /notifications fatal error", { message: error?.message });
    return res.status(500).json({ error: error?.message || "Failed to fetch notifications", reqId });
  }
});

// ─── MARK ONE AS READ ───────────────────────────────────────────────────────────
// Broadcast read state is managed client-side; only individual rows are updated here.

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('is_broadcast', false);

    if (error) throw error;
    return res.json({ message: "Notification marked as read" });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// ─── MARK ALL AS READ ───────────────────────────────────────────────────────────
// Broadcast read state is managed client-side; only individual rows are updated here.

router.patch("/notifications/mark-read", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_email', email)
      .eq('read', false);

    return res.json({ message: "All notifications marked as read" });

  } catch (error) {
    console.error("Error marking all as read:", error);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

// ─── CREATE INDIVIDUAL NOTIFICATION ─────────────────────────────────────────────

router.post("/notifications", async (req, res) => {
  const reqId = newReqId();
  try {
    notifLog.info(reqId, "Incoming individual notification request", { body: req.body });
    const {
      title,
      message,
      type,
      event_id,
      event_title,
      action_url,
      recipient_email,
      user_email,
      category,
      deepLink,
      priority,
      metadata,
    } = req.body || {};

    const targetEmail = normalizeEmail(user_email || recipient_email);

    if (!title || !message || !targetEmail) {
      return res.status(400).json({ error: "title, message, and user_email are required", reqId });
    }

    const resolvedType = category || type || 'info';
    const resolvedLink = deepLink || action_url || null;

    const insertPayload = {
      title,
      message,
      type: resolvedType,
      category: resolvedType,
      event_id: event_id || null,
      event_title: event_title || null,
      action_url: resolvedLink,
      deep_link: resolvedLink,
      priority: priority || "normal",
      metadata: metadata || {},
      user_email: targetEmail,
      is_broadcast: false,
      read: false,
    };
    notifLog.info(reqId, "DB insert (individual) payload", insertPayload);

    const { data: dataArr, error } = await supabase
      .from('notifications')
      .insert(insertPayload)
      .select();

    if (error) {
      notifLog.error(reqId, "Supabase insert error", error);
      return res.status(500).json({
        error: `Supabase insert failed: ${error.message || error.code || 'unknown'}`,
        reqId,
        supabase: { code: error.code, hint: error.hint, details: error.details },
      });
    }

    const notification = Array.isArray(dataArr) && dataArr.length > 0 ? dataArr[0] : null;
    if (!notification) {
      notifLog.error(reqId, "Insert returned no rows.");
      return res.status(500).json({ error: "Insert succeeded but returned no rows (check RLS / select grants).", reqId });
    }
    notifLog.info(reqId, `DB insert success id=${notification.id}`);

    const webPushResult = await sendPushToEmail(targetEmail, {
      title,
      body: message,
      tag: notification.id,
      actionUrl: resolvedLink || "/notifications",
    });
    notifLog.info(reqId, "webPush result", webPushResult);

    const oneSignalResult = await sendOneSignalToEmail(targetEmail, {
      title,
      body: message,
      actionUrl: resolvedLink || "/notifications",
      reqId,
      data: {
        notificationId: notification.id,
        category: resolvedType,
        priority: priority || "normal",
        ...(metadata || {}),
      },
    });
    notifLog.info(reqId, "OneSignal enqueue result", oneSignalResult);

    return res.status(201).json({
      notification,
      delivery: { webPush: webPushResult, oneSignal: oneSignalResult },
      reqId,
    });

  } catch (error) {
    notifLog.error(reqId, "Error creating notification", { message: error?.message, stack: error?.stack });
    return res.status(500).json({ error: error?.message || "Failed to create notification", reqId });
  }
});

// ─── CLEAR ALL (for a user) ─────────────────────────────────────────────────────
// Must be defined BEFORE the :id route so Express doesn't match "clear-all" as an :id
// Broadcasts are shared rows — dismiss state is managed client-side only.

router.delete("/notifications/clear-all", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    await supabase
      .from('notifications')
      .delete()
      .eq('user_email', email)
      .or('is_broadcast.is.null,is_broadcast.eq.false');

    return res.json({ message: "All notifications cleared" });

  } catch (error) {
    console.error("Error clearing notifications:", error);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
});

// ─── DISMISS ONE ────────────────────────────────────────────────────────────────
// Broadcasts are dismissed client-side only. Individual notifications are deleted from DB.

router.delete("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if broadcast — if so, dismiss is client-side only, nothing to do in DB
    const { data: notif } = await supabase
      .from('notifications')
      .select('is_broadcast')
      .eq('id', id)
      .single();

    if (!notif?.is_broadcast) {
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

export async function sendBroadcastNotification({ title, message, type = 'info', event_id = null, event_title = null, action_url = null, deepLink = null, category = null, priority = "high", metadata = {} }) {
  console.log('[BROADCAST] Creating single broadcast notification:', { title, event_id });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title,
        message,
        type: category || type,
        category: category || type,
        event_id,
        event_title,
        action_url: deepLink || action_url,
        deep_link: deepLink || action_url,
        priority,
        metadata,
        user_email: null,
        is_broadcast: true,
        read: false
      })
      .select();

    if (error) {
      console.error("[SUPABASE INSERT ERROR]", JSON.stringify(error, null, 2));
      throw error;
    }

    const dataRow = data && data.length > 0 ? data[0] : null;
    if (!dataRow) {
      console.error("[SUPABASE INSERT ERROR] Insert succeeded but returned no rows.");
      throw new Error("Insert succeeded but returned no rows.");
    }
    console.log("[SUPABASE INSERT SUCCESS]", JSON.stringify(dataRow, null, 2));

    // 1. Web Push (VAPID) — capture result so callers can surface real delivery state
    let webPushResult;
    try {
      webPushResult = await sendPushToAll({
        title,
        body: message,
        tag: dataRow.id,
        actionUrl: action_url || "/notifications",
      });
    } catch (webPushErr) {
      console.error('[BROADCAST] sendPushToAll threw:', webPushErr?.message || webPushErr);
      webPushResult = { success: false, error: webPushErr?.message || String(webPushErr) };
    }

    // 2. Mobile Push (OneSignal) — same: capture so we don't lie to the client
    let oneSignalResult;
    try {
      oneSignalResult = await sendOneSignalToAll({
        title,
        body: message,
        actionUrl: deepLink || action_url || "/notifications",
        data: { notificationId: dataRow.id, category: category || type, priority, ...metadata }
      });
    } catch (osErr) {
      console.error('[BROADCAST] sendOneSignalToAll threw:', osErr?.message || osErr);
      oneSignalResult = { success: false, error: osErr?.message || String(osErr) };
    }

    console.log(`[BROADCAST] Created 1 broadcast row (id: ${dataRow.id}) — delivery:`, {
      webPush: webPushResult,
      oneSignal: oneSignalResult,
    });

    return {
      success: true,
      notificationId: dataRow.id,
      delivery: { webPush: webPushResult, oneSignal: oneSignalResult },
    };

  } catch (error) {
    console.error('[BROADCAST] Error:', error);
    return { success: false, error: error.message };
  }
}

// ─── HYDRATION SYNC (MOBILE LAUNCH) ──────────────────────────────────────────────
// High-performance endpoint for mobile cold-boots, backed by Valkey caching.
router.get("/notifications/sync", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const cacheKey = typeof CACHE_KEYSPACE.notificationSummary === 'function'
      ? CACHE_KEYSPACE.notificationSummary(email)
      : `notifications:sync:${email}`;

    const cachedString = await cacheGet(cacheKey);
    if (cachedString) {
      const parsed = safeParse(cachedString);
      if (parsed) return res.json(parsed);
    }

    // 2. Fetch User to get join date (prevents sending old broadcasts)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('created_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.json({ notifications: [] });
    }

    // 3. Parallel fetch of last 50 individual + broadcast
    const [{ data: individual }, { data: broadcasts }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_email', email)
        .gte('created_at', user.created_at)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('notifications')
        .select('*')
        .eq('is_broadcast', true)
        .gte('created_at', user.created_at)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Merge and sort
    const merged = [
      ...(individual || []).map(n => mapNotification(n)),
      ...(broadcasts || []).map(n => mapNotification(n))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

    const payload = { notifications: merged };

    await cacheSet(cacheKey, safeStringify(payload), 60);

    return res.json(payload);
  } catch (error) {
    console.error("[Sync] Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to sync notifications" });
  }
});

// ─── TEST NOTIFICATION (authenticated user → themselves) ────────────────────────
// Bypasses broadcast segment; targets the current authenticated user's external_id
// directly via include_aliases. Returns the full OneSignal response.

router.post(
  "/notifications/test",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    const reqId = newReqId();
    const startedAt = Date.now();
    try {
      const targetEmail = normalizeEmail(req.userInfo?.email);
      notifLog.info(reqId, "Incoming test notification request", { targetEmail });

      if (!targetEmail) {
        return res.status(400).json({ error: "Authenticated user has no email on file.", reqId });
      }

      const overrideTitle = req.body?.title;
      const overrideMessage = req.body?.message;
      const title = (overrideTitle || "🧪 SOCIO Test Notification").toString().slice(0, 100);
      const message = (overrideMessage || `Hello ${targetEmail} — this is a self-test fired at ${new Date().toLocaleTimeString()}.`).toString().slice(0, 500);

      const insertPayload = {
        title,
        message,
        type: "info",
        category: "diagnostic",
        event_id: null,
        event_title: null,
        action_url: "/notifications",
        deep_link: "/notifications",
        priority: "high",
        metadata: { test: true, firedAt: new Date().toISOString() },
        user_email: targetEmail,
        is_broadcast: false,
        read: false,
      };
      notifLog.info(reqId, "DB insert (test) payload", insertPayload);

      let notification = null;
      let supabaseError = null;
      try {
        const { data, error } = await supabase
          .from("notifications")
          .insert(insertPayload)
          .select();
        if (error) {
          supabaseError = { code: error.code, message: error.message, hint: error.hint, details: error.details };
          notifLog.error(reqId, "Supabase insert failed (continuing anyway for push)", supabaseError);
        } else {
          notification = Array.isArray(data) && data.length > 0 ? data[0] : null;
          notifLog.info(reqId, `DB insert success id=${notification?.id}`);
        }
      } catch (dbErr) {
        supabaseError = { message: dbErr?.message };
        notifLog.error(reqId, "Supabase insert threw (continuing anyway for push)", supabaseError);
      }

      // Always attempt push directly if a client subscription is supplied
      let pushResult = null;
      if (req.body?.subscription) {
        try {
          pushResult = await sendPush(pushPayload, req.body.subscription);
        } catch (pushErr) {
          pushResult = { success: false, error: pushErr?.message || String(pushErr) };
        }
      } else {
        pushResult = { success: false, error: "No target subscription supplied in body for lightweight mode push." };
      }
      notifLog.info(reqId, "VAPID direct test result", pushResult);

      const durationMs = Date.now() - startedAt;
      return res.status(200).json({
        ok: true,
        reqId,
        durationMs,
        target: { email: targetEmail, external_id: targetEmail },
        notification,
        supabaseError,
        pushResult,
        config: {
          vapidPublicKey: process.env.VAPID_PUBLIC_KEY ? "configured" : "missing",
          vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? "configured" : "missing",
          vapidSubject: process.env.VAPID_SUBJECT || "mailto:thesocio.blr@gmail.com",
        },
        queueReady: isQueueReady(),
      });
    } catch (error) {
      notifLog.error(reqId, "Test notification fatal error", { message: error?.message, stack: error?.stack });
      return res.status(500).json({ error: error?.message || "Test notification failed", reqId });
    }
  }
);

// ─── DIAGNOSTICS (config + queue health) ────────────────────────────────────────
// Public-ish read-only endpoint; useful for mobile diagnostics screen.

router.get("/notifications/diagnostics", async (req, res) => {
  return res.json({
    config: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ? "configured" : "missing",
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? "configured" : "missing",
      vapidSubject: process.env.VAPID_SUBJECT || "mailto:thesocio.blr@gmail.com",
    },
    queueReady: isQueueReady(),
    timestamp: new Date().toISOString(),
  });
});

export default router;