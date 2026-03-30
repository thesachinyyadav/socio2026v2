"use client";

import { useEffect } from "react";

export default function ClientInit() {
  useEffect(() => {
    const hasChunkLoadFailure = (message: string) => {
      return (
        message.includes("ChunkLoadError") ||
        message.includes("Loading chunk") ||
        message.includes("Loading CSS chunk") ||
        message.includes("Failed to fetch dynamically imported module")
      );
    };

    const recoverFromChunkFailure = async () => {
      const key = "chunk_reload";
      if (sessionStorage.getItem(key)) {
        return;
      }
      sessionStorage.setItem(key, "1");

      // Clear runtime caches only during a confirmed chunk mismatch recovery.
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((cacheKey) => caches.delete(cacheKey)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      window.location.reload();
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

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
