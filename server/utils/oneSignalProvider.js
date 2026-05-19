/**
 * OneSignal Provider Utility
 * Actually executes the HTTP requests to the OneSignal REST API.
 * This should ONLY be called by the Valkey queue worker (queueService.js).
 */

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_BROADCAST_SEGMENT = process.env.ONESIGNAL_BROADCAST_SEGMENT || "Subscribed Users";

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.warn(
    `[OneSignal] Startup check: missing config (app_id=${!!ONESIGNAL_APP_ID}, rest_key=${!!ONESIGNAL_REST_API_KEY}). Mobile push will be skipped.`
  );
} else {
  console.log(
    `[OneSignal] Startup check: ready (app_id_suffix=${String(ONESIGNAL_APP_ID).slice(-6)}, broadcast_segment="${ONESIGNAL_BROADCAST_SEGMENT}")`
  );
}

export async function executeOneSignalPush(type, payload) {
  const jobId = Math.random().toString(36).slice(2, 10);

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn(`[OneSignal:${jobId}] Missing configuration. Skipping ${type} push.`);
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
    bodyData.include_external_user_ids = [String(userEmail).toLowerCase()];
    bodyData.channel_for_external_user_ids = "push";
  } else if (type === "broadcast") {
    bodyData.included_segments = [ONESIGNAL_BROADCAST_SEGMENT];
  } else {
    throw new Error(`[OneSignal:${jobId}] Invalid push type or missing target: type=${type} userEmail=${userEmail}`);
  }

  console.log(
    `[OneSignal:${jobId}] POST ${type} target=${type === "email" ? userEmail : ONESIGNAL_BROADCAST_SEGMENT} payload:`,
    JSON.stringify(bodyData)
  );

  let response;
  try {
    response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(bodyData),
    });
  } catch (networkErr) {
    console.error(`[OneSignal:${jobId}] Network error calling REST API:`, networkErr?.message || networkErr);
    throw networkErr;
  }

  const rawText = await response.text();
  let result;
  try { result = rawText ? JSON.parse(rawText) : {}; } catch { result = { parseError: rawText }; }
  console.log(`[OneSignal:${jobId}] status=${response.status} body=`, JSON.stringify(result));

  if (response.status === 401 || response.status === 403) {
    console.error(`[OneSignal:${jobId}] Auth rejected (${response.status}). Check ONESIGNAL_REST_API_KEY.`);
    throw new Error(`OneSignal auth failed (${response.status}): ${JSON.stringify(result)}`);
  }

  if (result.errors) {
    if (Array.isArray(result.errors) && result.errors.some(e => typeof e === 'string' && e.includes("external_user_id not found"))) {
      console.log(`[OneSignal:${jobId}] User ${userEmail} not subscribed to push (external_user_id not found). Skipping.`);
      return { success: true, warning: "User not subscribed", jobId };
    }
    if (result.errors?.invalid_external_user_ids) {
      console.log(`[OneSignal:${jobId}] User ${userEmail} has an invalid external_user_id. Skipping.`);
      return { success: true, warning: "Invalid user external_id", jobId };
    }
    console.error(`[OneSignal:${jobId}] API error sending ${type}:`, result.errors);
    throw new Error(JSON.stringify(result.errors));
  }

  if (typeof result.recipients === "number" && result.recipients === 0) {
    console.warn(`[OneSignal:${jobId}] Delivered to 0 recipients. Check segment "${ONESIGNAL_BROADCAST_SEGMENT}" or external_user_id "${userEmail}".`);
  }

  return { success: true, id: result.id, recipients: result.recipients, jobId };
}
