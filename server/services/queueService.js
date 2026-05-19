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
      console.log(`[Queue] Job ${job.id} starting type=${type} attempt=${job.attemptsMade + 1}/${job.opts?.attempts || 1}`);
      const result = await executeOneSignalPush(type, payload);
      console.log(`[Queue] Job ${job.id} executed result:`, JSON.stringify(result));
      return result;
    }, {
      connection,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 1000,
      },
    });

    notificationWorker.on("completed", (job, returnValue) => {
      console.log(`[Queue] Job ${job.id} completed type=${job.data?.type} ->`, JSON.stringify(returnValue));
    });

    notificationWorker.on("failed", (job, err) => {
      console.error(
        `[Queue] Job ${job?.id} failed type=${job?.data?.type} attempt=${job?.attemptsMade}/${job?.opts?.attempts}: ${err?.message}`,
        err?.stack
      );
    });

    notificationWorker.on("error", (err) => {
      console.error("[Queue] Worker error:", err?.message);
    });

    console.log("[ValkeyQueue] BullMQ Notification Queue initialized.");
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
    const job = await notificationQueue.add(type, { type, payload }, {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
    console.log(
      `[Queue] Enqueued job id=${job.id} type=${type} target=${payload?.userEmail || "broadcast"} notif=${payload?.metadata?.notificationId || payload?.id || "n/a"}`
    );
    return { success: true, queued: true, jobId: job.id };
  }

  console.warn(`[Queue Fallback] Queue not initialized; executing ${type} push synchronously.`);
  try {
    const result = await executeOneSignalPush(type, payload);
    return { success: true, queued: false, result };
  } catch (err) {
    console.error("[Queue Fallback] Push failed:", err?.message, err?.stack);
    return { success: false, queued: false, error: err?.message || String(err) };
  }
}
