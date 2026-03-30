"use client";

import { useEffect, useState } from "react";

const MOBILE_PROMPT_ACK_KEY = "socio_mobile_prompt_acknowledged";

export default function MobileDetectionRedirect() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile/i;
      const isMobileUA = mobileKeywords.test(userAgent);

      const isSmallScreen = window.innerWidth <= 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      return isMobileUA || (isSmallScreen && hasTouch);
    };

    const updateMobileStatus = () => {
      const hasAcknowledged = sessionStorage.getItem(MOBILE_PROMPT_ACK_KEY) === "1";
      setShowPrompt(checkMobile() && !hasAcknowledged);
      setIsReady(true);
    };

    updateMobileStatus();

    window.addEventListener('resize', updateMobileStatus);
    window.addEventListener('orientationchange', updateMobileStatus);

    return () => {
      window.removeEventListener('resize', updateMobileStatus);
      window.removeEventListener('orientationchange', updateMobileStatus);
    };
  }, []);

  useEffect(() => {
    if (!showPrompt) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPrompt]);

  const acknowledgePrompt = () => {
    sessionStorage.setItem(MOBILE_PROMPT_ACK_KEY, "1");
  };

  const handleDownloadApp = () => {
    acknowledgePrompt();
    const appDownloadUrl = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "/app-download";
    window.location.assign(appDownloadUrl);
  };

  const handleNotNow = () => {
    acknowledgePrompt();
    const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL || "https://thesocio.vercel.app";
    const targetUrl = `${pwaBaseUrl}${window.location.pathname}${window.location.search}`;

    try {
      const parsedTarget = new URL(targetUrl, window.location.origin);
      const sameDestination =
        parsedTarget.origin === window.location.origin &&
        parsedTarget.pathname === window.location.pathname &&
        parsedTarget.search === window.location.search;

      if (sameDestination) {
        setShowPrompt(false);
        return;
      }
    } catch {
      setShowPrompt(false);
      return;
    }

    window.location.assign(targetUrl);
  };

  if (!isReady || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#063168]">
      <div className="relative flex h-full w-full items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#154CB3]/10 text-[#154CB3] sm:h-16 sm:w-16">
            <svg className="h-7 w-7 sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>

          <h2 className="text-2xl font-extrabold text-[#063168] sm:text-3xl">
            Get The Best Mobile Experience
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            Download the SOCIO mobile app for faster access, smoother browsing, and instant updates.
          </p>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={handleDownloadApp}
              className="w-full rounded-xl bg-[#154CB3] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f3d8a] sm:text-base"
            >
              Download Mobile App
            </button>
            <button
              type="button"
              onClick={handleNotNow}
              className="w-full rounded-xl border border-[#154CB3]/25 bg-white px-5 py-3 text-sm font-semibold text-[#154CB3] transition-colors hover:bg-[#154CB3]/5 sm:text-base"
            >
              Not Right Now
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Not Right Now will continue you to mobile web.
          </p>
        </div>
      </div>
    </div>
  );
}
