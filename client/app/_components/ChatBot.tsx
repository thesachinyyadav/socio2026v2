"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/* ─── Types ─────────────────────────────────────────── */
interface QA { q: string; a: string }
interface Message { role: "user" | "assistant"; content: string }
interface WebFetchResponse {
  ok: boolean;
  url: string;
  title: string;
  description?: string;
  summary: string;
  error?: string;
}

/* ─── Preset Q&A databases ──────────────────────────── */
const GLOBAL_QA: QA[] = [
  { q: "What is Socio?", a: "Socio is a campus event management platform that lets you discover, register for, and manage college events and fests — all in one place." },
  { q: "How do I create an event?", a: "Go to the Manage page from the sidebar. If you have organiser access, you'll see a 'Create Event' button. Fill in the details and publish!" },
  { q: "How do I register for an event?", a: "Open any event page and click the 'Register' button. You'll need to be signed in with your college email." },
  { q: "How do I contact support?", a: "Head to the Contact page from the footer or sidebar. You can reach us via email or the support form." },
  { q: "Is there a mobile app?", a: "Yes! Socio has a Progressive Web App (PWA) for mobile. Visit the App Download page for instructions on how to install it." },
];

function getPageQA(pathname: string): QA[] {
  if (pathname === "/events") return [
    { q: "How do I find events?", a: "You're on the right page! Browse all upcoming events here. Use the search bar and filters to narrow down by category, date, or fest." },
    { q: "Can I filter by event type?", a: "Yes! Use the filter options at the top to filter by category (Technical, Cultural, Sports, etc.), date range, or associated fest." },
    { q: "Are events free?", a: "It depends on the event. Each event card shows whether it's free or paid. Click on an event for full details including pricing." },
    { q: "How do I know if registration is open?", a: "Events with open registration show a 'Register' button. If registration is closed, you'll see the status on the event card." },
  ];
  if (pathname.startsWith("/event/")) return [
    { q: "How do I register for this event?", a: "Click the 'Register' button on this page. Make sure you're signed in first. You'll receive a confirmation with your QR code." },
    { q: "Where is the venue?", a: "The venue details are shown in the event information section on this page. Look for the location/venue field." },
    { q: "Can I cancel my registration?", a: "You can view your registration status on your Profile page. Contact the event organiser directly for cancellations." },
    { q: "What is the QR code for?", a: "After registering, you receive a QR code. This is scanned at the venue entrance for attendance tracking. Keep it handy!" },
  ];
  if (pathname === "/fests") return [
    { q: "What is a fest?", a: "A fest is a collection of related events, usually spanning multiple days — like a college cultural or technical festival." },
    { q: "How do I view fest events?", a: "Click on any fest card to see all events that are part of that fest. You can register for individual events within." },
    { q: "When is the next fest?", a: "Check the fest cards on this page — each shows the start and end dates. Upcoming fests are listed first." },
  ];
  if (pathname.startsWith("/fest/")) return [
    { q: "What events are in this fest?", a: "Scroll down on this page to see all events that are part of this fest. You can register for each one individually." },
    { q: "How long does this fest run?", a: "The fest duration is shown at the top of this page with start and end dates." },
    { q: "Can I register for all events at once?", a: "You'll need to register for each event separately. Browse the events listed below and click Register on the ones you want." },
  ];
  if (pathname === "/profile") return [
    { q: "Where are my registrations?", a: "Your registered events are shown on this page under the Registrations section. You can also see your attendance history." },
    { q: "Can I edit my profile here?", a: "Profile editing is not available right now. You can use this page to view your details, registrations, attendance history, and QR codes." },
    { q: "Where is my QR code?", a: "Your QR codes for registered events appear in the Registrations section. Click on a registration to view or download your QR." },
  ];
  if (pathname === "/Discover") return [
    { q: "What is the Discover page?", a: "Discover helps you explore events and fests tailored to your interests. Browse by category to find something you'll enjoy!" },
    { q: "Can I search for specific events?", a: "Yes! Use the search bar at the top to find events by name, or use filters to narrow down by type and date." },
  ];
  if (pathname === "/manage") return [
    { q: "How do I create an event?", a: "Click 'Create Event' at the top of the Events tab. Fill in the event details like title, date, venue, and description, then publish." },
    { q: "How do I view registrations?", a: "Go to the Events tab, find your event, and click on it to see all registrations. You can also export the data." },
    { q: "How do I create a fest?", a: "Switch to the Fests tab and click 'Create Fest'. Set up the fest details, then add events to it from the Events tab." },
    { q: "How do reports work?", a: "Go to the Report tab to generate detailed reports. Choose fest or event mode, select your data, and export to Excel." },
  ];
  if (pathname === "/masteradmin") return [
    { q: "What can I do as master admin?", a: "You can manage all users, events, fests, view analytics, send notifications, and generate comprehensive reports." },
    { q: "How do I manage user roles?", a: "Go to the Users tab to view all users. You can assign roles like organiser or modify existing permissions." },
    { q: "How do I generate reports?", a: "Use the Report tab. Select fest or event mode, apply filters, and export detailed Excel reports with registration and attendance data." },
  ];
  if (pathname === "/" || pathname === "/dashboard") return [
    { q: "Where do I start?", a: "Welcome to Socio! Head to the Events page to browse upcoming events, or check out Fests to see what's happening on campus." },
    { q: "How do I sign in?", a: "Click the Sign In button in the top right. You can sign in with your Google account." },
    { q: "What can I do on Socio?", a: "Discover and register for campus events, track your registrations and attendance, and manage events if you're an organiser." },
  ];
  if (pathname === "/auth") return [
    { q: "How do I sign in?", a: "Click 'Sign in with Google' to use your Google account. Make sure to use your college email if required by your institution." },
    { q: "I can't sign in", a: "Make sure you're using a supported browser and that pop-ups aren't blocked. Try clearing your cache or using an incognito window." },
  ];
  return [];
}

