"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

// ─── Types ──────────────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  event_id?: string;
  event_title?: string;
  user_email?: string;
  is_broadcast: boolean;
  read: boolean;
  created_at: string;
  action_url?: string;
}

interface AdminNotificationsProps {
  authToken: string;
  users: Array<{ email: string; name: string }>;
  events: Array<{ event_id: string; title: string }>;
}

type ComposeMode = "broadcast" | "individual" | "event";

const ITEMS_PER_PAGE = 15;

const TYPE_OPTIONS: { value: NotificationItem["type"]; label: string; color: string }[] = [
  { value: "info", label: "Info", color: "bg-blue-100 text-blue-700" },
  { value: "success", label: "Success", color: "bg-green-100 text-green-700" },
  { value: "warning", label: "Warning", color: "bg-amber-100 text-amber-700" },
  { value: "error", label: "Alert", color: "bg-red-100 text-red-700" },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AdminNotifications({ authToken, users, events }: AdminNotificationsProps) {
  // ── Send UI State ─────────────────────────────────────────────────────────
  const [composeMode, setComposeMode] = useState<ComposeMode>("broadcast");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeType, setComposeType] = useState<NotificationItem["type"]>("info");
  const [composeEventId, setComposeEventId] = useState("");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── History State ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<"all" | "broadcast" | "individual">("all");
  const [historySearch, setHistorySearch] = useState("");

  // ── Quick Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = history.length;
    const broadcasts = history.filter(n => n.is_broadcast).length;
    const individual = total - broadcasts;
    const today = history.filter(n => {
      const d = new Date(n.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, broadcasts, individual, today };
  }, [history]);

  // ── Fetch Notification History ────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      // Fetch broadcast notifications (admin view — see all broadcasts)
      const response = await fetch(`${API_URL}/api/notifications/admin/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.notifications || []);
      } else {
        // Fallback: try fetching without the admin route
        // This uses the standard endpoint — admin sees "all" by fetching broadcasts
        const fallback = await fetch(`${API_URL}/api/notifications?email=admin@system&page=1&limit=200`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (fallback.ok) {
          const data = await fallback.json();
          setHistory(data.notifications || []);
        }
      }
    } catch (error) {
      console.error("Error fetching notification history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Filtered + Paginated History ──────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    let items = history;
    if (historyFilter === "broadcast") items = items.filter(n => n.is_broadcast);
    if (historyFilter === "individual") items = items.filter(n => !n.is_broadcast);
    if (historySearch) {
      const q = historySearch.toLowerCase();
      items = items.filter(
        n => n.title.toLowerCase().includes(q) ||
             n.message.toLowerCase().includes(q) ||
             n.user_email?.toLowerCase().includes(q) ||
             n.event_title?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [history, historyFilter, historySearch]);

  const totalHistoryPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  // ── Recipient autocomplete ────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!recipientSearch) return [];
    const q = recipientSearch.toLowerCase();
    return users.filter(u => u.email.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [users, recipientSearch]);

  // ── Send Notification ─────────────────────────────────────────────────────
  const sendNotification = async () => {
    if (!composeTitle.trim() || !composeMessage.trim()) {
      toast.error("Title and message are required");
      return;
    }

    if (composeMode === "individual" && !composeRecipient) {
      toast.error("Please select a recipient");
      return;
    }

    setIsSending(true);
    try {
      if (composeMode === "broadcast") {
        // Send as broadcast
        const response = await fetch(`${API_URL}/api/notifications/broadcast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: composeTitle,
            message: composeMessage,
            type: composeType,
            event_id: composeEventId || null,
            event_title: composeEventId ? events.find(e => e.event_id === composeEventId)?.title : null,
            action_url: composeEventId ? `/event/${composeEventId}` : null,
          }),
        });

        if (!response.ok) throw new Error("Failed to send broadcast");
        toast.success("Broadcast notification sent to all users!");
      } else if (composeMode === "individual") {
        // Send to specific user
        const response = await fetch(`${API_URL}/api/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: composeTitle,
            message: composeMessage,
            type: composeType,
            user_email: composeRecipient,
            event_id: composeEventId || null,
            event_title: composeEventId ? events.find(e => e.event_id === composeEventId)?.title : null,
            action_url: composeEventId ? `/event/${composeEventId}` : null,
          }),
        });

        if (!response.ok) throw new Error("Failed to send notification");
        toast.success(`Notification sent to ${composeRecipient}`);
      } else if (composeMode === "event") {
        // Send to all users (as broadcast) about a specific event
        if (!composeEventId) {
          toast.error("Please select an event");
          setIsSending(false);
          return;
        }
        const eventTitle = events.find(e => e.event_id === composeEventId)?.title || "";
        const response = await fetch(`${API_URL}/api/notifications/broadcast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: composeTitle || `Update: ${eventTitle}`,
            message: composeMessage,
            type: composeType,
            event_id: composeEventId,
            event_title: eventTitle,
            action_url: `/event/${composeEventId}`,
          }),
        });

        if (!response.ok) throw new Error("Failed to send event notification");
        toast.success("Event notification broadcast to all users!");
      }

      // Reset form
      setComposeTitle("");
      setComposeMessage("");
      setComposeType("info");
      setComposeEventId("");
      setComposeRecipient("");
      setRecipientSearch("");
      setShowComposer(false);
      fetchHistory();
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setIsSending(false);
    }
  };

  // ── Quick Templates ───────────────────────────────────────────────────────
  const templates = [
    { title: "System Maintenance", message: "Scheduled maintenance will occur. Some features may be temporarily unavailable.", type: "warning" as const },
    { title: "Welcome!", message: "Welcome to SOCIO! Explore events, register, and connect with your campus community.", type: "success" as const },
    { title: "New Feature", message: "We've added new features! Check out the latest updates in the platform.", type: "info" as const },
    { title: "Important Notice", message: "Please review the updated terms and conditions on the platform.", type: "error" as const },
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    setComposeTitle(template.title);
    setComposeMessage(template.message);
    setComposeType(template.type);
  };

  // ── Relative Time ─────────────────────────────────────────────────────────
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "success": return { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-700" };
      case "warning": return { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", text: "text-amber-700" };
      case "error": return { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-700" };
      default: return { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", text: "text-blue-700" };
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Quick Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: stats.total, iconPath: "M22 12h-4l-3 9L9 3l-3 9H2", color: "bg-blue-50 border-blue-200", iconColor: "text-blue-500" },
          { label: "Broadcasts", value: stats.broadcasts, iconPath: "m3 11 18-5v12L3 13v-2z", color: "bg-purple-50 border-purple-200", iconColor: "text-purple-500" },
          { label: "Individual", value: stats.individual, iconPath: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", color: "bg-green-50 border-green-200", iconColor: "text-green-500" },
          { label: "Sent Today", value: stats.today, iconPath: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", color: "bg-amber-50 border-amber-200", iconColor: "text-amber-500" },
        ].map((s, i) => (
          <div key={i} className={`${s.color} border rounded-xl p-4 flex items-center gap-3`}>
            <svg className={`w-6 h-6 ${s.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={s.iconPath} />{s.label === "Individual" && <circle cx="12" cy="7" r="4" />}</svg>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Compose Button ────────────────────────────────────────────────── */}
      {!showComposer && (
        <button
          onClick={() => setShowComposer(true)}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#154CB3] text-white font-semibold rounded-xl hover:bg-[#0e3a8a] transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Compose Notification
        </button>
      )}

      {/* ── Composer ──────────────────────────────────────────────────────── */}
      {showComposer && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900">Compose Notification</h3>
            <button
              onClick={() => setShowComposer(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Send To</label>
              <div className="flex gap-2">
                {([
                  { id: "broadcast", label: "All Users", path: "m3 11 18-5v12L3 13v-2z" },
                  { id: "individual", label: "Specific User", path: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" },
                  { id: "event", label: "Event Update", path: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6" },
                ] as { id: ComposeMode; label: string; path: string }[]).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setComposeMode(mode.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      composeMode === mode.id
                        ? "bg-[#154CB3] text-white border-[#154CB3]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={mode.path} />{mode.id === "individual" && <circle cx="12" cy="7" r="4" />}</svg>
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient (individual mode) */}
            {composeMode === "individual" && (
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Recipient</label>
                {composeRecipient ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm font-medium text-[#154CB3]">{composeRecipient}</span>
                    <button onClick={() => { setComposeRecipient(""); setRecipientSearch(""); }} className="ml-auto text-gray-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search users by email or name..."
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3]"
                    />
                    {filteredUsers.length > 0 && recipientSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredUsers.map(u => (
                          <button
                            key={u.email}
                            onClick={() => { setComposeRecipient(u.email); setRecipientSearch(""); }}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Event (event mode or optional link) */}
            {(composeMode === "event" || composeMode === "broadcast") && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  {composeMode === "event" ? "Select Event *" : "Link to Event (optional)"}
                </label>
                <select
                  value={composeEventId}
                  onChange={e => setComposeEventId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3]"
                >
                  <option value="">— No event —</option>
                  {events.map(e => (
                    <option key={e.event_id} value={e.event_id}>{e.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Notification Type</label>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setComposeType(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      composeType === opt.value
                        ? `${opt.color} border-current`
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Title *</label>
              <input
                type="text"
                placeholder="Notification title..."
                value={composeTitle}
                onChange={e => setComposeTitle(e.target.value)}
                maxLength={100}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3]"
              />
              <p className="text-[10px] text-gray-400 mt-1">{composeTitle.length}/100</p>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Message *</label>
              <textarea
                placeholder="Write your notification message..."
                value={composeMessage}
                onChange={e => setComposeMessage(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">{composeMessage.length}/500</p>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Quick Templates</label>
              <div className="flex flex-wrap gap-2">
                {templates.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(t)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {(composeTitle || composeMessage) && (
              <div className={`p-4 rounded-lg border ${getTypeConfig(composeType).bg} ${getTypeConfig(composeType).border}`}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Preview</p>
                <p className={`text-sm font-bold ${getTypeConfig(composeType).text}`}>{composeTitle || "(No title)"}</p>
                <p className="text-xs text-gray-600 mt-1">{composeMessage || "(No message)"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2 h-2 rounded-full ${getTypeConfig(composeType).dot}`} />
                  <span className="text-[10px] text-gray-400 capitalize">{composeType}</span>
                  <span className="text-[10px] text-gray-400">• {composeMode === "broadcast" ? "All users" : composeMode === "individual" ? composeRecipient || "—" : "Event update"}</span>
                </div>
              </div>
            )}

            {/* Confirmation disclaimer */}
            {showConfirm && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Are you sure you want to broadcast this notification to {composeMode === "individual" ? composeRecipient : "everyone"}?
                    </p>
                    <p className="text-xs text-amber-600 mt-1">This action cannot be undone. {composeMode !== "individual" ? "All users will receive this notification immediately." : "This user will receive the notification immediately."}</p>
                  </div>
                </div>

                {/* Inline preview */}
                <div className="mt-3 bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Preview</p>
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getTypeConfig(composeType).dot}`} />
                    <div>
                      <p className={`text-sm font-bold ${getTypeConfig(composeType).text}`}>{composeTitle || "(No title)"}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{composeMessage || "(No message)"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowConfirm(false); sendNotification(); }}
                    disabled={isSending}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#154CB3] rounded-lg hover:bg-[#0e3a8a] disabled:opacity-50 transition-colors"
                  >
                    {isSending ? "Sending..." : "Yes, Send Now"}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            {!showConfirm && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  if (!composeTitle.trim() || !composeMessage.trim()) {
                    toast.error("Title and message are required");
                    return;
                  }
                  if (composeMode === "individual" && !composeRecipient) {
                    toast.error("Please select a recipient");
                    return;
                  }
                  setShowConfirm(true);
                }}
                disabled={isSending || !composeTitle.trim() || !composeMessage.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#154CB3] text-white font-semibold rounded-lg hover:bg-[#0e3a8a] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Notification
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setComposeTitle("");
                  setComposeMessage("");
                  setComposeType("info");
                  setComposeEventId("");
                  setComposeRecipient("");
                  setRecipientSearch("");
                }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Reset
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notification History ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <h3 className="text-sm font-bold text-gray-900 flex-shrink-0">Notification History</h3>

            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-gray-200 flex-shrink-0">
              {([
                ["all", "All"],
                ["broadcast", "Broadcasts"],
                ["individual", "Individual"],
              ] as [typeof historyFilter, string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => { setHistoryFilter(val); setHistoryPage(1); }}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                    historyFilter === val
                      ? "bg-[#154CB3] text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search notifications..."
                value={historySearch}
                onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3]"
              />
            </div>

            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <svg className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="divide-y divide-gray-50">
          {historyLoading && paginatedHistory.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#154CB3] rounded-full animate-spin" />
            </div>
          ) : paginatedHistory.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
              </svg>
              <p className="text-sm font-medium text-gray-400">No notifications found</p>
              <p className="text-xs text-gray-300 mt-1">
                {historySearch || historyFilter !== "all" ? "Try adjusting your filters" : "Send your first notification above"}
              </p>
            </div>
          ) : (
            paginatedHistory.map(n => {
              const tc = getTypeConfig(n.type);
              return (
                <div key={n.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${tc.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize ${tc.bg} ${tc.text}`}>
                          {n.type}
                        </span>
                        {n.is_broadcast ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-purple-50 text-purple-600">
                            Broadcast
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-gray-100 text-gray-600">
                            To: {n.user_email || "—"}
                          </span>
                        )}
                        {n.event_title && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-blue-50 text-[#154CB3]">
                            {n.event_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalHistoryPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Showing {(historyPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)} of {filteredHistory.length}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setHistoryPage(p => p - 1)}
                disabled={historyPage <= 1}
                className="px-3 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalHistoryPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalHistoryPages <= 5) {
                  pageNum = i + 1;
                } else if (historyPage <= 3) {
                  pageNum = i + 1;
                } else if (historyPage >= totalHistoryPages - 2) {
                  pageNum = totalHistoryPages - 4 + i;
                } else {
                  pageNum = historyPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setHistoryPage(pageNum)}
                    className={`w-7 h-7 text-xs font-medium rounded-md transition-colors ${
                      historyPage === pageNum
                        ? "bg-[#154CB3] text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-white"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setHistoryPage(p => p + 1)}
                disabled={historyPage >= totalHistoryPages}
                className="px-3 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

