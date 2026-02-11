"use client";

import { useState, useEffect, useCallback } from "react";
import { campusData } from "../lib/eventFormSchema";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_DISTANCE_KM = 15;
const DISMISS_KEY = "campus_modal_dismissed_at";
const DISMISS_HOURS = 12;

type ModalState = "detecting" | "confirm" | "finalConfirm" | "notOnCampus" | "saving" | "error";

interface CampusDetectionModalProps {
  userEmail: string;
  accessToken: string;
  onComplete: (campus: string) => void;
  onDismiss: () => void;
}

/** Check if modal was dismissed less than 12 hours ago */
export function isCampusDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const elapsed = Date.now() - Number(ts);
    return elapsed < DISMISS_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestCampus(lat: number, lng: number) {
  let nearest = campusData[0];
  let minDist = Infinity;
  for (const campus of campusData) {
    const dist = haversineDistance(lat, lng, campus.lat, campus.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = campus;
    }
  }
  return { campus: nearest, distance: minDist };
}

export default function CampusDetectionModal({
  userEmail,
  accessToken,
  onComplete,
  onDismiss,
}: CampusDetectionModalProps) {
  const [state, setState] = useState<ModalState>("detecting");
  const [detectedCampus, setDetectedCampus] = useState<string | null>(null);
  const [detectedDistance, setDetectedDistance] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [copied, setCopied] = useState(false);

  const detectLocation = useCallback(() => {
    setState("detecting");
    setConfirmInput("");
    setCopied(false);
    if (!navigator.geolocation) {
      setState("notOnCampus");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const { campus, distance } = findNearestCampus(latitude, longitude);
        setDetectedCampus(campus.name);
        setDetectedDistance(Math.round(distance * 10) / 10);
        if (distance <= MAX_DISTANCE_KM) {
          setState("confirm");
        } else {
          setState("notOnCampus");
        }
      },
      () => {
        setState("notOnCampus");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  const handleDismiss = () => {
    markDismissed();
    onDismiss();
  };

  const saveCampus = async (campus: string) => {
    setState("saving");
    try {
      const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(userEmail)}/campus`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ campus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save campus");
      }
      onComplete(campus);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setState("error");
    }
  };

  const copyYes = async () => {
    try {
      await navigator.clipboard.writeText("YES");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#063168] to-[#154CB3] p-6 text-center">
          <div className="flex items-center justify-center w-14 h-14 bg-white rounded-full mx-auto mb-3">
            <svg className="w-7 h-7 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            {state === "finalConfirm" ? "Final Confirmation" : "Set Your Campus"}
          </h3>
          <p className="text-blue-100 text-sm">
            {state === "finalConfirm" ? "This action is permanent" : "We need to verify your campus location"}
          </p>
        </div>

        <div className="p-6">
          {/* Detecting */}
          {state === "detecting" && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Detecting your location...</p>
              <p className="text-gray-400 text-sm mt-1">Please allow location access when prompted</p>
            </div>
          )}

          {/* Confirm — detected near a campus */}
          {state === "confirm" && detectedCampus && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-center">
                <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-green-800 font-semibold mb-1">Campus Detected</p>
                <p className="text-green-700 text-lg font-bold">{detectedCampus}</p>
                <p className="text-green-600 text-xs mt-1">{detectedDistance} km away</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span>Your campus will be saved as <strong>{detectedCampus}</strong>. This <strong>cannot be changed</strong> once saved.</span>
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                <p className="text-sm text-red-700 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <span>If the wrong campus is showing, please <strong>dismiss this and try again when you are connected to your campus network</strong>.</span>
                </p>
              </div>

              <button
                onClick={() => setState("finalConfirm")}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors mb-2"
              >
                Yes, This Is My Campus
              </button>
              <button
                onClick={handleDismiss}
                className="w-full border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-3 rounded-lg transition-colors"
              >
                Wrong Campus — I&apos;ll Try On Campus Network
              </button>
            </>
          )}

          {/* Final confirmation — type YES to confirm */}
          {state === "finalConfirm" && detectedCampus && (
            <>
              <div className="text-center mb-5">
                <p className="text-2xl font-extrabold text-[#063168] mb-2">
                  YOUR CAMPUS WILL BE SET TO
                </p>
                <p className="text-2xl font-extrabold text-[#154CB3] mb-3">
                  {detectedCampus.toUpperCase()}
                </p>
                <p className="text-lg font-bold text-red-600">
                  ARE YOU SURE YOU WANT TO GO AHEAD?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This is permanent and cannot be undone.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[#154CB3]">YES</span> to confirm:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="Type YES here"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-center text-lg font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={copyYes}
                    className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-600 flex items-center gap-1.5 shrink-0"
                    title="Copy YES to clipboard"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                        Copy YES
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => saveCampus(detectedCampus)}
                disabled={confirmInput.trim().toUpperCase() !== "YES"}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors mb-2"
              >
                Confirm &amp; Save Permanently
              </button>
              <button
                onClick={() => {
                  setConfirmInput("");
                  setState("confirm");
                }}
                className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
              >
                Go Back
              </button>
            </>
          )}

          {/* Not on campus — too far, denied, or geolocation unavailable */}
          {state === "notOnCampus" && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-center">
                <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <p className="text-gray-700 font-semibold mb-2">You don&apos;t appear to be on campus</p>
                <p className="text-gray-500 text-sm">
                  To set your campus, you need to be physically present at your campus so we can verify your location. Please try again when you&apos;re connected to your campus network.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
                <p className="text-sm text-blue-700 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <span>Make sure location services are enabled and you&apos;re connected to your campus network. You can use the <strong>Detect Campus</strong> button on your profile page anytime.</span>
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Got It, I&apos;ll Try When On Campus
              </button>
            </>
          )}

          {/* Saving */}
          {state === "saving" && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Saving your campus...</p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-red-700 font-semibold mb-1">Something went wrong</p>
                <p className="text-red-600 text-sm">{errorMsg}</p>
              </div>
              <button
                onClick={() => detectLocation()}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Retry Detection
              </button>
              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
              >
                Try again later
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
