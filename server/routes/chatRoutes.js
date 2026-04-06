import express from "express";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { getFestTableForSupabase } from "../utils/festTableResolver.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_HISTORY_MESSAGES = 24;

// Lazy-init OpenAI - do not crash startup if key is missing
let openAI = null;
function getOpenAI() {
  if (!openAI && process.env.OPENAI_API_KEY) {
    openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openAI;
}

// Lazy-init Gemini — don't crash if key is missing at startup
let genAI = null;
function getGenAI() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabase;
}

const SYSTEM_PROMPT = `You are SocioAssist, a helpful assistant for the Socio university event platform at Christ University.

You help students with:
- Finding events and fests
- Registration questions
- Platform navigation (how to create events, manage attendance, etc.)
- General university event queries

Rules:
- Be concise and friendly
- If you don't know something specific, suggest checking the events page or contacting support
- Never make up event details — only use data provided in context
- Keep responses under 150 words
- When user asks about "this event" or "this fest", refer to the current page context`;

// Per-user daily limit storage
const dailyLimitMap = new Map();

// Clean up old entries every hour
const dailyLimitCleanupInterval = setInterval(() => {
  const today = new Date().toDateString();
  for (const [key] of dailyLimitMap.entries()) {
    if (!key.includes(today)) {
      dailyLimitMap.delete(key);
    }
  }
}, 3600000);

if (typeof dailyLimitCleanupInterval.unref === "function") {
  dailyLimitCleanupInterval.unref();
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((msg) => typeof msg?.content === "string" && msg.content.trim())
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: String(msg.content).trim(),
    }))
    .slice(-MAX_HISTORY_MESSAGES);
}

function buildOpenAIHistory(history) {
  return normalizeHistory(history).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

function buildGeminiHistory(history) {
  return normalizeHistory(history).map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
}

function getFriendlyError(error) {
  const message = String(error?.message || "");
  const lowerMessage = message.toLowerCase();
  const statusCode = typeof error?.status === "number" ? error.status : 0;
  const code = String(error?.code || "").toLowerCase();

  if (
    statusCode === 429 ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("rate limit") ||
    code.includes("rate_limit")
  ) {
    return {
      status: 503,
      error: "AI assistant is temporarily unavailable due to high usage. Please try again later.",
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("api_key") ||
    code.includes("invalid_api_key")
  ) {
    return {
      status: 503,
      error: "AI service configuration error. Please contact support.",
    };
  }

  if (statusCode === 404 || lowerMessage.includes("not found")) {
    return {
      status: 503,
      error: "AI model temporarily unavailable. Please try again later.",
    };
  }

  return {
    status: 500,
    error: "Failed to generate response. Please try again.",
  };
}

function setStreamHeaders(res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
}

async function buildFullSystemPrompt(currentPage, userId) {
  let pageContext = "";
  let platformContext = "No platform data available.";
  const sb = getSupabase();

  if (sb) {
    try {
      let festTable = null;
      festTable = await getFestTableForSupabase(sb);

      // If on a specific event page, fetch that event
      if (currentPage.startsWith("/event/")) {
        const eventId = currentPage.split("/event/")[1];
        if (eventId) {
          const { data: event } = await sb
            .from("events")
            .select("*")
            .eq("event_id", eventId)
            .single();

          if (event) {
            pageContext = `\n\nCURRENT EVENT PAGE:\nTitle: ${event.title}\nDate: ${new Date(event.event_date).toLocaleDateString()}\nVenue: ${event.venue || "TBA"}\nType: ${event.event_type || "N/A"}\nCategory: ${event.category || "N/A"}\nDepartment: ${event.organizing_dept}\nFee: ${event.registration_fee ? `Rs.${event.registration_fee}` : "Free"}\nDescription: ${event.description}\nRegistrations: ${event.registration_count || 0}`;
          }
        }
      }

      // If on a specific fest page, fetch that fest
      if (currentPage.startsWith("/fest/")) {
        const festId = currentPage.split("/fest/")[1];
        if (festId) {
          const { data: fest } = await sb
            .from(festTable || "fests")
            .select("*")
            .eq("fest_id", festId)
            .single();

          if (fest) {
            pageContext = `\n\nCURRENT FEST PAGE:\nName: ${fest.fest_title}\nStart: ${new Date(fest.opening_date).toLocaleDateString()}\nEnd: ${new Date(fest.closing_date).toLocaleDateString()}\nVenue: ${fest.venue || "TBA"}\nDepartment: ${fest.organizing_dept}\nDescription: ${fest.description}`;
          }
        }
      }

      // If on profile page, fetch user's registrations
      if (currentPage === "/profile") {
        const { data: userRegs } = await sb
          .from("registrations")
          .select("event_id, created_at")
          .eq("register_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (userRegs && userRegs.length > 0) {
          pageContext = `\n\nYOUR PROFILE DATA:\nTotal Registrations: ${userRegs.length}\nRecent: ${userRegs.slice(0, 5).map((r) => `Event ID ${r.event_id} on ${new Date(r.created_at).toLocaleDateString()}`).join(", ")}`;
        } else {
          pageContext = "\n\nYOUR PROFILE DATA:\nYou haven't registered for any events yet.";
        }
      }

      // Fetch general platform data (non-fatal if it fails)
      const { data: events } = await sb
        .from("events")
        .select("title, event_date, venue, organizing_dept, category")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(10);

      const { data: fests } = await sb
        .from(festTable || "fests")
        .select("fest_title, opening_date, closing_date, venue")
        .gte("closing_date", new Date().toISOString())
        .limit(5);

      platformContext = `
UPCOMING EVENTS:
${events?.map((e) => `- ${e.title} | ${new Date(e.event_date).toLocaleDateString()} | ${e.venue || "TBA"} | ${e.organizing_dept || ""}`).join("\n") || "No upcoming events"}

ACTIVE FESTS:
${fests?.map((f) => `- ${f.fest_title} | ${new Date(f.opening_date).toLocaleDateString()} to ${new Date(f.closing_date).toLocaleDateString()} | ${f.venue || "TBA"}`).join("\n") || "No active fests"}`;
    } catch (contextErr) {
      console.error("[ChatBot] Error fetching context data (non-fatal):", contextErr.message);
    }
  }

  return `${SYSTEM_PROMPT}\n\nPLATFORM DATA:\n${platformContext}${pageContext}`;
}

async function getOpenAIReply({ message, history, fullSystemPrompt }) {
  const ai = getOpenAI();
  if (!process.env.OPENAI_API_KEY || !ai) {
    throw new Error("OPENAI_UNAVAILABLE");
  }

  const completion = await ai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_tokens: 320,
    messages: [
      { role: "system", content: fullSystemPrompt },
      ...buildOpenAIHistory(history),
      { role: "user", content: message },
    ],
  });

  const reply = completion?.choices?.[0]?.message?.content;
  if (!reply || !String(reply).trim()) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  return String(reply).trim();
}

