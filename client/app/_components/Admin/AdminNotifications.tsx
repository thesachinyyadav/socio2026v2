"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  Send,
  Radio,
  User,
  CalendarDays,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

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
type NotifType = NotificationItem["type"];

const ITEMS_PER_PAGE = 20;

const TYPE_CONFIG: Record<NotifType, { label: string; icon: React.ReactNode; dot: string; badge: string }> = {
  info:    { label: "Info",    icon: <Info className="w-3 h-3" />,          dot: "bg-blue-500",  badge: "bg-blue-50 text-blue-700" },
  success: { label: "Success", icon: <CheckCircle className="w-3 h-3" />,   dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  warning: { label: "Warning", icon: <AlertTriangle className="w-3 h-3" />, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  error:   { label: "Alert",   icon: <AlertCircle className="w-3 h-3" />,   dot: "bg-red-500",   badge: "bg-red-50 text-red-700" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminNotifications({ authToken, users, events }: AdminNotificationsProps) {
  // ── Compose state ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ComposeMode>("broadcast");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState<NotifType>("info");
  const [eventId, setEventId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const recipientRef = useRef<HTMLDivElement>(null);

  // ── History state ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "broadcast" | "individual">("all");
  const [search, setSearch] = useState("");

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = history.length;
    const broadcasts = history.filter(n => n.is_broadcast).length;
    const individual = total - broadcasts;
    const today      = history.filter(n =>
      new Date(n.created_at).toDateString() === new Date().toDateString()
    ).length;
    return { total, broadcasts, individual, today };
  }, [history]);

  // ── Fetch history ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/admin/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.notifications || []);
      } else {
        const fallback = await fetch(
          `${API_URL}/api/notifications?email=admin@system&page=1&limit=200`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        if (fallback.ok) {
          const data = await fallback.json();
          setHistory(data.notifications || []);
        }
      }
    } catch {
      console.error("Failed to load notification history");
    } finally {
      setHistoryLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Filtered + paginated history ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = history;
    if (filter === "broadcast")  items = items.filter(n => n.is_broadcast);
    if (filter === "individual") items = items.filter(n => !n.is_broadcast);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.user_email?.toLowerCase().includes(q) ||
        n.event_title?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [history, filter, search]);

  const totalPages  = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated   = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── Recipient autocomplete ─────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!recipientSearch) return [];
    const q = recipientSearch.toLowerCase();
    return users
      .filter(u => u.email.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, recipientSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (recipientRef.current && !recipientRef.current.contains(e.target as Node)) {
        setRecipientSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setTitle(""); setMessage(""); setNotifType("info");
    setEventId(""); setRecipient(""); setRecipientSearch("");
    setShowConfirm(false);
  };

  const validate = () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return false; }
    if (mode === "individual" && !recipient)  { toast.error("Select a recipient"); return false; }
    if (mode === "event" && !eventId)         { toast.error("Select an event"); return false; }
    return true;
  };

  const sendNotification = async () => {
    if (!validate()) return;
    setIsSending(true);
    try {
      const linkedEvent  = events.find(e => e.event_id === eventId);
      const basePayload  = {
        title: title || (linkedEvent ? `Update: ${linkedEvent.title}` : ""),
        message,
        type: notifType,
        event_id:    eventId    || null,
        event_title: linkedEvent?.title || null,
        action_url:  eventId ? `/event/${eventId}` : null,
      };

      const endpoint = mode === "individual"
        ? `${API_URL}/api/notifications`
        : `${API_URL}/api/notifications/broadcast`;

      const body = mode === "individual"
        ? { ...basePayload, user_email: recipient }
        : basePayload;

      console.log("[AdminNotifications] POST", endpoint, body);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }

      console.log("[AdminNotifications] response", res.status, parsed);

      if (!res.ok) {
        const serverMsg =
          (parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error: unknown }).error === "string")
            ? (parsed as { error: string }).error
            : typeof parsed === "string" && parsed
            ? parsed
            : `HTTP ${res.status}`;
        throw new Error(serverMsg);
      }

      toast.success(mode === "individual" ? `Sent to ${recipient}` : "Broadcast sent");
      resetForm();
      fetchHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[AdminNotifications] send failed:", err);
      toast.error(`Failed to send notification: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const relativeTime = (s: string) => {
    const diff = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
    if (diff < 60)     return "Just now";
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: "Total sent",  value: stats.total,      icon: <Bell className="w-4 h-4" /> },
          { label: "Broadcasts",  value: stats.broadcasts, icon: <Radio className="w-4 h-4" /> },
          { label: "Individual",  value: stats.individual, icon: <User className="w-4 h-4" /> },
          { label: "Today",       value: stats.today,      icon: <CalendarDays className="w-4 h-4" /> },
        ] as const).map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-[#154CB3]/8 text-[#154CB3]">{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main panel ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">

        {/* ── Left: Compose ────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Compose</h3>
          </div>

          <div className="p-5 space-y-4">
            {/* Mode */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Send to</label>
              <div className="flex gap-1.5">
                {([
                  { id: "broadcast",  label: "All users",      icon: <Radio className="w-3.5 h-3.5" /> },
                  { id: "individual", label: "One user",        icon: <User className="w-3.5 h-3.5" /> },
                  { id: "event",      label: "Event update",    icon: <CalendarDays className="w-3.5 h-3.5" /> },
                ] as { id: ComposeMode; label: string; icon: React.ReactNode }[]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                      mode === m.id
                        ? "bg-[#154CB3] text-white border-[#154CB3]"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient */}
            {mode === "individual" && (
              <div ref={recipientRef} className="relative">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Recipient</label>
                {recipient ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                    <span className="flex-1 text-gray-800 font-medium truncate">{recipient}</span>
                    <button onClick={() => setRecipient("")} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search by name or email…"
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
                    />
                    {filteredUsers.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {filteredUsers.map(u => (
                          <button
                            key={u.email}
                            onClick={() => { setRecipient(u.email); setRecipientSearch(""); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-xs font-semibold text-gray-800">{u.name}</p>
                            <p className="text-[11px] text-gray-400">{u.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Event link */}
            {(mode === "event" || mode === "broadcast") && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {mode === "event" ? "Event *" : "Link to event (optional)"}
                </label>
                <select
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3] bg-white"
                >
                  <option value="">— none —</option>
                  {events.map(e => (
                    <option key={e.event_id} value={e.event_id}>{e.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
              <div className="flex gap-1.5">
                {(Object.keys(TYPE_CONFIG) as NotifType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setNotifType(t)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                      notifType === t
                        ? `${TYPE_CONFIG[t].badge} border-current`
                        : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {TYPE_CONFIG[t].icon}
                    {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Title *</label>
                <span className="text-[10px] text-gray-400">{title.length}/100</span>
              </div>
              <input
                type="text"
                placeholder="Notification title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
              />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Message *</label>
                <span className="text-[10px] text-gray-400">{message.length}/500</span>
              </div>
              <textarea
                placeholder="Write your message…"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3] resize-none"
              />
            </div>

            {/* Live preview */}
            {(title || message) && !showConfirm && (
              <div className={`rounded-lg border px-3 py-2.5 ${TYPE_CONFIG[notifType].badge} border-current/20`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-1">Preview</p>
                <p className="text-xs font-bold leading-snug">{title || "—"}</p>
                <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{message || "—"}</p>
              </div>
            )}

            {/* Confirm step */}
            {showConfirm && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-amber-800">
                    Send to {mode === "individual" ? recipient : "all users"}? This can't be undone.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendNotification}
                    disabled={isSending}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#154CB3] rounded-lg hover:bg-[#0e3a8a] disabled:opacity-50 transition-colors"
                  >
                    {isSending ? "Sending…" : "Send now"}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            {!showConfirm && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => validate() && setShowConfirm(true)}
                  disabled={isSending || !title.trim() || !message.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-lg hover:bg-[#0e3a8a] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
                <button
                  onClick={resetForm}
                  className="px-3 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: History ────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* History header */}
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <h3 className="text-sm font-semibold text-gray-800 flex-shrink-0">History</h3>

              {/* Filter pills */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 flex-shrink-0">
                {(["all", "broadcast", "individual"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setPage(1); }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${
                      filter === f ? "bg-[#154CB3] text-white" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3]/30 focus:border-[#154CB3]"
                />
              </div>

              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                title="Refresh"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Notification</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide w-20">Type</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide w-28">Recipient</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide w-20">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyLoading && paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <RefreshCw className="w-5 h-5 mx-auto text-gray-300 animate-spin" />
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <Bell className="w-8 h-8 mx-auto text-gray-200 mb-2" strokeWidth={1.5} />
                      <p className="text-gray-400 font-medium">No notifications</p>
                      <p className="text-gray-300 text-[11px] mt-0.5">
                        {search || filter !== "all" ? "Adjust filters to see more" : "Send one using the composer"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map(n => {
                    const tc = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                    return (
                      <tr key={n.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${tc.dot}`} />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{n.title}</p>
                              <p className="text-gray-400 mt-0.5 line-clamp-1">{n.message}</p>
                              {n.event_title && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#154CB3] text-[10px] font-medium">
                                  {n.event_title}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${tc.badge}`}>
                            {tc.icon}
                            {n.type}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {n.is_broadcast ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-purple-600 font-medium">
                              <Radio className="w-3 h-3" />
                              All
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-500 truncate block max-w-[100px]" title={n.user_email}>
                              {n.user_email || "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-400 whitespace-nowrap">
                          {relativeTime(n.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/60">
              <span className="text-[11px] text-gray-400">
                {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1}
                  className="p-1 rounded-md border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const num = totalPages <= 5 ? i + 1
                    : page <= 3 ? i + 1
                    : page >= totalPages - 2 ? totalPages - 4 + i
                    : page - 2 + i;
                  return (
                    <button
                      key={num}
                      onClick={() => setPage(num)}
                      className={`w-6 h-6 text-[11px] font-semibold rounded-md transition-colors ${
                        page === num ? "bg-[#154CB3] text-white" : "text-gray-500 hover:bg-white border border-gray-200"
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="p-1 rounded-md border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
