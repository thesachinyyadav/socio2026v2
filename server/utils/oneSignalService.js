/**
 * OneSignal Service Wrapper
 * Adapts legacy sendOneSignalToEmail / sendOneSignalToAll calls into Valkey queue jobs.
 * This ensures backwards compatibility with all existing backend route calls.
 */

import { enqueueNotification } from "../services/queueService.js";

/**
 * Enqueue a push notification for a specific user identified by their email.
 */
export async function sendOneSignalToEmail(email, { title, body, actionUrl, data = {} }) {
  const payload = {
    userEmail: email,
    title,
    body,
    deepLink: actionUrl,
    metadata: data,
    priority: data.priority || "normal",
    category: data.category || "info",
    createdAt: new Date().toISOString()
  };

  try {
    await enqueueNotification("email", payload);
    return { success: true, queued: true };
  } catch (error) {
    console.error("[OneSignal Wrapper] Enqueue error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Enqueue a broadcast push notification to all subscribed mobile users.
 */
export async function sendOneSignalToAll({ title, body, actionUrl, data = {} }) {
  const payload = {
    title,
    body,
    deepLink: actionUrl,
    metadata: data,
    priority: "high",
    category: "announcement",
    createdAt: new Date().toISOString()
  };

  try {
    await enqueueNotification("broadcast", payload);
    return { success: true, queued: true };
  } catch (error) {
    console.error("[OneSignal Wrapper] Enqueue error:", error);
    return { success: false, error: error.message };
  }
}
