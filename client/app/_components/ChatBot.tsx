"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

/* ─── Types ───────────────────────────────────────────── */
interface Message { role: "user" | "assistant"; content: string }
interface QA { question: string; answer: string }
interface UsageInfo { limit: number; used: number; remaining: number }

/* ─── Q&A Data ────────────────────────────────────────── */
const GLOBAL_QA: QA[] = [
  { question: "What is SOCIO?",        answer: "SOCIO is Christ University's platform for discovering, registering, and managing campus events and fests." },
  { question: "Who can use SOCIO?",    answer: "Current students, faculty, and staff with a valid christuniversity.in email. Approved outsiders may also participate." },
  { question: "Is SOCIO free?",        answer: "Yes — browsing and registering for events is completely free." },
  { question: "Where do I start?",     answer: "Head to Discover — it's your main hub for finding upcoming events, fests, and everything happening on campus." },
  { question: "How do I register?",    answer: "Open any event page, click Register, fill in the required details, and submit. Your QR code will be available in your Profile." },
  { question: "Where is my QR code?",  answer: "Go to your Profile and tap QR next to the event you registered for." },
  { question: "How do I get support?", answer: "Use the Support or Contact pages. You can also email thesocio.blr@gmail.com or call +91 88613 30665 (9 AM – 6 PM)." },
  { question: "Is my data safe?",      answer: "Yes. SOCIO never sells your data. You can request deletion by emailing thesocio.blr@gmail.com." },
];

const EVENTS_QA: QA[] = [
  { question: "How do I find events?",  answer: "Use the search bar and category filters on the Events page to narrow down by interest, date, or type." },
  { question: "Is this event free?",    answer: "Check the event card or detail page — the fee is clearly shown. Free events are labeled." },
  { question: "Seats available?",       answer: "Open the event detail page to see capacity and current registration status." },
  { question: "What do I need to bring?", answer: "Your registration confirmation and QR code. Check the event page for any additional requirements." },
];

const EVENT_PAGE_QA: QA[] = [
  { question: "Can I register here?",  answer: "Yes — click Register, sign in if prompted, fill the form, and submit. Check your Profile for confirmation." },
  { question: "Who can join?",         answer: "Eligibility details are listed on this event page — look for department, year, or any participation restrictions." },
  { question: "Can I cancel?",         answer: "You can cancel registration up to 24 hours before the event starts. Use the Cancel Registration button on this page or in your Profile." },
  { question: "What to verify?",       answer: "Date, time, venue, fee, and any special instructions before registering. Keep your QR handy for smooth check-in." },
];

const FESTS_QA: QA[] = [
  { question: "How do I plan a fest?",    answer: "Start with must-attend events, arrange by time and venue to avoid clashes, and register for the ones that close earliest." },
  { question: "How many events per fest?", answer: "Each fest page lists all its events. You can register for as many as your schedule allows." },
  { question: "How do I track my fests?", answer: "Your Profile shows all registered events including fest sub-events, with QR codes and status." },
  { question: "Where are fest dates?",    answer: "Fest opening and closing dates are on the fest detail page." },
];

const PROFILE_QA: QA[] = [
  { question: "How do I see my events?",     answer: "Your registered events are listed in the Registered Events section of your Profile." },
  { question: "How do I check attendance?",  answer: "Attendance updates after your QR is scanned at the venue. Check Profile for the latest status." },
  { question: "Can I cancel a registration?", answer: "Yes — tap the ✕ button next to an upcoming event in your Profile. This is allowed up to 24 hours before the event." },
  { question: "How do I update my name?",    answer: "Name editing is available for visitor/outsider accounts from the Profile page (one-time)." },
];

const MANAGE_QA: QA[] = [
  { question: "How do I publish an event?", answer: "Fill in all required details (title, date, venue, category), save as draft to review, then publish when ready." },
  { question: "Can I edit after publish?",  answer: "Yes — open the event in Manage, make changes, and save. Attendees won't be automatically notified, so use announcements if needed." },
  { question: "How do I take attendance?",  answer: "Use the Attendance tab on the event page — scan attendee QR codes with the camera or enter registration numbers manually." },
  { question: "How do I export data?",      answer: "Use the export option in the event's participant list to download registration and attendance data." },
];

const ADMIN_QA: QA[] = [
  { question: "How do I assign roles?",      answer: "Go to the Roles tab in Masteradmin to assign HOD, Dean, CFO, Campus Director, or Finance Officer roles to users." },
  { question: "How do I manage venues?",     answer: "Use the Venues tab to add, edit, or deactivate venues. You can also view all venue bookings there." },
  { question: "How do I manage users?",      answer: "The Users tab lists all registered users. You can update roles, view profiles, and grant/revoke access." },
  { question: "How do I view analytics?",    answer: "The Dashboard and Reports tabs show event registrations, attendance trends, and campus-wise breakdowns." },
];

