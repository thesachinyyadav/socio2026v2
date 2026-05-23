import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

for (const envFile of [".env", ".env.local"]) {
  dotenv.config({
    path: path.join(serverRoot, envFile),
    override: false,
  });
}

console.log("[ONESIGNAL_ENV]", {
  hasAppId: !!process.env.ONESIGNAL_APP_ID,
  hasApiKey: !!process.env.ONESIGNAL_REST_API_KEY
});

if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
  throw new Error("CRITICAL ERROR: OneSignal environment variables ONESIGNAL_APP_ID and/or ONESIGNAL_REST_API_KEY are missing from the environment!");
}

// Ensure `fetch` is available in Node (Supabase JS requires global fetch).
// Prefer top-level await so the polyfill is ready before other modules use it.
if (typeof globalThis.fetch === 'undefined') {
  try {
    const { fetch: undiciFetch } = await import('undici');
    globalThis.fetch = undiciFetch;
    console.log('✅ Polyfilled global `fetch` using undici');
  } catch (err) {
    console.warn('⚠️ global `fetch` is not available and `undici` could not be loaded.');
    console.warn('Install `undici` (npm install undici) or upgrade Node to v18+ to provide global fetch.');
  }
}

