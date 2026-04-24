"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface ITRequest {
  event_id: string;
  title: string;
  event_date: string | null;
  venue: string | null;
  campus_hosted_at: string | null;
  it_description: string;
  organizing_dept: string | null;
  organizing_school: string | null;
  created_by: string | null;
  created_at: string;
  is_draft: boolean | null;
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function ItDashboard() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const isIt = (userData as any)?.is_it_support;
    const isAdmin = (userData as any)?.is_masteradmin;
    if (userData && !isIt && !isAdmin) { router.replace("/error"); return; }
    if (userData) fetchRequests();
  }, [authLoading, session, userData]);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/events/it-requests`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load IT requests");
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  const campus = (userData as any)?.campus;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#154CB3]">IT Support Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Incoming IT support requests{campus ? ` for ${campus}` : ""}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">💻</div>
            <p className="text-gray-600 font-medium">No IT support requests yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Requests will appear here when organizers submit IT requirements for events at your campus.
            </p>
          </div>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {requests.length} request{requests.length !== 1 ? "s" : ""}
            </p>
            {requests.map((req) => (
              <div
                key={req.event_id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-[#154CB3]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/event/${req.event_id}`}
                        className="font-semibold text-[#154CB3] hover:underline text-base"
                      >
                        {req.title}
                      </Link>
                      {req.is_draft && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium">
                          Draft
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                      {req.event_date && (
                        <span>
                          📅 {new Date(req.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {req.venue && <span>📍 {req.venue}</span>}
                      {req.campus_hosted_at && <span>🏫 {req.campus_hosted_at}</span>}
                      {(req.organizing_dept || req.organizing_school) && (
                        <span>🏛 {req.organizing_dept || req.organizing_school}</span>
                      )}
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">
                        IT Requirements
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{req.it_description}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{timeAgo(req.created_at)}</p>
                    {req.created_by && (
                      <p className="text-xs text-gray-400 mt-0.5">by {req.created_by}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
