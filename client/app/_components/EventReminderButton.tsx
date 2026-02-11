"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// SVG icon components
const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const MegaphoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
  </svg>
);
const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
  </svg>
);
const HeartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

const TEMPLATES = [
  {
    id: "reminder",
    label: "Event Reminder",
    desc: "Remind everyone about the upcoming event",
    icon: MegaphoneIcon,
    preview: (title: string) => `Don't forget — "${title}" is coming up soon! Make sure you're registered.`,
  },
  {
    id: "lastChance",
    label: "Last Chance to Register",
    desc: "Urgency — registrations closing soon",
    icon: ClockIcon,
    preview: (title: string) => `Registrations for "${title}" are closing soon. Don't miss out!`,
  },
  {
    id: "tomorrow",
    label: "Happening Tomorrow",
    desc: "One-day-before reminder",
    icon: CalendarIcon,
    preview: (title: string) => `"${title}" is tomorrow. See you there!`,
  },
  {
    id: "update",
    label: "Event Update",
    desc: "Notify about a change or update",
    icon: InfoIcon,
    preview: (title: string) => `There's been an update regarding "${title}". Check the event page for details.`,
  },
  {
    id: "thankYou",
    label: "Thank You",
    desc: "Post-event gratitude message",
    icon: HeartIcon,
    preview: (title: string) => `Thank you for being part of "${title}"! We hope you had a great experience.`,
  },
];

interface EventReminderButtonProps {
  eventId: string;
  eventTitle: string;
  authToken: string;
}

type Step = "select" | "confirm";

export default function EventReminderButton({ eventId, eventTitle, authToken }: EventReminderButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("select");

  const close = () => {
    setOpen(false);
    setSelected(null);
    setStep("select");
    setJustSent(null);
  };

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
      setTimeout(() => close(), 1500);
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
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold hover:text-amber-700 transition-colors"
        title="Send reminder notification"
      >
        <BellIcon />
        Notify
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
          onClick={close}
          style={{ animation: "reminderFadeIn 150ms ease-out" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "reminderScaleIn 150ms ease-out" }}
          >
            {step === "select" && (
              <>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900">Send Reminder</h3>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    for <strong className="text-gray-700">{eventTitle}</strong>
                  </p>
                </div>

                {/* Template list */}
                <div className="p-4 space-y-2 max-h-[340px] overflow-y-auto">
                  {TEMPLATES.map((tpl) => {
                    const isSelected = selected === tpl.id;
                    const wasSent = justSent === tpl.id;
                    const Icon = tpl.icon;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => setSelected(tpl.id)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                          wasSent
                            ? "border-green-400 bg-green-50"
                            : isSelected
                            ? "border-[#154CB3] bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-[#154CB3] text-white" : "bg-gray-100 text-gray-500"
                          }`}>
                            <Icon />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-gray-900">{tpl.label}</span>
                              {wasSent && (
                                <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                  <CheckIcon /> Sent
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{tpl.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="px-4 py-4 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={close}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selected && setStep("confirm")}
                    disabled={!selected}
                    className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-colors text-sm ${
                      !selected
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#154CB3] text-white hover:bg-[#0e3a8a]"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && selectedTemplate && (
              <>
                {/* Confirmation Header */}
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <WarningIcon />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Confirm Broadcast</h3>
                      <p className="text-xs text-gray-500 mt-0.5">This will be sent to every user on the platform</p>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Message Preview</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[#154CB3] flex-shrink-0 mt-0.5">
                        <BellIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{selectedTemplate.label}: {eventTitle}</p>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          {selectedTemplate.preview(eventTitle)}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-blue-50 text-[#154CB3]">
                            Broadcast
                          </span>
                          <span className="text-[10px] text-gray-400">Just now</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium">
                      Are you sure you want to broadcast this notification to everyone?
                    </p>
                    <p className="text-[11px] text-amber-600 mt-1">
                      This action cannot be undone. All users will receive this notification immediately.
                    </p>
                  </div>
                </div>

                {/* Confirm Actions */}
                <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => setStep("select")}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !!justSent}
                    className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-colors text-sm ${
                      sending || justSent
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#154CB3] text-white hover:bg-[#0e3a8a]"
                    }`}
                  >
                    {sending ? "Sending..." : justSent ? "Sent" : "Yes, Broadcast Now"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes reminderFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes reminderScaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      ` }} />
    </>
  );
}
