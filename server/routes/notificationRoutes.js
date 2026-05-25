import express from "express";
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, getUserInfo, checkRoleExpiration, requireMasterAdmin, requireOrganiserOrSubHead, extractCreatorEmails } from "../middleware/authMiddleware.js";
import {
  sendPush,
  sendPushToEmail,
  sendPushToAll,
  addSubscription,
  removeSubscription,
} from "../utils/webPushService.js";
import { isQueueReady } from "../services/queueService.js";
import { notifLog, newReqId, normalizeEmail } from "../utils/notificationLogger.js";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  CACHE_KEYSPACE,
  safeStringify,
  safeParse,
} from "../services/cacheService.js";
import { sendOneSignalToEmail, sendOneSignalToAll } from "../utils/oneSignalService.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────

router.post(
  "/notifications/push/subscribe",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    try {
      const email = normalizeEmail(req.userInfo?.email);
      if (!email) {
        return res.status(401).json({ error: "Unauthorized: User email not found" });
      }

      const subscription = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Invalid subscription details." });
      }

      console.log(`[PUSH] Subscribing user ${email} with endpoint: ${subscription.endpoint}`);

      // Register subscription in the memory-only store on the backend
      addSubscription(email, subscription);

      return res.status(201).json({ message: "Push subscription registered in-memory" });
    } catch (err) {
      console.error("[PUSH] Subscription registration fatal error:", err);
      return res.status(500).json({ error: err.message || "Failed to register subscription" });
    }
  }
);

router.delete(
  "/notifications/push/unsubscribe",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    try {
      const email = normalizeEmail(req.userInfo?.email);
      if (!email) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const subscription = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Invalid subscription details." });
      }

      console.log(`[PUSH] Unsubscribing user ${email} with endpoint: ${subscription.endpoint}`);

      // Remove subscription from the memory-only store on the backend
      removeSubscription(email, subscription.endpoint);

      return res.json({ message: "Push subscription removed from in-memory" });
    } catch (err) {
      console.error("[PUSH] Unsubscribe fatal error:", err);
      return res.status(500).json({ error: err.message || "Failed to unsubscribe" });
    }
  }
);

router.post(
  "/notifications/push/register-platform",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    try {
      const email = normalizeEmail(req.userInfo?.email || req.body?.email);
      if (!email) {
        return res.status(401).json({ error: "Unauthorized: User email not found" });
      }

      const { platform } = req.body;
      if (!platform || (platform !== "web" && platform !== "android-native")) {
        return res.status(400).json({ error: "Invalid or missing platform. Allowed: web, android-native" });
      }

      const key = `user:platform:${email}`;
      console.log(`[PUSH] Registering platform for ${email}: ${platform}`);
      await cacheSet(key, safeStringify(platform));

      return res.status(200).json({ message: "Platform registered successfully", platform });
    } catch (err) {
      console.error("[PUSH] Register platform fatal error:", err);
      return res.status(500).json({ error: err.message || "Failed to register platform" });
    }
  }
);

