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

// Defensive normalization: pasted env values often carry a trailing newline
// (Vercel dashboard), surrounding quotes, or an accidental "Basic " prefix
// that the user copied along with the value from documentation. All three
// produce an opaque 403 from OneSignal that's easy to misdiagnose as a
// rotated/invalid key.
function normalizeRestKey(raw) {
  if (!raw) return "";
  let v = String(raw).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/^Basic\s+/i, "").replace(/^Key\s+/i, "").trim();
  return v;
}

const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || "").trim();
const ONESIGNAL_REST_API_KEY = normalizeRestKey(process.env.ONESIGNAL_REST_API_KEY);
const ONESIGNAL_BROADCAST_SEGMENT = process.env.ONESIGNAL_BROADCAST_SEGMENT || "Subscribed Users";
const ONESIGNAL_KEY_FORMAT = ONESIGNAL_REST_API_KEY.startsWith("os_v2_") ? "v2" : "legacy";

// OneSignal endpoint + auth pair depends on the key format:
//   - legacy (48-char base64) key  → v1 endpoint + "Basic <token>"
//   - v2 ("os_v2_app_*") key       → v2 endpoint + "Key <token>"
// The v1 endpoint no longer reliably accepts v2 keys despite earlier
// backwards-compatibility claims, so v2 keys must use the new endpoint.
// v2 endpoint: OneSignal's newer convention puts channel in the body
// (`target_channel: "push"`) rather than the `?c=push` query param.
// Some accounts reject the query-param form with 403; the body form is
// universally accepted.
const ONESIGNAL_API_URL = ONESIGNAL_KEY_FORMAT === "v2"
  ? "https://api.onesignal.com/notifications"
  : "https://onesignal.com/api/v1/notifications";
const ONESIGNAL_AUTH_SCHEME = ONESIGNAL_KEY_FORMAT === "v2" ? "Key" : "Basic";

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.warn(
    `[OneSignal] Startup check: missing config (app_id=${!!ONESIGNAL_APP_ID}, rest_key=${!!ONESIGNAL_REST_API_KEY}). Mobile push will be skipped.`
  );
} else {
  console.log(
    `[OneSignal] Startup check: ready (app_id_suffix=${ONESIGNAL_APP_ID.slice(-6)}, key_format=${ONESIGNAL_KEY_FORMAT}, key_length=${ONESIGNAL_REST_API_KEY.length}, key_last4=${ONESIGNAL_REST_API_KEY.slice(-4)}, auth_scheme=${ONESIGNAL_AUTH_SCHEME}, broadcast_segment="${ONESIGNAL_BROADCAST_SEGMENT}")`
  );
  const rawHadIssue =
    process.env.ONESIGNAL_REST_API_KEY &&
    process.env.ONESIGNAL_REST_API_KEY !== ONESIGNAL_REST_API_KEY;
  if (rawHadIssue) {
    console.warn(
      "[OneSignal] Startup check: ONESIGNAL_REST_API_KEY env value contained whitespace, quotes, or an auth-scheme prefix; it has been stripped before use."
    );
  }
}

export function getOneSignalConfigStatus() {
  return {
    appIdConfigured: !!ONESIGNAL_APP_ID,
    restKeyConfigured: !!ONESIGNAL_REST_API_KEY,
    appIdSuffix: ONESIGNAL_APP_ID ? ONESIGNAL_APP_ID.slice(-6) : null,
    broadcastSegment: ONESIGNAL_BROADCAST_SEGMENT,
    keyFormat: ONESIGNAL_KEY_FORMAT,
    keyLength: ONESIGNAL_REST_API_KEY.length || 0,
    keyLast4: ONESIGNAL_REST_API_KEY ? ONESIGNAL_REST_API_KEY.slice(-4) : null,
    authScheme: ONESIGNAL_AUTH_SCHEME,
    endpoint: ONESIGNAL_API_URL,
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

  // v2 endpoint requires target_channel in body for broadcasts. Setting it
  // unconditionally is harmless on v1 (field is accepted but ignored) and
  // ensures broadcast sends route correctly under v2.
  if (ONESIGNAL_KEY_FORMAT === "v2") {
    bodyData.target_channel = "push";
  }

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
    response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `${ONESIGNAL_AUTH_SCHEME} ${ONESIGNAL_REST_API_KEY}`,
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
    const hint = [
      `OneSignal rejected the request (${response.status}). Things to check, in order:`,
      `  1. The REST API Key in your server env (ONESIGNAL_REST_API_KEY) belongs to the SAME OneSignal app as ONESIGNAL_APP_ID ending in "${ONESIGNAL_APP_ID.slice(-6)}". Open OneSignal dashboard → Settings → Keys & IDs and copy the value next to "REST API Key" (NOT the App ID, NOT the User Auth Key).`,
      `  2. The key has not been rotated/deleted in the dashboard since it was put into the env var.`,
      `  3. If the key starts with "os_v2_" the auth scheme is "Key <token>"; otherwise "Basic <token>". Current scheme being sent: "${ONESIGNAL_AUTH_SCHEME}" (key_format=${ONESIGNAL_KEY_FORMAT}, key_length=${ONESIGNAL_REST_API_KEY.length}, key_last4=${ONESIGNAL_REST_API_KEY.slice(-4)}).`,
      `  4. The env value has no surrounding quotes, no trailing newline, no leading "Basic "/"Key ". (The provider strips these defensively at startup — see the startup-check log line.)`,
    ].join("\n");
    osLog.error(reqId, `auth rejected (${response.status})`, { keyLength: ONESIGNAL_REST_API_KEY.length, keyLast4: ONESIGNAL_REST_API_KEY.slice(-4), authScheme: ONESIGNAL_AUTH_SCHEME, hint });
    throw new Error(`OneSignal auth failed (${response.status}): ${rawText || "(empty body)"}\n\n${hint}`);
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
