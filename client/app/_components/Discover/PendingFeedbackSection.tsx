"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface FeedbackItem {
  id: string;
  eventId: string;
  eventTitle: string;
  actionUrl: string;
}

export function PendingFeedbackSection() {
  const { userData, session } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userData?.email || !session?.access_token) return;

    const token = session.access_token;

    fetch(
      `/api/notifications?email=${encodeURIComponent(userData.email)}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const notifs: any[] = Array.isArray(data?.notifications) ? data.notifications : [];
        // Include all feedback_form notifications regardless of read status
        const feedbackNotifs = notifs.filter((n) => n.type === "feedback_form" && n.eventId);

        if (feedbackNotifs.length === 0) {
          setItems([]);
          return;
        }

        // Filter out events where feedback was already submitted
        const checks = await Promise.all(
          feedbackNotifs.map((n) =>
            fetch(`/api/feedbacks/${n.eventId}/check`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((r) => (r.ok ? r.json() : { submitted: true, feedback_sent: false }))
              .then((d) => ({ notif: n, pending: !!d.feedback_sent && !d.submitted }))
              .catch(() => ({ notif: n, pending: false }))
          )
        );

        const pending = checks
          .filter((c) => c.pending)
          .map((c) => ({
            id: c.notif.id as string,
            eventId: c.notif.eventId as string,
            eventTitle: (c.notif.eventTitle || c.notif.title?.replace(/^Feedback for\s*/i, "") || "this event") as string,
            actionUrl: (c.notif.actionUrl || `/feedback/${c.notif.eventId}`) as string,
          }));

        setItems(pending);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userData?.email, session?.access_token]);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-violet-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Share your experience</h2>
          <p className="text-xs text-gray-500">
            {items.length} event{items.length !== 1 ? "s" : ""} waiting for your feedback
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-violet-100 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-violet-300 hover:shadow-sm transition-all"
          >
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium mb-0.5">Your feedback is needed</p>
              <p className="text-sm font-bold text-gray-900 truncate">{item.eventTitle}</p>
            </div>
            <Link
              href={item.actionUrl}
              className="flex-shrink-0 px-3 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap"
            >
              Give Feedback →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
