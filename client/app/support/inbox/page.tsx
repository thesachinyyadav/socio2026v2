"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "../../_components/Home/Footer";
import LoadingIndicator from "../../_components/UI/LoadingIndicator";
import { useAuth } from "../../../context/AuthContext";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const statusBadgeStyles: Record<string, string> = {
  new: "bg-red-100 text-red-700",
  read: "bg-blue-100 text-blue-700",
  resolving: "bg-yellow-100 text-yellow-700",
  solved: "bg-green-100 text-green-700",
  // Legacy statuses
  handled: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700"
};

const SupportInboxPage = () => {
  const { session, userData, isSupport, isLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!session?.access_token) {
      setError("Missing session token. Please sign in again.");
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/support/messages`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        cache: "no-store"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Unable to load messages.");
      }

      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load messages.";
      setError(message);
    } finally {
      setIsFetching(false);
    }
  }, [session?.access_token]);

  const updateMessageStatus = useCallback(async (messageId: string, newStatus: string) => {
    if (!session?.access_token) {
      setError("Missing session token. Please sign in again.");
      return;
    }

    setUpdatingStatus(messageId);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/support/messages/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Unable to update status.");
      }

      const data = await response.json();
      
      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: data.message?.status || newStatus } 
            : msg
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update status.";
      setError(message);
    } finally {
      setUpdatingStatus(null);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!session) {
      setError("Please sign in to continue.");
      router.push("/auth");
      return;
    }

    if (!isSupport) {
      setError("You do not have permission to view the support inbox.");
      return;
    }

    fetchMessages();
  }, [session, isSupport, isLoading, fetchMessages, router]);

  const filteredMessages = useMemo(() => {
    if (filter === "all") {
      return messages;
    }
    return messages.filter((entry) => (entry.status || "new").toLowerCase() === filter);
  }, [messages, filter]);

  const renderStatusBadge = (status?: string | null) => {
    const normalized = (status || "new").toLowerCase();
    const style = statusBadgeStyles[normalized] || "bg-gray-100 text-gray-600";
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style}`}>
        {normalized.replace(/_/g, " ")}
      </span>
    );
  };

  const formatSource = (source?: string | null) => {
    if (!source) return "contact";
    return source.replace(/_/g, " ");
  };

  const formatTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return "--";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString();
  };

  const hasMessages = filteredMessages.length > 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="container mx-auto px-4 py-6 max-w-6xl flex-1 w-full">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-[#154CB3]">Support Inbox</h1>
            <p className="text-gray-500 text-sm">
              View incoming contact submissions across SOCIO touchpoints.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/support"
              className="flex items-center text-[#063168] hover:underline text-sm"
            >
              ← Back to Support Hub
            </Link>
            <button
              type="button"
              onClick={fetchMessages}
              disabled={isFetching}
              className={`px-4 py-2 rounded-lg text-sm font-medium border border-[#154CB3] text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all ${
                isFetching ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {isFetching && !hasMessages ? (
          <div className="py-16 flex justify-center">
            <LoadingIndicator label="Loading messages" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {hasMessages ? `${filteredMessages.length} message${filteredMessages.length === 1 ? "" : "s"}` : "No messages"}
              </div>
              <div className="flex items-center gap-2">
                {(["all", "new", "read", "resolving", "solved"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter(option)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      filter === option
                        ? "bg-[#154CB3] border-[#154CB3] text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-[#154CB3] hover:text-[#154CB3]"
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {!hasMessages ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16 text-center text-sm text-gray-500">
                No messages match the selected filter yet.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((entry) => (
                  <article key={entry.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                      <div>
                        <h2 className="text-lg font-semibold text-[#063168] flex items-center gap-3">
                          {entry.subject}
                          {renderStatusBadge(entry.status)}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {formatSource(entry.source)} • {formatTimestamp(entry.created_at)}
                        </p>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-gray-800">{entry.name}</span>
                        <br />
                        <a className="text-[#154CB3] hover:underline" href={`mailto:${entry.email}`}>
                          {entry.email}
                        </a>
                      </div>
                    </div>

                    <p className="mt-4 text-gray-700 whitespace-pre-line leading-relaxed">
                      {entry.message}
                    </p>

                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
                      <span className="text-sm text-gray-600 font-medium">Update status:</span>
                      <div className="flex gap-2 flex-wrap">
                        {["new", "read", "resolving", "solved"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateMessageStatus(entry.id, status)}
                            disabled={updatingStatus === entry.id || entry.status === status}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              entry.status === status
                                ? "bg-[#154CB3] border-[#154CB3] text-white"
                                : "bg-white border-gray-200 text-gray-700 hover:border-[#154CB3] hover:text-[#154CB3] hover:bg-blue-50"
                            } ${
                              updatingStatus === entry.id ? "opacity-50 cursor-wait" : ""
                            }`}
                          >
                            {status === "new" && (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>New</span>
                              </>
                            )}
                            {status === "read" && (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>Read</span>
                              </>
                            )}
                            {status === "resolving" && (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Resolving</span>
                              </>
                            )}
                            {status === "solved" && (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Solved</span>
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SupportInboxPage;

