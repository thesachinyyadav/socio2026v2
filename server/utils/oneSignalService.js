/**
 * OneSignal Service Wrapper
 * Adapts legacy sendOneSignalToEmail / sendOneSignalToAll calls into Valkey queue jobs.
 * Threads reqId through for end-to-end traceability.
 */

import { enqueueNotification } from "../services/queueService.js";
import { notifLog, normalizeEmail } from "./notificationLogger.js";

export async function sendOneSignalToEmail(email, { title, body, actionUrl, data = {}, reqId } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    notifLog.warn(reqId, "sendOneSignalToEmail called without an email; skipping.");
    return { success: false, error: "Missing recipient email" };
  }
  const payload = {
    userEmail: normalized,
    title,
    body,
    deepLink: actionUrl,
    metadata: data,
    priority: data.priority || "normal",
    category: data.category || "info",
    createdAt: new Date().toISOString(),
    __reqId: reqId,
  };

  try {
    const result = await enqueueNotification("email", payload);
    // Preserve the inner success value rather than blindly returning success:true.
    // enqueueNotification's sync fallback can return success:false when the
    // OneSignal API rejects (e.g. 401 on a misconfigured key).
    return { ...result, success: result?.success !== false };
  } catch (error) {
    notifLog.error(reqId, "Enqueue error (email)", { message: error?.message });
    if (error?.stack) console.error(error.stack);
    return { success: false, error: error?.message || String(error) };
  }
}

export async function sendOneSignalToAll({ title, body, actionUrl, data = {}, reqId } = {}) {
  const payload = {
    title,
    body,
    deepLink: actionUrl,
    metadata: data,
    priority: data.priority || "high",
    category: data.category || "announcement",
    createdAt: new Date().toISOString(),
    __reqId: reqId,
  };

  try {
    const result = await enqueueNotification("broadcast", payload);
    // Preserve the inner success value (see sendOneSignalToEmail above).
    return { ...result, success: result?.success !== false };
  } catch (error) {
    notifLog.error(reqId, "Enqueue error (broadcast)", { message: error?.message });
    if (error?.stack) console.error(error.stack);
    return { success: false, error: error?.message || String(error) };
  }
}
