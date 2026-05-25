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

  console.log("[ONESIGNAL_SEND_START]", {
    email: normalizedEmail,
    title
  });

  console.log("[ONESIGNAL_ENV]", {
    appId: Boolean(appId),
    apiKey: Boolean(apiKey),
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
    console.log("[ONESIGNAL_HTTP_REQUEST]");
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`
      },
      body: JSON.stringify(bodyData)
    });

    const json = await response.json();
    console.log("[ONESIGNAL_HTTP_RESPONSE]", {
      status: response.status,
      ok: response.ok,
      body: json || null,
    });

    if (!response.ok) {
      console.error(`[ONESIGNAL] Push failed for ${normalizedEmail}:`, json);
      return { success: false, error: json };
    }
    console.log(`[ONESIGNAL] Push succeeded for ${normalizedEmail}:`, json);
    return { success: true, result: json };
  } catch (err) {
    console.error("[ONESIGNAL_ERROR]", err.response?.data || err);
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

  const { title, body, actionUrl, data } = payload;
  const message = body || payload.message || "";

  console.log("[ONESIGNAL_SEND_START]", {
    email: "all_users",
    title
  });

  console.log("[ONESIGNAL_ENV]", {
    appId: Boolean(appId),
    apiKey: Boolean(apiKey),
  });

  if (!appId || !apiKey) {
    console.warn("[ONESIGNAL] Credentials missing. Bypassing broadcast native push.");
    return { success: false, error: "OneSignal credentials missing" };
  }

  const bodyData = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
    included_segments: ["Subscribed Users"],
    target_channel: "push",
    url: actionUrl || "/notifications",
    data: {
      actionUrl: actionUrl || "/notifications",
      deepLink: actionUrl || "/notifications",
      ...(data || {})
    }
  };

  try {
    console.log("[ONESIGNAL_HTTP_REQUEST]");
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${apiKey}`
      },
      body: JSON.stringify(bodyData)
    });

    const resJson = await response.json();
    console.log("[ONESIGNAL_HTTP_RESPONSE]", {
      status: response.status,
      ok: response.ok,
      body: resJson || null,
    });

    if (!response.ok) {
      console.error("[ONESIGNAL] Broadcast push failed:", resJson);
      return { success: false, error: resJson };
    }
    console.log("[ONESIGNAL] Broadcast push succeeded:", resJson);
    return { success: true, result: resJson };
  } catch (err) {
    console.error("[ONESIGNAL_ERROR]", err.response?.data || err);
    return { success: false, error: err.message || err };
  }
}