async function streamOpenAIReply({ res, message, history, fullSystemPrompt, signal }) {
  const ai = getOpenAI();
  if (!process.env.OPENAI_API_KEY || !ai) {
    throw new Error("OPENAI_UNAVAILABLE");
  }

  const stream = await ai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_tokens: 320,
    stream: true,
    messages: [
      { role: "system", content: fullSystemPrompt },
      ...buildOpenAIHistory(history),
      { role: "user", content: message },
    ],
  }, { signal });

  let reply = "";
  try {
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      let token = "";

      if (typeof delta === "string") {
        token = delta;
      } else if (Array.isArray(delta)) {
        token = delta
          .map((part) => (typeof part === "string" ? part : part?.text || ""))
          .join("");
      }

      if (!token) continue;
      reply += token;

      if (res.writableEnded) {
        break;
      }

      res.write(token);
    }
  } catch (error) {
    if (reply.trim()) {
      console.error("[ChatBot] OpenAI stream interrupted after partial output:", error.message);
      return reply;
    }
    throw error;
  }

  if (!reply.trim()) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  return reply;
}

async function getGeminiReply({ message, history, fullSystemPrompt }) {
  const ai = getGenAI();
  if (!process.env.GEMINI_API_KEY || !ai) {
    throw new Error("GEMINI_UNAVAILABLE");
  }

  const model = ai.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: fullSystemPrompt,
  });

  const chat = model.startChat({
    history: buildGeminiHistory(history),
  });

  const result = await chat.sendMessage(message);
  const reply = result.response.text();

  if (!reply || !String(reply).trim()) {
    throw new Error("GEMINI_EMPTY_RESPONSE");
  }

  return String(reply).trim();
}

// Health check — no auth, no sensitive details.
router.get("/health", (req, res) => {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  res.json({
    status: "ok",
    services: {
      ai: hasOpenAIKey || hasGeminiKey ? "configured" : "missing",
      providers: {
        openai: hasOpenAIKey ? "configured" : "missing",
        gemini: hasGeminiKey ? "configured" : "missing",
      },
      database: hasSupabaseUrl && hasSupabaseKey ? "configured" : "missing",
    },
    timestamp: new Date().toISOString(),
  });
});

