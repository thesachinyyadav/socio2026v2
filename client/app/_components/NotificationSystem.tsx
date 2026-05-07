"use client";

import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

// ─── LOCAL STORAGE + COOKIES HELPERS ───────────────────────────────────────

const STORAGE_KEY = "socio_read_notifications";
const DISMISSED_KEY = "socio_dismissed_notifications";

const getReadNotificationsFromStorage = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
};

const getDismissedNotificationsFromStorage = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
};

const addReadNotification = (notificationId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const readIds = getReadNotificationsFromStorage();
    readIds.add(notificationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readIds)));
    document.cookie = `notif_${notificationId}=read; max-age=2592000; path=/`;
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
};

const addDismissedNotification = (notificationId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const dismissedIds = getDismissedNotificationsFromStorage();
    dismissedIds.add(notificationId);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissedIds)));
  } catch (error) {
    console.error("Error saving dismissed notification:", error);
  }
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "feedback_form";
  eventId?: string;
  eventTitle?: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  isBroadcast?: boolean;
}

interface NotificationSystemProps {
  className?: string;
}

// Map a raw Supabase INSERT payload to the Notification shape used by the UI
function mapRawToNotification(raw: Record<string, unknown>): Notification {
  return {
    id: raw.id as string,
    title: raw.title as string,
    message: raw.message as string,
    type: (raw.type as Notification["type"]) || "info",
    eventId: (raw.event_id as string) || undefined,
    eventTitle: (raw.event_title as string) || undefined,
    read: false,
    createdAt: raw.created_at as string,
    actionUrl: (raw.action_url as string) || undefined,
    isBroadcast: (raw.is_broadcast as boolean) || false,
  };
}

