/**
 * OneSignal Provider Utility
 * ─────────────────────────────────────────────────────────────
 * Calls the OneSignal v1/notifications REST API.
 * Invoked from the BullMQ worker in queueService.js, or directly
 * when no queue is configured (sync fallback).
 *
 * Schema notes (current OneSignal v11 / v1 endpoint):
 *  - For per-user targeting, prefer:
 *        include_aliases: { external_id: [...] }
 *        target_channel: "push"
 *    `include_external_user_ids` still works but is deprecated.
 *  - For segment targeting:
 *        included_segments: ["Subscribed Users"]
 *  - Authorization uses the legacy "Basic <REST_API_KEY>" format
 *    (works with both classic and `os_v2_app_*` keys for v1/notifications).
 */

import { osLog, normalizeEmail } from "./notificationLogger.js";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_BROADCAST_SEGMENT = process.env.ONESIGNAL_BROADCAST_SEGMENT || "Subscribed Users";

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.warn(
    `[OneSignal] Startup check: missing config (app_id=${!!ONESIGNAL_APP_ID}, rest_key=${!!ONESIGNAL_REST_API_KEY}). Mobile push will be skipped.`
  );
} else {
  console.log(
    `[OneSignal] Startup check: ready (app_id_suffix=${String(ONESIGNAL_APP_ID).slice(-6)}, key_format=${String(ONESIGNAL_REST_API_KEY).startsWith("os_v2_") ? "v2" : "legacy"}, broadcast_segment="${ONESIGNAL_BROADCAST_SEGMENT}")`
  );
}

export function getOneSignalConfigStatus() {
  return {
    appIdConfigured: !!ONESIGNAL_APP_ID,
    restKeyConfigured: !!ONESIGNAL_REST_API_KEY,
    appIdSuffix: ONESIGNAL_APP_ID ? String(ONESIGNAL_APP_ID).slice(-6) : null,
    broadcastSegment: ONESIGNAL_BROADCAST_SEGMENT,
    keyFormat: ONESIGNAL_REST_API_KEY?.startsWith("os_v2_") ? "v2" : "legacy",
  };
}

export async function executeOneSignalPush(type, payload) {
  // Reuse reqId if the caller (route → queue) embedded one; otherwise mint a new one.
  const reqId = payload?.__reqId || Math.random().toString(36).slice(2, 10);

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    osLog.warn(reqId, `Missing configuration. Skipping ${type} push.`);
    return { success: false, error: "Missing OneSignal config (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY)" };
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
    metadata,
  } = payload;

  const dataPayload = {
    notification_id: id,
    event_id: eventId,
    route: deepLink || "/notifications",
    deepLink: deepLink || "/notifications",
    priority: priority || "normal",
    category: category || "info",
    created_at: createdAt,
    ...(metadata || {}),
  };

  const bodyData = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title || "Notification" },
    contents: { en: body || "You have a new notification." },
    data: dataPayload,
    android_accent_color: "011F7B",
    small_icon: "ic_stat_onesignal_default",
  };

  if (image) {
    bodyData.big_picture = image;
    bodyData.ios_attachments = { id1: image };
  }

  if (type === "email" && userEmail) {
    const normalized = normalizeEmail(userEmail);
    // Modern alias-based targeting (preferred) + legacy field as a safety net.
    bodyData.include_aliases = { external_id: [normalized] };
    bodyData.target_channel = "push";
    bodyData.include_external_user_ids = [normalized];
    bodyData.channel_for_external_user_ids = "push";
  } else if (type === "broadcast") {
    bodyData.included_segments = [ONESIGNAL_BROADCAST_SEGMENT];
  } else {
    const err = new Error(`Invalid push type or missing target: type=${type} userEmail=${userEmail}`);
    osLog.error(reqId, "rejected before send", { type, userEmail });
    throw err;
  }

  osLog.info(reqId, `POST ${type} target=${type === "email" ? userEmail : ONESIGNAL_BROADCAST_SEGMENT} payload`, bodyData);

  let response;
  try {
    response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(bodyData),
    });
  } catch (networkErr) {
    osLog.error(reqId, "network error calling REST API", { message: networkErr?.message });
    throw networkErr;
  }

  const rawText = await response.text();
  let result;
  try {
    result = rawText ? JSON.parse(rawText) : {};
  } catch {
    result = { parseError: rawText };
  }
  osLog.info(reqId, `status=${response.status} response`, result);

  if (response.status === 401 || response.status === 403) {
    osLog.error(reqId, `auth rejected (${response.status}). Check ONESIGNAL_REST_API_KEY.`);
    throw new Error(`OneSignal auth failed (${response.status}): ${JSON.stringify(result)}`);
  }

  if (result.errors) {
    const errorList = Array.isArray(result.errors) ? result.errors : Object.values(result.errors).flat();
    const flattened = errorList.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("; ");

    if (flattened.includes("external_user_id not found") || flattened.includes("All included players are not subscribed")) {
      osLog.warn(reqId, `user ${userEmail} not subscribed — skipping`, { reason: flattened });
      return { success: true, warning: "User not subscribed", reqId, recipients: 0 };
    }
    if (result.errors?.invalid_external_user_ids || flattened.includes("invalid_external_user_ids")) {
      osLog.warn(reqId, `invalid external_user_id for ${userEmail} — skipping`);
      return { success: true, warning: "Invalid user external_id", reqId, recipients: 0 };
    }
    osLog.error(reqId, `API error sending ${type}`, result.errors);
    throw new Error(JSON.stringify(result.errors));
  }

  if (typeof result.recipients === "number" && result.recipients === 0) {
    osLog.warn(
      reqId,
      `delivered to 0 recipients. Check segment "${ONESIGNAL_BROADCAST_SEGMENT}" or external_user_id "${userEmail}".`
    );
  }

  return {
    success: true,
    id: result.id,
    recipients: result.recipients ?? null,
    external_id: result.external_id ?? null,
    reqId,
    raw: result,
  };
}
