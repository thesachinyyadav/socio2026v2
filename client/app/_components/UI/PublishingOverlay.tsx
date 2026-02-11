"use client";

import { useEffect, useState } from "react";

type OverlayMode = "publishing" | "updating" | "deleting" | "uploading";

interface PublishingOverlayProps {
  isVisible: boolean;
  mode?: OverlayMode;
}

const messages: Record<OverlayMode, string[]> = {
  publishing: [
    "Pushing your event up the hill...",
    "Almost at the top, hang tight!",
    "Uploading images to the cloud...",
    "Polishing the final details...",
    "Making it look great for everyone...",
  ],
  updating: [
    "Swapping out the old for the new...",
    "Saving your changes, hold on...",
    "Syncing everything up...",
    "Nearly there, just a sec...",
  ],
  deleting: [
    "Packing things up...",
    "Clearing the stage...",
    "Cleaning up after the show...",
    "Almost done tidying up...",
  ],
  uploading: [
    "Beaming your files to the server...",
    "Images are on their way up...",
    "Hold tight, big files need big effort...",
    "Almost there, stay with us...",
  ],
};

const titles: Record<OverlayMode, string> = {
  publishing: "Publishing Your Event",
  updating: "Updating Your Event",
  deleting: "Deleting, Hold On",
  uploading: "Uploading Files",
};

export default function PublishingOverlay({ isVisible, mode = "publishing" }: PublishingOverlayProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setMsgIndex(0);
      setProgress(0);
      return;
    }

    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages[mode].length);
    }, 3000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 8 + 2));
    }, 600);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [isVisible, mode]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="bg-gradient-to-r from-[#063168] to-[#154CB3] px-6 py-4 text-center">
          <h3 className="text-lg font-bold text-white">{titles[mode]}</h3>
        </div>

        <div className="p-6">
          {/* Sisyphus-style animation */}
          <div className="flex justify-center mb-5">
            <div className="relative w-48 h-28">
              {/* Hill */}
              <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                {/* Hill slope */}
                <path d="M 10 110 Q 100 20 190 110" fill="none" stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
                {/* Track line */}
                <path d="M 10 110 Q 100 20 190 110" fill="none" stroke="#dbeafe" strokeWidth="8" strokeLinecap="round" opacity="0.4" />

                {/* Moving person + ball group */}
                <g className="animate-push-uphill">
                  {/* Ball/circle (the "event") */}
                  <circle r="12" fill="#154CB3" opacity="0.9">
                    <animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;0.85;0.85" keyTimes="0;0.8;1">
                      <mpath href="#hillPath" />
                    </animateMotion>
                  </circle>
                  {/* Inner icon on ball */}
                  <g>
                    <animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;0.85;0.85" keyTimes="0;0.8;1">
                      <mpath href="#hillPath" />
                    </animateMotion>
                    <text x="-4" y="4" fill="white" fontSize="10" fontWeight="bold">
                      {mode === "deleting" ? "x" : mode === "uploading" ? "^" : "!"}
                    </text>
                  </g>

                  {/* Stick figure pushing */}
                  <g>
                    <animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;0.85;0.85" keyTimes="0;0.8;1">
                      <mpath href="#personPath" />
                    </animateMotion>
                    {/* Body */}
                    <circle cx="0" cy="-20" r="4" fill="#063168" />
                    <line x1="0" y1="-16" x2="0" y2="-4" stroke="#063168" strokeWidth="2" />
                    {/* Arms pushing forward */}
                    <line x1="0" y1="-12" x2="10" y2="-10" stroke="#063168" strokeWidth="2" />
                    <line x1="0" y1="-12" x2="8" y2="-14" stroke="#063168" strokeWidth="2" />
                    {/* Legs walking */}
                    <line x1="0" y1="-4" x2="-4" y2="4" stroke="#063168" strokeWidth="2">
                      <animate attributeName="x2" values="-4;4;-4" dur="0.6s" repeatCount="indefinite" />
                    </line>
                    <line x1="0" y1="-4" x2="4" y2="4" stroke="#063168" strokeWidth="2">
                      <animate attributeName="x2" values="4;-4;4" dur="0.6s" repeatCount="indefinite" />
                    </line>
                  </g>
                </g>

                {/* Hidden path definitions for animateMotion */}
                <path id="hillPath" d="M 30 105 Q 100 25 175 50" fill="none" stroke="none" />
                <path id="personPath" d="M 12 108 Q 82 28 157 53" fill="none" stroke="none" />
              </svg>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#154CB3] to-[#FFCC00] h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Rotating message */}
          <p className="text-sm text-gray-600 text-center font-medium min-h-[20px] transition-opacity duration-300">
            {messages[mode][msgIndex]}
          </p>

          <p className="text-xs text-gray-400 text-center mt-2">
            Please don&apos;t close this page
          </p>
        </div>
      </div>
    </div>
  );
}