const NotificationSystemComponent: React.FC<NotificationSystemProps> = ({
  className = "",
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { userData, session } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Derived — no separate state needed
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const fetchNotifications = useCallback(
    async (page = 1, append = false) => {
      if (!session?.access_token || !userData?.email) return;

      setLoading(true);
      try {
        const email = userData.email;
        const response = await fetch(
          `/api/notifications?email=${encodeURIComponent(email)}&page=${page}&limit=20`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          const incoming = (data.notifications || []) as Notification[];

          const readIds = getReadNotificationsFromStorage();
          const dismissedIds = getDismissedNotificationsFromStorage();

          const filtered = incoming
            .filter((n) => !dismissedIds.has(n.id))
            .map((n) => ({ ...n, read: n.read || readIds.has(n.id) }));

          if (append) {
            setNotifications((prev) => {
              const existingIds = new Set(prev.map((n) => n.id));
              return [...prev, ...filtered.filter((n) => !existingIds.has(n.id))];
            });
          } else {
            setNotifications(filtered);
          }

          setHasMore(data.pagination?.hasMore || false);
          setTotalPages(data.pagination?.totalPages || 1);
          setCurrentPage(page);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    },
    [session?.access_token, userData?.email]
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchNotifications(currentPage + 1, true);
  }, [loading, hasMore, currentPage, fetchNotifications]);

  // ─── REALTIME SUBSCRIPTION (replaces 30-second polling) ──────────────────
  // Requires Realtime enabled on the `notifications` table in Supabase Dashboard.
  useEffect(() => {
    if (!userData?.email) return;

    fetchNotifications();

    const email = userData.email;

    // Handler shared by both individual and broadcast insert events
    const handleInsert = (payload: { new: Record<string, unknown> }) => {
      const newNotif = mapRawToNotification(payload.new);
      const dismissedIds = getDismissedNotificationsFromStorage();
      if (dismissedIds.has(newNotif.id)) return;

      setNotifications((prev) => {
        // Deduplicate in case the initial fetch and realtime fire close together
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
    };

    const channel = supabase
      .channel(`notifications:${email}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_email=eq.${email}`,
        },
        handleInsert
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "is_broadcast=eq.true",
        },
        handleInsert
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData?.email, fetchNotifications]);

  // ─── READ / DISMISS ACTIONS (localStorage-only, no backend round-trips) ──

  const markAsRead = useCallback((notificationId: string) => {
    addReadNotification(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    if (notifications.length === 0) return;
    notifications.forEach((n) => addReadNotification(n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications]);

  const clearAllNotifications = useCallback(() => {
    notifications.forEach((n) => {
      addDismissedNotification(n.id);
      addReadNotification(n.id);
    });

    setNotifications([]);
    setCurrentPage(1);
    setTotalPages(1);
    setHasMore(false);

    // Only need to clean up individual rows from DB (broadcasts are shared rows)
    const hasIndividual = notifications.some((n) => !n.isBroadcast);
    if (session?.access_token && userData?.email && hasIndividual) {
      fetch(
        `/api/notifications/clear-all?email=${encodeURIComponent(userData.email)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      ).catch((err) => console.error("Clear-all backend sync failed:", err));
    }
  }, [notifications, session?.access_token, userData?.email]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      const notif = notifications.find((n) => n.id === notificationId);

      // Optimistically remove from UI and persist locally
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      addDismissedNotification(notificationId);

      if (notif?.isBroadcast) {
        // Broadcasts are shared rows — dismiss locally only, nothing to delete in DB
        return;
      }

      // Individual notifications can be deleted from DB
      if (!session?.access_token) return;
      try {
        const emailParam = userData?.email
          ? `?email=${encodeURIComponent(userData.email)}`
          : "";
        await fetch(`/api/notifications/${notificationId}${emailParam}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch (error) {
        console.error("Error deleting notification:", error);
        fetchNotifications();
      }
    },
    [notifications, session?.access_token, userData?.email, fetchNotifications]
  );

  // ─── NAVIGATION ──────────────────────────────────────────────────────────

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    setIsOpen(false);

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    } else if (notification.eventId) {
      const isFest = notification.title?.toLowerCase().includes("fest");
      window.location.href = isFest
        ? `/fest/${notification.eventId}`
        : `/event/${notification.eventId}`;
    }
  };

  // ─── UI HELPERS ───────────────────────────────────────────────────────────

  const getNotificationIcon = (type: Notification["type"]) => {
    const baseClasses = "w-4 h-4 flex-shrink-0";
    switch (type) {
      case "success":
        return (
          <svg className={`${baseClasses} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "warning":
        return (
          <svg className={`${baseClasses} text-yellow-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case "error":
        return (
          <svg className={`${baseClasses} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "feedback_form":
        return (
          <svg className={`${baseClasses} text-violet-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      default:
        return (
          <svg className={`${baseClasses} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return "";
    const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(dateString)
      ? dateString
      : dateString + "Z";
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-[#154CB3] transition-colors rounded-full hover:bg-gray-100"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" role="presentation" onClick={() => setIsOpen(false)} />

          {/* Notification Panel */}
          <div className="absolute right-0 top-full mt-3 w-[340px] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100/80 z-20 max-h-[34rem] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[15px] font-bold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-[#154CB3] text-white px-2 py-[3px] rounded-full font-semibold leading-none">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-[#154CB3] hover:text-[#0e3a8a] font-semibold transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={clearAllNotifications}
                      className="text-[11px] text-gray-400 hover:text-red-500 font-medium transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-gray-200 border-t-[#154CB3]"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-400">You&apos;re all caught up</p>
                  <p className="text-xs text-gray-300 mt-1">New notifications will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100/80">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`group relative px-5 py-4 cursor-pointer transition-all duration-150 ${
                        !notification.read
                          ? "bg-blue-50/30 hover:bg-blue-50/60"
                          : "hover:bg-gray-50/60"
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {!notification.read && (
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[#154CB3] rounded-r-full" />
                      )}

                      <div className="flex items-start gap-3.5">
                        <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className={`text-[13px] leading-snug ${
                                !notification.read
                                  ? "font-semibold text-gray-900"
                                  : "font-medium text-gray-700"
                              }`}
                            >
                              {notification.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="text-gray-300 hover:text-red-400 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5"
                              title="Dismiss"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center flex-wrap gap-2 mt-2.5">
                            {notification.eventTitle && (
                              <span className="inline-flex items-center text-[11px] text-[#154CB3] bg-blue-50 px-2.5 py-1 rounded-md font-medium">
                                {notification.eventTitle}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400">
                              {formatRelativeTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with pagination */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="text-[11px] text-[#154CB3] hover:text-[#0e3a8a] font-semibold disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Loading..." : "Load more →"}
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-300">End of notifications</span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Utility functions for creating notifications
export const createEventNotification = async (
  eventId: string,
  eventTitle: string,
  type: "created" | "updated" | "cancelled" | "reminder",
  recipientEmails: string[]
) => {
  const messages = {
    created: `New event "${eventTitle}" has been created and is now open for registration.`,
    updated: `Event "${eventTitle}" has been updated. Check the latest details.`,
    cancelled: `Event "${eventTitle}" has been cancelled. Sorry for any inconvenience.`,
    reminder: `Reminder: Event "${eventTitle}" is happening soon. Don't forget to attend!`,
  };
  const titles = {
    created: "New Event Available",
    updated: "Event Updated",
    cancelled: "Event Cancelled",
    reminder: "Event Reminder",
  };
  const notificationTypes = {
    created: "info" as const,
    updated: "warning" as const,
    cancelled: "error" as const,
    reminder: "info" as const,
  };

  try {
    const response = await fetch(`${API_URL}/api/notifications/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titles[type],
        message: messages[type],
        type: notificationTypes[type],
        eventId,
        eventTitle,
        recipientEmails,
        actionUrl: `/event/${eventId}`,
      }),
    });
    if (!response.ok) throw new Error("Failed to send notifications");
  } catch (error) {
    console.error("Error creating event notifications:", error);
  }
};

export const NotificationSystem = memo(NotificationSystemComponent);
export default NotificationSystem;
