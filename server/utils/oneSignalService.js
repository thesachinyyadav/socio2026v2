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
export async function sendOneSignalToEmail(email, notifPayload) {
  const { title, body: rawBody, actionUrl, data: extraDataInput } = notifPayload || {};
  const body = rawBody || notifPayload?.message || "";

  console.log("=================================");
  console.log("[ONESIGNAL SEND START]");
  console.log("EMAIL:", email);
  console.log("TITLE:", title);
  console.log("APP_ID:", process.env.ONESIGNAL_APP_ID);
  console.log(
    "API_KEY_EXISTS:",
    !!process.env.ONESIGNAL_REST_API_KEY
  );
  console.log("=================================");

  const normalizedEmail = email ? email.trim().toLowerCase() : "";

  const extraData = {
    actionUrl: actionUrl || "/notifications",
    deepLink: actionUrl || "/notifications",
    ...(extraDataInput || {})
  };

  const payload = {
    app_id: process.env.ONESIGNAL_APP_ID,

    include_aliases: {
      external_id: [normalizedEmail]
    },

    target_channel: "push",

    headings: {
      en: title
    },

    contents: {
      en: body
    },

    data: extraData || {}
  };

  console.log(
    "[ONESIGNAL PAYLOAD]",
    JSON.stringify(payload, null, 2)
  );

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json();

    if (!response.ok) {
      const error = new Error(`Request failed with status code ${response.status}`);
      error.response = {
        status: response.status,
        data: resJson
      };
      throw error;
    }

    console.log(
      "[ONESIGNAL SUCCESS RESPONSE]",
      JSON.stringify(resJson, null, 2)
    );
    return { success: true, result: resJson };
  } catch (error) {
    console.error(
      "[ONESIGNAL ERROR RESPONSE]",
      JSON.stringify(
        error.response?.data || error.message || error,
        null,
        2
      )
    );

    console.error(
      "[ONESIGNAL ERROR STATUS]",
      error.response?.status
    );

    throw error;
  }
}

/**
 * Sends a push notification to a list of users identified by their emails (external_ids).
 *
 * @param {string[]} emails - Array of user email addresses.
 * @param {object} notifPayload - The notification content.
 * @returns {Promise<object>} Result status.
 */
export async function sendOneSignalToEmails(emails, notifPayload) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn("[ONESIGNAL] Credentials missing. Bypassing native push.");
    return { success: false, error: "OneSignal credentials missing" };
  }

  const { title, body: rawBody, actionUrl, data: extraDataInput } = notifPayload || {};
  const body = rawBody || notifPayload?.message || "";

  const extraData = {
    actionUrl: actionUrl || "/notifications",
    deepLink: actionUrl || "/notifications",
    ...(extraDataInput || {})
  };

  const payload = {
    app_id: appId,
    include_aliases: {
      external_id: emails
    },
    target_channel: "push",
    headings: { en: title },
    contents: { en: body },
    data: extraData || {}
  };

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json();

    if (!response.ok) {
      console.error("[ONESIGNAL] Batch delivery failed:", resJson);
      return { success: false, error: resJson };
    }

    return { success: true, result: resJson };
  } catch (error) {
    console.error("[ONESIGNAL] Batch delivery error:", error);
    return { success: false, error: error.message || error };
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

  console.log("[ONESIGNAL_PAYLOAD_BROADCAST]", JSON.stringify(bodyData, null, 2));

  try {
    console.log("[ONESIGNAL_HTTP_REQUEST]", "POST https://api.onesignal.com/notifications");
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
