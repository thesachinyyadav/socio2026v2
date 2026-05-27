import { supabase } from "../config/database.js";
import { sendPushToAll, sendPushToEmail } from "./webPushService.js";
import { sendOneSignalToAll, sendOneSignalToEmail, sendOneSignalToEmails } from "./oneSignalService.js";
import { cacheGet, safeParse } from "../services/cacheService.js";

/**
 * Helper to insert a notification into the database and immediately trigger a push notification.
 * This ensures "all notifications in mobile are pushed" automatically.
 */
export async function createAndPushNotification(payload) {
  const {
    user_email,
    broadcast = false,
    is_broadcast,
    title,
    message,
    type = 'info',
    category,
    event_id = null,
    event_title = null,
    action_url = null,
    deep_link = null,
    priority = "normal",
    metadata = {}
  } = payload;

  const resolvedType = category || type;
  const resolvedLink = deep_link || action_url || "/notifications";
  const shouldBroadcast = broadcast || is_broadcast || !user_email;

  try {
    // 1. Insert into database
    const { data: insertedRows, error } = await supabase
      .from('notifications')
      .insert({
        user_email: shouldBroadcast ? null : user_email,
        title,
        message,
        type: resolvedType,
        category: resolvedType,
        event_id,
        event_title,
        action_url: resolvedLink,
        deep_link: resolvedLink,
        priority,
        metadata,
        is_broadcast: shouldBroadcast ? true : false,
        read: false
      })
      .select();

    if (error) {
      console.error("[NotificationHelper] DB Insert Error:", error);
      return { success: false, error };
    }

    console.log("[ADMIN_NOTIFICATION_CREATED]");

    const notificationId = insertedRows && insertedRows.length > 0 ? insertedRows[0].id : null;

    // 2. Trigger Push Notification either to one user or to all users.
    if (shouldBroadcast) {
      console.log("[BROADCAST_START]", { title, resolvedType });

      // Fetch all users to broadcast to
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('email');

      if (usersError) {
        console.error("[BROADCAST_FAILURE] Failed to query users:", usersError);
        return { success: false, error: usersError };
      }

      const allEmails = [...new Set((users || [])
        .map(u => u.email ? u.email.trim().toLowerCase() : "")
        .filter(email => !!email))];

      console.log("[BROADCAST_USERS]", { count: allEmails.length });
      console.log("[BROADCAST USERS COUNT]", allEmails.length);

      // Trigger parallel dispatches: Web Push and OneSignal
      const results = await Promise.allSettled([
        // A. Web Push to All
        sendPushToAll({
          title,
          body: message,
          tag: notificationId,
          notificationId,
          actionUrl: resolvedLink,
          category: resolvedType,
          priority,
          timestamp: Date.now(),
          ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
        }),
        // B. OneSignal chunked dispatch
        (async () => {
          console.log("[ONESIGNAL_BATCH] Starting chunked OneSignal dispatch");
          const ONESIGNAL_BATCH_SIZE = 100;
          const batches = [];
          for (let i = 0; i < allEmails.length; i += ONESIGNAL_BATCH_SIZE) {
            batches.push(allEmails.slice(i, i + ONESIGNAL_BATCH_SIZE));
          }
          
          const batchPromises = batches.map(batch => {
            console.log(`[ONESIGNAL_BATCH] Sending batch of size ${batch.length}`);
            return sendOneSignalToEmails(batch, {
              title,
              body: message,
              actionUrl: resolvedLink,
              data: {
                notificationId,
                category: resolvedType,
                priority,
                ...(metadata && Object.keys(metadata).length > 0 ? metadata : {}),
              },
            });
          });

          const batchResults = await Promise.allSettled(batchPromises);
          const successCount = batchResults.filter(
            r => r.status === "fulfilled" && r.value?.success
          ).length;
          console.log(`[ONESIGNAL_BATCH] Completed chunked dispatch: ${successCount}/${batches.length} batches succeeded.`);
          return { success: successCount > 0, batchesSent: successCount, totalBatches: batches.length };
        })()
      ]);

      const webPushVal = results[0].status === "fulfilled" ? results[0].value : { success: false, error: results[0].reason };
      const oneSignalVal = results[1].status === "fulfilled" ? results[1].value : { success: false, error: results[1].reason };

      console.log("[PUSH_RESULTS]", results);
      console.log("[WEB_PUSH_RESULT]", webPushVal);
      console.log("[ONESIGNAL_RESULT]", oneSignalVal);

      if (webPushVal.success && oneSignalVal.success) {
        console.log("[BROADCAST_SUCCESS]", { notificationId });
      } else {
        console.warn("[BROADCAST_FAILURE] Partially failed or failed broadcast dispatch", { webPushVal, oneSignalVal });
      }

      return {
        success: true,
        data: insertedRows[0],
        delivery: {
          webPush: webPushVal,
          oneSignal: oneSignalVal,
        },
      };
    }

    if (user_email) {
      const normalizedEmail = user_email.toLowerCase().trim();
      const cachedPlatform = safeParse(await cacheGet(`user:platform:${normalizedEmail}`));
      console.log(`[NotificationHelper] Active platform for ${normalizedEmail} is: ${cachedPlatform}. Executing parallel dispatch...`);

      console.log("[PUSH_DISPATCH_START]", {
        email: normalizedEmail,
        title
      });

      const results = await Promise.allSettled([
        sendPushToEmail(normalizedEmail, {
          title,
          body:           message,
          tag:            notificationId,
          notificationId: notificationId,
          actionUrl:      resolvedLink,
          category:       resolvedType,
          priority:       priority,
          timestamp:      Date.now(),
          userEmail:      normalizedEmail,
          ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
        }),
        sendOneSignalToEmail(normalizedEmail, {
          title,
          body: message,
          actionUrl: resolvedLink,
          data: {
            notificationId,
            category: resolvedType,
            priority,
            ...(metadata && Object.keys(metadata).length > 0 ? metadata : {}),
          }
        })
      ]);

      console.log("[PUSH_RESULTS]", results);

      const webPushVal = results[0].status === "fulfilled" ? results[0].value : { success: false, error: results[0].reason };
      const oneSignalVal = results[1].status === "fulfilled" ? results[1].value : { success: false, error: results[1].reason };

      console.log("[WEB_PUSH_RESULT]", webPushVal);
      console.log("[ONESIGNAL_RESULT]", oneSignalVal);

      console.log(`[NotificationHelper] Parallel dispatch results for ${normalizedEmail}:`, {
        oneSignal: oneSignalVal,
        webPush: webPushVal
      });
    }

    return { success: true, data: insertedRows[0], delivery: null };
  } catch (err) {
    console.error("[NotificationHelper] Fatal Error:", err);
    return { success: false, error: err };
  }
}
