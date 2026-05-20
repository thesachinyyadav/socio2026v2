import webpush from "web-push";

let vapidConfigured = false;

function initializeVapid() {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:thesocio.blr@gmail.com";

  if (!publicKey || !privateKey) {
    console.error("[PUSH] VAPID keys are missing from environment variables (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    console.log("[PUSH] VAPID successfully initialized.");
    return true;
  } catch (error) {
    console.error("[PUSH] VAPID initialization failed:", error.message || error);
    return false;
  }
}

/**
 * Sends a push notification directly to a browser push subscription.
 * @param {object} payload The notification payload (title, body, route, etc.)
 * @param {object} subscription The VAPID subscription object (endpoint, keys: { p256dh, auth })
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPush(payload, subscription) {
  if (!initializeVapid()) {
    return { success: false, error: "VAPID not initialized" };
  }

  if (!subscription || !subscription.endpoint) {
    console.error("[PUSH] Delivery failed: Invalid or missing subscription details.");
    return { success: false, error: "Invalid subscription" };
  }

  const endpoint = subscription.endpoint;
  console.log(`[PUSH] Delivery started to endpoint: ${endpoint.substring(0, 45)}...`);

  try {
    const stringifiedPayload = JSON.stringify(payload);
    await webpush.sendNotification(subscription, stringifiedPayload, {
      TTL: 60 * 60, // 1 hour Time-To-Live
    });

    console.log(`[PUSH] Delivery success to endpoint: ${endpoint.substring(0, 45)}...`);
    return { success: true };
  } catch (error) {
    console.error(`[PUSH] Delivery failed to endpoint: ${endpoint.substring(0, 45)}... | Error:`, error.message || error);
    return {
      success: false,
      error: error.message || String(error),
      statusCode: error.statusCode,
    };
  }
}

/**
 * Mocked sendPushToEmail for database-free VAPID push mode.
 */
export async function sendPushToEmail(email, payload) {
  console.log(`[PUSH] sendPushToEmail bypassed for ${email} (lightweight database-free mode). Payload:`, payload);
  return { success: true, bypassed: true };
}

/**
 * Mocked sendPushToAll for database-free VAPID push mode.
 */
export async function sendPushToAll(payload) {
  console.log("[PUSH] sendPushToAll bypassed (lightweight database-free mode). Payload:", payload);
  return { success: true, bypassed: true };
}

