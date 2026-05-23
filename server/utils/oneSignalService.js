/**
 * Service wrapper for OneSignal REST API notifications.
 */

/**
 * Sends a push notification to a specific user identified by their email (external_id).
 *
 * @param {string} email - The user's email address (external_id in OneSignal).
 * @param {object} payload - The notification content.
 * @param {string} payload.title - The notification title.
 * @param {string} payload.body - The notification body/message.
 * @param {string} [payload.actionUrl] - Optional URL target.
 * @param {object} [payload.data] - Additional custom metadata.
 * @returns {Promise<object>} Result status and payload.
 */
export async function sendOneSignalToEmail(email, payload) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  const { title, body, actionUrl, data } = payload;
  const message = body || payload.message || "";
  const normalizedEmail = email ? email.toLowerCase().trim() : "";

  console.log("[ONESIGNAL_EXECUTING]", normalizedEmail);
  console.log("[ONESIGNAL_TARGET_EMAIL]", normalizedEmail);
  console.log("[ONESIGNAL_ENV]", {
    hasAppId: !!process.env.ONESIGNAL_APP_ID,
    hasKey: !!process.env.ONESIGNAL_REST_API_KEY
  });

  if (!appId || !apiKey) {
    console.warn("[ONESIGNAL] Credentials missing. Bypassing native push.");
    return { success: false, error: "OneSignal credentials missing" };
  }

  if (!normalizedEmail) {
    return { success: false, error: "Email is required to send individual native push" };
  }

  const bodyData = {
    app_id: appId,
    include_aliases: {
      external_id: [normalizedEmail]
    },
    target_channel: "push",
    headings: {
      en: title
    },
    contents: {
      en: message
    },
    url: actionUrl || "/notifications",
    data: {
      actionUrl: actionUrl || "/notifications",
      deepLink: actionUrl || "/notifications",
      ...(data || {})
    }
  };

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`
      },
      body: JSON.stringify(bodyData)
    });

    const json = await response.json();
    console.log("[ONESIGNAL_RESPONSE]", json);

    if (!response.ok) {
      console.error(`[ONESIGNAL] Push failed for ${normalizedEmail}:`, json);
      return { success: false, error: json };
    }
    console.log(`[ONESIGNAL] Push succeeded for ${normalizedEmail}:`, json);
    return { success: true, result: json };
  } catch (err) {
    console.error(`[ONESIGNAL] Error sending push to ${normalizedEmail}:`, err);
    console.error("[ONESIGNAL_ERROR]", err);
    return { success: false, error: err.message || err };
  }
}

/**
 * Sends a broadcast push notification to all subscribed users.
 *
 * @param {object} payload - The notification content.
 * @param {string} payload.title - The notification title.
 * @param {string} payload.body - The notification body/message.
 * @param {string} [payload.actionUrl] - Optional URL target.
 * @param {object} [payload.data] - Additional custom metadata.
 * @returns {Promise<object>} Result status and payload.
 */
export async function sendOneSignalToAll(payload) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn("[ONESIGNAL] Credentials missing. Bypassing broadcast native push.");
    return { success: false, error: "OneSignal credentials missing" };
  }

  const { title, body, actionUrl, data } = payload;

  const bodyData = {
    app_id: appId,
    headings: { en: title },
    contents: { en: body },
    included_segments: ["Subscribed Users"],
    url: actionUrl || "/notifications",
    data: {
      actionUrl: actionUrl || "/notifications",
      deepLink: actionUrl || "/notifications",
      ...(data || {})
    }
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${apiKey}`
      },
      body: JSON.stringify(bodyData)
    });

    const resJson = await response.json();
    if (!response.ok) {
      console.error("[ONESIGNAL] Broadcast push failed:", resJson);
      return { success: false, error: resJson };
    }
    console.log("[ONESIGNAL] Broadcast push succeeded:", resJson);
    return { success: true, result: resJson };
  } catch (err) {
    console.error("[ONESIGNAL] Error sending broadcast push:", err);
    return { success: false, error: err.message || err };
  }
}