router.post("/notifications/send-direct", async (req, res) => {
  try {
    const { subscription, payload, delayMs } = req.body || {};
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
    if (delayMs && typeof delayMs === "number" && delayMs > 0) {
      setTimeout(async () => {
        try {
          console.log(`[PUSH] Delayed push delivery executing after ${delayMs}ms...`);
          await sendPush(pushPayload, subscription);
        } catch (delayedErr) {
          console.error("[PUSH] Error sending delayed direct web push:", delayedErr);
        }
      }, delayMs);
      return res.status(200).json({ ok: true, delayed: true });
    }

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
      .neq('type', 'push_subscription_metadata')
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

    console.log("[ADMIN_NOTIFICATION_TRIGGERED]", {
      title,
      email: "all_users",
      timestamp: Date.now()
    });

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

    console.log("[ADMIN_NOTIFICATION_CREATED]");

    const dataRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!dataRow) {
      notifLog.error(reqId, "Insert returned no rows.");
      return res.status(500).json({ error: "Insert succeeded but returned no rows (check RLS / select grants).", reqId });
    }
    notifLog.info(reqId, `DB insert success id=${dataRow.id}`);

    console.log("[PUSH_DISPATCH_START]", {
      email: "all_users",
      title
    });

    const [webPushResultSettled, oneSignalResultSettled] = await Promise.allSettled([
      sendPushToAll({
        title,
        body:           message,
        tag:            dataRow.id,
        notificationId: dataRow.id,
        actionUrl:      resolvedLink || "/notifications",
        category:       resolvedType,
        priority:       priority || "high",
        timestamp:      Date.now(),
      }),
      sendOneSignalToAll({
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
      })
    ]);

    const webPushResult = webPushResultSettled.status === "fulfilled" ? webPushResultSettled.value : { success: false, error: webPushResultSettled.reason };
    const oneSignalResult = oneSignalResultSettled.status === "fulfilled" ? oneSignalResultSettled.value : { success: false, error: oneSignalResultSettled.reason };

    notifLog.info(reqId, "Parallel broadcast results:", { webPushResult, oneSignalResult });

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

// ─── ADMIN: EVENT BLAST NOTIFICATION ─────────────────────────────────────────────
// POST endpoint to let the admin panel send blasts to registered participants of a specific event.
router.post(
  "/notifications/event-blast",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    const reqId = newReqId();
    try {
      notifLog.info(reqId, "Incoming event blast request", { sender: req.userInfo?.email, body: req.body });
      const { title, message, type = 'info', event_id, event_title, action_url, deepLink, category, priority, metadata } = req.body || {};

      if (!event_id) {
        return res.status(400).json({ error: "event_id is required for event blast", reqId });
      }
      if (!title || !message) {
        return res.status(400).json({ error: "title and message are required", reqId });
      }

      // 1. Fetch all registered users for this event
      const { data: registrations, error: regError } = await supabase
        .from("registrations")
        .select("user_email, individual_email, team_leader_email, teammates")
        .eq("event_id", event_id);

      if (regError) {
        notifLog.error(reqId, "Failed to fetch event registrations", regError);
        return res.status(500).json({ error: "Failed to fetch event registrations", reqId });
      }

      // Collect all unique attendee emails
      const emails = new Set();
      (registrations || []).forEach(r => {
        if (r.user_email) emails.add(r.user_email.toLowerCase().trim());
        if (r.individual_email) emails.add(r.individual_email.toLowerCase().trim());
        if (r.team_leader_email) emails.add(r.team_leader_email.toLowerCase().trim());
        if (r.teammates && Array.isArray(r.teammates)) {
          r.teammates.forEach(tm => {
            if (tm.email) emails.add(tm.email.toLowerCase().trim());
          });
        }
      });

      const emailList = Array.from(emails);
      notifLog.info(reqId, `Found ${emailList.length} unique registered users for event ${event_id}`);

      if (emailList.length === 0) {
        return res.status(200).json({ message: "No registered participants found for this event", sentCount: 0, reqId });
      }

      const resolvedType = category || type;
      const resolvedLink = deepLink || action_url || `/event/${event_id}`;

      // 2. Insert individual notifications in database for each attendee
      const insertPayloads = emailList.map(email => ({
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
        user_email: email,
        is_broadcast: false,
        read: false,
      }));

      const { data: insertedRows, error: insertError } = await supabase
        .from('notifications')
        .insert(insertPayloads)
        .select();

      if (insertError) {
        notifLog.error(reqId, "Failed to insert event blast notifications in DB", insertError);
        return res.status(500).json({ error: "Failed to insert event blast notifications in DB", reqId });
      }

      console.log("[ADMIN_NOTIFICATION_CREATED]");

      // Map inserted notification IDs to user emails
      const notifIdMap = {};
      (insertedRows || []).forEach(row => {
        if (row.user_email) {
          notifIdMap[row.user_email.toLowerCase().trim()] = row.id;
        }
      });

      // 3. Dispatch parallel push notifications to each attendee
      const promises = emailList.map(async (email) => {
        const notifId = notifIdMap[email] || null;

        console.log("[PUSH_DISPATCH_START]", {
          email,
          title
        });

        const [oneSignalResultSettled, webPushResultSettled] = await Promise.allSettled([
          sendOneSignalToEmail(email, {
            title,
            body: message,
            actionUrl: resolvedLink,
            data: {
              notificationId: notifId,
              category: resolvedType,
              priority: priority || "high",
              eventId: event_id,
              ...(metadata || {}),
            }
          }),
          sendPushToEmail(email, {
            title,
            body:           message,
            tag:            notifId,
            notificationId: notifId,
            actionUrl:      resolvedLink,
            category:       resolvedType,
            priority:       priority || "high",
            timestamp:      Date.now(),
            userEmail:      email,
          })
        ]);

        const oneSignalVal = oneSignalResultSettled.status === "fulfilled" ? oneSignalResultSettled.value : { success: false, error: oneSignalResultSettled.reason };
        const webPushVal = webPushResultSettled.status === "fulfilled" ? webPushResultSettled.value : { success: false, error: webPushResultSettled.reason };

        console.log("[WEB_PUSH_RESULT]", webPushVal);
        console.log("[ONESIGNAL_RESULT]", oneSignalVal);

        return { email, oneSignal: oneSignalVal, webPush: webPushVal };
      });

      const dispatchResults = await Promise.all(promises);

      return res.status(201).json({
        ok: true,
        sentCount: emailList.length,
        delivery: dispatchResults,
        reqId
      });
    } catch (error) {
      notifLog.error(reqId, "Error sending event blast", { message: error?.message, stack: error?.stack });
      return res.status(500).json({ error: error?.message || "Failed to send event blast", reqId });
    }
  }
);

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

      // Trigger parallel dispatch to both Web Push and OneSignal
      const [webPushResultSettled, oneSignalResultSettled] = await Promise.allSettled([
        sendPushToAll({
          title:          tpl.title,
          body:           tpl.message,
          tag:            data.id,
          notificationId: data.id,
          actionUrl:      `/event/${event.event_id}`,
          category:       "event",
          priority:       "high",
          timestamp:      Date.now(),
        }),
        sendOneSignalToAll({
          title: tpl.title,
          body: tpl.message,
          actionUrl: `/event/${event.event_id}`,
          data: { notificationId: data.id, eventId: event.event_id }
        })
      ]);

      const webPushResult = webPushResultSettled.status === "fulfilled" ? webPushResultSettled.value : { success: false, error: webPushResultSettled.reason };
      const oneSignalResult = oneSignalResultSettled.status === "fulfilled" ? oneSignalResultSettled.value : { success: false, error: oneSignalResultSettled.reason };

      console.log(`[EVENT-REMINDER] Parallel dispatch results:`, { webPushResult, oneSignalResult });

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
// Read/dismiss state is managed per-user via notification_user_status table.

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

    const [{ data: individual, error: indError }, { data: broadcasts, error: bcError }, { data: statusRows, error: statusError }] =
      await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .ilike('user_email', email)
          .neq('type', 'push_subscription_metadata')
          .gte('created_at', userCreatedAt)
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .eq('is_broadcast', true)
          .neq('type', 'push_subscription_metadata')
          .gte('created_at', userCreatedAt)
          .order('created_at', { ascending: false }),
        supabase
          .from('notification_user_status')
          .select('notification_id, is_read, is_dismissed')
          .eq('user_email', email),
      ]);

    if (indError) {
      notifLog.error(reqId, "individual fetch failed", { code: indError.code, message: indError.message });
      throw indError;
    }
    if (bcError) {
      notifLog.error(reqId, "broadcast fetch failed", { code: bcError.code, message: bcError.message });
      throw bcError;
    }
    if (statusError) {
      notifLog.error(reqId, "user status fetch failed", { code: statusError.code, message: statusError.message });
      // Fallback: don't crash
    }

    const statusMap = new Map();
    (statusRows || []).forEach(row => {
      statusMap.set(row.notification_id, {
        is_read: row.is_read,
        is_dismissed: row.is_dismissed
      });
    });

    const processedIndividual = (individual || [])
      .map(n => {
        const userStatus = statusMap.get(n.id);
        if (userStatus?.is_dismissed) return null;
        return mapNotification(n, userStatus);
      })
      .filter(Boolean);

    const processedBroadcasts = (broadcasts || [])
      .map(n => {
        const userStatus = statusMap.get(n.id);
        if (userStatus?.is_dismissed) return null;
        return mapNotification(n, userStatus);
      })
      .filter(Boolean);

    const indCount = processedIndividual.length;
    const bcCount = processedBroadcasts.length;
    notifLog.info(reqId, `Fetched individual=${indCount} broadcasts=${bcCount} (since ${userCreatedAt})`);

    const all = [
      ...processedIndividual,
      ...processedBroadcasts,
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
// Broadcast read state is saved in notification_user_status; individual rows are updated directly.

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const rawEmail = req.body?.email;
    const email = normalizeEmail(rawEmail);

    // 1. Mark individual notification as read in notifications table
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('is_broadcast', false);

    // 2. Also write to notification_user_status for broadcast / cross-device support
    if (email) {
      const { error: insertErr } = await supabase
        .from('notification_user_status')
        .insert({
          notification_id: id,
          user_email: email,
          is_read: true
        });

      if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('unique'))) {
        await supabase
          .from('notification_user_status')
          .update({ is_read: true })
          .eq('notification_id', id)
          .eq('user_email', email);
      }

      // Invalidate sync/summary caches
      const cacheKey = typeof CACHE_KEYSPACE.notificationSummary === 'function'
        ? CACHE_KEYSPACE.notificationSummary(email)
        : `notifications:sync:${email}`;
      await cacheDel(cacheKey);
      await cacheDel(`notifications:sync:${email}`);
    }

    return res.json({ message: "Notification marked as read" });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// ─── MARK ALL AS READ ───────────────────────────────────────────────────────────
