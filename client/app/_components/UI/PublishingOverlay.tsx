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
          {/* Sisyphus-style animation: person pushes ball up a mountain */}
          <div className="flex justify-center mb-5">
            <div className="relative w-52 h-32">
              <svg viewBox="0 0 210 130" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                {/* Ground */}
                <rect x="0" y="108" width="210" height="22" fill="#f3f4f6" rx="2" />

                {/* Mountain body */}
                <polygon points="8,108 135,18 200,108" fill="#e8eaed" stroke="#d1d5db" strokeWidth="1.5" strokeLinejoin="round" />

                {/* Snow cap */}
                <polygon points="127,28 135,18 143,28" fill="white" opacity="0.7" />

                {/* Flag at peak */}
                <line x1="135" y1="18" x2="135" y2="4" stroke="#063168" strokeWidth="1.5" />
                <polygon points="135,4 149,8 135,12" fill="#FFCC00" />

                {/* Dotted trail on slope */}
                <line x1="22" y1="104" x2="130" y2="22" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="4 3" opacity="0.5" />

                {/* Climb path (hidden) - follows the left slope surface */}
                <path id="climbPath" d="M 22 103 L 126 23" fill="none" stroke="none" />

                {/* Person + Ball group */}
                <g>
                  <animateMotion
                    dur="4s"
                    repeatCount="indefinite"
                    keyPoints="0;0.82;0.82;0"
                    keyTimes="0;0.65;0.8;1"
                    calcMode="linear"
                  >
                    <mpath href="#climbPath" />
                  </animateMotion>

                  {/* Ball (the event/fest being pushed) */}
                  <circle cx="6" cy="-10" r="9" fill="#154CB3" opacity="0.9" />
                  <text x="2" y="-6" fill="white" fontSize="9" fontWeight="bold">
                    {mode === "deleting" ? "x" : mode === "uploading" ? "^" : "!"}
                  </text>

                  {/* Stick figure */}
                  <circle cx="-8" cy="-24" r="3.5" fill="#063168" />
                  <line x1="-8" y1="-20" x2="-8" y2="-8" stroke="#063168" strokeWidth="2" />
                  {/* Arms pushing toward ball */}
                  <line x1="-8" y1="-15" x2="0" y2="-12" stroke="#063168" strokeWidth="1.8" />
                  <line x1="-8" y1="-15" x2="-1" y2="-16" stroke="#063168" strokeWidth="1.8" />
                  {/* Legs walking */}
                  <line x1="-8" y1="-8" x2="-12" y2="0" stroke="#063168" strokeWidth="1.8">
                    <animate attributeName="x2" values="-12;-4;-12" dur="0.5s" repeatCount="indefinite" />
                  </line>
                  <line x1="-8" y1="-8" x2="-4" y2="0" stroke="#063168" strokeWidth="1.8">
                    <animate attributeName="x2" values="-4;-12;-4" dur="0.5s" repeatCount="indefinite" />
                  </line>
                </g>

                {/* Tiny grass tufts at base */}
                <line x1="30" y1="108" x2="28" y2="103" stroke="#a7f3d0" strokeWidth="1.5" opacity="0.6" />
                <line x1="55" y1="108" x2="53" y2="104" stroke="#a7f3d0" strokeWidth="1.5" opacity="0.6" />
                <line x1="170" y1="108" x2="168" y2="103" stroke="#a7f3d0" strokeWidth="1.5" opacity="0.6" />
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
