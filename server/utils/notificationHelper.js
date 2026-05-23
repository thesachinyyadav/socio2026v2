import { supabase } from "../config/database.js";
import { sendPushToEmail } from "./webPushService.js";
import { sendOneSignalToEmail } from "./oneSignalService.js";
import { cacheGet, safeParse } from "../services/cacheService.js";

/**
 * Helper to insert a notification into the database and immediately trigger a push notification.
 * This ensures "all notifications in mobile are pushed" automatically.
 */
export async function createAndPushNotification(payload) {
  const {
    user_email,
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

  try {
    // 1. Insert into database
    const { data: insertedRows, error } = await supabase
      .from('notifications')
      .insert({
        user_email,
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
        is_broadcast: false,
        read: false
      })
      .select();

    if (error) {
      console.error("[NotificationHelper] DB Insert Error:", error);
      return { success: false, error };
    }

    const notificationId = insertedRows && insertedRows.length > 0 ? insertedRows[0].id : null;

    // 2. Trigger Push Notification to the user via parallel dispatch (both OneSignal & Web Push)
    if (user_email) {
      const normalizedEmail = user_email.toLowerCase().trim();
      const cachedPlatform = safeParse(await cacheGet(`user:platform:${normalizedEmail}`));
      console.log(`[NotificationHelper] Active platform for ${normalizedEmail} is: ${cachedPlatform}. Executing parallel dispatch...`);

      console.log("[ADMIN_PUSH_START]", {
        email: normalizedEmail,
        title
      });

      const [oneSignalResult, webPushResult] = await Promise.allSettled([
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
        }),
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
        })
      ]);

      const oneSignalVal = oneSignalResult.status === "fulfilled" ? oneSignalResult.value : { success: false, error: oneSignalResult.reason };
      const webPushVal = webPushResult.status === "fulfilled" ? webPushResult.value : { success: false, error: webPushResult.reason };

      console.log("[WEB_PUSH_RESULT]", webPushVal);
      console.log("[ONESIGNAL_RESULT]", oneSignalVal);

      console.log(`[NotificationHelper] Parallel dispatch results for ${normalizedEmail}:`, {
        oneSignal: oneSignalVal,
        webPush: webPushVal
      });
    }

    return { success: true, data: insertedRows[0] };
  } catch (err) {
    console.error("[NotificationHelper] Fatal Error:", err);
    return { success: false, error: err };
  }
}
