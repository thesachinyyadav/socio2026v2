"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

/* ─── Types ─────────────────────────────────────────── */
interface Message { role: "user" | "assistant"; content: string }
interface WebFetchResponse {
  ok: boolean;
  url: string;
  title: string;
  description?: string;
  summary: string;
  error?: string;
}
interface ChatUsage {
  limit: number;
  used: number;
  remaining: number;
}
interface ChatApiResponse {
  reply?: string;
  error?: string;
  details?: string;
  usage?: Partial<ChatUsage>;
}
interface InbuiltPromptQA {
  question: string;
  answer: string;
}

/* ─── Suggested Prompt Sets ─────────────────────────── */
const GLOBAL_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "What is SOCIO?",
    answer: "SOCIO is Christ University's event platform for discovering, registering, and managing campus events and activities.",
  },
  {
    question: "What can I do?",
    answer: "You can discover events, register, track attendance, explore fests, and use support resources from one place.",
  },
  {
    question: "Is SOCIO free?",
    answer: "Yes, SOCIO is free for students to browse events and register as shown in the FAQ.",
  },
  {
    question: "Who can join?",
    answer: "Terms state SOCIO is intended for current students, faculty, and staff of the university.",
  },
  {
    question: "Need uni email?",
    answer: "Terms mention a valid christuniversity.in email is required, unless approved otherwise by SOCIO admins.",
  },
  {
    question: "Use on mobile?",
    answer: "Yes, SOCIO works on mobile browsers and the app page currently shows a beta mobile-app rollout.",
  },
  {
    question: "App in beta?",
    answer: "Yes, the App Download page says the mobile app is in beta and coming soon.",
  },
  {
    question: "Notify launch?",
    answer: "Use the Notify Me form on the App Download page to get launch and early-access updates.",
  },
  {
    question: "Where start?",
    answer: "Start from Discover, then open Events or Fests to find what you want to join.",
  },
  {
    question: "Open Discover?",
    answer: "Use the Discover page as your main hub to explore what's happening on campus.",
  },
  {
    question: "Events listed?",
    answer: "The Events page lists upcoming events with filtering and event-detail links.",
  },
  {
    question: "Fests listed?",
    answer: "The Fests page lists upcoming fests and festival timelines happening on campus.",
  },
  {
    question: "Event categories?",
    answer: "Events are grouped by categories like Academic, Cultural, Sports, Literary, Arts, Innovation, and Free.",
  },
  {
    question: "Fest categories?",
    answer: "Fests include category views such as Technology, Cultural, Science, Arts, Management, Academic, and Sports.",
  },
  {
    question: "Need support?",
    answer: "Use Contact or Support pages for quick help, guided articles, and direct team assistance.",
  },
  {
    question: "Contact email?",
    answer: "Primary support email shown on site is thesocio.blr@gmail.com.",
  },
  {
    question: "Contact phone?",
    answer: "Primary support phone shown on site is +91 88613 30665.",
  },
  {
    question: "Support hours?",
    answer: "Contact page lists phone support during business hours from 9 AM to 6 PM.",
  },
  {
    question: "Open FAQ?",
    answer: "FAQ page provides categorized answers for General, Account, Events, Registration, Technical, and Organizers.",
  },
  {
    question: "Help Center?",
    answer: "Support page includes help articles for account setup, event registration, QR attendance, app issues, and notifications.",
  },
  {
    question: "Report issue?",
    answer: "Use the Report Issue action on Support when something is not working correctly.",
  },
  {
    question: "Submit idea?",
    answer: "Use the Submit Idea action on Support to request improvements or new features.",
  },
  {
    question: "Pricing access?",
    answer: "Pricing page asks you to fill a form first, then the team contacts you with service and pricing options.",
  },
  {
    question: "Privacy rights?",
    answer: "Privacy page lists rights including access, correction, deletion, restriction, and data portability requests.",
  },
  {
    question: "Terms updates?",
    answer: "Terms page says material changes are notified before they take effect, and continued use means acceptance.",
  },
  {
    question: "Data collected?",
    answer: "Privacy policy lists name, university email, registration number, campus or department, optional photo, and usage data.",
  },
  {
    question: "Data sold?",
    answer: "Privacy policy explicitly says personal information is never sold to third parties.",
  },
  {
    question: "Delete my data?",
    answer: "Privacy policy says deletion requests can be made by contacting thesocio.blr@gmail.com.",
  },
  {
    question: "Organizer tools?",
    answer: "Organizer-focused resources are linked under Our Solutions and With Socio in the site footer.",
  },
  {
    question: "Legal policies?",
    answer: "Site footer legal links include Terms of Service, Privacy Policy, and Cookie Policy.",
  },
  {
    question: "Careers link?",
    answer: "Careers is available from the Support section through the support/careers page.",
  },
];