router.post("/", authenticateUser, async (req, res) => {
  const userEmail = req.user?.email || "unknown";
  console.log("[ChatBot] Request received from:", userEmail);
  
  const today = new Date().toDateString();
  const key = `${userEmail}_${today}`;

  // Check daily user limit (20 messages per day)
  const count = dailyLimitMap.get(key) || 0;
  if (count >= 20) {
    console.log("[ChatBot] Rate limit hit for:", userEmail);
    return res.status(429).json({
      error: "You've used all 20 daily questions. Please try again tomorrow.",
    });
  }

  try {
    const { message, history = [], context, stream = false } = req.body || {};
    console.log("[ChatBot] Message:", message, "| Page:", context?.page);

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    if (!hasOpenAI && !hasGemini) {
      console.error("[ChatBot] No AI provider key configured!");
      return res.status(503).json({
        error: "AI chatbot is not configured. Please contact support.",
      });
    }

    const currentPage = typeof context?.page === "string" ? context.page : "";
    const userId = context?.userId || userEmail;
    const fullSystemPrompt = await buildFullSystemPrompt(currentPage, userId);

    const disconnectController = new AbortController();
    const onClientClose = () => {
      disconnectController.abort();
    };

    req.on("close", onClientClose);

    try {
      if (stream) {
        setStreamHeaders(res);

        let reply = "";
        let providerUsed = "none";
        let openAIError = null;
        let geminiError = null;

        if (hasOpenAI) {
          try {
            console.log("[ChatBot] Streaming from OpenAI...");
            reply = await streamOpenAIReply({
              res,
              message,
              history,
              fullSystemPrompt,
              signal: disconnectController.signal,
            });
            providerUsed = "openai";
          } catch (error) {
            openAIError = error;
            console.error("[ChatBot] OpenAI stream failed:", error.message);
          }
        }

        if (!reply && hasGemini) {
          try {
            console.log("[ChatBot] Falling back to Gemini (non-stream chunk)...");
            reply = await getGeminiReply({ message, history, fullSystemPrompt });
            providerUsed = "gemini";
            if (!res.writableEnded) {
              res.write(reply);
            }
          } catch (error) {
            geminiError = error;
            console.error("[ChatBot] Gemini fallback failed:", error.message);
          }
        }

        if (!reply) {
          const finalError = geminiError || openAIError || new Error("AI_PROVIDER_UNAVAILABLE");
          const friendly = getFriendlyError(finalError);

          if (!res.headersSent) {
            const payload = { error: friendly.error };
            if (!isProduction) {
              payload.details = finalError.message;
            }
            return res.status(friendly.status).json(payload);
          }

          if (!res.writableEnded) {
            res.write("I couldn't complete that response right now. Please try again.");
            res.end();
          }
          return;
        }

        console.log("[ChatBot] Stream completed via", providerUsed, "| length:", reply.length);
        dailyLimitMap.set(key, count + 1);
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }

      let reply = "";
      let openAIError = null;
      let geminiError = null;

      if (hasOpenAI) {
        try {
          console.log("[ChatBot] Requesting non-stream reply from OpenAI...");
          reply = await getOpenAIReply({ message, history, fullSystemPrompt });
          console.log("[ChatBot] OpenAI response length:", reply.length);
        } catch (error) {
          openAIError = error;
          console.error("[ChatBot] OpenAI non-stream failed:", error.message);
        }
      }

      if (!reply && hasGemini) {
        try {
          console.log("[ChatBot] Falling back to Gemini...");
          reply = await getGeminiReply({ message, history, fullSystemPrompt });
          console.log("[ChatBot] Gemini response length:", reply.length);
        } catch (error) {
          geminiError = error;
          console.error("[ChatBot] Gemini fallback failed:", error.message);
        }
      }

      if (!reply) {
        throw geminiError || openAIError || new Error("AI_PROVIDER_UNAVAILABLE");
      }

      dailyLimitMap.set(key, count + 1);
      return res.json({ reply });
    } finally {
      if (typeof req.off === "function") {
        req.off("close", onClientClose);
      } else {
        req.removeListener("close", onClientClose);
      }
    }
  } catch (error) {
    console.error("[ChatBot] Error:", error.message);
    console.error("[ChatBot] Stack:", error.stack);

    const friendly = getFriendlyError(error);
    const payload = { error: friendly.error };

    if (!isProduction) {
      payload.details = error.message;
    }

    res.status(friendly.status).json(payload);
  }
});

export default router;
