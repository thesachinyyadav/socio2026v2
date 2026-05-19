import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { executeOneSignalPush } from "../utils/oneSignalProvider.js";
import "../config/loadEnv.js";

const connectionString = process.env.VALKEY_URL || process.env.REDIS_URL;

let notificationQueue = null;
let notificationWorker = null;

if (connectionString) {
  try {
    const connection = new Redis(connectionString, {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    });

    notificationQueue = new Queue("notifications", { connection });

    notificationWorker = new Worker("notifications", async (job) => {
      const { type, payload } = job.data;
      await executeOneSignalPush(type, payload);
    }, { 
      connection,
      concurrency: 5, // Process up to 5 pushes concurrently
      limiter: {
        max: 50,
        duration: 1000, // Rate limit for OneSignal API safety
      }
    });

    notificationWorker.on("completed", (job) => {
      console.log(`[Queue] Job ${job.id} completed!`);
    });

    notificationWorker.on("failed", (job, err) => {
      console.error(`[Queue] Job ${job?.id} failed: ${err.message}`);
    });

    console.log("✅ [ValkeyQueue] BullMQ Notification Queue initialized.");
  } catch (err) {
    console.error("❌ [ValkeyQueue] Initialization failed:", err.message);
    notificationQueue = null;
  }
} else {
  console.warn(
    "⚠️ [ValkeyQueue] No VALKEY_URL or REDIS_URL configured. Falling back to synchronous push execution."
  );
}

/**
 * Enqueue a notification for asynchronous delivery.
 * @param {string} type 'email' | 'broadcast'
 * @param {object} payload The unified notification payload
 */
export async function enqueueNotification(type, payload) {
  if (notificationQueue) {
    await notificationQueue.add(type, { type, payload }, {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000, // 2s, 4s, 8s, 16s, 32s
      },
      removeOnComplete: true, // Keep Valkey memory clean
      removeOnFail: false, // Allow manual retry for failed jobs
    });
  } else {
    // Fallback synchronous execution if queue is disabled
    try {
      await executeOneSignalPush(type, payload);
    } catch (err) {
      console.error("[Queue Fallback] Push failed:", err);
    }
  }
}
