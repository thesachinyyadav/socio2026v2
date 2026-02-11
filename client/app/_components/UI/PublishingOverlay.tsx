"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type OverlayMode = "publishing" | "updating" | "deleting" | "uploading";

interface PublishingOverlayProps {
  isVisible: boolean;
  mode?: OverlayMode;
  onComplete?: () => void;
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
    "Uploading bits and bytes...",
  ],
};

const titles: Record<OverlayMode, string> = {
  publishing: "Publishing Your Event",
  updating: "Updating Your Event",
  deleting: "Deleting, Hold On",
  uploading: "Uploading Files",
};

const doneMessages: Record<OverlayMode, string> = {
  publishing: "Published! You did it!",
  updating: "Updated successfully!",
  deleting: "All cleaned up!",
  uploading: "Upload complete!",
};

// Path points: bottom-left of slope to peak
const PATH_START = { x: 22, y: 103 };
const PATH_END = { x: 126, y: 23 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function PublishingOverlay({ isVisible, mode = "publishing", onComplete }: PublishingOverlayProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  // phase: "climbing" = normal loop, "sprinting" = rushing to top, "done" = at peak, "fadeout" = fading
  const [phase, setPhase] = useState<"climbing" | "sprinting" | "done" | "fadeout" | "hidden">("hidden");
  // 0..1 position along the climb path
  const [climbT, setClimbT] = useState(0);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const directionRef = useRef<1 | -1>(1); // 1 = going up, -1 = sliding down

  // Normal climb animation loop: go up slowly, slide back, repeat
  const animateClimb = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    setClimbT((prev) => {
      const dir = directionRef.current;
      if (dir === 1) {
        // Climbing up: takes ~3.5s to reach 85%
        const next = prev + delta * 0.24;
        if (next >= 0.85) {
          directionRef.current = -1;
          return 0.85;
        }
        return next;
      } else {
        // Sliding back down: faster, ~0.8s
        const next = prev - delta * 1.1;
        if (next <= 0) {
          directionRef.current = 1;
          return 0;
        }
        return next;
      }
    });

    animRef.current = requestAnimationFrame(animateClimb);
  }, []);

  // Sprint animation: rush from current position to the peak
  const animateSprint = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    setClimbT((prev) => {
      // Sprint speed: reach top in ~0.5s from any position
      const next = prev + delta * 2.2;
      if (next >= 1.0) {
        setPhase("done");
        return 1.0;
      }
      return next;
    });

    animRef.current = requestAnimationFrame(animateSprint);
  }, []);

  // Start climb when visible
  useEffect(() => {
    if (isVisible && phase === "hidden") {
      setPhase("climbing");
      setClimbT(0);
      setProgress(0);
      setMsgIndex(0);
      directionRef.current = 1;
      lastTimeRef.current = 0;
    }
  }, [isVisible, phase]);

  // When isVisible turns false, begin sprinting to the top
  useEffect(() => {
    if (!isVisible && (phase === "climbing" || phase === "sprinting")) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      setPhase("sprinting");
      directionRef.current = 1;
      lastTimeRef.current = 0;
      setProgress(95);
    }
  }, [isVisible, phase]);

  // Run the appropriate animation loop
  useEffect(() => {
    if (phase === "climbing") {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(animateClimb);
    } else if (phase === "sprinting") {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(animateSprint);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [phase, animateClimb, animateSprint]);

  // "Done" phase: hold at peak briefly, fire onComplete, then fade out
  useEffect(() => {
    if (phase === "done") {
      setProgress(100);
      // Fire onComplete so parent can show success modal during our fade
      const completeTimer = setTimeout(() => {
        onCompleteRef.current?.();
      }, 300);
      const fadeTimer = setTimeout(() => setPhase("fadeout"), 600);
      return () => {
        clearTimeout(completeTimer);
        clearTimeout(fadeTimer);
      };
    }
  }, [phase]);

  // Fade out, then fully hide
  useEffect(() => {
    if (phase === "fadeout") {
      const timer = setTimeout(() => {
        setPhase("hidden");
        setClimbT(0);
        setProgress(0);
        setMsgIndex(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Rotate messages while climbing
  useEffect(() => {
    if (phase !== "climbing") return;
    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages[mode].length);
    }, 3000);
    return () => clearInterval(msgInterval);
  }, [phase, mode]);

  // Progress bar ticks while climbing
  useEffect(() => {
    if (phase !== "climbing") return;
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 88 ? 88 : prev + Math.random() * 8 + 2));
    }, 600);
    return () => clearInterval(progressInterval);
  }, [phase]);

  if (phase === "hidden") return null;

  const posX = lerp(PATH_START.x, PATH_END.x, climbT);
  const posY = lerp(PATH_START.y, PATH_END.y, climbT);
  const isSprinting = phase === "sprinting";
  const isDone = phase === "done";
  const legSpeed = isSprinting ? "0.2s" : "0.5s";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      style={{
        opacity: phase === "fadeout" ? 0 : 1,
        transition: "opacity 0.4s ease-out",
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="bg-gradient-to-r from-[#063168] to-[#154CB3] px-6 py-4 text-center">
          <h3 className="text-lg font-bold text-white">
            {isDone ? "Done!" : titles[mode]}
          </h3>
        </div>

        <div className="p-6">
          {/* Mountain animation */}
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
                <polygon points="135,4 149,8 135,12" fill={isDone ? "#22c55e" : "#FFCC00"}>
                  {isDone && (
                    <animate attributeName="fill" values="#FFCC00;#22c55e" dur="0.3s" fill="freeze" />
                  )}
                </polygon>

                {/* Dotted trail on slope */}
                <line x1="22" y1="104" x2="130" y2="22" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="4 3" opacity="0.5" />

                {/* Person + Ball group positioned via JS */}
                {!isDone && (
                  <g transform={`translate(${posX}, ${posY})`}>
                    {/* Ball */}
                    <circle cx="6" cy="-10" r="9" fill="#154CB3" opacity="0.9" />
                    <text x="2" y="-6" fill="white" fontSize="9" fontWeight="bold">
                      {mode === "deleting" ? "x" : mode === "uploading" ? "^" : "!"}
                    </text>

                    {/* Stick figure */}
                    <circle cx="-8" cy="-24" r="3.5" fill="#063168" />
                    <line x1="-8" y1="-20" x2="-8" y2="-8" stroke="#063168" strokeWidth="2" />
                    <line x1="-8" y1="-15" x2="0" y2="-12" stroke="#063168" strokeWidth="1.8" />
                    <line x1="-8" y1="-15" x2="-1" y2="-16" stroke="#063168" strokeWidth="1.8" />
                    <line x1="-8" y1="-8" x2="-12" y2="0" stroke="#063168" strokeWidth="1.8">
                      <animate attributeName="x2" values="-12;-4;-12" dur={legSpeed} repeatCount="indefinite" />
                    </line>
                    <line x1="-8" y1="-8" x2="-4" y2="0" stroke="#063168" strokeWidth="1.8">
                      <animate attributeName="x2" values="-4;-12;-4" dur={legSpeed} repeatCount="indefinite" />
                    </line>
                  </g>
                )}

                {/* Victory pose at peak when done */}
                {isDone && (
                  <g transform="translate(126, 23)">
                    {/* Person standing tall with arms up */}
                    <circle cx="0" cy="-26" r="3.5" fill="#063168" />
                    <line x1="0" y1="-22" x2="0" y2="-10" stroke="#063168" strokeWidth="2" />
                    {/* Arms raised up in victory */}
                    <line x1="0" y1="-18" x2="-7" y2="-26" stroke="#063168" strokeWidth="1.8" />
                    <line x1="0" y1="-18" x2="7" y2="-26" stroke="#063168" strokeWidth="1.8" />
                    {/* Legs standing */}
                    <line x1="0" y1="-10" x2="-4" y2="-2" stroke="#063168" strokeWidth="1.8" />
                    <line x1="0" y1="-10" x2="4" y2="-2" stroke="#063168" strokeWidth="1.8" />
                  </g>
                )}

                {/* Grass tufts */}
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

          {/* Message */}
          <p className="text-sm text-gray-600 text-center font-medium min-h-[20px] transition-opacity duration-300">
            {isDone ? doneMessages[mode] : isSprinting ? "Finishing up..." : messages[mode][msgIndex]}
          </p>

          <p className="text-xs text-gray-400 text-center mt-2">
            {isDone ? "Redirecting you shortly..." : "Please don\u0027t close this page"}
          </p>
        </div>
      </div>
    </div>
  );
}
