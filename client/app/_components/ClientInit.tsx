"use client";

import { useEffect } from "react";

const BUILD_FINGERPRINT_STORAGE_KEY = "socio_build_fingerprint_v1";
const SERVICE_WORKER_CLEANUP_KEY = "socio_sw_cleanup_v1";

const chunkFailurePatterns = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "dynamically imported module",
];

const getCurrentBuildFingerprint = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const scriptSources = Array.from(document.querySelectorAll("script[src]"))
    .map((element) => element.getAttribute("src") || "")
    .filter(Boolean);

  const styleSources = Array.from(document.querySelectorAll("link[href]"))
    .map((element) => element.getAttribute("href") || "")
    .filter(Boolean);

  const candidates = [...scriptSources, ...styleSources];
  for (const source of candidates) {
    const match = source.match(/\/_next\/static\/([^/]+)\//);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const clearRuntimeCaches = async () => {
  if (!("caches" in window)) {
    return;
  }

  const keys = await caches.keys();
  await Promise.all(keys.map((cacheKey) => caches.delete(cacheKey)));
};

const unregisterServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

export default function ClientInit() {
  useEffect(() => {
    // BFCACHE: Detect when page is restored from bfcache and validate build fingerprint
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const currentFingerprint = getCurrentBuildFingerprint();
        const storedFingerprint = localStorage.getItem(BUILD_FINGERPRINT_STORAGE_KEY);
        
        if (currentFingerprint && storedFingerprint && currentFingerprint !== storedFingerprint) {
          localStorage.setItem(BUILD_FINGERPRINT_STORAGE_KEY, currentFingerprint);
          window.location.replace(window.location.href);
        }
      }
    };

    const hasChunkLoadFailure = (message: string) => {
      if (!message) {
        return false;
      }

      return chunkFailurePatterns.some((pattern) => message.includes(pattern));
    };

    const recoverFromChunkFailure = async () => {
      const key = "chunk_reload";
      if (sessionStorage.getItem(key)) {
        return;
      }
      sessionStorage.setItem(key, "1");

      await clearRuntimeCaches();
      await unregisterServiceWorkers();

      // BFCACHE: Use location.replace instead of reload - more bfcache-friendly
      window.location.replace(window.location.href);
    };

    const syncBuildFingerprint = async () => {
      const currentFingerprint = getCurrentBuildFingerprint();
      if (!currentFingerprint) {
        return;
      }

      const storedFingerprint = localStorage.getItem(BUILD_FINGERPRINT_STORAGE_KEY);

      if (!storedFingerprint) {
        localStorage.setItem(BUILD_FINGERPRINT_STORAGE_KEY, currentFingerprint);
      } else if (storedFingerprint !== currentFingerprint) {
        localStorage.setItem(BUILD_FINGERPRINT_STORAGE_KEY, currentFingerprint);
        await clearRuntimeCaches();
        await unregisterServiceWorkers();
        // BFCACHE: Use location.replace for navigation without adding history entry
        window.location.replace(window.location.href);
        return;
      }

      if (!localStorage.getItem(SERVICE_WORKER_CLEANUP_KEY)) {
        await unregisterServiceWorkers();
        localStorage.setItem(SERVICE_WORKER_CLEANUP_KEY, "1");
      }
    };

    const handleError = (event: ErrorEvent) => {
      const message = event.message || "";
      if (hasChunkLoadFailure(message)) {
        void recoverFromChunkFailure();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const reasonMessage =
        typeof reason === "string"
          ? reason
          : typeof reason?.message === "string"
          ? reason.message
          : "";

      if (hasChunkLoadFailure(reasonMessage)) {
        void recoverFromChunkFailure();
      }
    };

    // BFCACHE: Listen for pageshow to handle bfcache restoration
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    void syncBuildFingerprint();

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
