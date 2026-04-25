"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

const QUESTIONS = [
  "How would you rate the overall event experience?",
  "How relevant and valuable was the content to you?",
  "How well-organized was the event (scheduling, flow, communication)?",
  "How would you rate the venue / platform and logistics?",
  "How likely are you to attend or recommend future events like this?",
];

type PageStatus =
  | "loading"
  | "not_authenticated"
  | "idle"
  | "submitting"
  | "submitted"
  | "already_submitted"
  | "not_registered"
  | "error";

export default function FeedbackFormPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const { userData } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [ratings, setRatings] = useState<(number | null)[]>([null, null, null, null, null]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Get session token
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        setToken(data.session.access_token);
      } else {
        setStatus("not_authenticated");
      }
    });
  }, []);

  // Check submission status + fetch event title
  useEffect(() => {
    if (!token || !userData?.email) return;

    const init = async () => {
      try {
        const [checkRes, eventRes] = await Promise.all([
          fetch(`${API_URL}/api/feedbacks/${eventId}/check`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/events/${eventId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.submitted) {
            setStatus("already_submitted");
            return;
          }
        }

        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEventTitle(
            eventData?.event?.title ||
            eventData?.title ||
            eventData?.events?.[0]?.title ||
            "this event"
          );
        }

        setStatus("idle");
      } catch {
        setStatus("error");
        setErrorMsg("Failed to load feedback form.");
      }
    };

    init();
  }, [token, userData?.email, eventId]);

  const allRated = ratings.every((r) => r !== null);

  const handleRating = (questionIdx: number, value: number) => {
    setRatings((prev) => {
      const next = [...prev];
      next[questionIdx] = value;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!token || !allRated) return;
    setStatus("submitting");

    try {
      const res = await fetch(`${API_URL}/api/feedbacks/${eventId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ratings }),
      });

      if (res.status === 409) {
        setStatus("already_submitted");
        return;
      }
      if (res.status === 403) {
        setStatus("not_registered");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "Submission failed. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("submitted");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  // ─── Render states ────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm animate-pulse">Loading feedback form…</p>
      </div>
    );
  }

  if (status === "not_authenticated") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Sign in to continue</h2>
          <p className="text-sm text-slate-500">
            You need to be signed in to submit feedback for this event.
          </p>
          <a
            href="/auth"
            className="inline-block px-6 py-2.5 bg-[#154cb3] text-white text-sm font-semibold rounded-xl hover:bg-[#124099] transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (status === "already_submitted") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Already submitted</h2>
          <p className="text-sm text-slate-500">
            You&apos;ve already submitted feedback for this event. Thank you!
          </p>
        </div>
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Thank you!</h2>
          <p className="text-sm text-slate-500">
            Your feedback for <strong>{eventTitle}</strong> has been recorded.
          </p>
        </div>
      </div>
    );
  }

  if (status === "not_registered") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Not registered</h2>
          <p className="text-sm text-slate-500">
            You are not registered for this event and cannot submit feedback.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Something went wrong</h2>
          <p className="text-sm text-slate-500">{errorMsg}</p>
          <button
            onClick={() => { setStatus("loading"); setErrorMsg(""); }}
            className="text-sm text-[#154cb3] font-semibold hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── Main form ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Event Feedback</p>
          <h1 className="text-2xl font-extrabold text-[#0f2557]">{eventTitle}</h1>
          <p className="text-sm text-slate-500">
            Rate each question from 1 (lowest) to 5 (highest). All questions are required.
          </p>
        </div>

        <div className="space-y-4">
          {QUESTIONS.map((question, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-800 mb-4">
                <span className="text-slate-400 font-bold mr-2">{idx + 1}.</span>
                {question}
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((val) => {
                  const selected = ratings[idx] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleRating(idx, val)}
                      className={`w-11 h-11 rounded-lg text-sm font-bold border-2 transition-all ${
                        selected
                          ? "bg-[#154cb3] border-[#154cb3] text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:border-[#154cb3] hover:text-[#154cb3]"
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
                <span className="ml-2 text-xs text-slate-400">
                  {ratings[idx] !== null ? `Selected: ${ratings[idx]}` : "Not rated"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allRated || status === "submitting"}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
            allRated && status !== "submitting"
              ? "bg-[#154cb3] text-white hover:bg-[#124099] shadow-md"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          {status === "submitting" ? "Submitting…" : "Submit Feedback"}
        </button>

        {!allRated && (
          <p className="text-center text-xs text-slate-400">
            Please rate all {QUESTIONS.length} questions before submitting.
          </p>
        )}
      </div>
    </div>
  );
}
