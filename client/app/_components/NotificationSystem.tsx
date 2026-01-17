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
        
        setUnreadCount(newNotifications.filter((n: Notification) => !n.read).length);
        setHasMore(data.pagination?.hasMore || false);
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

  const deleteNotification = async (notificationId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications(prev => {
          const notification = prev.find(n => n.id === notificationId);
          const newNotifications = prev.filter(n => n.id !== notificationId);
          if (notification && !notification.read) {
            setUnreadCount(count => Math.max(0, count - 1));
          }
          return newNotifications;
        });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
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
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
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
            d="M15 17h5l-5 5v-5zM10.07 14C10.28 14 10.5 14.22 10.5 14.5s-.22.5-.5.5-.5-.22-.5-.5.22-.5.43-.5M12 3a7.5 7.5 0 0 1 7.5 7.5c0 .274-.014.543-.04.81L12 18.5 4.54 11.31c-.026-.267-.04-.536-.04-.81A7.5 7.5 0 0 1 12 3z"
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
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-[#154CB3] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#154CB3]"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM10.07 14C10.28 14 10.5 14.22 10.5 14.5s-.22.5-.5.5-.5-.22-.5-.5.22-.5.43-.5M12 3a7.5 7.5 0 0 1 7.5 7.5c0 .274-.014.543-.04.81L12 18.5 4.54 11.31c-.026-.267-.04-.536-.04-.81A7.5 7.5 0 0 1 12 3z" />
                  </svg>
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? "bg-blue-50" : ""
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${
                              !notification.read ? "text-gray-900" : "text-gray-600"
                            }`}>
                              {notification.title}
                            </p>
                            <div className="flex items-center space-x-2 ml-2">
                              {!notification.read && (
                                <div className="w-2 h-2 bg-[#154CB3] rounded-full"></div>
                              )}
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {formatRelativeTime(notification.createdAt)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                          {notification.eventTitle && (
                            <p className="text-xs text-gray-500 mt-1">
                              Event: {notification.eventTitle}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Load More Button */}
                  {hasMore && (
                    <div className="p-3 text-center border-t border-gray-100">
                      <button
                        onClick={loadMore}
                        disabled={loading}
                        className="text-sm text-[#154CB3] hover:underline disabled:opacity-50"
                      >
                        {loading ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
