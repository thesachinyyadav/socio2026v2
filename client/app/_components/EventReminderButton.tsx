"use client";

import React, { useState } from "react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TEMPLATES = [
  {
    id: "reminder",
    label: "📢 Event Reminder",
    desc: "Remind everyone about the upcoming event",
    preview: (title: string) => `Don't forget — "${title}" is coming up soon! Make sure you're registered.`,
  },
  {
    id: "lastChance",
    label: "⏰ Last Chance to Register",
    desc: "Urgency — registrations closing soon",
    preview: (title: string) => `Registrations for "${title}" are closing soon. Don't miss out!`,
  },
  {
    id: "tomorrow",
    label: "📅 Happening Tomorrow",
    desc: "One-day-before reminder",
    preview: (title: string) => `"${title}" is tomorrow. See you there!`,
  },
  {
    id: "update",
    label: "ℹ️ Event Update",
    desc: "Notify about a change or update",
    preview: (title: string) => `There's been an update regarding "${title}". Check the event page for details.`,
  },
  {
    id: "thankYou",
    label: "🎉 Thank You",
    desc: "Post-event gratitude message",
    preview: (title: string) => `Thank you for being part of "${title}"! We hope you had a great experience.`,
  },
];

interface EventReminderButtonProps {
  eventId: string;
  eventTitle: string;
  authToken: string;
}

export default function EventReminderButton({ eventId, eventTitle, authToken }: EventReminderButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<string | null>(null);

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/event-reminder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ event_id: eventId, template: selected }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }

      toast.success("Reminder sent to all users!");
      setJustSent(selected);
      setTimeout(() => {
        setOpen(false);
        setSelected(null);
        setJustSent(null);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = TEMPLATES.find((t) => t.id === selected);

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-sm text-amber-600 font-semibold hover:underline"
        title="Send reminder notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        Notify
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setOpen(false); setSelected(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Send Reminder</h3>
              <p className="text-sm text-gray-500 mt-1 truncate">
                for <strong>{eventTitle}</strong>
              </p>
            </div>

            {/* Template list */}
            <div className="p-4 space-y-2 max-h-[340px] overflow-y-auto">
              {TEMPLATES.map((tpl) => {
                const isSelected = selected === tpl.id;
                const wasSent = justSent === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelected(tpl.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      wasSent
                        ? "border-green-400 bg-green-50"
                        : isSelected
                        ? "border-[#154CB3] bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-gray-900">{tpl.label}</span>
                      {wasSent && (
                        <span className="text-xs font-medium text-green-600">✓ Sent</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            {selectedTemplate && !justSent && (
              <div className="mx-4 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Preview</div>
                <p className="text-sm text-gray-700">{selectedTemplate.preview(eventTitle)}</p>
              </div>
            )}

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setOpen(false); setSelected(null); }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!selected || sending || !!justSent}
                className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-colors text-sm ${
                  !selected || sending || justSent
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[#154CB3] text-white hover:bg-[#154cb3df]"
                }`}
              >
                {sending ? "Sending..." : justSent ? "Sent ✓" : "Send to Everyone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
