"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import TextType from "@/components/TextType";

/* ─── Types ─────────────────────────────────────────── */
interface Message { role: "user" | "assistant"; content: string }
interface WebFetchResponse {
  ok: boolean;
  url: string;
  title: string;
  description?: string;
  summary: string;
  highlights?: string[];
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
  followUps?: string[];
}

interface ProgressiveFlowState {
  question: string;
  chunks: string[];
  nextChunkIndex: number;
  followUps: string[];
}

interface TypoCorrectionResult {
  correctedInput: string;
  replacements: Array<{ from: string; to: string }>;
}

/* ─── Suggested Prompt Sets ─────────────────────────── */
const GLOBAL_INBUILT_QA: InbuiltPromptQA[] = [
  {
    question: "What is SOCIO?",
    answer: "SOCIO is Christ University's event platform for discovering, registering, and managing campus events and activities.",
    followUps: ["What can I do?", "Where start?"],
  },
  {
    question: "What can I do?",
    answer: "You can discover events, register, track attendance, explore fests, and use support resources from one place.",
    followUps: ["Events listed?", "Fests listed?"],
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
    followUps: ["Open Discover?", "Events listed?"],
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
    followUps: ["Help Center?", "Report issue?"],
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
    followUps: ["Open Discover?", "Events listed?"],
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
const UNKNOWN_ANSWER_MESSAGE = "I am here to help. Please share your question in one short line and I will answer right away.";
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

const SMALL_TALK_TOKENS = new Set([
  "hi",
  "hii",
  "hiii",
  "hey",
  "heyy",
  "hello",
  "yo",
  "sup",
  "hola",
  "namaste",
  "ok",
  "okay",
  "thanks",
  "thankyou",
  "thx",
]);

const KNOWN_SHORT_INTENT_TOKENS = new Set([
  "about",
  "auth",
  "cookie",
  "cookies",
  "contact",
  "discover",
  "dashboard",
  "home",
  "event",
  "events",
  "faq",
  "fest",
  "fests",
  "founder",
  "founders",
  "help",
  "manage",
  "mission",
  "pricing",
  "privacy",
  "profile",
  "register",
  "registration",
  "socio",
  "story",
  "support",
  "team",
  "terms",
]);

const BASE_TYPO_DICTIONARY_WORDS = [
  "about",
  "auth",
  "hello",
  "hey",
  "hi",
  "contact",
  "cookies",
  "dashboard",
  "discover",
  "event",
  "events",
  "faq",
  "fest",
  "fests",
  "founder",
  "founders",
  "go",
  "help",
  "home",
  "login",
  "manage",
  "masteradmin",
  "mission",
  "open",
  "pricing",
  "privacy",
  "profile",
  "register",
  "registration",
  "show",
  "signin",
  "socio",
  "story",
  "support",
  "team",
  "terms",
  "visit",
];

const FLOW_CONTINUE_LABEL = "Continue";
const FLOW_RECAP_LABEL = "Quick recap";
const FLOW_SKIP_LABEL = "Show other prompts";
const LOCAL_STREAM_STEP_DELAY_MS = 36;

function splitIntoProgressiveChunks(answer: string): string[] {
  const normalized = answer.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentenceMatches = normalized.match(/[^.!?]+[.!?]?/g);
  const sentences = (sentenceMatches || [normalized])
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const candidate = currentChunk
      ? `${currentChunk} ${sentence}`
      : sentence;

    if (candidate.length <= 170) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) chunks.push(currentChunk);
    currentChunk = sentence;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [normalized];
}

function formatProgressiveChunkMessage(
  question: string,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): string {
  const intro =
    totalChunks > 1
      ? `Let's go step-by-step for "${question}" (${chunkIndex + 1}/${totalChunks}).`
      : `Here is a quick answer for "${question}".`;

  const outro =
    chunkIndex < totalChunks - 1
      ? `\n\nWould you like the next step? Tap "${FLOW_CONTINUE_LABEL}".`
      : "";

  return `${intro}\n\n${chunk}${outro}`;
}

function isContinueFlowIntent(input: string): boolean {
  const normalized = normalizePromptForMatch(input);
  return normalized === normalizePromptForMatch(FLOW_CONTINUE_LABEL)
    || /^(next|continue|go on|yes|step \d+)$/i.test(normalized);
}

function isRecapFlowIntent(input: string): boolean {
  const normalized = normalizePromptForMatch(input);
  return normalized === normalizePromptForMatch(FLOW_RECAP_LABEL)
    || /recap|summary|summarize/i.test(normalized);
}

function isSkipFlowIntent(input: string): boolean {
  const normalized = normalizePromptForMatch(input);
  return normalized === normalizePromptForMatch(FLOW_SKIP_LABEL)
    || /show (other|more) prompts|skip/i.test(normalized);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeLooseInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyNonsenseToken(token: string): boolean {
  if (!token) return false;
  if (SMALL_TALK_TOKENS.has(token)) return false;
  if (KNOWN_SHORT_INTENT_TOKENS.has(token)) return false;
  if (/^\d+$/.test(token)) return true;
  if (/^(.)\1{2,}$/.test(token)) return true;
  if (token.length <= 2) return true;
  if (!/[aeiou]/.test(token) && token.length >= 3) return true;
  return false;
}

function getMaxTypoDistance(tokenLength: number): number {
  if (tokenLength <= 4) return 1;
  if (tokenLength <= 8) return 2;
  return 3;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1).fill(0);
  const curr = new Array(b.length + 1).fill(0);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function findClosestDictionaryWord(token: string, dictionaryWords: string[]): string | null {
  const maxDistance = getMaxTypoDistance(token.length);
  let bestWord: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of dictionaryWords) {
    if (!candidate || candidate === token) continue;
    if (Math.abs(candidate.length - token.length) > maxDistance) continue;
    if (candidate[0] !== token[0]) continue;

    const distance = levenshteinDistance(token, candidate);
    if (distance === 0 || distance > maxDistance) continue;

    const normalizedDistance = distance / Math.max(token.length, candidate.length);
    if (normalizedDistance > 0.36) continue;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestWord = candidate;
    }
  }

  return bestWord;
}