const EVENTS_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "Shortlist events?",
    answer: "Use search and filters first, open only the top matches, and shortlist events that fit your date and interest. Then review those shortlisted cards together to make a final registration choice faster.",
  },
  {
    question: "Filter type/date?",
    answer: "On the Events page, apply category or event-type filters, then narrow by date. Combine both filters to avoid clutter and focus only on relevant events happening in your preferred time window.",
  },
  {
    question: "Check before reg?",
    answer: "Check date and time, venue, registration fee, eligibility, and remaining slots. Also read the event description and rules to avoid missing prerequisites before you submit registration.",
  },
  {
    question: "Free or paid?",
    answer: "Event cards or event detail pages show fee information. Always verify payment status before you submit registration.",
  },
  {
    question: "Seats left?",
    answer: "Open the event details page to confirm capacity or registration status. If full, registration may be closed or unavailable.",
  },
  {
    question: "Venue info?",
    answer: "Venue is listed on each event card and detail page. Check the exact location before the event date.",
  },
  {
    question: "Event rules?",
    answer: "Read the event description and instructions section on the event page for eligibility, format, and participation rules.",
  },
];

const EVENT_PAGE_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "About this event?",
    answer: "This event page gives you the essentials: what the event is about, when and where it happens, who is organizing it, and any fee or category details. Use this summary to decide if you should register now.",
  },
  {
    question: "Register here?",
    answer: "Sign in, open this event page, click Register, complete all required fields exactly, and submit. After submission, confirm your registration status in Profile and keep your QR details ready for attendance.",
  },
  {
    question: "What to verify?",
    answer: "Verify event date, reporting time, venue, fee status, and any special instructions. Keep your registration confirmation and QR available so check-in is smooth at the venue.",
  },
  {
    question: "Who can join?",
    answer: "Check the event eligibility details on this page, including department, year, or any participation restrictions.",
  },
  {
    question: "Fee and timing?",
    answer: "Both fee and schedule are shown on the event page. Confirm them before registering.",
  },
  {
    question: "What to carry?",
    answer: "Carry your registration confirmation and QR details. Follow any extra instructions listed on the event page.",
  },
  {
    question: "Cancel option?",
    answer: "If cancellation is supported, check your registration or event instructions. Otherwise contact the organizer for help.",
  },
];

const FESTS_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "Plan fest?",
    answer: "Start with must-attend events, then arrange them by time and venue to avoid overlap. Keep travel buffer between venues and prioritize registrations that close earliest.",
  },
  {
    question: "Prioritize events?",
    answer: "Prioritize by relevance, timing, and registration urgency. Pick core events first, then add optional ones where schedule gaps allow. This avoids clashes and helps you maximize participation.",
  },
  {
    question: "Many regs?",
    answer: "Track all registrations in your profile, set reminders for event times, and verify each venue beforehand. Keep a simple checklist of registered events so you do not miss reporting windows.",
  },
  {
    question: "Fest dates?",
    answer: "Fest opening and closing dates are listed on the fest details page. Use them to plan your event sequence.",
  },
  {
    question: "Fest venue?",
    answer: "Check the fest page for primary venue details, then verify individual event venues for exact locations.",
  },
  {
    question: "Fest updates?",
    answer: "Follow fest and event pages for schedule or organizer updates. Recheck timings near event day.",
  },
];

const PROFILE_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "My history?",
    answer: "Use Profile to review your registrations and attendance updates. It gives you a reliable event history so you can confirm what you joined and what is still upcoming.",
  },
  {
    question: "Reg updates?",
    answer: "Check your Profile registrations first for the latest status. Also review event details pages for schedule updates and organizer announcements when applicable.",
  },
  {
    question: "Attend status?",
    answer: "Attendance status usually updates after check-in validation. In Profile, compare your registered events against attendance markers and verify your QR was scanned properly at entry.",
  },
  {
    question: "Where is QR?",
    answer: "Your QR details are available from your registration records in Profile for applicable events.",
  },
  {
    question: "Upcoming events?",
    answer: "Use your profile registrations to track upcoming items and check each event page for final timing/venue details.",
  },
  {
    question: "Missed event?",
    answer: "If you missed check-in, attendance may remain incomplete. Contact the organizer if a correction process exists.",
  },
];

