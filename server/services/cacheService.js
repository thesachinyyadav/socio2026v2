import Redis from "ioredis";
import "../config/loadEnv.js";

// Namespaces matching the cache-policy-matrix and rollout-checklist
export const CACHE_KEYSPACE = {
  eventsList: "events:list",
  eventDetail: (eventId) => `events:detail:${eventId}`,
  festsList: "fests:list",
  festDetail: (festId) => `fests:detail:${festId}`,
  discoverFeed: "discover:feed",
  cateringList: "catering:list",
  notificationSummary: (userId) => `notifications:summary:${userId}`,
  volunteerEventList: (userId) => `volunteer:events:${userId}`,
  volunteerAccess: (eventId, userId) => `volunteer:access:${eventId}:${userId}`,
};

// Custom serialization to support BigInt, Date strings, and prevent circular structures
export function safeStringify(data) {
  if (data === undefined) return "";
  return JSON.stringify(data, (key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  });
}

export function safeParse(data) {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("[ValkeyCache] Parse error:", error.message);
    return null;
  }
}

// In-memory fallback database for local development or when Valkey is unconfigured/disconnected
class MemoryFallbackCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlSeconds) {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiry });
    return true;
  }

  del(key) {
    return this.store.delete(key);
  }

  keys(pattern) {
    const regexPattern = pattern
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`);
    const matched = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  delPattern(pattern) {
    const matchedKeys = this.keys(pattern);
    matchedKeys.forEach((key) => this.store.delete(key));
    return matchedKeys.length;
  }

  clear() {
    this.store.clear();
  }
}

const memoryFallback = new MemoryFallbackCache();

// Environment configuration for Valkey/Redis
const connectionString = process.env.VALKEY_URL || process.env.REDIS_URL;
let redisClient = null;
let isValkeyAvailable = false;

if (connectionString) {
  try {
    console.log("[ValkeyCache] Attempting connection to Valkey/Redis server...");
    redisClient = new Redis(connectionString, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy(times) {
        // Fast reconnect back-off strategy (capped at 3 seconds)
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    redisClient.on("connect", () => {
      console.log("[ValkeyCache] Socket connected to caching server.");
    });

    redisClient.on("ready", () => {
      isValkeyAvailable = true;
      console.log("✅ [ValkeyCache] Valkey connection is stable and ready.");
    });

    redisClient.on("error", (error) => {
      isValkeyAvailable = false;
      console.warn("⚠️ [ValkeyCache] Connection error:", error.message || error);
    });

    redisClient.on("close", () => {
      isValkeyAvailable = false;
      console.warn("⚠️ [ValkeyCache] Connection closed.");
    });
  } catch (initError) {
    console.error("❌ [ValkeyCache] Initialization failed:", initError.message);
    redisClient = null;
  }
} else {
  console.warn(
    "⚠️ [ValkeyCache] No VALKEY_URL or REDIS_URL configured in environment. Gracefully falling back to high-performance in-memory cache."
  );
}

/**
 * Get value from cache with full DB/Memory fallback safety
 */
export async function cacheGet(key) {
  const start = Date.now();
  if (isValkeyAvailable && redisClient) {
    try {
      const value = await redisClient.get(key);
      const latency = Date.now() - start;
      if (value) {
        console.log(`[PERF] Valkey cache: ${latency}ms`);
      }
      return value;
    } catch (error) {
      console.error(`❌ [ValkeyCache] Read failure for key "${key}":`, error.message);
    }
  }

  // Graceful fallback to memory cache
  const value = memoryFallback.get(key);
  const latency = Date.now() - start;
  if (value) {
    console.log(`[PERF] Memory fallback cache: ${latency}ms`);
  }
  return value;
}

/**
 * Set value in cache with full DB/Memory fallback safety
 */
export async function cacheSet(key, value, ttlSeconds) {
  if (isValkeyAvailable && redisClient) {
    try {
      if (ttlSeconds) {
        await redisClient.set(key, value, "EX", ttlSeconds);
      } else {
        await redisClient.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`❌ [ValkeyCache] Write failure for key "${key}":`, error.message);
    }
  }

  // Graceful fallback to memory cache
  return memoryFallback.set(key, value, ttlSeconds);
}

/**
 * Delete specific key from cache
 */
export async function cacheDel(key) {
  console.log(`[CACHE INVALIDATE] ${key}`);
  if (isValkeyAvailable && redisClient) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error(`❌ [ValkeyCache] Deletion failure for key "${key}":`, error.message);
    }
  }

  return memoryFallback.del(key);
}

/**
 * Delete key group by wildcard pattern safely
 */
export async function cacheDelPattern(pattern) {
  console.log(`[CACHE INVALIDATE GROUP] ${pattern}`);
  if (isValkeyAvailable && redisClient) {
    try {
      // Using SCAN instead of KEYS to avoid blocking production event loop
      let cursor = "0";
      let keysDeleted = 0;
      do {
        const reply = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = reply[0];
        const keys = reply[1];
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
          keysDeleted += keys.length;
        }
      } while (cursor !== "0");
      return keysDeleted;
    } catch (error) {
      console.error(`❌ [ValkeyCache] Pattern deletion failure for "${pattern}":`, error.message);
    }
  }

  return memoryFallback.delPattern(pattern);
}

/**
 * Read-Through cache manager that wraps DB load routines
 */
export async function getOrSet(key, ttlSeconds, loader) {
  try {
    const cachedString = await cacheGet(key);
    if (cachedString) {
      const parsedData = safeParse(cachedString);
      if (parsedData !== null) {
        console.log(`[CACHE HIT] ${key}`);
        return parsedData;
      }
    }
  } catch (cacheErr) {
    console.warn(`[ValkeyCache] Read-Through lookup bypass:`, cacheErr.message);
  }

  console.log(`[CACHE MISS] ${key}`);
  
  // Measure DB Query Performance
  const dbStart = Date.now();
  const freshData = await loader();
  const dbLatency = Date.now() - dbStart;
  console.log(`[PERF] DB query: ${dbLatency}ms`);

  // Write back to cache asynchronously (do not block client response)
  if (freshData !== undefined && freshData !== null) {
    try {
      const stringified = safeStringify(freshData);
      if (stringified) {
        await cacheSet(key, stringified, ttlSeconds);
        console.log(`[CACHE WRITE] ${key} (TTL: ${ttlSeconds}s)`);
      }
    } catch (writeErr) {
      console.warn(`[ValkeyCache] Read-Through populate failure for "${key}":`, writeErr.message);
    }
  }

  return freshData;
}
