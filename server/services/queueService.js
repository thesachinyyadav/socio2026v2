import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
// import { executeOneSignalPush } from "../utils/oneSignalProvider.js";
const executeOneSignalPush = async (type, payload) => {
  queueLog.warn(payload?.__reqId, `Push execution bypassed (OneSignal removed, queue requires target subscription)`);
  return { success: true, bypassed: true };
};
import { queueLog } from "../utils/notificationLogger.js";
import "../config/loadEnv.js";

const connectionString = process.env.VALKEY_URL || process.env.REDIS_URL;
// BullMQ workers need a long-lived process. In Vercel serverless, the process
// is killed between invocations, so jobs would queue up forever. Force the
// synchronous fallback path in that environment unless an operator explicitly
// opts in via FORCE_QUEUE_IN_SERVERLESS=1 (e.g. they run a separate worker).
const isServerless = process.env.VERCEL === "1" && process.env.FORCE_QUEUE_IN_SERVERLESS !== "1";

let notificationQueue = null;
let notificationWorker = null;

if (isServerless) {
  console.warn(
    "[ValkeyQueue] Detected Vercel serverless runtime — using synchronous OneSignal calls instead of BullMQ worker (which cannot run in serverless). Set FORCE_QUEUE_IN_SERVERLESS=1 to override."
  );
} else if (connectionString) {
  try {
    const connection = new Redis(connectionString, {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    });

    notificationQueue = new Queue("notifications", { connection });

    notificationWorker = new Worker(
      "notifications",
      async (job) => {
        const { type, payload } = job.data;
        const reqId = payload?.__reqId || job.id;
        queueLog.info(reqId, `Job ${job.id} starting type=${type} attempt=${job.attemptsMade + 1}/${job.opts?.attempts || 1}`);
        const result = await executeOneSignalPush(type, payload);
        queueLog.info(reqId, `Job ${job.id} executed`, result);
        return result;
      },
      {
        connection,
        concurrency: 5,
        limiter: { max: 50, duration: 1000 },
      }
    );

    notificationWorker.on("completed", (job, returnValue) => {
      const reqId = job?.data?.payload?.__reqId || job?.id;
      queueLog.info(reqId, `Job ${job.id} completed type=${job.data?.type}`, returnValue);
    });

    notificationWorker.on("failed", (job, err) => {
      const reqId = job?.data?.payload?.__reqId || job?.id;
      queueLog.error(reqId, `Job ${job?.id} failed type=${job?.data?.type} attempt=${job?.attemptsMade}/${job?.opts?.attempts}: ${err?.message}`);
      if (err?.stack) console.error(err.stack);
    });

    notificationWorker.on("error", (err) => {
      queueLog.error(null, "Worker error", { message: err?.message });
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

export function isQueueReady() {
  return !!notificationQueue;
}

/**
 * Enqueue a notification for asynchronous delivery.
 * @param {string} type 'email' | 'broadcast'
 * @param {object} payload The unified notification payload. Pass payload.__reqId for traceability.
 */
export async function enqueueNotification(type, payload) {
  const reqId = payload?.__reqId;
  if (notificationQueue) {
    const job = await notificationQueue.add(
      type,
      { type, payload },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    queueLog.info(
      reqId,
      `Enqueued job id=${job.id} type=${type} target=${payload?.userEmail || "broadcast"} notif=${payload?.metadata?.notificationId || payload?.id || "n/a"}`
    );
    return { success: true, queued: true, jobId: job.id, reqId };
  }

  queueLog.warn(reqId, `Queue not initialized; executing ${type} push synchronously.`);
  try {
    const result = await executeOneSignalPush(type, payload);
    return { success: true, queued: false, result, reqId };
  } catch (err) {
    queueLog.error(reqId, "Sync fallback push failed", { message: err?.message });
    if (err?.stack) console.error(err.stack);
    return { success: false, queued: false, error: err?.message || String(err), reqId };
  }
}
