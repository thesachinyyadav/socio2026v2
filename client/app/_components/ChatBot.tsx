"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! 👋 I'm Socio AI. Ask me about events, fests, registrations, or anything about the platform!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // ── Dynamic Quick Questions Based on Page ──────────────────────────────
  const quickQuestions = (() => {
    // Events list page
    if (pathname === "/events") {
      return [
        "What events are happening this week?",
        "Show me free events",
        "What cultural events are coming up?",
      ];
    }
    
    // Single event page
    if (pathname.startsWith("/event/")) {
      return [
        "When is this event?",
        "What type of event is this?",
        "Where is the venue?",
        "Is registration open?",
      ];
    }

    // Fests list page
    if (pathname === "/fests") {
      return [
        "What fests are happening this month?",
        "Which fest has the most events?",
        "When does the next fest start?",
      ];
    }

    // Single fest page
    if (pathname.startsWith("/fest/")) {
      return [
        "What events are in this fest?",
        "When does this fest start?",
        "How do I register?",
      ];
    }

    // Profile page
    if (pathname === "/profile") {
      return [
        "How many events have I participated in?",
        "What are my upcoming events?",
        "Show my registration history",
      ];
    }

    // Discover page
    if (pathname === "/Discover") {
      return [
        "Recommend events based on my interests",
        "What's popular this week?",
        "Show me technical events",
      ];
    }

    // Dashboard/home
    if (pathname === "/dashboard" || pathname === "/") {
      return [
        "What events are happening today?",
        "How do I create an event?",
        "Where can I see my registrations?",
      ];
    }

    // Default questions
    return [
      "What events are happening this week?",
      "How do I register for an event?",
      "How do I create an event?",
    ];
  })();

  const sendMessage = async (messageText?: string) => {
    // Check if user is logged in
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.token}` 
          },
          body: JSON.stringify({
            message: textToSend,
            history: messages.slice(-10),
            context: {
              page: pathname, // Send current page for context
              userId: user.email,
            }
          }),
        }
      );

      const data = await res.json();

      if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: data.error || "You've used all 20 daily questions. Please try again tomorrow! 🕐"
          },
        ]);
      } else if (res.status === 503) {
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: "I'm taking a short break due to high usage. 😅 Please check our FAQ page or contact support for immediate help."
          },
        ]);
      } else if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't process that. Try again!" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please check your internet and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Panel */}
      {isOpen && (
        <div className="mb-4 w-[360px] h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-[#154CB3] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">
                🤖
              </div>
              <div>
                <p className="font-semibold text-sm">Socio AI</p>
                <p className="text-xs text-blue-100">
                  {user ? "Online" : "Login required"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowLoginPrompt(false);
              }}
              className="text-white/80 hover:text-white text-xl leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Login Prompt Overlay */}
          {showLoginPrompt && !user && (
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <div className="text-5xl">🔒</div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Login Required
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Please sign in to chat with Socio AI
                </p>
                <button
                  onClick={() => window.location.href = "/auth"}
                  className="px-6 py-2 bg-[#154CB3] hover:bg-[#063168] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="block w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#154CB3] text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Quick questions (show only at start) */}
            {messages.length === 1 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium">Quick questions for this page:</p>
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={user ? "Ask about events, fests..." : "Sign in to chat..."}
                disabled={!user}
                className="flex-1 px-3 py-2 text-sm rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#154CB3] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!user || !input.trim() || loading}
                className="w-9 h-9 bg-[#154CB3] hover:bg-[#063168] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#154CB3] hover:bg-[#063168] text-white rounded-full shadow-lg flex items-center justify-center text-2xl cursor-pointer transition-all hover:scale-105"
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}
