"use client";

import { useEffect, useState } from "react";

export default function MobileDetectionRedirect() {
  // Start with null to avoid hydration mismatch
  const [showRedirect, setShowRedirect] = useState<boolean | null>(null);

  useEffect(() => {
    // Mobile detection - only redirect on actual mobile devices
    const checkMobile = () => {
      // Check 1: User agent - primary check
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile/i;
      const isMobileUA = mobileKeywords.test(userAgent);
      
      // Check 2: Screen size - only very small screens (tablets excluded)
      const isSmallScreen = window.innerWidth <= 768;
      
      // Check 3: Touch support (only relevant with small screen)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Only consider it mobile if user agent indicates mobile OR small screen with touch
      return isMobileUA || (isSmallScreen && hasTouch);
    };

    const updateMobileStatus = () => {
      const isMobile = checkMobile();
      console.log("Mobile detection:", isMobile, "Width:", window.innerWidth, "UA mobile:", /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile/i.test(navigator.userAgent.toLowerCase()));
      setShowRedirect(isMobile);
    };

    // Run immediately
    updateMobileStatus();

    // Also listen for resize events
    window.addEventListener('resize', updateMobileStatus);
    window.addEventListener('orientationchange', updateMobileStatus);
    
    return () => {
      window.removeEventListener('resize', updateMobileStatus);
      window.removeEventListener('orientationchange', updateMobileStatus);
    };
  }, []);

  const handleRedirect = () => {
    window.location.href = "https://thesocio.vercel.app";
  };

  // During SSR or before check, don't render anything
  if (showRedirect === null) {
    return null;
  }

  // If not mobile, don't show the redirect screen
  if (!showRedirect) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#154CB3] flex items-center justify-center p-6">
      <div className="text-center max-w-md mx-auto">
        {/* Desktop Icon */}
        <div className="mb-8 flex justify-center">
          <svg 
            className="w-20 h-20 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-black text-white mb-6">
          Best on Mobile
        </h1>

        {/* Description */}
        <p className="text-white text-lg mb-2 font-medium">
          This app is designed as a mobile-first experience.
        </p>
        <p className="text-white text-lg mb-8 font-medium">
          For the full desktop site, visit:
        </p>

        {/* Redirect Button */}
        <button
          onClick={handleRedirect}
          className="bg-[#FFCC00] hover:bg-[#FFD700] text-[#063168] font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 mx-auto mb-12"
        >
          <span>socio.christuniversity.in</span>
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* Bottom Text */}
        <div className="flex items-center justify-center gap-2 text-white/90">
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <p className="text-base font-medium">
            Open on your phone for the best experience
          </p>
        </div>
      </div>
    </div>
  );
}
