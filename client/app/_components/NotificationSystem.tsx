"use client";

import React, { useState, useEffect, memo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  eventId?: string;
  eventTitle?: string;
  read: boolean; // Changed from isRead to read to match backend
  createdAt: string;
  actionUrl?: string;
}

interface NotificationSystemProps {
  className?: string;
}

// OPTIMIZATION: Memoize NotificationSystem to prevent unnecessary re-renders
const NotificationSystemComponent: React.FC<NotificationSystemProps> = ({ 
  className = "" 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { userData, session } = useAuth();

  // OPTIMIZATION: Memoize fetchNotifications with useCallback
  const fetchNotifications = useCallback(async (page = 1, append = false) => {
    if (!session?.access_token || !userData?.email) return;

    setLoading(true);
    try {
      const email = userData.email;
      const response = await fetch(
        `${API_URL}/api/notifications?email=${encodeURIComponent(email)}&page=${page}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newNotifications = data.notifications || [];
        
        if (append) {
          setNotifications(prev => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }
        
        // Use server-provided unread count (accurate across all pages)
        if (data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        } else {
          setUnreadCount(newNotifications.filter((n: Notification) => !n.read).length);
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
  }, [session?.access_token, userData?.email]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications(currentPage + 1, true);
    }
  }, [loading, hasMore, currentPage, fetchNotifications]);

  useEffect(() => {
    if (userData?.email) {
      fetchNotifications();
      // Set up polling for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [userData?.email, fetchNotifications]);

  // OPTIMIZATION: Memoize markAsRead with useCallback
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, [session?.access_token]);

  // OPTIMIZATION: Memoize markAllAsRead with useCallback
  const markAllAsRead = useCallback(async () => {
    if (!session?.access_token || !userData?.email) return;

    try {
      const email = userData.email;
      const response = await fetch(
        `${API_URL}/api/notifications/mark-read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        }
      );

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [session?.access_token, userData?.email]);

  const clearAllNotifications = useCallback(async () => {
    if (!session?.access_token || !userData?.email) return;

    // Optimistically clear UI
    setNotifications([]);
    setUnreadCount(0);
    setCurrentPage(1);
    setTotalPages(1);
    setHasMore(false);

    try {
      await fetch(
        `${API_URL}/api/notifications/clear-all?email=${encodeURIComponent(userData.email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    } catch (error) {
      console.error("Error clearing notifications:", error);
      // Refetch on failure to restore
      fetchNotifications();
    }
  }, [session?.access_token, userData?.email, fetchNotifications]);

  const deleteNotification = async (notificationId: string) => {
    if (!session?.access_token) return;

    // Optimistically remove from UI immediately
    const removedNotification = notifications.find(n => n.id === notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (removedNotification && !removedNotification.read) {
      setUnreadCount(count => Math.max(0, count - 1));
    }

    try {
      await fetch(
        `${API_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
      // Refetch on failure to restore
      fetchNotifications();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    setIsOpen(false);

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    } else if (notification.eventId) {
      // Fallback: navigate using eventId directly
      // Check if it looks like a fest or event based on notification title
      const isFest = notification.title?.toLowerCase().includes('fest');
      window.location.href = isFest ? `/fest/${notification.eventId}` : `/event/${notification.eventId}`;
    }
  };

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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 0) return "Just now";
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

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
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
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
                      {/* Unread indicator bar */}
                      {!notification.read && (
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[#154CB3] rounded-r-full" />
                      )}
                      
                      <div className="flex items-start gap-3.5">
                        {/* Icon with background circle */}
                        <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-[13px] leading-snug ${
                              !notification.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"
                            }`}>
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
                    {loading ? 'Loading...' : 'Load more →'}
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
      headers: {
        "Content-Type": "application/json",
      },
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

    if (!response.ok) {
      throw new Error("Failed to send notifications");
    }
  } catch (error) {
    console.error("Error creating event notifications:", error);
  }
};

// OPTIMIZATION: Export memoized component
export const NotificationSystem = memo(NotificationSystemComponent);
export default NotificationSystem;
