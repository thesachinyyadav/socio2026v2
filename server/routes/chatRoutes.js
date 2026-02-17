import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYSTEM_PROMPT = `You are Socio AI, a helpful assistant for the Socio university event platform at Christ University.

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

router.post("/", authenticateUser, getUserInfo(), async (req, res) => {
  const userEmail = req.user?.email;
  const today = new Date().toDateString();
  const key = `${userEmail}_${today}`;

  // Check daily user limit (20 messages per day)
  const count = dailyLimitMap.get(key) || 0;
  if (count >= 20) {
    return res.status(429).json({
      error: "You've used all 20 daily questions. Please try again tomorrow! 🕐",
    });
  }

  try {
    const { message, history = [], context } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const currentPage = context?.page || "";
    const userId = context?.userId || userEmail;

    // Build context based on current page
    let pageContext = "";

    // If on a specific event page, fetch that event
    if (currentPage.startsWith("/event/")) {
      const eventId = currentPage.split("/event/")[1];
      const { data: event } = await supabase
        .from("events")
        .select("*")
        .eq("event_id", eventId)
        .single();
      
      if (event) {
        pageContext = `\n\nCURRENT EVENT PAGE:\nTitle: ${event.title}\nDate: ${new Date(event.event_date).toLocaleDateString()}\nVenue: ${event.venue || "TBA"}\nType: ${event.event_type || "N/A"}\nCategory: ${event.category || "N/A"}\nDepartment: ${event.organizing_dept}\nFee: ${event.registration_fee ? `₹${event.registration_fee}` : "Free"}\nDescription: ${event.description}\nRegistrations: ${event.registration_count || 0}`;
      }
    }

    // If on a specific fest page, fetch that fest
    if (currentPage.startsWith("/fest/")) {
      const festId = currentPage.split("/fest/")[1];
      const { data: fest } = await supabase
        .from("fests")
        .select("*")
        .eq("fest_id", festId)
        .single();
      
      if (fest) {
        pageContext = `\n\nCURRENT FEST PAGE:\nName: ${fest.fest_title}\nStart: ${new Date(fest.opening_date).toLocaleDateString()}\nEnd: ${new Date(fest.closing_date).toLocaleDateString()}\nVenue: ${fest.venue || "TBA"}\nDepartment: ${fest.organizing_dept}\nDescription: ${fest.description}`;
      }
    }

    // If on profile page, fetch user's registrations
    if (currentPage === "/profile") {
      const { data: userRegs } = await supabase
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

    // Fetch general platform data
    const { data: events } = await supabase
      .from("events")
      .select("title, event_date, venue, organizing_dept, category, description")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(15);

    const { data: fests } = await supabase
      .from("fests")
      .select("fest_title, opening_date, closing_date, description, venue")
      .gte("closing_date", new Date().toISOString())
      .limit(5);

    const platformContext = `
UPCOMING EVENTS:
${events?.map((e) => `- ${e.title} | ${new Date(e.event_date).toLocaleDateString()} | ${e.venue} | ${e.organizing_dept} | ${e.category}`).join("\n") || "No upcoming events"}

ACTIVE FESTS:
${fests?.map((f) => `- ${f.fest_title} | ${new Date(f.opening_date).toLocaleDateString()} to ${new Date(f.closing_date).toLocaleDateString()} | ${f.venue}`).join("\n") || "No active fests"}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const chat = model.startChat({
      history: history.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      systemInstruction: `${SYSTEM_PROMPT}\n\nPLATFORM DATA:\n${platformContext}${pageContext}`,
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    // Increment user's daily count
    dailyLimitMap.set(key, count + 1);

    res.json({ reply: response });
  } catch (error) {
    console.error("Chat error:", error);

    // Check if it's a quota error
    if (error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      return res.status(503).json({
        error: "AI assistant is temporarily unavailable due to high usage. Please try again later or contact support.",
      });
    }

    res.status(500).json({ 
      error: "Failed to generate response. Please try again." 
    });
  }
});

export default router;
