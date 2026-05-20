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

import { supabase } from "../config/database.js";

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
 * Send push notifications to all subscriptions for a specific user email.
 */
export async function sendPushToEmail(email, payload) {
  try {
    console.log(`[PUSH] sendPushToEmail started for ${email}`);
    const { data: subs, error } = await supabase
      .from("notifications")
      .select("metadata")
      .eq("user_email", email)
      .eq("type", "push_subscription_metadata");

    if (error) {
      console.error("[PUSH] Error fetching subscriptions for sendPushToEmail:", error.message);
      return { success: false, error: error.message };
    }

    if (!subs || subs.length === 0) {
      console.log(`[PUSH] No active subscriptions found for ${email}`);
      return { success: true, sent: 0 };
    }

    let successCount = 0;
    for (const subRow of subs) {
      const sub = subRow.metadata;
      if (sub && sub.endpoint) {
        const result = await sendPush(payload, sub);
        if (result.success) {
          successCount++;
        }
      }
    }

    console.log(`[PUSH] sendPushToEmail complete. Sent ${successCount}/${subs.length} notifications to ${email}`);
    return { success: true, sent: successCount };
  } catch (err) {
    console.error(`[PUSH] sendPushToEmail error for ${email}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Send push notifications to all users' active subscriptions.
 */
export async function sendPushToAll(payload) {
  try {
    console.log("[PUSH] sendPushToAll started");
    const { data: subs, error } = await supabase
      .from("notifications")
      .select("metadata")
      .eq("type", "push_subscription_metadata");

    if (error) {
      console.error("[PUSH] Error fetching all subscriptions for broadcast:", error.message);
      return { success: false, error: error.message };
    }

    if (!subs || subs.length === 0) {
      console.log("[PUSH] No subscriptions in database for broadcast.");
      return { success: true, sent: 0 };
    }

    let successCount = 0;
    for (const subRow of subs) {
      const sub = subRow.metadata;
      if (sub && sub.endpoint) {
        const result = await sendPush(payload, sub);
        if (result.success) {
          successCount++;
        }
      }
    }

    console.log(`[PUSH] sendPushToAll complete. Sent ${successCount}/${subs.length} notifications.`);
    return { success: true, sent: successCount };
  } catch (err) {
    console.error("[PUSH] sendPushToAll error:", err);
    return { success: false, error: err.message };
  }
}

