import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let webpushLib = null;
let webpushInitAttempted = false;

async function getWebPush() {
  if (webpushInitAttempted) return webpushLib;
  webpushInitAttempted = true;

  try {
    const mod = await import("web-push");
    webpushLib = mod.default || mod;

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:thesocio.blr@gmail.com";

    if (!publicKey || !privateKey) {
      console.warn("[push] VAPID keys are missing. Push delivery disabled.");
      return null;
    }

    webpushLib.setVapidDetails(subject, publicKey, privateKey);
    return webpushLib;
  } catch (error) {
    console.warn("[push] web-push package not available. Install with: npm i web-push");
    return null;
  }
}

function normalizeSubscription(input) {
  if (!input || typeof input !== "object") return null;
  const endpoint = input.endpoint;
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    p256dh,
    auth,
    raw: input,
  };
}

export async function savePushSubscription(email, subscription) {
  const normalized = normalizeSubscription(subscription);
  if (!email || !normalized) {
    return { success: false, error: "Invalid email or subscription" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_email: email,
        endpoint: normalized.endpoint,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        subscription: normalized.raw,
        is_active: true,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("[push] save subscription error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function disablePushSubscription(email, endpoint) {
  if (!email || !endpoint) return { success: false, error: "Invalid email or endpoint" };

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("user_email", email)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push] disable subscription error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

async function markSubscriptionInactive(endpoint) {
  if (!endpoint) return;
  await supabase
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("endpoint", endpoint);
}

async function sendToSubscriptions(rows, payload) {
  const webpush = await getWebPush();
  if (!webpush) return { success: false, sent: 0 };
  if (!rows?.length) return { success: true, sent: 0 };

  let sent = 0;
  for (const row of rows) {
    try {
      const subscription = row.subscription || {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        { TTL: 60 * 60 }
      );
      sent += 1;
    } catch (error) {
      const code = Number(error?.statusCode || 0);
      if (code === 404 || code === 410) {
        await markSubscriptionInactive(row.endpoint);
      }
      console.error("[push] send error:", error?.message || error);
    }
  }

  return { success: true, sent };
}

export async function sendPushToEmail(email, payload) {
  if (!email) return { success: false, sent: 0 };

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,subscription")
    .eq("user_email", email)
    .eq("is_active", true);

  if (error) {
    console.error("[push] fetch subscriptions error:", error.message);
    return { success: false, sent: 0 };
  }

  return sendToSubscriptions(data || [], payload);
}

export async function sendPushToAll(payload) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,subscription")
    .eq("is_active", true)
    .limit(2000);

  if (error) {
    console.error("[push] fetch all subscriptions error:", error.message);
    return { success: false, sent: 0 };
  }

  return sendToSubscriptions(data || [], payload);
}
