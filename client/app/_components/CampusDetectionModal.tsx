"use client";

import { useState, useEffect, useCallback } from "react";
import { campusData } from "../lib/eventFormSchema";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
const MAX_DISTANCE_KM = 15;
const DISMISS_KEY = "campus_modal_dismissed_at";
const DISMISS_HOURS = 12;
const CONFIRM_WORD = "YES";

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
  const [pasted, setPasted] = useState(false);

  const detectLocation = useCallback(() => {
    setState("detecting");
    setConfirmInput("");
    setPasted(false);
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

  const pasteConfirmWord = () => {
    setConfirmInput(CONFIRM_WORD);
    setPasted(true);
    setTimeout(() => setPasted(false), 2000);
  };

  const isConfirmationValid = confirmInput.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#063168] to-[#154CB3] px-6 py-4 text-center">
          <h3 className="text-lg font-bold text-white">
            {state === "finalConfirm" ? "Final Confirmation" : "Set Your Campus"}
          </h3>
        </div>

        <div className="p-5">
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
              <div className="text-center mb-4">
                <p className="text-lg font-bold text-[#063168]">{detectedCampus}</p>
                <p className="text-xs font-semibold text-[#154CB3] mt-0.5">{detectedDistance} km away</p>
              </div>

              <p className="text-sm text-gray-600 text-center mb-4">
                This is <strong>permanent</strong> and cannot be changed. Wrong campus? Dismiss and retry on your campus network.
              </p>

              <button
                onClick={() => {
                  setConfirmInput("");
                  setPasted(false);
                  setState("finalConfirm");
                }}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-2.5 rounded-lg transition-colors mb-2 text-sm"
              >
                Yes, This Is My Campus
              </button>
              <button
                onClick={handleDismiss}
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Wrong Campus — Try Later On Campus
              </button>
            </>
          )}

          {/* Final confirmation — type YES to confirm */}
          {state === "finalConfirm" && detectedCampus && (
            <>
              <div className="text-center mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Final confirmation</p>
                <p className="text-sm font-medium text-gray-600">Campus will be permanently set to</p>
                <p className="text-lg font-bold text-[#063168] mt-0.5">{detectedCampus.toUpperCase()}</p>
              </div>

              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[#154CB3]">{CONFIRM_WORD}</span> below to continue
                  </label>
                  <button
                    onClick={pasteConfirmWord}
                    className="px-2.5 py-1.5 border border-[#154CB3]/30 bg-white rounded-md hover:bg-[#eaf1ff] transition-colors text-xs font-semibold text-[#154CB3] flex items-center gap-1 shrink-0"
                    title="Insert YES in confirmation input"
                  >
                    {pasted ? "Inserted" : "Insert YES"}
                  </button>
                </div>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                  placeholder="Type YES here"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-center text-base font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                  autoFocus
                />

                <p className={`mt-1.5 text-xs font-medium ${isConfirmationValid ? "text-green-600" : "text-gray-500"}`}>
                  {isConfirmationValid ? "Ready to confirm." : `Confirm is enabled when input matches ${CONFIRM_WORD}.`}
                </p>

                {pasted && (
                  <p className="mt-1 text-xs font-medium text-green-600">YES inserted into the input.</p>
                )}
              </div>

              <button
                onClick={() => saveCampus(detectedCampus)}
                disabled={!isConfirmationValid}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors mb-2 text-sm"
              >
                Confirm &amp; Save
              </button>
              <button
                onClick={() => {
                  setConfirmInput("");
                  setPasted(false);
                  setState("confirm");
                }}
                className="w-full text-gray-400 hover:text-gray-600 text-xs py-1.5 transition-colors"
              >
                Go Back
              </button>
            </>
          )}

          {/* Not on campus */}
          {state === "notOnCampus" && (
            <>
              <div className="text-center mb-4">
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <p className="text-gray-700 font-semibold text-sm">Not on campus</p>
                <p className="text-gray-400 text-xs mt-1">
                  Try again when on your campus network. You can use <strong>Detect Campus</strong> on your profile anytime.
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                Got It
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