function detectTypoCorrection(
  input: string,
  dictionaryWords: string[],
  dictionaryLookup: Set<string>
): TypoCorrectionResult | null {
  const normalized = normalizeLooseInput(input);
  if (!normalized) return null;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const replacements: Array<{ from: string; to: string }> = [];
  const correctedTokens = tokens.map((token) => {
    if (token.length < 3 || token.length > 24) return token;
    if (SMALL_TALK_TOKENS.has(token)) return token;
    if (dictionaryLookup.has(token)) return token;

    const suggestion = findClosestDictionaryWord(token, dictionaryWords);
    if (!suggestion) return token;

    replacements.push({ from: token, to: suggestion });
    return suggestion;
  });

  if (replacements.length === 0) return null;

  if (replacements.length > Math.ceil(tokens.length * 0.65)) {
    return null;
  }

  return {
    correctedInput: correctedTokens.join(" "),
    replacements,
  };
}

function detectDirectPageIntent(input: string): { path: string; label: string } | null {
  const token = normalizeLooseInput(input);
  if (!token || token.includes(" ")) return null;

  if (token === "events" || token === "event") return { path: "/events", label: "Events" };
  if (token === "fests" || token === "fest") return { path: "/fests", label: "Fests" };
  if (token === "discover") return { path: "/Discover", label: "Discover" };
  if (token === "profile" || token === "account") return { path: "/profile", label: "Profile" };
  if (token === "manage") return { path: "/manage", label: "Manage" };
  if (token === "masteradmin" || token === "admin") return { path: "/masteradmin", label: "Master Admin" };
  if (token === "auth" || token === "signin" || token === "login") return { path: "/auth", label: "Sign In" };
  if (token === "support") return { path: "/support", label: "Support" };
  if (token === "contact") return { path: "/contact", label: "Contact" };
  if (token === "pricing") return { path: "/pricing", label: "Pricing" };
  if (token === "faq") return { path: "/faq", label: "FAQ" };
  if (token === "privacy") return { path: "/privacy", label: "Privacy" };
  if (token === "terms") return { path: "/terms", label: "Terms" };
  if (token === "cookies" || token === "cookie") return { path: "/cookies", label: "Cookies" };
  if (token === "about") return { path: "/about", label: "About" };
  if (token === "home" || token === "dashboard") return { path: "/", label: "Home" };

  return null;
}

