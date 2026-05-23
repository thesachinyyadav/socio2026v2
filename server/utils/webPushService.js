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

/* ── Android notification icon paths ──────────────────────────────────────────
 * These paths must match the actual files served from /public/icons/
 * The badge must be monochrome (white-on-transparent) at 72×72px.
 */
const ANDROID_ICON  = "/icons/icon-192x192.png";
const ANDROID_BADGE = "/icons/badge-72x72.png";

/**
 * Resolves the web-push TTL based on notification priority.
 *
 * Android delivery priority:
 *   high   → TTL=60s   — Google servers try immediate delivery; drops after 1min if undeliverable
 *   normal → TTL=300s  — Allows up to 5min for Doze-mode batching
 *   low    → TTL=900s  — Background-only, Doze-friendly
 *
 * Keeping TTL SHORT is crucial: a long TTL (e.g. 3600s) tells Google's servers
 * it's fine to hold the push and deliver it hours later when the device wakes —
 * which causes the "sometimes delayed, sometimes instant" symptom on Android.
 */
function resolveTTL(priority) {
  switch ((priority || "normal").toLowerCase()) {
    case "high":    return 60;   // urgent: deadline, approval, alert
    case "normal":  return 300;  // standard activity
    case "low":     return 900;  // background info
    default:        return 300;
  }
}

/**
 * Normalizes and enriches a raw push payload with Android-presentation defaults.
 * This is a non-breaking enrichment: caller-provided values are preserved;
 * missing fields are filled with SOCIO-branded defaults.
 *
 * @param {object} payload Raw payload from a route or utility call
 * @returns {object}       Enriched payload ready for web-push delivery
 */
function buildAndroidPayload(payload) {
  const p = payload || {};
  return {
    // Content
    title:              p.title || "SOCIO",
    body:               p.body  || p.message || "New activity on SOCIO",

    // Branding — always use the proper icon ladder paths
    icon:               p.icon  || ANDROID_ICON,
    badge:              p.badge || ANDROID_BADGE,

    // Optional large image (event banners, etc.)
    image:              p.image || undefined,

    // Identification — used for notification grouping and deduplication
    tag:            p.tag            || p.notificationId || p.id || undefined,
    notificationId: p.notificationId || p.tag            || p.id || undefined,

    // Routing — the path the notification click opens
    actionUrl:      p.actionUrl || p.deepLink || p.route || "/notifications",

    // Classification — used by the SW to choose group tag and vibration pattern
    category:       p.category || p.type || "info",

    // Priority — drives requireInteraction and vibration intensity
    priority:       p.priority || "normal",

    // Timestamp — Android uses this to sort notifications
    timestamp:      p.timestamp || Date.now(),

    // Delivery latency instrumentation — SW logs (Date.now() - sentAt) on receipt
    sentAt:         Date.now(),

    // User identity — forwarded through for analytics/routing in the SW
    userEmail:      p.userEmail || p.email || undefined,

    // Pass-through metadata
    ...(p.metadata ? { metadata: p.metadata } : {}),
  };
}

/**
 * Removes a stale/expired subscription from the in-memory store by endpoint URL.
 * Called automatically when webpush returns 410 or 404.
 */
function purgeStaleEndpoint(endpoint) {
  for (const [email, userSubs] of subscriptionStore.entries()) {
    const idx = userSubs.findIndex(s => s.endpoint === endpoint);
    if (idx !== -1) {
      userSubs.splice(idx, 1);
      if (userSubs.length === 0) subscriptionStore.delete(email);
      console.log(`[PUSH] Purged stale endpoint for ${email} (status 410/404)`);
      break;
    }
  }
}