// Broadcast read state is saved in notification_user_status; individual rows are updated directly.

router.patch("/notifications/mark-read", async (req, res) => {
  try {
    const { email: rawEmail } = req.body;
    const email = normalizeEmail(rawEmail);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // 1. Mark all individual notifications as read in notifications table
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_email', email)
      .eq('read', false);

    // 2. Fetch all active broadcasts and mark them as read in notification_user_status
    const { data: user } = await supabase
      .from('users')
      .select('created_at')
      .ilike('email', email)
      .maybeSingle();

    if (user?.created_at) {
      const { data: broadcasts } = await supabase
        .from('notifications')
        .select('id')
        .eq('is_broadcast', true)
        .gte('created_at', user.created_at);

      if (broadcasts && broadcasts.length > 0) {
        const insertRows = broadcasts.map(b => ({
          notification_id: b.id,
          user_email: email,
          is_read: true
        }));

        await supabase
          .from('notification_user_status')
          .upsert(insertRows, { onConflict: 'notification_id,user_email' });
      }
    }

    // Invalidate sync/summary caches
    const cacheKey = typeof CACHE_KEYSPACE.notificationSummary === 'function'
      ? CACHE_KEYSPACE.notificationSummary(email)
      : `notifications:sync:${email}`;
    await cacheDel(cacheKey);
    await cacheDel(`notifications:sync:${email}`);

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

    console.log("[ADMIN_NOTIFICATION_TRIGGERED]", {
      title,
      email: targetEmail,
      timestamp: Date.now()
    });

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

    console.log("[ADMIN_NOTIFICATION_CREATED]");

    const notification = Array.isArray(dataArr) && dataArr.length > 0 ? dataArr[0] : null;
    if (!notification) {
      notifLog.error(reqId, "Insert returned no rows.");
      return res.status(500).json({ error: "Insert succeeded but returned no rows (check RLS / select grants).", reqId });
    }
    notifLog.info(reqId, `DB insert success id=${notification.id}`);

    let webPushResult = null;
    let oneSignalResult = null;

    const cachedPlatform = safeParse(await cacheGet(`user:platform:${targetEmail}`));
    notifLog.info(reqId, `Active platform for ${targetEmail} is: ${cachedPlatform}. Executing parallel dispatch...`);

    console.log("[PUSH_DISPATCH_START]", {
      email: targetEmail,
      title
    });

    const [oneSignalResultSettled, webPushResultSettled] = await Promise.allSettled([
      sendOneSignalToEmail(targetEmail, {
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
      }),
      sendPushToEmail(targetEmail, {
        title,
        body:           message,
        tag:            notification.id,
        notificationId: notification.id,
        actionUrl:      resolvedLink || "/notifications",
        category:       resolvedType,
        priority:       priority || "normal",
        timestamp:      Date.now(),
        userEmail:      targetEmail,
      })
    ]);

    oneSignalResult = oneSignalResultSettled.status === "fulfilled" ? oneSignalResultSettled.value : { success: false, error: oneSignalResultSettled.reason };
    webPushResult = webPushResultSettled.status === "fulfilled" ? webPushResultSettled.value : { success: false, error: webPushResultSettled.reason };

    console.log("[WEB_PUSH_RESULT]", webPushResult);
    console.log("[ONESIGNAL_RESULT]", oneSignalResult);

    notifLog.info(reqId, "Parallel dispatch results:", { oneSignalResult, webPushResult });

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
    const { email: rawEmail } = req.query;
    const email = normalizeEmail(rawEmail);

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    // 1. Delete user status rows for the user's individual notifications to avoid foreign key violations
    // First, fetch the IDs of individual notifications for this user
    const { data: individual } = await supabase
      .from('notifications')
      .select('id')
      .ilike('user_email', email)
      .or('is_broadcast.is.null,is_broadcast.eq.false');

    if (individual && individual.length > 0) {
      const indIds = individual.map(n => n.id);
      await supabase
        .from('notification_user_status')
        .delete()
        .eq('user_email', email)
        .in('notification_id', indIds);
    }

    // 2. Delete individual notifications
    await supabase
      .from('notifications')
      .delete()
      .ilike('user_email', email)
      .or('is_broadcast.is.null,is_broadcast.eq.false');

    // 3. Mark all current active broadcasts as dismissed in notification_user_status
    const { data: user } = await supabase
      .from('users')
      .select('created_at')
      .ilike('email', email)
      .maybeSingle();

    if (user?.created_at) {
      const { data: broadcasts } = await supabase
        .from('notifications')
        .select('id')
        .eq('is_broadcast', true)
        .gte('created_at', user.created_at);

      if (broadcasts && broadcasts.length > 0) {
        const insertRows = broadcasts.map(b => ({
          notification_id: b.id,
          user_email: email,
          is_dismissed: true,
          is_read: true
        }));

        await supabase
          .from('notification_user_status')
          .upsert(insertRows, { onConflict: 'notification_id,user_email' });
      }
    }

    // Invalidate sync/summary caches
    const cacheKey = typeof CACHE_KEYSPACE.notificationSummary === 'function'
      ? CACHE_KEYSPACE.notificationSummary(email)
      : `notifications:sync:${email}`;
    await cacheDel(cacheKey);
    await cacheDel(`notifications:sync:${email}`);

    return res.json({ message: "All notifications cleared" });

  } catch (error) {
    console.error("Error clearing notifications:", error);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
});

// ─── DISMISS ONE ────────────────────────────────────────────────────────────────
// Broadcasts are dismissed in notification_user_status; individual notifications are deleted from DB.

router.delete("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const rawEmail = req.query.email || req.body?.email;
    const email = normalizeEmail(rawEmail);

    // Check if broadcast
    const { data: notif } = await supabase
      .from('notifications')
      .select('is_broadcast')
      .eq('id', id)
      .single();

    if (notif?.is_broadcast) {
      // If broadcast, mark as dismissed in notification_user_status
      if (email) {
        const { error: insertErr } = await supabase
          .from('notification_user_status')
          .insert({
            notification_id: id,
            user_email: email,
            is_dismissed: true,
            is_read: true
          });

        if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('unique'))) {
          await supabase
            .from('notification_user_status')
            .update({ is_dismissed: true, is_read: true })
            .eq('notification_id', id)
            .eq('user_email', email);
        }
      }
    } else {
      // If individual, delete from notification_user_status first, then from notifications table
      if (email) {
        await supabase
          .from('notification_user_status')
          .delete()
          .eq('notification_id', id)
          .eq('user_email', email);
      } else {
        // Fallback: delete status records for this notification first just in case
        await supabase
          .from('notification_user_status')
          .delete()
          .eq('notification_id', id);
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }

    // Invalidate sync/summary caches
    if (email) {
      const cacheKey = typeof CACHE_KEYSPACE.notificationSummary === 'function'
        ? CACHE_KEYSPACE.notificationSummary(email)
        : `notifications:sync:${email}`;
      await cacheDel(cacheKey);
      await cacheDel(`notifications:sync:${email}`);
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

    console.log("[ADMIN_NOTIFICATION_CREATED]");

    const dataRow = data && data.length > 0 ? data[0] : null;
    if (!dataRow) {
      console.error("[SUPABASE INSERT ERROR] Insert succeeded but returned no rows.");
      throw new Error("Insert succeeded but returned no rows.");
    }
    console.log("[SUPABASE INSERT SUCCESS]", JSON.stringify(dataRow, null, 2));

    console.log("[PUSH_DISPATCH_START]", {
      email: "all_users",
      title
    });

    // Trigger parallel dispatch to both Web Push and OneSignal
    const [webPushResultSettled, oneSignalResultSettled] = await Promise.allSettled([
      sendPushToAll({
        title,
        body:           message,
        tag:            dataRow.id,
        notificationId: dataRow.id,
        actionUrl:      deepLink || action_url || "/notifications",
        category:       category || type || "info",
        priority:       priority || "high",
        timestamp:      Date.now(),
      }),
      sendOneSignalToAll({
        title,
        body: message,
        actionUrl: deepLink || action_url || "/notifications",
        data: { notificationId: dataRow.id, category: category || type, priority, ...metadata }
      })
    ]);

    const webPushResult = webPushResultSettled.status === "fulfilled" ? webPushResultSettled.value : { success: false, error: webPushResultSettled.reason };
    const oneSignalResult = oneSignalResultSettled.status === "fulfilled" ? oneSignalResultSettled.value : { success: false, error: oneSignalResultSettled.reason };

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

    // 3. Parallel fetch of last 50 individual + broadcast + status
    const [{ data: individual }, { data: broadcasts }, { data: statusRows }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_email', email)
        .neq('type', 'push_subscription_metadata')
        .gte('created_at', user.created_at)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('notifications')
        .select('*')
        .eq('is_broadcast', true)
        .neq('type', 'push_subscription_metadata')
        .gte('created_at', user.created_at)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('notification_user_status')
        .select('notification_id, is_read, is_dismissed')
        .eq('user_email', email),
    ]);

    const statusMap = new Map();
    (statusRows || []).forEach(row => {
      statusMap.set(row.notification_id, {
        is_read: row.is_read,
        is_dismissed: row.is_dismissed
      });
    });

    const processedIndividual = (individual || [])
      .map(n => {
        const userStatus = statusMap.get(n.id);
        if (userStatus?.is_dismissed) return null;
        return mapNotification(n, userStatus);
      })
      .filter(Boolean);

    const processedBroadcasts = (broadcasts || [])
      .map(n => {
        const userStatus = statusMap.get(n.id);
        if (userStatus?.is_dismissed) return null;
        return mapNotification(n, userStatus);
      })
      .filter(Boolean);

    // Merge and sort
    const merged = [
      ...processedIndividual,
      ...processedBroadcasts
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);

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
      const pushPayload = {
        title,
        body:           message,
        tag:            notification?.id || undefined,
        notificationId: notification?.id || undefined,
        actionUrl:      "/notifications",
        category:       "diagnostic",
        priority:       "high",
        timestamp:      Date.now(),
        userEmail:      targetEmail,
      };

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
      oneSignalAppId: process.env.ONESIGNAL_APP_ID ? "configured" : "missing",
      oneSignalRestApiKey: process.env.ONESIGNAL_REST_API_KEY ? "configured" : "missing",
    },
    queueReady: isQueueReady(),
    timestamp: new Date().toISOString(),
  });
});

export default router;