function getLowSignalLocalReply(input: string, pathname: string): string | null {
  const normalized = normalizeLooseInput(input);

  if (!normalized) {
    return "I am online and ready. Ask me anything about SOCIO, events, fests, or support.";
  }

  if (/^(start|menu|options)$/.test(normalized)) {
    return HELP_MESSAGE;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length !== 1) {
    return null;
  }

  const token = tokens[0];
  if (SMALL_TALK_TOKENS.has(token)) {
    const pageHint = pathname ? ` You are currently on ${pathname}.` : "";
    return `Hi! I am SocioAssist and I am ready to help.${pageHint} Ask me about events, fests, registrations, founders, support, or any general question.`;
  }

  if (isLikelyNonsenseToken(token)) {
    return "I got your message. Share a little more context and I will help instantly. Example: 'show upcoming events' or 'who are Socio co-founders'.";
  }

  return null;
}

function inferSocioKnowledgeTarget(input: string, origin: string): { url: string; query: string; label: string } | null {
  const lower = input.toLowerCase();
  const hasWebsiteTopicCue = /(co[-\s]?founder|founders?|about us|mission|story|timeline|contact|faq|support|privacy|terms|cookies|pricing|what is socio|about socio)/.test(lower);
  const hasSocioCue = /\bsocio\b|this (site|website|platform|app)|your (site|website|platform|app)/.test(lower) || hasWebsiteTopicCue;
  if (!hasSocioCue) return null;

  const base = origin.replace(/\/$/, "");

  if (/(co[-\s]?founder|founders?|who (created|made|built)|team|lead developer)/.test(lower)) {
    return {
      url: `${base}/about/team`,
      query: "co founders founders team",
      label: "About Team",
    };
  }

  if (/(mission|vision|purpose|values)/.test(lower)) {
    return {
      url: `${base}/about/mission`,
      query: "mission values purpose",
      label: "Mission",
    };
  }

  if (/(story|journey|timeline|how .* started)/.test(lower)) {
    return {
      url: `${base}/about/story`,
      query: "story timeline journey",
      label: "About Story",
    };
  }

  if (/(contact|email|phone|call|reach|support number)/.test(lower)) {
    return {
      url: `${base}/contact`,
      query: "contact email phone support",
      label: "Contact",
    };
  }

  if (/(faq|frequently asked|common question)/.test(lower)) {
    return {
      url: `${base}/faq`,
      query: "frequently asked questions",
      label: "FAQ",
    };
  }

  if (/(support|help center|report issue|submit idea)/.test(lower)) {
    return {
      url: `${base}/support`,
      query: "support help center",
      label: "Support",
    };
  }

  if (/(privacy|personal data|delete data|data rights)/.test(lower)) {
    return {
      url: `${base}/privacy`,
      query: "privacy data rights deletion",
      label: "Privacy",
    };
  }

  if (/(terms|conditions|tos)/.test(lower)) {
    return {
      url: `${base}/terms`,
      query: "terms conditions",
      label: "Terms",
    };
  }

  if (/(cookie|tracking)/.test(lower)) {
    return {
      url: `${base}/cookies`,
      query: "cookies tracking",
      label: "Cookies",
    };
  }

  if (/(pricing|price|plan|subscription|cost)/.test(lower)) {
    return {
      url: `${base}/pricing`,
      query: "pricing plans cost",
      label: "Pricing",
    };
  }

  if (/(what is socio|about socio|what does socio do)/.test(lower)) {
    return {
      url: `${base}/about`,
      query: "what is socio platform",
      label: "About",
    };
  }

  return null;
}

function renderInlineFormattedText(text: string): React.ReactNode[] {
  const segments = text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter((segment) => segment.length > 0);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
      return (
        <strong key={`strong-${index}`} className="font-semibold text-white">
          {segment.slice(2, -2)}
        </strong>
      );
    }

    if (segment.startsWith("`") && segment.endsWith("`") && segment.length > 2) {
      return (
        <code
          key={`code-${index}`}
          className="rounded-md border border-cyan-200/35 bg-[#0a214f] px-1.5 py-0.5 text-[12px] text-cyan-100"
        >
          {segment.slice(1, -1)}
        </code>
      );
    }

    return <span key={`txt-${index}`}>{segment}</span>;
  });
}

