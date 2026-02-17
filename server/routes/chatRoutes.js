import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

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
setInterval(() => {
  const today = new Date().toDateString();
  for (const [key] of dailyLimitMap.entries()) {
    if (!key.includes(today)) {
      dailyLimitMap.delete(key);
    }
  }
}, 3600000);

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
    const { message, history = [], context } = req.body;
    console.log("[ChatBot] Message:", message, "| Page:", context?.page);

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Check if Gemini API key is configured
    const ai = getGenAI();
    if (!process.env.GEMINI_API_KEY || !ai) {
      console.error("[ChatBot] GEMINI_API_KEY not configured!");
      return res.status(503).json({
        error: "AI chatbot is not configured. Please contact support.",
      });
    }

    const currentPage = context?.page || "";
    const userId = context?.userId || userEmail;

    // Build context based on current page
    let pageContext = "";
    const sb = getSupabase();

    if (sb) {
      try {
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
              .from("fests")
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
            pageContext = `\n\nYOUR PROFILE DATA:\nTotal Registrations: ${userRegs.length}\nRecent: ${userRegs.slice(0, 5).map(r => `Event ID ${r.event_id} on ${new Date(r.created_at).toLocaleDateString()}`).join(", ")}`;
          } else {
            pageContext = `\n\nYOUR PROFILE DATA:\nYou haven't registered for any events yet.`;
          }
        }
      } catch (contextErr) {
        console.error("[ChatBot] Error fetching page context (non-fatal):", contextErr.message);
        // Continue without page context — don't let this break the chat
      }
    }

    // Fetch general platform data (non-fatal if it fails)
    let platformContext = "No platform data available.";
    if (sb) {
      try {
        const { data: events } = await sb
          .from("events")
          .select("title, event_date, venue, organizing_dept, category")
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true })
          .limit(10);

        const { data: fests } = await sb
          .from("fests")
          .select("fest_title, opening_date, closing_date, venue")
          .gte("closing_date", new Date().toISOString())
          .limit(5);

        platformContext = `
UPCOMING EVENTS:
${events?.map((e) => `- ${e.title} | ${new Date(e.event_date).toLocaleDateString()} | ${e.venue || "TBA"} | ${e.organizing_dept || ""}`).join("\n") || "No upcoming events"}

ACTIVE FESTS:
${fests?.map((f) => `- ${f.fest_title} | ${new Date(f.opening_date).toLocaleDateString()} to ${new Date(f.closing_date).toLocaleDateString()} | ${f.venue || "TBA"}`).join("\n") || "No active fests"}`;
      } catch (platformErr) {
        console.error("[ChatBot] Error fetching platform data (non-fatal):", platformErr.message);
      }
    }

    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nPLATFORM DATA:\n${platformContext}${pageContext}`;

    console.log("[ChatBot] Creating Gemini model...");
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: fullSystemPrompt,
    });

    // Build chat history (filter out empty messages)
    const chatHistory = history
      .filter((msg) => msg.content && msg.content.trim())
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

    console.log("[ChatBot] Starting chat with", chatHistory.length, "history messages...");
    const chat = model.startChat({
      history: chatHistory,
    });

    console.log("[ChatBot] Sending message to Gemini...");
    const result = await chat.sendMessage(message);
    const response = result.response.text();
    console.log("[ChatBot] Got response, length:", response.length);

    // Increment user's daily count
    dailyLimitMap.set(key, count + 1);

    res.json({ reply: response });
  } catch (error) {
    console.error("[ChatBot] Error:", error.message);
    console.error("[ChatBot] Stack:", error.stack);

    // Check if it's a quota error
    if (error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      return res.status(503).json({
        error: "AI assistant is temporarily unavailable due to high usage. Please try again later.",
      });
    }

    // Check for API key issues
    if (error.message?.includes("API_KEY") || error.message?.includes("API key")) {
      return res.status(503).json({
        error: "AI service configuration error. Please contact support.",
      });
    }

    // Check for model not found
    if (error.message?.includes("not found") || error.message?.includes("404")) {
      return res.status(503).json({
        error: "AI model temporarily unavailable. Please try again later.",
      });
    }

    res.status(500).json({ 
      error: "Failed to generate response. Please try again." 
    });
  }
});

export default router;