const MANAGE_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "Manage events?",
    answer: "Work in a fixed sequence: review drafts, confirm dates and venues, verify registration settings, then publish. This keeps operations clean and reduces last-minute corrections.",
  },
  {
    question: "Admin checklist?",
    answer: "Check pending updates, validate upcoming event details, review registration counts, confirm attendance setup, and close with a quick QA pass on published items.",
  },
  {
    question: "Avoid edit errors?",
    answer: "Update one section at a time, verify date/time format, confirm venue and fee values, and recheck before saving. Avoid parallel edits and always preview after major changes.",
  },
  {
    question: "Before publish?",
    answer: "Confirm title, date, time, venue, fee, category, and registration settings before publishing any event.",
  },
  {
    question: "Track regs?",
    answer: "Use registration dashboards or event-specific views to monitor counts, status, and attendance readiness.",
  },
  {
    question: "Export reports?",
    answer: "Use the report/export options in admin or manage modules to generate registration and attendance outputs.",
  },
];

function getInbuiltPromptQA(pathname: string): InbuiltPromptQA[] {
  if (pathname === "/events") {
    return [
      ...EVENTS_INBUILT_QA,
      ...GLOBAL_INBUILT_QA,
    ];
  }

  if (pathname.startsWith("/event/")) {
    return [
      ...EVENT_PAGE_INBUILT_QA,
      ...GLOBAL_INBUILT_QA,
    ];
  }

  if (pathname === "/fests" || pathname.startsWith("/fest/")) {
    return [
      ...FESTS_INBUILT_QA,
      ...GLOBAL_INBUILT_QA,
    ];
  }

  if (pathname === "/profile") {
    return [
      ...PROFILE_INBUILT_QA,
      ...GLOBAL_INBUILT_QA,
    ];
  }

  if (pathname === "/manage" || pathname === "/masteradmin") {
    return [
      ...MANAGE_INBUILT_QA,
      ...GLOBAL_INBUILT_QA,
    ];
  }

  return GLOBAL_INBUILT_QA;
}

function normalizePromptForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!,;:]+$/g, "");
}

const WELCOME_MESSAGE = "Hi! I'm SocioAssist - your campus event guide. Ask me anything and I'll help in real time.";
const UNKNOWN_ANSWER_MESSAGE = "I can't assist you with that. Please rephrase your question or ask something else.";
const CHAT_API_ENDPOINT = "/api/chat";

function toNonNegativeInteger(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }
  return Math.floor(numericValue);
}

function normalizeUsage(input: { limit?: unknown; used?: unknown; remaining?: unknown } | undefined): ChatUsage | null {
  if (!input) return null;

  const limit = toNonNegativeInteger(input.limit);
  const used = toNonNegativeInteger(input.used);
  const remaining = toNonNegativeInteger(input.remaining);

  if (limit === null || used === null || remaining === null) {
    return null;
  }

  return {
    limit,
    used: Math.min(used, limit),
    remaining: Math.min(remaining, limit),
  };
}

function parseUsageHeaders(headers: Headers): ChatUsage | null {
  return normalizeUsage({
    limit: headers.get("x-ai-limit") || undefined,
    used: headers.get("x-ai-used") || undefined,
    remaining: headers.get("x-ai-remaining") || undefined,
  });
}

function buildDailyLimitMessage(usage: ChatUsage): string {
  return `Daily limit reached. You've used all ${usage.limit} AI questions for today. Try one of the built-in questions below.`;
}

const HELP_MESSAGE = [
  "I answer questions in live AI mode.",
  "- Ask anything about events, fests, profile, registrations, or platform usage.",
  "- Paste any URL to fetch and summarize webpage content.",
  "- Use navigation commands like: open events, go to profile, open fests.",
].join("\n");

function getUserFacingErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (!raw) return UNKNOWN_ANSWER_MESSAGE;

  const lower = raw.toLowerCase();
  if (lower.includes("daily questions") || lower.includes("try again tomorrow")) {
    return "Daily limit reached. Try one of the built-in questions below.";
  }

  if (lower.includes("sign in")) {
    return raw;
  }

  if (
    lower.includes("high usage") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return "AI assistant is temporarily unavailable due to high usage. Please try again later.";
  }

  return UNKNOWN_ANSWER_MESSAGE;
}

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
  const streamAbortRef = useRef<AbortController | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showFabPulse, setShowFabPulse] = useState(true);
  const [dailyUsage, setDailyUsage] = useState<ChatUsage | null>(null);

  const inbuiltPromptQA = useMemo(() => getInbuiltPromptQA(pathname), [pathname]);
  const quickPrompts = useMemo(
    () => inbuiltPromptQA.map((entry) => entry.question),
    [inbuiltPromptQA]
  );
  const inbuiltAnswerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of inbuiltPromptQA) {
      map.set(normalizePromptForMatch(entry.question), entry.answer);
    }
    return map;
  }, [inbuiltPromptQA]);
  const isTyping = isStreaming;

  const asked = messages.filter((m) => m.role === "user").map((m) => m.content);
  const unseenSuggestions = quickPrompts.filter((q) => !asked.includes(q));
  const suggestionPool = unseenSuggestions.length > 0
    ? unseenSuggestions
    : quickPrompts;
  const visibleSuggestions = suggestionPool.slice(0, 4);

  const resetChat = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setInput("");
    setIsThinking(false);
    setIsStreaming(false);
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

  const applyUsageUpdate = useCallback((headers: Headers, bodyUsage?: Partial<ChatUsage>) => {
    const usageFromHeaders = parseUsageHeaders(headers);
    if (usageFromHeaders) {
      setDailyUsage(usageFromHeaders);
      return;
    }

    const usageFromBody = normalizeUsage(bodyUsage);
    if (usageFromBody) {
      setDailyUsage(usageFromBody);
    }
  }, []);

  const refreshDailyUsage = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setDailyUsage(null);
      return;
    }

    const response = await fetch(CHAT_API_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    let bodyData: Partial<ChatUsage> | undefined;
    try {
      bodyData = await response.json() as Partial<ChatUsage>;
    } catch {
      bodyData = undefined;
    }

    applyUsageUpdate(response.headers, bodyData);
  }, [applyUsageUpdate]);

  const generateLocalReply = useCallback(async (trimmed: string): Promise<string | null> => {
    const lower = trimmed.toLowerCase();

    if (/^\/?help$|what can you do|commands?|capabilities/.test(lower)) {
      return HELP_MESSAGE;
    }

    const inbuiltAnswer = inbuiltAnswerMap.get(normalizePromptForMatch(trimmed));
    if (inbuiltAnswer) {
      return inbuiltAnswer;
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

    return null;
  }, [fetchWebSummary, inbuiltAnswerMap, pathname, router]);

  const requestChatReply = useCallback(async (trimmed: string, history: Message[]): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Please sign in to use live AI responses.");
    }

    const response = await fetch(CHAT_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: trimmed,
        history,
        context: {
          page: pathname,
          userId: session.user?.id || session.user?.email,
        },
      }),
    });

    const data = await response.json() as ChatApiResponse;
    applyUsageUpdate(response.headers, data.usage);

    if (!response.ok || !data.reply) {
      throw new Error(data.error || data.details || "Unable to get assistant response right now.");
    }

    return data.reply;
  }, [applyUsageUpdate, pathname]);

  const streamChatReply = useCallback(async (trimmed: string, history: Message[]): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Please sign in to use live AI responses.");
    }

    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }

    const controller = new AbortController();
    streamAbortRef.current = controller;

    const response = await fetch(CHAT_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: trimmed,
        history,
        context: {
          page: pathname,
          userId: session.user?.id || session.user?.email,
        },
        stream: true,
      }),
      signal: controller.signal,
    });

    applyUsageUpdate(response.headers);

    if (!response.ok) {
      const data = await response.json() as ChatApiResponse;
      applyUsageUpdate(response.headers, data.usage);
      throw new Error(data.error || data.details || "Unable to start live response.");
    }

    if (!response.body) {
      throw new Error("Streaming is unavailable on this connection.");
    }

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsThinking(false);
    setIsStreaming(true);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        accumulated += chunk;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (next[lastIndex].role === "assistant") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: accumulated,
            };
          } else {
            next.push({ role: "assistant", content: accumulated });
          }
          return next;
        });
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        accumulated += finalChunk;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (next[lastIndex].role === "assistant") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: accumulated,
            };
          }
          return next;
        });
      }

      if (!accumulated.trim()) {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.role === "assistant" && !last.content.trim()) {
            next.pop();
          }
          return next;
        });
        throw new Error("Received an empty assistant response.");
      }
    } catch (error) {
      if (accumulated.trim()) {
        return;
      }

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.role === "assistant" && !last.content.trim()) {
          next.pop();
        }
        return next;
      });

      throw error;
    } finally {
      reader.releaseLock();
      streamAbortRef.current = null;
      setIsStreaming(false);
    }
  }, [applyUsageUpdate, pathname]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isThinking, isStreaming]);
  useEffect(() => {
    resetChat();
  }, [pathname, resetChat]);

  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    refreshDailyUsage().catch((error) => {
      console.error("Failed to load daily chat usage:", error);
    });
  }, [isOpen, refreshDailyUsage]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
      setIsStreaming(false);
    }

    const history = messages
      .filter((msg, index) => !(index === 0 && msg.role === "assistant" && msg.content === WELCOME_MESSAGE))
      .slice(-24);

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsThinking(true);

    try {
      const localReply = await generateLocalReply(trimmed);
      if (localReply) {
        setMessages((prev) => [...prev, { role: "assistant", content: localReply }]);
        return;
      }

      if (dailyUsage && dailyUsage.remaining <= 0) {
        const limitMessage = buildDailyLimitMessage(dailyUsage);
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === "assistant" && lastMessage.content === limitMessage) {
            return prev;
          }
          return [...prev, { role: "assistant", content: limitMessage }];
        });
        return;
      }

      try {
        await streamChatReply(trimmed, history);
      } catch (streamError) {
        if (streamError instanceof Error && streamError.name === "AbortError") {
          return;
        }

        const fallbackReply = await requestChatReply(trimmed, history);
        setMessages((prev) => [...prev, { role: "assistant", content: fallbackReply }]);
      }
    } catch (error) {
      const message = getUserFacingErrorMessage(error);
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleQuestion(input);
  };

  const handleToggleChat = () => {
    setShowFabPulse(false);
    setIsOpen(true);
  };

  const isStatuscheckPage = pathname.startsWith("/statuscheck");
  if (isStatuscheckPage) {
    return null;
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />
      )}

      <div className="fixed inset-x-2 bottom-2 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:pb-0 z-50 flex justify-end">
        {isOpen && (
          <div className="mb-3 w-full sm:w-[380px] h-[min(calc(100dvh-1rem),44rem)] sm:h-[580px] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] rounded-2xl sm:rounded-3xl border border-blue-200/20 ring-1 ring-white/10 bg-gradient-to-b from-[#08163a] via-[#091a45] to-[#07132d] text-white shadow-[0_22px_70px_-24px_rgba(21,76,179,0.85)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 relative">
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
                    {isThinking ? "Thinking..." : isTyping ? "Streaming..." : "Quick Help Online"}
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
                    {msg.content}
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
                <div className="mt-3 rounded-2xl border border-blue-200/20 bg-[#10275d]/45 px-3 py-3">
                  <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100/80">
                    Tap a quick prompt
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleSuggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuestion(q)}
                        className="h-10 w-full rounded-full border border-blue-200/35 bg-[#13397d]/45 px-3 py-2 text-center text-[12px] font-medium leading-4 text-blue-50 transition-colors hover:border-cyan-200/60 hover:bg-[#1c4fb6]/45 hover:text-white"
                        title={q}
                        type="button"
                      >
                        <span className="block overflow-hidden whitespace-nowrap">{q}</span>
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
                  placeholder={isThinking ? "SocioAssist is thinking..." : isTyping ? "SocioAssist is replying... (send to interrupt)" : "Ask anything or paste a URL"}
                  disabled={isThinking}
                  className="flex-1 min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-100/65 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-300/30 transition"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  className="h-10 w-10 rounded-xl bg-[#1d63de] text-white flex items-center justify-center transition-all hover:bg-[#3477e9] hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-blue-100/75">
                <span>{isThinking ? "Assistant is thinking" : isTyping ? "Assistant is streaming (send to interrupt)" : "Press Enter to send"}</span>
                <div className="flex items-center gap-2">
                  {dailyUsage && (
                    <span className={`rounded-full border px-2 py-0.5 ${dailyUsage.remaining <= 1 ? "border-amber-300/55 text-amber-100" : "border-emerald-300/45 text-emerald-100"}`}>
                      AI chat limit left today: {dailyUsage.remaining}/{dailyUsage.limit}
                    </span>
                  )}
                  <button type="button" onClick={resetChat} className="hover:text-white transition-colors underline underline-offset-2">
                    Reset chat
                  </button>
                </div>
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