function renderAssistantContent(content: string): React.ReactNode {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const normalizedBlocks = blocks.length > 0 ? blocks : [content.trim()];

  return normalizedBlocks.map((block, blockIndex) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const isBulletList = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
    const isOrderedList = lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));

    if (isBulletList) {
      return (
        <ul key={`ul-${blockIndex}`} className="ml-4 list-disc space-y-1 text-blue-50/95">
          {lines.map((line, lineIndex) => (
            <li key={`ul-${blockIndex}-${lineIndex}`}>{renderInlineFormattedText(line.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }

    if (isOrderedList) {
      return (
        <ol key={`ol-${blockIndex}`} className="ml-4 list-decimal space-y-1 text-blue-50/95">
          {lines.map((line, lineIndex) => (
            <li key={`ol-${blockIndex}-${lineIndex}`}>{renderInlineFormattedText(line.replace(/^\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }

    return (
      <p key={`p-${blockIndex}`} className="text-blue-50/95">
        {renderInlineFormattedText(block)}
      </p>
    );
  });
}

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

  if (lower.includes("message is required")) {
    return "Please type at least one word and I will respond instantly.";
  }

  if (
    lower.includes("high usage") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return "AI assistant is temporarily unavailable due to high usage. Please try again later.";
  }

  return "I hit a temporary issue while generating that answer. Please rephrase your question and I will try again.";
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
  const highlights = Array.isArray(data.highlights)
    ? data.highlights.map((entry) => entry.trim()).filter(Boolean)
    : [];

  if (highlights.length > 0) {
    return highlights.join("\n\n");
  }

  const lines: string[] = [];

  if (data.description && !data.summary.toLowerCase().includes(data.description.toLowerCase())) {
    lines.push(data.description.trim());
  }

  if (data.summary?.trim()) {
    lines.push(data.summary.trim());
  }

  if (lines.length === 0) {
    return "I fetched that page successfully, but I could not extract enough readable details yet.";
  }

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
  const localStreamVersionRef = useRef(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showFabPulse, setShowFabPulse] = useState(true);
  const [dailyUsage, setDailyUsage] = useState<ChatUsage | null>(null);
  const [activeFlow, setActiveFlow] = useState<ProgressiveFlowState | null>(null);

  const inbuiltPromptQA = useMemo(() => getInbuiltPromptQA(pathname), [pathname]);
  const quickPrompts = useMemo(
    () => inbuiltPromptQA.map((entry) => entry.question),
    [inbuiltPromptQA]
  );
  const inbuiltPromptMap = useMemo(() => {
    const map = new Map<string, InbuiltPromptQA>();
    for (const entry of inbuiltPromptQA) {
      map.set(normalizePromptForMatch(entry.question), entry);
    }
    return map;
  }, [inbuiltPromptQA]);
  const typoDictionaryWords = useMemo(() => {
    const words = new Set<string>(BASE_TYPO_DICTIONARY_WORDS);
    for (const prompt of quickPrompts) {
      const promptWords = normalizeLooseInput(prompt)
        .split(" ")
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && word.length <= 24);

      for (const word of promptWords) {
        words.add(word);
      }
    }

    return Array.from(words);
  }, [quickPrompts]);
  const typoDictionaryLookup = useMemo(
    () => new Set<string>(typoDictionaryWords),
    [typoDictionaryWords]
  );
  const isTyping = isStreaming;

  const asked = messages.filter((m) => m.role === "user").map((m) => m.content);
  const unseenSuggestions = quickPrompts.filter((q) => !asked.includes(q));
  const suggestionPool = unseenSuggestions.length > 0
    ? unseenSuggestions
    : quickPrompts;

  const visibleSuggestions = useMemo(() => {
    if (!activeFlow) {
      return suggestionPool.slice(0, 4);
    }

    const contextualFollowUps = activeFlow.followUps.length > 0
      ? activeFlow.followUps
      : suggestionPool.filter((prompt) => prompt !== activeFlow.question);

    const merged = [
      FLOW_CONTINUE_LABEL,
      FLOW_RECAP_LABEL,
      ...contextualFollowUps,
      FLOW_SKIP_LABEL,
    ];

    return Array.from(new Set(merged)).slice(0, 4);
  }, [activeFlow, suggestionPool]);

  const typingPromptTexts = useMemo(() => {
    if (activeFlow) {
      const flowTexts = [FLOW_CONTINUE_LABEL, FLOW_RECAP_LABEL, FLOW_SKIP_LABEL];
      const contextualFollowUps = activeFlow.followUps.length > 0
        ? activeFlow.followUps
        : suggestionPool.filter((prompt) => prompt !== activeFlow.question).slice(0, 2);

      return Array.from(new Set([...flowTexts, ...contextualFollowUps])).map((entry) => `Try: ${entry}`);
    }

    return suggestionPool.slice(0, 5).map((entry) => `Try: ${entry}`);
  }, [activeFlow, suggestionPool]);

  const resetChat = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }

    localStreamVersionRef.current += 1;
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setActiveFlow(null);
    setInput("");
    setIsThinking(false);
    setIsStreaming(false);
  }, []);

  const appendAssistantMessage = useCallback(async (content: string, streamLocally = true) => {
    const message = content.trim();
    if (!message) return;

    setIsThinking(false);

    if (!streamLocally) {
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      return;
    }

    const streamVersion = ++localStreamVersionRef.current;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    const tokens = message.match(/\S+\s*/g) || [message];
    let built = "";

    try {
      for (const token of tokens) {
        if (localStreamVersionRef.current !== streamVersion) {
          return;
        }

        built += token;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const lastIndex = next.length - 1;

          if (next[lastIndex].role === "assistant") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: built,
            };
          }

          return next;
        });

        await wait(LOCAL_STREAM_STEP_DELAY_MS);
      }
    } finally {
      if (localStreamVersionRef.current === streamVersion) {
        setIsStreaming(false);
      }
    }
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

    const lowSignalReply = getLowSignalLocalReply(trimmed, pathname);
    if (lowSignalReply) {
      return lowSignalReply;
    }

    const directPageTarget = detectDirectPageIntent(trimmed);
    if (directPageTarget) {
      if (directPageTarget.path === pathname) {
        return `You're already on the ${directPageTarget.label} page.`;
      }

      router.push(directPageTarget.path);
      return `Opening ${directPageTarget.label} now. Tell me what you want to do next on that page.`;
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

    const websiteTarget = inferSocioKnowledgeTarget(trimmed, window.location.origin);
    if (websiteTarget) {
      try {
        const data = await fetchWebSummary(websiteTarget.url, websiteTarget.query);
        return buildWebReply(data);
      } catch (error) {
        console.error("Website knowledge fetch failed:", error);
      }
    }

    return null;
  }, [fetchWebSummary, pathname, router]);

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

    const streamVersion = ++localStreamVersionRef.current;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsThinking(false);
    setIsStreaming(true);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let carryToken = "";
    let rendered = "";

    const pushRendered = () => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const lastIndex = next.length - 1;

        if (next[lastIndex].role === "assistant") {
          next[lastIndex] = {
            ...next[lastIndex],
            content: rendered,
          };
        } else {
          next.push({ role: "assistant", content: rendered });
        }

        return next;
      });
    };

    const streamByWords = async (incomingText: string, flushRemainder = false) => {
      const merged = carryToken + incomingText;
      const tokens = merged.match(/\S+\s*/g) || [];

      if (flushRemainder) {
        carryToken = "";
      } else if (!/\s$/.test(merged) && tokens.length > 0) {
        carryToken = tokens.pop() || "";
      } else {
        carryToken = "";
      }

      for (const token of tokens) {
        if (localStreamVersionRef.current !== streamVersion) {
          return;
        }

        rendered += token;
        pushRendered();
        await wait(LOCAL_STREAM_STEP_DELAY_MS);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        await streamByWords(chunk);
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        await streamByWords(finalChunk);
      }

      if (carryToken && localStreamVersionRef.current === streamVersion) {
        rendered += carryToken;
        carryToken = "";
        pushRendered();
      }

      if (!rendered.trim()) {
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
      if (rendered.trim()) {
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
      localStreamVersionRef.current += 1;
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

    localStreamVersionRef.current += 1;

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
      if (activeFlow && isSkipFlowIntent(trimmed)) {
        setActiveFlow(null);
        await appendAssistantMessage("Sure, let's switch topics. Pick a prompt below or ask me anything.");
        return;
      }

      if (activeFlow && isRecapFlowIntent(trimmed)) {
        const deliveredChunks = activeFlow.chunks.slice(0, activeFlow.nextChunkIndex);
        const hasNext = activeFlow.nextChunkIndex < activeFlow.chunks.length;
        const recapMessage = [
          `Quick recap for "${activeFlow.question}":`,
          deliveredChunks.join(" "),
          hasNext
            ? `\nWould you like to continue? Tap "${FLOW_CONTINUE_LABEL}" for the next step.`
            : "\nYou've reached the final step. Want to explore a related prompt?",
        ].join("\n\n");

        await appendAssistantMessage(recapMessage);
        return;
      }

      if (activeFlow && isContinueFlowIntent(trimmed)) {
        const chunkIndex = activeFlow.nextChunkIndex;
        if (chunkIndex >= activeFlow.chunks.length) {
          setActiveFlow(null);
          await appendAssistantMessage("We've reached the end of that answer. Pick a related prompt and I'll continue.");
          return;
        }

        const chunkMessage = formatProgressiveChunkMessage(
          activeFlow.question,
          activeFlow.chunks[chunkIndex],
          chunkIndex,
          activeFlow.chunks.length
        );

        const nextIndex = chunkIndex + 1;
        if (nextIndex >= activeFlow.chunks.length) {
          setActiveFlow(null);
        } else {
          setActiveFlow((prev) =>
            prev
              ? {
                  ...prev,
                  nextChunkIndex: nextIndex,
                }
              : prev
          );
        }

        await appendAssistantMessage(chunkMessage);
        return;
      }

      const inbuiltEntry = inbuiltPromptMap.get(normalizePromptForMatch(trimmed));
      if (inbuiltEntry) {
        const chunks = splitIntoProgressiveChunks(inbuiltEntry.answer);
        if (chunks.length === 0) {
          setActiveFlow(null);
          await appendAssistantMessage(UNKNOWN_ANSWER_MESSAGE, false);
          return;
        }

        const firstChunkMessage = formatProgressiveChunkMessage(
          inbuiltEntry.question,
          chunks[0],
          0,
          chunks.length
        );

        if (chunks.length > 1) {
          setActiveFlow({
            question: inbuiltEntry.question,
            chunks,
            nextChunkIndex: 1,
            followUps: inbuiltEntry.followUps || [],
          });
        } else {
          setActiveFlow(null);
        }

        await appendAssistantMessage(firstChunkMessage);
        return;
      }

      if (activeFlow) {
        setActiveFlow(null);
      }

      const typoCorrection = detectTypoCorrection(
        trimmed,
        typoDictionaryWords,
        typoDictionaryLookup
      );
      const normalizedOriginalInput = normalizeLooseInput(trimmed);
      let correctedInput = typoCorrection?.correctedInput || trimmed;
      const normalizedCorrectedInput = normalizeLooseInput(correctedInput);
      const shouldCanonicalizeGreeting = SMALL_TALK_TOKENS.has(normalizedCorrectedInput);

      if (shouldCanonicalizeGreeting) {
        correctedInput = "hi";
      }

      const shouldAnnounceTypo = Boolean(
        typoCorrection && normalizedOriginalInput !== normalizeLooseInput(correctedInput)
      );

      if (shouldAnnounceTypo) {
        await appendAssistantMessage(
          `Did you mean "${correctedInput}"? I will use that and help you now.`,
          false
        );
      }

      const correctedInbuiltEntry = inbuiltPromptMap.get(normalizePromptForMatch(correctedInput));
      if (correctedInbuiltEntry) {
        const chunks = splitIntoProgressiveChunks(correctedInbuiltEntry.answer);
        if (chunks.length === 0) {
          setActiveFlow(null);
          await appendAssistantMessage(UNKNOWN_ANSWER_MESSAGE, false);
          return;
        }

        const firstChunkMessage = formatProgressiveChunkMessage(
          correctedInbuiltEntry.question,
          chunks[0],
          0,
          chunks.length
        );

        if (chunks.length > 1) {
          setActiveFlow({
            question: correctedInbuiltEntry.question,
            chunks,
            nextChunkIndex: 1,
            followUps: correctedInbuiltEntry.followUps || [],
          });
        } else {
          setActiveFlow(null);
        }

        await appendAssistantMessage(firstChunkMessage);
        return;
      }

      const localReply = await generateLocalReply(correctedInput);
      if (localReply) {
        await appendAssistantMessage(localReply);
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
        await streamChatReply(correctedInput, history);
      } catch (streamError) {
        if (streamError instanceof Error && streamError.name === "AbortError") {
          return;
        }

        const fallbackReply = await requestChatReply(correctedInput, history);
        await appendAssistantMessage(fallbackReply);
      }
    } catch (error) {
      const message = getUserFacingErrorMessage(error);
      await appendAssistantMessage(message, false);
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
                  <TextType
                    as="p"
                    text="SocioAssist"
                    typingSpeed={42}
                    deletingSpeed={24}
                    pauseDuration={600}
                    loop={false}
                    showCursor
                    cursorCharacter="_"
                    cursorClassName="text-cyan-100"
                    className="font-semibold text-sm leading-none"
                  />
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
                  <div className={`max-w-[86%] px-4 py-3 rounded-2xl text-[13px] sm:text-sm leading-6 break-words overflow-hidden backdrop-blur-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[#2d7bf8] via-[#1f63de] to-[#154CB3] border border-blue-200/35 text-white rounded-br-md shadow-[0_10px_24px_-12px_rgba(31,99,222,0.95)]"
                      : "bg-white/10 border border-white/15 text-blue-50 rounded-bl-md space-y-2"
                  }`}>
                    {msg.role === "assistant"
                      ? (i === 0 && msg.content === WELCOME_MESSAGE
                        ? (
                          <TextType
                            as="div"
                            text={msg.content}
                            typingSpeed={26}
                            deletingSpeed={18}
                            pauseDuration={1200}
                            loop={false}
                            showCursor
                            cursorCharacter="_"
                            cursorClassName="text-cyan-200"
                            className="text-blue-50/95"
                          />
                        )
                        : i === messages.length - 1 && (isTyping || isThinking)
                          ? (
                            <TextType
                              as="div"
                              text={msg.content}
                              typingSpeed={20}
                              deletingSpeed={12}
                              pauseDuration={900}
                              loop={false}
                              showCursor
                              cursorCharacter="_"
                              cursorClassName="text-cyan-200"
                              className="text-blue-50/95"
                            />
                          )
                          : renderAssistantContent(msg.content))
                      : msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator (before message arrives) */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/10 border border-white/10 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              {visibleSuggestions.length > 0 && !isTyping && !isThinking && !input.trim() && (
                <div className="mt-3 rounded-2xl border border-blue-200/20 bg-[#10275d]/45 px-3 py-3">
                  <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/85">
                    {activeFlow ? "Continue this answer" : "Try a quick prompt"}
                  </p>
                  <div className="mb-3 text-center text-[12px] text-cyan-100/90">
                    <TextType
                      as="span"
                      text={typingPromptTexts}
                      typingSpeed={34}
                      deletingSpeed={20}
                      pauseDuration={1100}
                      showCursor
                      cursorCharacter="_"
                      cursorClassName="text-cyan-200/85"
                      className="inline"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {visibleSuggestions.map((q) => {
                      const isPrimaryFlowAction = activeFlow && q === FLOW_CONTINUE_LABEL;
                      const isSecondaryFlowAction = activeFlow && (q === FLOW_RECAP_LABEL || q === FLOW_SKIP_LABEL);

                      return (
                        <button
                          key={q}
                          onClick={() => handleQuestion(q)}
                          className={`inline-flex max-w-full items-center rounded-full border px-3.5 py-2 text-xs font-medium leading-4 transition-all ${
                            isPrimaryFlowAction
                              ? "border-cyan-200/75 bg-cyan-300/15 text-cyan-50 shadow-[0_8px_20px_-12px_rgba(34,211,238,0.95)]"
                              : isSecondaryFlowAction
                                ? "border-blue-200/45 bg-[#173b77]/60 text-blue-50 hover:border-blue-100/65 hover:bg-[#24509a]"
                                : "border-blue-200/35 bg-[#13397d]/45 text-blue-50 hover:border-cyan-200/60 hover:bg-[#1c4fb6]/45 hover:text-white"
                          }`}
                          title={q}
                          type="button"
                        >
                          <span className="truncate">{q}</span>
                        </button>
                      );
                    })}
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
                  placeholder={
                    isThinking
                      ? "SocioAssist is thinking..."
                      : isTyping
                        ? "SocioAssist is replying... (send to interrupt)"
                        : activeFlow
                          ? `Type "${FLOW_CONTINUE_LABEL}" or ask a related question`
                          : "Ask anything or paste a URL"
                  }
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
                <span>
                  {isThinking
                    ? "Assistant is thinking"
                    : isTyping
                      ? "Assistant is streaming (send to interrupt)"
                      : activeFlow
                        ? `Step-by-step mode active (${activeFlow.nextChunkIndex}/${activeFlow.chunks.length} delivered)`
                        : "Press Enter to send"}
                </span>
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
              <span className="absolute inset-0 rounded-full bg-[#154CB3]/40 animate-ping [animation-iteration-count:2]" />
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