function getPageQA(pathname: string, isOrganiser: boolean, isMasterAdmin: boolean): QA[] {
  if (isMasterAdmin || pathname === "/masteradmin") return [...ADMIN_QA, ...MANAGE_QA, ...GLOBAL_QA];
  if (isOrganiser || pathname === "/manage")        return [...MANAGE_QA, ...GLOBAL_QA];
  if (pathname.startsWith("/event/"))               return [...EVENT_PAGE_QA, ...GLOBAL_QA];
  if (pathname === "/events")                       return [...EVENTS_QA, ...GLOBAL_QA];
  if (pathname === "/fests" || pathname.startsWith("/fest/")) return [...FESTS_QA, ...GLOBAL_QA];
  if (pathname === "/profile")                      return [...PROFILE_QA, ...GLOBAL_QA];
  return GLOBAL_QA;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[?.!,;:]+$/, "").replace(/\s+/g, " ").trim();
}

/* ─── Markdown renderer (bold, bullets, line breaks) ─────── */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  const listBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="list-disc pl-4 space-y-0.5 my-1">
        {listBuf.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuf.length = 0;
  };

  for (const line of lines) {
    if (line.startsWith("* ") || line.startsWith("- ")) {
      listBuf.push(line.slice(2));
    } else {
      flushList();
      if (line.trim()) {
        elements.push(<p key={`p-${elements.length}`}>{renderInline(line)}</p>);
      } else if (elements.length > 0) {
        // empty line → small gap (only if not first element)
        elements.push(<div key={`gap-${elements.length}`} className="h-1" />);
      }
    }
  }
  flushList();

  return <>{elements}</>;
}

/* ─── Daily AI usage cache (per-user, 24h rolling window) ────────────
   The visible "N/5 AI chatbot" counter lives in localStorage so it
   decrements on every typed question, survives manual refresh, and
   resets 24h after the first question of the window. The server keeps
   its own hard cap as a backstop; this is the user-facing limiter. */
const AI_DAILY_LIMIT = 5;
const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const USAGE_STORAGE_PREFIX = "socio_ai_usage_v1";

function usageStorageKey(userKey: string) {
  return `${USAGE_STORAGE_PREFIX}:${userKey}`;
}

function emptyUsage(): UsageInfo {
  return { limit: AI_DAILY_LIMIT, used: 0, remaining: AI_DAILY_LIMIT };
}

function toUsage(used: number): UsageInfo {
  const clamped = Math.min(AI_DAILY_LIMIT, Math.max(0, used));
  return { limit: AI_DAILY_LIMIT, used: clamped, remaining: AI_DAILY_LIMIT - clamped };
}

function readUsageRecord(userKey: string): { used: number; windowStart: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(usageStorageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const used = Number(parsed?.used);
    const windowStart = Number(parsed?.windowStart);
    if (!Number.isFinite(used) || !Number.isFinite(windowStart)) return null;
    return { used, windowStart };
  } catch {
    return null;
  }
}

function writeUsageRecord(userKey: string, used: number, windowStart: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(usageStorageKey(userKey), JSON.stringify({ used, windowStart }));
  } catch {
    // ignore quota / availability errors — the cap is best-effort
  }
}

// A window older than 24h is treated as a fresh start.
function isWindowActive(windowStart: number) {
  return Boolean(windowStart) && Date.now() - windowStart < USAGE_WINDOW_MS;
}

function readUsage(userKey: string): UsageInfo {
  const record = readUsageRecord(userKey);
  if (!record || !isWindowActive(record.windowStart)) return emptyUsage();
  return toUsage(record.used);
}

// Count one typed question against the limit and persist it.
function consumeUsage(userKey: string): UsageInfo {
  const record = readUsageRecord(userKey);
  const active = record && isWindowActive(record.windowStart);
  const baseUsed = active ? record!.used : 0;
  const windowStart = active ? record!.windowStart : Date.now();
  if (baseUsed >= AI_DAILY_LIMIT) return toUsage(baseUsed);
  const used = baseUsed + 1;
  writeUsageRecord(userKey, used, windowStart);
  return toUsage(used);
}

// Force the window to exhausted (used when the server reports its own 429).
function exhaustUsage(userKey: string): UsageInfo {
  const record = readUsageRecord(userKey);
  const windowStart = record && isWindowActive(record.windowStart) ? record.windowStart : Date.now();
  writeUsageRecord(userKey, AI_DAILY_LIMIT, windowStart);
  return toUsage(AI_DAILY_LIMIT);
}

