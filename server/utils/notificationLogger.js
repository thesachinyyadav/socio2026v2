/**
 * Notification Logger
 * ─────────────────────────────────────────────────────────────
 * Structured, traceable logger for the notification pipeline.
 * Every notification request gets a short reqId; every queue job
 * and OneSignal call carries the same id so logs can be grepped
 * end-to-end across:
 *
 *   [notif:abc12345] Incoming request
 *   [notif:abc12345] DB insert success id=...
 *   [Queue abc12345] Job started type=email
 *   [OneSignal abc12345] status=200 recipients=1
 *
 * Use newReqId() once per route invocation and pass it through
 * the queue payload as payload.__reqId.
 */

export function newReqId() {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(scope, reqId, msg, extra) {
  const prefix = reqId ? `[${scope}:${reqId}]` : `[${scope}]`;
  if (extra === undefined) return `${prefix} ${msg}`;
  try {
    return `${prefix} ${msg} ${typeof extra === "string" ? extra : JSON.stringify(extra)}`;
  } catch {
    return `${prefix} ${msg} [unserializable]`;
  }
}

export const notifLog = {
  info: (reqId, msg, extra) => console.log(fmt("notif", reqId, msg, extra)),
  warn: (reqId, msg, extra) => console.warn(fmt("notif", reqId, msg, extra)),
  error: (reqId, msg, extra) => console.error(fmt("notif", reqId, msg, extra)),
};

export const queueLog = {
  info: (reqId, msg, extra) => console.log(fmt("Queue", reqId, msg, extra)),
  warn: (reqId, msg, extra) => console.warn(fmt("Queue", reqId, msg, extra)),
  error: (reqId, msg, extra) => console.error(fmt("Queue", reqId, msg, extra)),
};

export const osLog = {
  info: (reqId, msg, extra) => console.log(fmt("OneSignal", reqId, msg, extra)),
  warn: (reqId, msg, extra) => console.warn(fmt("OneSignal", reqId, msg, extra)),
  error: (reqId, msg, extra) => console.error(fmt("OneSignal", reqId, msg, extra)),
};

export function normalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}