/* ─── Fuzzy match typed questions ───────────────────── */
function findAnswer(input: string, qaList: QA[]): string | null {
  const lower = input.toLowerCase().trim();
  for (const qa of qaList) {
    const keywords = qa.q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits >= 2 || (keywords.length <= 3 && hits >= 1)) return qa.a;
  }
  if (/register|sign.?up|join/i.test(lower)) return "To register for an event, open the event page and click the 'Register' button. Make sure you're signed in first!";
  if (/qr|code|ticket/i.test(lower)) return "After registering, you receive a unique QR code used for attendance tracking. Find it on your Profile page.";
  if (/cancel|refund/i.test(lower)) return "To cancel a registration, please contact the event organiser directly. You can find their details on the event page.";
  if (/contact|help|support/i.test(lower)) return "You can reach our support team via the Contact page. Navigate there from the sidebar or footer.";
  if (/create|make|new.*event/i.test(lower)) return "To create an event, go to the Manage page. If you have organiser access, you'll see a 'Create Event' button.";
  if (/fest|festival/i.test(lower)) return "Fests are collections of related events. Visit the Fests page to browse upcoming festivals.";
  if (/profile|account/i.test(lower)) return "Visit your Profile page to view your registrations, attendance history, and QR codes. Profile editing is not available right now.";
  return null;
}

const WELCOME_MESSAGE = "Hi! I'm SocioAssist - your campus event guide. Pick a question below and I'll help.";

const HELP_MESSAGE = [
  "I can help in live mode.",
  "- Ask normal questions about Socio events, fests, profile, and sign-in.",
  "- Paste any URL to fetch and summarize the webpage.",
  "- Use commands like: summarize this page, analyze current page, open events, go to profile.",
].join("\n");

function detectNavigationCommand(input: string): { path: string; label: string } | null {
  const lower = input.toLowerCase();
  if (!/(go to|open|take me to|navigate|show me|visit)/.test(lower)) return null;

  if (/(^|\s)events?(\s|$)/.test(lower)) return { path: "/events", label: "Events" };
  if (/(^|\s)fests?(\s|$)|festival/.test(lower)) return { path: "/fests", label: "Fests" };
  if (/(^|\s)discover(\s|$)/.test(lower)) return { path: "/Discover", label: "Discover" };
  if (/profile|account/.test(lower)) return { path: "/profile", label: "Profile" };
  if (/manage|organi[sz]er/.test(lower)) return { path: "/manage", label: "Manage" };
  if (/master\s*admin|admin/.test(lower)) return { path: "/masteradmin", label: "Master Admin" };
  if (/auth|sign\s?in|login/.test(lower)) return { path: "/auth", label: "Sign In" };
  if (/home|dashboard/.test(lower)) return { path: "/", label: "Home" };

  return null;
}

