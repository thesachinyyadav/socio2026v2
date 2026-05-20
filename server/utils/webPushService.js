import webpush from "web-push";

let vapidConfigured = false;

function initializeVapid() {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:thesocio.blr@gmail.com";

  if (!publicKey || !privateKey) {
    console.error("[PUSH] VAPID keys are missing from environment variables (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    console.log("[PUSH] VAPID successfully initialized.");
    return true;
  } catch (error) {
    console.error("[PUSH] VAPID initialization failed:", error.message || error);
    return false;
  }
}

// Memory-only subscription store
// Key: normalized email (lowercase), Value: Array of subscription objects
const subscriptionStore = new Map();

/**
 * Registers an in-memory push subscription for a user.
 */
export function addSubscription(email, subscription) {
  if (!email || !subscription || !subscription.endpoint) return;
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!subscriptionStore.has(normalizedEmail)) {
    subscriptionStore.set(normalizedEmail, []);
  }
  const userSubs = subscriptionStore.get(normalizedEmail);

  // Prevent duplicate endpoints
  const exists = userSubs.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    userSubs.push(subscription);
    console.log(`[PUSH] Registered in-memory subscription for ${normalizedEmail}. Total endpoints: ${userSubs.length}`);
  } else {
    // Update/refresh existing subscription structure
    const index = userSubs.findIndex(s => s.endpoint === subscription.endpoint);
    userSubs[index] = subscription;
    console.log(`[PUSH] Refreshed in-memory subscription for ${normalizedEmail}.`);
  }
}

/**
 * Unregisters an in-memory push subscription for a user.
 */
export function removeSubscription(email, endpoint) {
  if (!email || !endpoint) return;
  const normalizedEmail = email.toLowerCase().trim();
  
  if (subscriptionStore.has(normalizedEmail)) {
    const userSubs = subscriptionStore.get(normalizedEmail);
    const filtered = userSubs.filter(s => s.endpoint !== endpoint);
    if (filtered.length === 0) {
      subscriptionStore.delete(normalizedEmail);
    } else {
      subscriptionStore.set(normalizedEmail, filtered);
    }
    console.log(`[PUSH] Removed in-memory subscription for ${normalizedEmail}`);
  }
}

/**
 * Gets all registered subscriptions for a user email.
 */
export function getSubscriptionsForEmail(email) {
  if (!email) return [];
  const normalizedEmail = email.toLowerCase().trim();
  return subscriptionStore.get(normalizedEmail) || [];
}

/**
 * Gets all active subscriptions across all users.
 */
export function getAllSubscriptions() {
  const all = [];
  for (const userSubs of subscriptionStore.values()) {
    all.push(...userSubs);
  }
  return all;
}

/**
 * Sends a push notification directly to a browser push subscription.
 * @param {object} payload The notification payload (title, body, route, etc.)
 * @param {object} subscription The VAPID subscription object (endpoint, keys: { p256dh, auth })
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPush(payload, subscription) {
  if (!initializeVapid()) {
    return { success: false, error: "VAPID not initialized" };
  }

  if (!subscription || !subscription.endpoint) {
    console.error("[PUSH] Delivery failed: Invalid or missing subscription details.");
    return { success: false, error: "Invalid subscription" };
  }

  const endpoint = subscription.endpoint;
  console.log(`[PUSH] Delivery started to endpoint: ${endpoint.substring(0, 45)}...`);

  try {
    const stringifiedPayload = JSON.stringify(payload);
    await webpush.sendNotification(subscription, stringifiedPayload, {
      TTL: 60 * 60, // 1 hour Time-To-Live
    });

    console.log(`[PUSH] Delivery success to endpoint: ${endpoint.substring(0, 45)}...`);
    return { success: true };
  } catch (error) {
    console.error(`[PUSH] Delivery failed to endpoint: ${endpoint.substring(0, 45)}... | Error:`, error.message || error);
    
    // Auto-remove invalid/expired subscriptions from our in-memory store
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`[PUSH] Subscription has expired or is invalid (status ${error.statusCode}). Removing from store.`);
      for (const [email, userSubs] of subscriptionStore.entries()) {
        const matchingIndex = userSubs.findIndex(s => s.endpoint === endpoint);
        if (matchingIndex !== -1) {
          userSubs.splice(matchingIndex, 1);
          if (userSubs.length === 0) {
            subscriptionStore.delete(email);
          }
          break;
        }
      }
    }

    return {
      success: false,
      error: error.message || String(error),
      statusCode: error.statusCode,
    };
  }
}

/**
 * Send push notifications to all in-memory subscriptions for a specific user email.
 */
export async function sendPushToEmail(email, payload) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[PUSH] sendPushToEmail started for ${normalizedEmail}`);
    
    const userSubs = getSubscriptionsForEmail(normalizedEmail);
    if (userSubs.length === 0) {
      console.log(`[PUSH] No active subscriptions found for ${normalizedEmail}`);
      return { success: true, sent: 0 };
    }

    let successCount = 0;
    for (const sub of userSubs) {
      if (sub && sub.endpoint) {
        const result = await sendPush(payload, sub);
        if (result.success) {
          successCount++;
        }
      }
    }

    console.log(`[PUSH] sendPushToEmail complete. Sent ${successCount}/${userSubs.length} notifications to ${normalizedEmail}`);
    return { success: true, sent: successCount };
  } catch (err) {
    console.error(`[PUSH] sendPushToEmail error for ${email}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Send push notifications to all users' active in-memory subscriptions.
 */
export async function sendPushToAll(payload) {
  try {
    console.log("[PUSH] sendPushToAll started");
    
    const allSubs = getAllSubscriptions();
    if (allSubs.length === 0) {
      console.log("[PUSH] No active subscriptions in memory for broadcast.");
      return { success: true, sent: 0 };
    }

    let successCount = 0;
    for (const sub of allSubs) {
      if (sub && sub.endpoint) {
        const result = await sendPush(payload, sub);
        if (result.success) {
          successCount++;
        }
      }
    }

    console.log(`[PUSH] sendPushToAll complete. Sent ${successCount}/${allSubs.length} notifications.`);
    return { success: true, sent: successCount };
  } catch (err) {
    console.error("[PUSH] sendPushToAll error:", err);
    return { success: false, error: err.message };
  }
}


