"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

interface SendFeedbackButtonProps {
  eventId: string;
  eventTitle: string;
  endDate: string | null;
  feedbackSentAt: string | null;
  authToken: string;
  onSent?: (sentAt: string) => void;
}

export default function SendFeedbackButton({
  eventId,
  eventTitle,
  endDate,
  feedbackSentAt,
  authToken,
  onSent,
}: SendFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [localSentAt, setLocalSentAt] = useState<string | null>(feedbackSentAt);

  const alreadySent = !!localSentAt;

  // Allow sending on the event day or any day after
  const canSend = (() => {
    if (!endDate) return false;
    const endMidnight = new Date(endDate);
    endMidnight.setHours(0, 0, 0, 0);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return endMidnight <= todayMidnight;
  })();

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/feedbacks/${eventId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }

      const data = await res.json();
      const sentAt = data.feedback_sent_at || new Date().toISOString();
      setLocalSentAt(sentAt);
      setOpen(false);
      toast.success(`Feedback form sent to ${data.sent} participant${data.sent !== 1 ? "s" : ""}!`);
      onSent?.(sentAt);
    } catch (err: any) {
      toast.error(err.message || "Failed to send feedback form");
    } finally {
      setSending(false);
    }
  };

  if (alreadySent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium cursor-default">
        <ClipboardIcon />
        Feedback sent
      </span>
    );
  }

  if (!canSend) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-slate-300 font-medium cursor-not-allowed"
        title={endDate ? "Available after the event ends" : "Event has no end date"}
      >
        <ClipboardIcon />
        Feedback
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold hover:text-violet-700 transition-colors"
        title="Send feedback form to all participants"
      >
        <ClipboardIcon />
        Send Feedback
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
            onClick={() => !sending && setOpen(false)}
            style={{ animation: "feedbackFadeIn 150ms ease-out" }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: "feedbackScaleIn 150ms ease-out" }}
            >
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0">
                    <WarningIcon />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Send Feedback Form</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-64">
                      for <strong className="text-gray-700">{eventTitle}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  This will send a feedback notification to every registered participant for this event.
                  They will be asked to rate 5 standard questions on a 1–5 scale.
                </p>
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <p className="text-xs text-violet-700 font-medium">
                    This action can only be performed once per event and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending..." : "Yes, Send Now"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes feedbackFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes feedbackScaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      ` }} />
    </>
  );
}
