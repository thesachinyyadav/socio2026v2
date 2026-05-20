import { supabase } from "../config/database.js";
import { sendPushToEmail } from "./webPushService.js";

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

    // 2. Trigger Push Notification to the user
    if (user_email) {
      const pushResult = await sendPushToEmail(user_email, {
        title,
        body: message,
        tag: notificationId,
        actionUrl: resolvedLink
      });
      console.log(`[NotificationHelper] Push triggered for ${user_email}:`, pushResult);
    }

    return { success: true, data: insertedRows[0] };
  } catch (err) {
    console.error("[NotificationHelper] Fatal Error:", err);
    return { success: false, error: err };
  }
}
