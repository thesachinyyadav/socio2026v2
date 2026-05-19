/**
 * OneSignal Provider Utility
 * Actually executes the HTTP requests to the OneSignal REST API.
 * This should ONLY be called by the Valkey queue worker (queueService.js).
 */

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Executes the push to OneSignal REST API.
 * @param {string} type 'email' | 'broadcast'
 * @param {object} payload The unified notification payload
 */
export async function executeOneSignalPush(type, payload) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("[OneSignal] Missing configuration. Skipping mobile push.");
    return { success: false, error: "Missing config" };
  }

  const {
    id,
    userEmail,
    title,
    body,
    image,
    eventId,
    deepLink,
    priority,
    category,
    createdAt,
    metadata
  } = payload;

  const dataPayload = {
    notification_id: id,
    event_id: eventId,
    route: deepLink || "/notifications",
    priority: priority || "normal",
    category: category || "info",
    created_at: createdAt,
    ...metadata
  };

  const bodyData = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: body || "You have a new notification." },
    data: dataPayload,
    // Mobile styling
    android_accent_color: "011F7B",
    small_icon: "ic_stat_onesignal_default"
  };

  if (image) {
    bodyData.big_picture = image;
    bodyData.ios_attachments = { id1: image };
  }

  if (type === "email" && userEmail) {
    bodyData.include_external_user_ids = [userEmail.toLowerCase()];
    bodyData.channel_for_external_user_ids = "push";
  } else if (type === "broadcast") {
    bodyData.included_segments = ["Total Subscriptions"];
  } else {
    throw new Error(`[OneSignal] Invalid push type or missing target: ${type}`);
  }

  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify(bodyData)
  });

  const result = await response.json();
  
  if (result.errors) {
    // If external ID isn't found, OneSignal returns an error array, we might not want to crash the worker if it's just a missing user.
    if (Array.isArray(result.errors) && result.errors.some(e => typeof e === 'string' && e.includes("external_user_id not found"))) {
       console.log(`[OneSignal] User ${userEmail} not subscribed to push. Skipping.`);
       return { success: true, warning: "User not subscribed" };
    }
    console.error(`[OneSignal] Error sending ${type}:`, result.errors);
    throw new Error(JSON.stringify(result.errors));
  }

  return { success: true, id: result.id };
}
