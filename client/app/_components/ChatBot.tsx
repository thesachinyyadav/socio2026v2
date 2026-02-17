"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const { session, userData } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm SocioAssist. Select a question below to get started.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset chat when user navigates to a different page
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm SocioAssist. Select a question below to get started.",
      },
    ]);
    setLoading(false);
  }, [pathname]);

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

  const sendMessage = async (messageText: string) => {
    if (!session) {
      setShowLoginPrompt(true);
      return;
    }

    if (!messageText || loading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const chatEndpoint = `${API_URL}/api/chat`;
      
      console.log('[SocioAssist] Calling:', chatEndpoint);
      
      const res = await fetch(chatEndpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          message: messageText,
          history: messages.slice(-10),
          context: {
            page: pathname,
            userId: session.user.email,
          }
        }),
      });
      
      console.log('[SocioAssist] Response status:', res.status);
      
      // Check if response is JSON before parsing
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error('[SocioAssist] Non-JSON response. Content-Type:', contentType);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Server returned an unexpected response. The server may be restarting. Please try again in a moment." },
        ]);
        return;
      }

      const data = await res.json();

      if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "You've used all 20 daily questions. Please try again tomorrow." },
        ]);
      } else if (res.status === 503) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "SocioAssist is temporarily unavailable. Please check our FAQ page or contact support." },
        ]);
      } else if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong. Please try again." },
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
    } catch (error) {
      console.error('[SocioAssist] Connection error:', error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to connect to SocioAssist. Please check your internet connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Panel */}
      {isOpen && (
        <div className="mb-4 w-[360px] h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-[#154CB3] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                  <circle cx="9" cy="10" r="1.5"/>
                  <circle cx="15" cy="10" r="1.5"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm">SocioAssist</p>
                <p className="text-xs text-blue-100">
                  {session ? "Online" : "Login required"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowLoginPrompt(false);
              }}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Login Prompt Overlay */}
          {showLoginPrompt && !session && (
            <div className="absolute inset-0 bg-[#1a1d29] z-10 flex items-center justify-center p-6">
              <div className="text-center space-y-5 max-w-xs">
                <div className="w-16 h-16 mx-auto bg-[#154CB3]/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Login Required
                  </h3>
                  <p className="text-sm text-gray-400">
                    Please sign in to chat with SocioAssist
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => window.location.href = "/auth"}
                    className="w-full px-6 py-3 bg-[#154CB3] hover:bg-[#0d3580] text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setShowLoginPrompt(false)}
                    className="w-full px-6 py-3 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
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

            {/* Quick questions - always visible */}
            {!loading && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-gray-400 font-medium">
                  {messages.length === 1 ? "Quick questions for this page:" : "Ask another question:"}
                </p>
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    disabled={loading}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Info Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Select a question above to continue
            </p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#154CB3] hover:bg-[#0d3580] text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all hover:shadow-xl hover:scale-105"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
