"use client";

import { useEffect } from "react";

export default function ClientInit() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key);
        });
      });
    }

    // Auto-recover from stale chunk errors after a new deployment.
    // When Vercel deploys a new version, old chunk filenames become 404.
    // This listener detects that and does a single hard reload.
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Loading CSS chunk")
      ) {
        // Guard against reload loops — only attempt once per session
        const key = "chunk_reload";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return null;
}
