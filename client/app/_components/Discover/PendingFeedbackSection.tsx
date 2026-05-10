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
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("feedback_widget_dismissed")) {
      setDismissed(true);
      setLoaded(true);
      return;
    }

    if (!userData?.email || !session?.access_token) return;

    const token = session.access_token;

    fetch(
      `/api/notifications?email=${encodeURIComponent(userData.email)}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const notifs: any[] = Array.isArray(data?.notifications) ? data.notifications : [];
        const feedbackNotifs = notifs.filter((n) => n.type === "feedback_form" && n.eventId);

        if (feedbackNotifs.length === 0) {
          setItems([]);
          return;
        }

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

  const dismiss = () => {
    sessionStorage.setItem("feedback_widget_dismissed", "1");
    setDismissed(true);
  };

  if (!loaded || items.length === 0 || dismissed) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 w-72 max-w-[calc(100vw-3rem)]">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 bg-[#18181b] border border-[#27272a] text-white px-4 py-2.5 rounded-xl shadow-2xl hover:bg-[#232326] transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          <span className="text-xs font-medium text-gray-200">
            {items.length} feedback pending
          </span>
        </button>
      ) : (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-[10px] font-bold bg-violet-600 text-white px-2.5 py-1 rounded-full tracking-widest uppercase">
              {items.length} PENDING
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                title="Minimize"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={dismiss}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                title="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pb-3 pt-1">
            <p className="text-sm font-semibold text-white mb-0.5">Share your experience</p>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
              You attended {items.length === 1 ? "an event" : `${items.length} events`} — your feedback helps others discover what&apos;s worth going to.
            </p>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 bg-white/5 hover:bg-white/8 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="text-[11px] text-gray-300 truncate flex-1 leading-tight">
                    {item.eventTitle}
                  </span>
                  <Link
                    href={item.actionUrl}
                    className="flex-shrink-0 text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
                  >
                    Rate →
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="px-4 pb-4">
            <Link
              href={items[0]?.actionUrl ?? "/"}
              className="block w-full text-center text-xs font-semibold bg-white text-[#18181b] py-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              Give feedback now
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
