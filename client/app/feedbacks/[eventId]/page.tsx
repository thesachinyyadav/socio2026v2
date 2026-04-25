"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

const QUESTIONS = [
  "Overall event experience",
  "Relevance and value of content",
  "Organisation (scheduling, flow, communication)",
  "Venue / platform and logistics",
  "Likelihood to attend or recommend future events",
];

interface FeedbackRow {
  reg_no: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q5: number | null;
}

interface Summary {
  total_registered: number;
  total_submissions: number;
  response_rate_pct: string;
  question_averages: string[];
  overall_average: string;
}

interface FeedbackData {
  event: { event_id: string; title: string; feedback_sent_at: string | null };
  summary: Summary;
  rows: FeedbackRow[];
}

type PageStatus = "loading" | "ready" | "forbidden" | "error";

export default function FeedbacksPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const { userData } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<FeedbackData | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setToken(data.session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token || !userData?.email) return;

    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/feedbacks/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 403) {
          setStatus("forbidden");
          return;
        }
        if (!res.ok) {
          const err = await res.json();
          setErrorMsg(err.error || "Failed to load feedback data.");
          setStatus("error");
          return;
        }

        setData(await res.json());
        setStatus("ready");
      } catch {
        setErrorMsg("Network error. Please refresh.");
        setStatus("error");
      }
    };

    load();
  }, [token, userData?.email, eventId]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    return [...data.rows].sort((a, b) => {
      const cmp = a.reg_no.localeCompare(b.reg_no);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortDir]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm animate-pulse">Loading feedback data…</p>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Access denied</h2>
          <p className="text-sm text-slate-500">
            Only the organiser of this event can view its feedback.
          </p>
          <Link href="/manage" className="text-sm text-[#154cb3] font-semibold hover:underline">
            Back to Manage
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Error</h2>
          <p className="text-sm text-slate-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { event, summary, rows } = data;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Feedback Results</p>
            <h1 className="text-2xl font-extrabold text-[#0f2557] mt-0.5">{event.title}</h1>
          </div>
          <Link
            href="/manage?tab=events"
            className="text-sm text-[#154cb3] font-semibold hover:underline self-start sm:self-auto"
          >
            ← Back to Manage
          </Link>
        </div>

        {/* Aggregates */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-800">Summary</h2>

          <div className="flex flex-wrap gap-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response Rate</p>
              <p className="text-3xl font-extrabold text-[#154cb3]">{summary.response_rate_pct}%</p>
              <p className="text-xs text-slate-500">
                {summary.total_submissions} / {summary.total_registered} participants
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Average</p>
              <p className="text-3xl font-extrabold text-emerald-600">{summary.overall_average}</p>
              <p className="text-xs text-slate-500">across all questions</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Average per Question
            </p>
            {summary.total_submissions === 0 ? (
              <p className="text-sm text-slate-400">No submissions yet.</p>
            ) : (
              <div className="space-y-2">
                {QUESTIONS.map((q, idx) => {
                  const avg = parseFloat(summary.question_averages[idx] ?? "0");
                  const pct = (avg / 5) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4 flex-shrink-0">Q{idx + 1}</span>
                      <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">{q}</span>
                      <div className="w-28 flex-shrink-0 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-[#154cb3] h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-10 text-right flex-shrink-0">
                        {summary.question_averages[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Raw table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              All Submissions ({rows.length})
            </h2>
            {rows.length > 0 && (
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold select-none"
              >
                Reg No {sortDir === "asc" ? "↑" : "↓"}
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              {event.feedback_sent_at ? "No submissions yet." : "Feedback form has not been sent yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Reg No
                    </th>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <th
                        key={n}
                        className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        Q{n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {row.reg_no}
                      </td>
                      {[row.q1, row.q2, row.q3, row.q4, row.q5].map((v, qi) => (
                        <td key={qi} className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                              v === null
                                ? "bg-slate-100 text-slate-400"
                                : v >= 4
                                ? "bg-emerald-100 text-emerald-700"
                                : v === 3
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {v ?? "–"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