function extractUrl(input: string): string | null {
  const directUrl = input.match(/https?:\/\/[^\s]+/i)?.[0];
  if (directUrl) return directUrl.replace(/[),.!?]+$/, "");

  const wwwUrl = input.match(/\bwww\.[^\s]+\.[a-z]{2,}(?:\/[^\s]*)?/i)?.[0];
  if (!wwwUrl) return null;

  return `https://${wwwUrl.replace(/[),.!?]+$/, "")}`;
}

function shouldFetchCurrentPage(input: string): boolean {
  const lower = input.toLowerCase();
  return /(this page|current page|page here|here)/.test(lower)
    && /(summari[sz]e|analy[sz]e|read|fetch|scan|what is on)/.test(lower);
}

function extractFocusQuery(input: string, url?: string): string {
  let query = input;
  if (url) query = query.replace(url, " ");
  query = query
    .replace(/\b(fetch|read|analy[sz]e|summari[sz]e|scan|explain|tell me about|what is on|from|website|webpage|page|this|current|here)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return query;
}

function buildWebReply(data: WebFetchResponse): string {
  const lines = [
    `Live fetch complete from: ${data.title}`,
    data.summary,
  ];

  if (data.description && !data.summary.toLowerCase().includes(data.description.toLowerCase())) {
    lines.splice(1, 0, `Overview: ${data.description}`);
  }

  lines.push(`Source: ${data.url}`);
  return lines.join("\n\n");
}

/* ─── Component ─────────────────────────────────────── */
export default function ChatBot() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const [displayedLen, setDisplayedLen] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [showFabPulse, setShowFabPulse] = useState(true);

  const pageQA = getPageQA(pathname);
  const allQA = [...pageQA, ...GLOBAL_QA];
  const quickQuestions = [...pageQA.slice(0, 4), ...GLOBAL_QA.slice(0, Math.max(0, 4 - pageQA.length))].map((qa) => qa.q);
  const isTyping = typingIdx !== null;

  const asked = messages.filter((m) => m.role === "user").map((m) => m.content);
  const suggestionPool = Array.from(new Set([...quickQuestions, ...allQA.map((qa) => qa.q)])).filter((q) => !asked.includes(q));
  const visibleSuggestions = suggestionPool.slice(0, 4);

  const resetChat = useCallback(() => {
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setTypingIdx(null);
    setDisplayedLen(0);
    setInput("");
    setIsThinking(false);
  }, []);

  const fetchWebSummary = useCallback(async (url: string, query: string) => {
    const response = await fetch("/api/chatbot/fetch-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, query }),
    });

    const data = await response.json() as WebFetchResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to fetch webpage content.");
    }

    return data;
  }, []);

  const generateReply = useCallback(async (trimmed: string) => {
    const lower = trimmed.toLowerCase();

    if (/^\/?help$|what can you do|commands?|capabilities/.test(lower)) {
      return HELP_MESSAGE;
    }

    const navTarget = detectNavigationCommand(trimmed);
    if (navTarget) {
      if (navTarget.path === pathname) {
        return `You're already on the ${navTarget.label} page.`;
      }
      router.push(navTarget.path);
      return `Opening ${navTarget.label} now. Tell me what you want to do next on that page.`;
    }

    const externalUrl = extractUrl(trimmed);
    const wantsCurrentPage = shouldFetchCurrentPage(trimmed);
    if (externalUrl || wantsCurrentPage) {
      const targetUrl = externalUrl || `${window.location.origin}${pathname}`;
      const focusQuery = extractFocusQuery(trimmed, externalUrl || undefined);

      try {
        const data = await fetchWebSummary(targetUrl, focusQuery);
        return buildWebReply(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not fetch webpage content right now.";
        return `I tried to fetch that page but hit an issue: ${message} Please verify the URL and try again.`;
      }
    }

    const answer = findAnswer(trimmed, allQA);
    if (answer) return answer;

    return "I understood your request but I need more detail. You can ask direct questions, give navigation commands like 'open events', or paste a URL and I'll fetch and summarize it live.";
  }, [allQA, fetchWebSummary, pathname, router]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, displayedLen, isThinking]);
  useEffect(() => {
    resetChat();
  }, [pathname, resetChat]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  /* Typewriter effect */
  useEffect(() => {
    if (typingIdx === null) return;
    const msg = messages[typingIdx];
    if (!msg) return;
    const fullLen = msg.content.length;
    if (displayedLen >= fullLen) { setTypingIdx(null); return; }
    const chunkSize = fullLen > 600 ? 4 : fullLen > 280 ? 2 : 1;
    const speed = fullLen > 600 ? 4 : fullLen > 280 ? 7 : 10;
    const id = setTimeout(() => setDisplayedLen((l: number) => Math.min(l + chunkSize, fullLen)), speed);
    return () => clearTimeout(id);
  }, [typingIdx, displayedLen, messages]);

  const handleQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typingIdx !== null || isThinking) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsThinking(true);

    let reply = "I ran into an unexpected issue while processing that command. Please try again.";
    try {
      reply = await generateReply(trimmed);
    } catch {
      // Fallback message above keeps chat responsive if command parsing fails unexpectedly.
    }

    setMessages((prev) => {
      const next = [...prev, { role: "assistant" as const, content: reply }];
      setTypingIdx(next.length - 1);
      setDisplayedLen(0);
      return next;
    });
    setIsThinking(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleQuestion(input);
  };

  const handleToggleChat = () => {
    setShowFabPulse(false);
    setIsOpen(true);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {isOpen && (
          <div className="mb-4 w-[380px] max-w-[calc(100vw-1rem)] h-[580px] max-h-[calc(100dvh-1.5rem)] rounded-3xl border border-blue-200/20 ring-1 ring-white/10 bg-gradient-to-b from-[#08163a] via-[#091a45] to-[#07132d] text-white shadow-[0_22px_70px_-24px_rgba(21,76,179,0.85)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 relative">
            <div className="pointer-events-none absolute -top-14 -left-12 h-36 w-36 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-8 -right-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-3xl" />

            {/* Header */}
            <div className="relative z-10 bg-gradient-to-r from-[#1B57C8] via-[#154CB3] to-[#0F3D97] text-white px-4 py-3.5 flex items-center justify-between shrink-0 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center ring-1 ring-white/20">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    <circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm">SocioAssist</p>
                  <p className="text-[11px] text-blue-100 flex items-center gap-1.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${isTyping || isThinking ? "bg-amber-300 animate-pulse" : "bg-emerald-300"}`} />
                    {isThinking ? "Thinking..." : isTyping ? "Typing..." : "Quick Help Online"}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer rounded-md p-1 hover:bg-white/10" aria-label="Close chatbot">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden backdrop-blur-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[#1f63de] to-[#154CB3] text-white rounded-br-md shadow-[0_8px_20px_-8px_rgba(31,99,222,0.8)]"
                      : "bg-white/10 border border-white/10 text-blue-50 rounded-bl-md"
                  }`}>
                    {i === typingIdx ? msg.content.slice(0, displayedLen) : msg.content}
                    {i === typingIdx && <span className="inline-block w-[2px] h-[14px] bg-gray-400 ml-0.5 align-middle animate-pulse" />}
                  </div>
                </div>
              ))}

              {/* Typing indicator (before message arrives) */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/10 border border-white/10 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              {visibleSuggestions.length > 0 && !isTyping && !isThinking && !input.trim() && (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-blue-100/80 text-center">Tap a quick prompt</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {visibleSuggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuestion(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-blue-200/30 bg-[#0e2a6d]/40 text-blue-100 hover:bg-[#1a4db4]/45 hover:text-white transition-colors cursor-pointer break-words max-w-full"
                        type="button"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="relative z-10 border-t border-white/10 bg-[#061335]/80 backdrop-blur-sm px-3 py-3">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={isTyping || isThinking ? "SocioAssist is replying..." : "Ask anything, paste a URL, or type: summarize this page"}
                  disabled={isTyping || isThinking}
                  className="flex-1 min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-100/65 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-300/30 transition"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping || isThinking}
                  className="h-10 w-10 rounded-xl bg-[#1d63de] text-white flex items-center justify-center transition-all hover:bg-[#3477e9] hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-blue-100/75">
                <span>{isTyping || isThinking ? "Assistant is crafting your reply" : "Press Enter to send"}</span>
                <button type="button" onClick={resetChat} className="hover:text-white transition-colors underline underline-offset-2">
                  Reset chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FAB */}
        {!isOpen && (
          <div className="relative">
            {showFabPulse && (
              <span className="absolute inset-0 rounded-full bg-[#154CB3]/40 animate-ping" style={{ animationIterationCount: 2 }} />
            )}
            <button
              onClick={handleToggleChat}
              className="relative w-14 h-14 bg-gradient-to-br from-[#1f63de] to-[#154CB3] hover:from-[#255ec0] hover:to-[#0d3580] text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              aria-label="Open chatbot"
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

