"use client";

import { useState, useEffect, useCallback } from "react";
import { campusData } from "../lib/eventFormSchema";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_DISTANCE_KM = 15;

type ModalState = "detecting" | "confirm" | "tooFar" | "denied" | "manual" | "saving" | "error";

interface CampusDetectionModalProps {
  userEmail: string;
  accessToken: string;
  onComplete: (campus: string) => void;
  onDismiss: () => void;
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
  const [selectedCampus, setSelectedCampus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  const detectLocation = useCallback(() => {
    setState("detecting");
    if (!navigator.geolocation) {
      setState("denied");
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
          setState("tooFar");
        }
      },
      () => {
        setState("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

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
          <h3 className="text-xl font-bold text-white mb-1">Set Your Campus</h3>
          <p className="text-blue-100 text-sm">Help us personalise your experience</p>
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
              <div className="flex gap-3">
                <button
                  onClick={() => saveCampus(detectedCampus)}
                  className="flex-1 bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setState("manual")}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
                >
                  Choose Manually
                </button>
              </div>
            </>
          )}

          {/* Too far from any campus */}
          {state === "tooFar" && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
                <svg className="w-8 h-8 text-amber-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-amber-800 font-semibold mb-1">No campus nearby</p>
                <p className="text-amber-700 text-sm">
                  The nearest campus is <strong>{detectedCampus}</strong> ({detectedDistance} km away).
                  Please select your campus manually.
                </p>
              </div>
              <button
                onClick={() => setState("manual")}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Select Campus
              </button>
            </>
          )}

          {/* Geolocation denied / unavailable */}
          {state === "denied" && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-center">
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
                <p className="text-gray-700 font-semibold mb-1">Location unavailable</p>
                <p className="text-gray-500 text-sm">
                  We couldn&apos;t access your location. No worries — you can select your campus manually.
                </p>
              </div>
              <button
                onClick={() => setState("manual")}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Select Campus
              </button>
            </>
          )}

          {/* Manual selection */}
          {state === "manual" && (
            <>
              <p className="text-gray-600 text-sm mb-3 text-center">
                Select the campus you belong to:
              </p>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {campusData.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedCampus(c.name)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedCampus === c.name
                        ? "border-[#154CB3] bg-blue-50 text-[#154CB3] font-semibold"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => selectedCampus && saveCampus(selectedCampus)}
                disabled={!selectedCampus}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Save Campus
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
                onClick={() => setState("manual")}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </>
          )}

          {/* Skip for now — always visible except during saving */}
          {state !== "saving" && (
            <button
              onClick={onDismiss}
              className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
            >
              Remind me later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