/**
 * Sends a push notification directly to a browser push subscription.
 *
 * Optimization headers applied on every send:
 *   urgency: "high"  — tells the push server (Google FCM Web Push) to bypass
 *                       Android Doze mode and deliver immediately. This is the
 *                       single most impactful change for Android delivery latency.
 *   topic:           — deduplication key on Google's servers; if two pushes with
 *                       the same topic are queued, only the latest is delivered.
 *   TTL:             — how long Google should hold the push if device is offline.
 *                       Short TTL = faster batching decisions on their side.
 *
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
  const priority = (payload?.priority || "normal").toLowerCase();
  const ttl      = resolveTTL(priority);

  // Derive topic: category-scoped dedup key so Google collapses duplicates
  // on their servers before delivery rather than flooding the device.
  const topic = (payload?.tag || payload?.notificationId || payload?.category || "socio")
    .toString()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 32); // topic header max 32 chars per RFC 8030

  console.log(`[PUSH] Delivery started → endpoint: ${endpoint.substring(0, 50)}... | urgency=high TTL=${ttl} topic=${topic}`);

  // Enrich the payload with Android branding defaults + sentAt timestamp
  const enrichedPayload    = buildAndroidPayload(payload);
  const stringifiedPayload = JSON.stringify(enrichedPayload);

  // Warn if payload approaches the 4KB browser push limit
  const payloadBytes = Buffer.byteLength(stringifiedPayload, "utf8");
  if (payloadBytes > 3072) {
    console.warn(`[PUSH] Payload is ${payloadBytes} bytes — approaching 4KB limit. Consider trimming body/metadata.`);
  }

  const pushOptions = {
    TTL:     ttl,
    urgency: "high",   // CRITICAL: bypasses Android Doze and Chrome background throttling
    topic,             // CRITICAL: Google dedup key — prevents push batching on their servers
  };

  try {
    await webpush.sendNotification(subscription, stringifiedPayload, pushOptions);
    console.log(`[PUSH] Delivery success → endpoint: ${endpoint.substring(0, 50)}...`);
    return { success: true };
  } catch (error) {
    // ── Stale / invalid subscription (permanent) ─────────────────────────────
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`[PUSH] Subscription expired/invalid (status ${error.statusCode}). Purging from store.`);
      purgeStaleEndpoint(endpoint);
      return { success: false, error: error.message, statusCode: error.statusCode, purged: true };
    }

    // ── Rate limited (429) or transient server error (≥500) — retry once ─────
    if (error.statusCode === 429 || error.statusCode >= 500) {
      const retryAfterMs = parseInt(error.headers?.["retry-after"] || "2", 10) * 1000;
      console.warn(`[PUSH] Transient error (status ${error.statusCode}). Retrying in ${retryAfterMs}ms…`);
      await new Promise(r => setTimeout(r, retryAfterMs));
      try {
        await webpush.sendNotification(subscription, stringifiedPayload, pushOptions);
        console.log(`[PUSH] Retry delivery success → endpoint: ${endpoint.substring(0, 50)}...`);
        return { success: true, retried: true };
      } catch (retryError) {
        console.error(`[PUSH] Retry failed → endpoint: ${endpoint.substring(0, 50)}... | Error:`, retryError.message || retryError);
        return { success: false, error: retryError.message, statusCode: retryError.statusCode };
      }
    }

    console.error(`[PUSH] Delivery failed → endpoint: ${endpoint.substring(0, 50)}... | Error:`, error.message || error);
    return {
      success: false,
      error: error.message || String(error),
      statusCode: error.statusCode,
    };
  }
}

/**
 * Send push notifications to all in-memory subscriptions for a specific user email.
 * Uses Promise.allSettled for parallel delivery — avoids N×sequential HTTP calls.
 */
export async function sendPushToEmail(email, payload) {
  if (!email) {
    console.warn("[PUSH] No email supplied to sendPushToEmail. Bypassing Web Push.");
    return { success: false, error: "Email is required" };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log("[WEB_PUSH_EXECUTING]", normalizedEmail);
    console.log(`[PUSH] sendPushToEmail started for ${normalizedEmail}`);
    
    const userSubs = getSubscriptionsForEmail(normalizedEmail);
    if (userSubs.length === 0) {
      console.log(`[PUSH] No active subscriptions found for ${normalizedEmail}`);
      return { success: true, sent: 0 };
    }

    // Parallel delivery — all subscriptions for the user fire simultaneously
    const results = await Promise.allSettled(
      userSubs
        .filter(sub => sub && sub.endpoint)
        .map(sub => sendPush(payload, sub))
    );

    const successCount = results.filter(
      r => r.status === "fulfilled" && r.value?.success
    ).length;

    console.log(`[PUSH] sendPushToEmail complete. Sent ${successCount}/${userSubs.length} notifications to ${normalizedEmail}`);
    return { success: true, sent: successCount };
  } catch (err) {
    console.error(`[PUSH] sendPushToEmail error for ${email}:`, err);
    console.error("[WEB_PUSH_ERROR]", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send push notifications to all users' active in-memory subscriptions.
 * Uses Promise.allSettled for parallel delivery across all subscriptions.
 */
export async function sendPushToAll(payload) {
  try {
    console.log("[PUSH] sendPushToAll started");
    
    const allSubs = getAllSubscriptions();
    if (allSubs.length === 0) {
      console.log("[PUSH] No active subscriptions in memory for broadcast.");
      return { success: true, sent: 0 };
    }

    // Fire all subscriptions in parallel — critical for large subscriber lists
    const results = await Promise.allSettled(
      allSubs
        .filter(sub => sub && sub.endpoint)
        .map(sub => sendPush(payload, sub))
    );

    const successCount = results.filter(
      r => r.status === "fulfilled" && r.value?.success
    ).length;

    console.log(`[PUSH] sendPushToAll complete. Sent ${successCount}/${allSubs.length} notifications.`);
    return { success: true, sent: successCount };
  } catch (err) {
    console.error("[PUSH] sendPushToAll error:", err);
    return { success: false, error: err.message };
  }
}