/* ─── Component ──────────────────────────────────────── */
export default function ChatBot() {
  const pathname     = usePathname();
  const { userData } = useAuth();
  const isOrganiser  = Boolean((userData as any)?.is_organiser);
  const isMasterAdmin = Boolean((userData as any)?.is_masteradmin);

  const [isOpen,        setIsOpen]        = useState(false);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState("");
  const [isThinking,    setIsThinking]    = useState(false);
  const [isTyping,      setIsTyping]      = useState(false);
  const [showPulse,     setShowPulse]     = useState(true);
  const [usage,         setUsage]         = useState<UsageInfo | null>(null);
  const [limitReached,  setLimitReached]  = useState(false);
  const endRef        = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const typingVersion = useRef(0);

  const allQA = useMemo(() => getPageQA(pathname, isOrganiser, isMasterAdmin), [pathname, isOrganiser, isMasterAdmin]);
  const presets = useMemo(() => allQA.slice(0, 4).map(q => q.question), [allQA]);
  const qaMap   = useMemo(() => {
    const m = new Map<string, string>();
    for (const qa of allQA) m.set(normalize(qa.question), qa.answer);
    return m;
  }, [allQA]);

  const userKey = useMemo(() => ((userData as any)?.email || "anon").toString().toLowerCase(), [userData]);

  // Pull the latest counter from the per-user cache (also applies the 24h reset).
  const syncUsageFromCache = useCallback(() => {
    const info = readUsage(userKey);
    setUsage(info);
    setLimitReached(info.remaining <= 0);
  }, [userKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    syncUsageFromCache();
  }, [isOpen, syncUsageFromCache]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Reset presets when page changes
  useEffect(() => {
    setMessages([]);
    setInput("");
    syncUsageFromCache();
  }, [pathname, syncUsageFromCache]);

  // Character-by-character typing — abortable via typingVersion
  const typeMessage = useCallback(async (content: string) => {
    const version = ++typingVersion.current;
    setIsTyping(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    let built = "";
    for (let i = 0; i < content.length; i++) {
      if (typingVersion.current !== version) break;
      built += content[i];
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: built };
        return next;
      });
      await new Promise(r => setTimeout(r, 18));
    }
    if (typingVersion.current === version) setIsTyping(false);
  }, []);

  const handleQuestion = async (text: string, fromPreset = false) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking || isTyping) return;

    const key = normalize(trimmed);
    const local = qaMap.get(key);

    // Preset chips are always free — they're the fallback once the limit is hit.
    if (fromPreset) {
      setMessages(prev => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setIsThinking(true);
      await new Promise(r => setTimeout(r, 350));
      setIsThinking(false);
      await typeMessage(local || "Please pick one of the suggested questions below.");
      return;
    }

    // Typed questions count against the daily limit. Block once exhausted.
    if (limitReached) {
      setMessages(prev => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      const dailyLimit = usage?.limit ?? AI_DAILY_LIMIT;
      await typeMessage(`You've used all ${dailyLimit} of your daily AI questions. Please pick a preset question below or come back in 24 hours.`);
      return;
    }

    // Consume one credit immediately (5 → 4 → 3 …) and persist it to the cache.
    const nextUsage = consumeUsage(userKey);
    setUsage(nextUsage);
    setLimitReached(nextUsage.remaining <= 0);

    // Local Q&A still answers instantly, but a typed question always counts.
    if (local) {
      setMessages(prev => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setIsThinking(true);
      await new Promise(r => setTimeout(r, 350));
      setIsThinking(false);
      await typeMessage(local);
      return;
    }

    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsThinking(true);

    // AI fallback
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setIsThinking(false);
        await typeMessage("Please sign in to chat with SocioAssist.");
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: trimmed, context: { page: pathname } }),
      });

      const data = await res.json().catch(() => ({}));
      setIsThinking(false);

      if (!res.ok) {
        if (res.status === 429) {
          const exhausted = exhaustUsage(userKey);
          setUsage(exhausted);
          setLimitReached(true);
          await typeMessage(`You've used all ${exhausted.limit} of your daily AI questions. Please pick a preset question below or come back in 24 hours.`);
        } else {
          await typeMessage("The AI is busy right now — please try again in a moment.");
        }
        return;
      }

      await typeMessage(data.reply || "I'm not sure about that. Try asking differently.");
    } catch {
      setIsThinking(false);
      await typeMessage("Couldn't reach the server. Please check your connection.");
    } finally {
      setIsThinking(false);
    }
  };

  const resetChat = () => {
    typingVersion.current++;  // abort any in-progress typing
    setIsTyping(false);
    setIsThinking(false);
    setMessages([]);
    setInput("");
  };

  const showPresets = messages.length === 0 && !isThinking && !isTyping;
  const showLimitPresets = limitReached && !isThinking && !isTyping;
  const remainingCount = usage?.remaining ?? null;
  const limitCount = usage?.limit ?? AI_DAILY_LIMIT;

  if (pathname.startsWith("/statuscheck")) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40" onClick={() => setIsOpen(false)} />
      )}

      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">

        {/* Chat window */}
        {isOpen && (
          <div className="w-[340px] sm:w-[370px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
               style={{ maxHeight: "min(520px, calc(100dvh - 5rem))" }}>

            {/* Header */}
            <div className="bg-[#154CB3] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm leading-tight">SocioAssist</p>
                  <p className="text-[11px] text-blue-100 flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      (isThinking || isTyping) ? "bg-blue-200 animate-pulse" : "bg-emerald-300"
                    }`} />
                    {isThinking ? "Thinking…" : isTyping ? "Typing…" : "Online"}
                    {remainingCount !== null && (
                      <span
                        className={`ml-1 px-1.5 py-[1px] rounded-full text-[10px] font-medium ${
                          remainingCount <= 0
                            ? "bg-red-500/30 text-red-50"
                            : remainingCount <= 2
                              ? "bg-amber-300/30 text-amber-50"
                              : "bg-white/20 text-blue-50"
                        }`}
                        title={`${remainingCount} of ${limitCount} AI chatbot questions left (resets 24h after your first question)`}
                      >
                        {remainingCount}/{limitCount} AI chatbot
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f7f9fc] min-h-0">

              {/* Welcome bubble */}
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] text-gray-700 shadow-sm leading-relaxed">
                Hi! I'm SocioAssist — your SOCIO guide. {showPresets ? "Pick a question or type below." : "Ask me anything."}
              </div>

              {/* Preset chips — only when no conversation yet */}
              {showPresets && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {presets.map(q => (
                    <button
                      key={q}
                      onClick={() => handleQuestion(q, true)}
                      className="text-left text-[12px] bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-[#154CB3] hover:text-[#154CB3] hover:bg-blue-50/50 transition-colors leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Conversation */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden ${
                    msg.role === "user"
                      ? "bg-[#154CB3] text-white rounded-br-sm"
                      : "bg-white text-gray-700 rounded-bl-sm shadow-sm"
                  }`}>
                    {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                  </div>
                </div>
              ))}

              {/* Thinking dots */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              {/* Limit reached — show preset questions */}
              {showLimitPresets && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-[#154CB3] font-semibold text-center">AI chatbot limit reached</p>
                  <p className="text-xs text-gray-600 mt-1 text-center">
                    You've used all {limitCount} AI questions. Pick a preset question below — these are free, and your limit resets 24 hours after your first question.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {presets.map(q => (
                      <button key={q} onClick={() => handleQuestion(q, true)}
                        className="text-left text-[11px] bg-white border border-blue-200 rounded-lg px-2.5 py-2 text-gray-600 hover:border-[#154CB3] hover:text-[#154CB3] transition-colors leading-snug">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-3">
              <form
                onSubmit={e => { e.preventDefault(); handleQuestion(input); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={isThinking || isTyping || limitReached}
                  placeholder={
                    limitReached ? "AI chatbot limit reached — use a preset"
                    : isThinking  ? "Thinking…"
                    : isTyping    ? "Typing…"
                    : "Ask me anything…"
                  }
                  className="flex-1 text-[13px] border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isThinking || isTyping || limitReached}
                  className="w-9 h-9 bg-[#154CB3] text-white rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-[#0f3a7a] transition disabled:opacity-35 disabled:cursor-not-allowed"
                  aria-label="Send"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetChat}
                  className="mt-1.5 ml-1 text-[11px] text-gray-400 hover:text-gray-600 transition"
                >
                  Reset chat
                </button>
              )}
            </div>
          </div>
        )}

        {/* FAB */}
        {!isOpen && (
          <div className="relative">
            {showPulse && (
              <span className="absolute inset-0 rounded-full bg-[#154CB3]/40 animate-ping [animation-iteration-count:2]" />
            )}
            <button
              onClick={() => { setIsOpen(true); setShowPulse(false); }}
              className="relative w-14 h-14 bg-[#154CB3] hover:bg-[#0f3a7a] text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105"
              aria-label="Open SocioAssist"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
            </button>
          </div>
        )}

      </div>
    </>
  );
}
