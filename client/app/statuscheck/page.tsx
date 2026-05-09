"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  FileText,
  Gauge,
  Keyboard,
  RefreshCw,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  TerminalSquare,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const headingFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const monoFont = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"] });

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
const MUTATION_CONFIRMATION_PHRASE = "I UNDERSTAND STATUSCHECK MUTATIONS";
const HISTORY_STORAGE_KEY = "statuscheck:history:v2";
const SLOW_CHECK_THRESHOLD_MS = 1200;
const VERIFY_ATTEMPT_TIMEOUT_MS = 1500;
const VERIFY_RETRY_DELAY_MS = 180;
const VERIFY_WELCOME_DELAY_MS = 220;
const VERIFY_FAIL_REDIRECT_DELAY_MS = 250;

const LOAD_PRESETS = [
  { id: "smoke", label: "Smoke", description: "Quick confidence pass", target: "events", iterations: 8, concurrency: 2, customPath: "" },
  { id: "balanced", label: "Balanced", description: "Daily reliability baseline", target: "events", iterations: 30, concurrency: 4, customPath: "" },
  { id: "burst", label: "Burst", description: "High traffic simulation", target: "notifications", iterations: 70, concurrency: 8, customPath: "" },
  { id: "edge", label: "Edge Path", description: "Custom route verification", target: "custom", iterations: 20, concurrency: 3, customPath: "/api/events?page=1&pageSize=25" },
] as const;

type LoadPreset = (typeof LOAD_PRESETS)[number];

type TableCount = { table: string; ok: boolean; count: number | null; error?: string };
type SummaryBucket = { passed: number; failed: number; skipped: number; total: number };

type CheckItem = {
  name: string;
  ok: boolean;
  status?: number | string;
  method?: string;
  path?: string;
  durationMs?: number;
  message?: string;
  reason?: string;
  details?: Record<string, unknown>;
  payload?: unknown;
};

type LoadFailure = { index: number; status: string | number; durationMs: number; message?: string };

type LoadResult = {
  ok: boolean;
  target: string;
  targetPath: string;
  iterations: number;
  concurrency: number;
  completed: number;
  successCount: number;
  failureCount: number;
  errorRatePercent: number;
  totalDurationMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  failures?: LoadFailure[];
};

type RouteCoverageItem = { group: string; mount: string; probe: string };

type SummaryResponse = {
  ok: boolean;
  checkedAt: string;
  durationMs: number;
  requestedBy: string;
  apiBaseUrl: string;
  dbHealth: { ok: boolean; message: string };
  sampleRows: { sampleEventId: string | null; sampleFestId: string | null; sampleUserEmail: string | null };
  tableCounts: TableCount[];
  routeCoverage: RouteCoverageItem[];
  mutatingChecks: { enabled: boolean; confirmationRequired: string };
};

type RunResponse = {
  ok: boolean;
  checkedAt: string;
  durationMs: number;
  includeMutations: boolean;
  requestedBy: string;
  endpointChecks: CheckItem[];
  fetchDisplayChecks: CheckItem[];
  workflowChecks: CheckItem[];
  mutationChecks: CheckItem[];
  loadCheck: LoadResult | null;
  summary: { endpoints: SummaryBucket; fetchDisplay: SummaryBucket; workflows: SummaryBucket; mutations: SummaryBucket };
};

type CheckSectionKey = "endpointChecks" | "fetchDisplayChecks" | "workflowChecks" | "mutationChecks";

type HistoryEntry = {
  id: string;
  at: string;
  kind: "summary" | "full" | "stream" | "load" | "insert";
  ok: boolean;
  headline: string;
  detail: string;
};

type DummyEventInsertResult = {
  event_id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  venue: string;
  fest_id: string | null;
  event_image_url: string | null;
  banner_url: string | null;
  pdf_url: string | null;
  created_at: string | null;
  created_by: string | null;
};

type IssueItem = {
  id: string;
  title: string;
  severity: "critical" | "warning";
  source: string;
  status: string;
  durationMs: number;
};

type LogLevel = "pass" | "fail" | "warn" | "info" | "skip" | "section";

type LogEntry = {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
};

const SECTION_META: Array<{ key: CheckSectionKey; label: string }> = [
  { key: "endpointChecks", label: "Endpoint" },
  { key: "fetchDisplayChecks", label: "Fetch / Display" },
  { key: "workflowChecks", label: "Workflow" },
  { key: "mutationChecks", label: "Mutation" },
];

function cn(...values: Array<string | false | undefined | null>) {
  return values.filter(Boolean).join(" ");
}

function formatDateTime(isoValue: string) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatTs(ts: number) {
  return new Date(ts).toISOString().slice(11, 23);
}

function asPercent(passed: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((passed / total) * 100)}%`;
}

function buildCheckSourceLabel(item: CheckItem) {
  return [item.method, item.path].filter(Boolean).join(" ") || "internal";
}

async function copyToClipboard(value: string, successLabel: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successLabel);
  } catch {
    toast.error("Clipboard is unavailable");
  }
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    window.clearTimeout(timer);
  }
}

function Badge({ ok, status }: { ok: boolean; status?: number | string }) {
  if (String(status) === "skipped") {
    return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Skipped</span>;
  }
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
      {ok ? "Pass" : "Fail"}{typeof status === "number" ? ` (${status})` : ""}
    </span>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <CircleHelp className="h-3.5 w-3.5 text-slate-500" />
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-slate-300 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function KpiTile({ label, value, helper, accent }: { label: string; value: string; helper: string; accent: "blue" | "green" | "amber" | "slate" | "rose" }) {
  const color = accent === "green" ? "text-emerald-600" : accent === "amber" ? "text-amber-600" : accent === "rose" ? "text-rose-600" : accent === "slate" ? "text-slate-700" : "text-[#154CB3]";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", color)}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function CheckCard({ item }: { item: CheckItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.details || item.payload || item.reason || item.message;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">{item.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{buildCheckSourceLabel(item)}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span>{item.durationMs ?? 0}ms</span>
            <span>·</span>
            <span>status {String(item.status ?? "n/a")}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge ok={item.ok} status={item.status} />
          {hasDetails && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "hide" : "expand"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 px-4 pb-3 pt-2">
          {(item.message || item.reason) && (
            <div className="mb-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">{item.message || item.reason}</div>
          )}
          {(item.details !== undefined || item.payload !== undefined) && (
            <pre className={cn("max-h-48 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-200", monoFont.className)}>
              {JSON.stringify(item.details ?? item.payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const color =
    entry.level === "pass" ? "text-emerald-400" :
    entry.level === "fail" ? "text-rose-400" :
    entry.level === "warn" ? "text-amber-400" :
    entry.level === "section" ? "text-cyan-300 font-semibold" :
    entry.level === "skip" ? "text-slate-500" :
    "text-slate-400";

  return (
    <div className={cn("flex gap-2 text-[11px]", monoFont.className)}>
      <span className="shrink-0 text-slate-600">{formatTs(entry.ts)}</span>
      <span className={cn("shrink-0 w-14 uppercase", color)}>[{entry.level}]</span>
      <span className={cn("break-all", color)}>{entry.message}</span>
    </div>
  );
}

function collectIssues(runResult: RunResponse | null): IssueItem[] {
  if (!runResult) return [];
  const allChecks = [...runResult.endpointChecks, ...runResult.fetchDisplayChecks, ...runResult.workflowChecks, ...runResult.mutationChecks];
  const issues: IssueItem[] = [];
  for (const check of allChecks) {
    const statusLabel = String(check.status ?? "n/a");
    const baseId = `${check.name}-${check.path || ""}-${statusLabel}`;
    if (!check.ok && statusLabel !== "skipped") {
      issues.push({ id: `${baseId}-fail`, title: check.name, severity: "critical", source: buildCheckSourceLabel(check), status: statusLabel, durationMs: check.durationMs ?? 0 });
    } else if ((check.durationMs ?? 0) >= SLOW_CHECK_THRESHOLD_MS) {
      issues.push({ id: `${baseId}-slow`, title: `${check.name} latency high`, severity: "warning", source: buildCheckSourceLabel(check), status: statusLabel, durationMs: check.durationMs ?? 0 });
    }
  }
  return issues;
}

export default function StatusCheckPage() {
  const router = useRouter();
  const { isLoading, isMasterAdmin, session, userData } = useAuth();
  const verifyInProgressRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  const authToken = session?.access_token || null;

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);

  const [activeSection, setActiveSection] = useState<CheckSectionKey>("endpointChecks");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [autoRefreshSummary, setAutoRefreshSummary] = useState(false);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [runningFull, setRunningFull] = useState(false);
  const [runningStream, setRunningStream] = useState(false);
  const [runningLoad, setRunningLoad] = useState(false);
  const [insertingDummyEvent, setInsertingDummyEvent] = useState(false);
  const [lastDummyEvent, setLastDummyEvent] = useState<DummyEventInsertResult | null>(null);

  const [includeMutations, setIncludeMutations] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [runLoadAlongsideFull, setRunLoadAlongsideFull] = useState(true);
  const [loadTarget, setLoadTarget] = useState("events");
  const [customPath, setCustomPath] = useState("");
  const [iterations, setIterations] = useState(30);
  const [concurrency, setConcurrency] = useState(4);

  const [verificationPhase, setVerificationPhase] = useState<"checking" | "welcome" | "ready" | "failed">("checking");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [verificationMessage, setVerificationMessage] = useState("Checking auth/verify/status...");
  const [selectedPresetId, setSelectedPresetId] = useState<LoadPreset["id"]>("balanced");
  const [showRawDiagnostics, setShowRawDiagnostics] = useState(false);
  const [rawTab, setRawTab] = useState<"summary" | "run" | "load">("summary");
  const [consoleOpen, setConsoleOpen] = useState(true);

  // ── History persistence ────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 20));
      }
    } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
  }, [history]);

  // ── Auto-scroll console ────────────────────────────────────────────
  useEffect(() => {
    if (consoleOpen && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs, consoleOpen]);

  // ── Access verification ────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    if (verificationPhase === "ready" || verificationPhase === "failed" || verifyInProgressRef.current) return;

    let cancelled = false;
    const verifyAccess = async () => {
      verifyInProgressRef.current = true;
      try {
        const sessionEmail = session.user?.email || userData?.email || "";
        if (!sessionEmail) {
          setVerificationMessage("Missing user email in session");
          setVerificationPhase("failed");
          await wait(VERIFY_FAIL_REDIRECT_DELAY_MS);
          if (!cancelled) router.replace("/error");
          return;
        }

        for (let attempt = 1; attempt <= 3; attempt++) {
          if (cancelled) return;
          setVerificationAttempt(attempt);
          setVerificationPhase("checking");
          setVerificationMessage(`Checking organiser/admin permissions (${attempt}/3)...`);

          if (Boolean(userData?.is_organiser || userData?.is_masteradmin || isMasterAdmin)) {
            setVerificationPhase("welcome");
            await wait(VERIFY_WELCOME_DELAY_MS);
            if (!cancelled) setVerificationPhase("ready");
            return;
          }

          const [apiOk, supabaseOk] = await Promise.all([
            (async () => {
              const result = await fetchJsonWithTimeout(
                `${API_URL}/api/users/${encodeURIComponent(sessionEmail)}`,
                { method: "GET", headers: { Accept: "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) } },
                VERIFY_ATTEMPT_TIMEOUT_MS
              );
              const u = (result.data as any)?.user;
              return Boolean(result.ok && (u?.is_organiser || u?.is_masteradmin));
            })(),
            (async () => {
              try {
                const q = supabase.from("users").select("is_organiser, is_masteradmin").eq("email", sessionEmail).maybeSingle();
                const r = await Promise.race([q, wait(VERIFY_ATTEMPT_TIMEOUT_MS).then(() => ({ data: null, error: { message: "timeout" } }))]) as any;
                if (r.error) return false;
                return Boolean(r.data?.is_organiser || r.data?.is_masteradmin);
              } catch { return false; }
            })(),
          ]);

          if (apiOk || supabaseOk) {
            setVerificationPhase("welcome");
            await wait(VERIFY_WELCOME_DELAY_MS);
            if (!cancelled) setVerificationPhase("ready");
            return;
          }
          if (attempt < 3) await wait(VERIFY_RETRY_DELAY_MS);
        }

        setVerificationPhase("failed");
        setVerificationMessage("Could not verify organiser/masteradmin access. Redirecting...");
        await wait(VERIFY_FAIL_REDIRECT_DELAY_MS);
        if (!cancelled) router.replace("/error");
      } finally {
        verifyInProgressRef.current = false;
      }
    };

    void verifyAccess();
    return () => { cancelled = true; };
  }, [isLoading, session, userData, authToken, isMasterAdmin, router, verificationPhase]);

  const headers = useMemo(() => {
    if (!authToken) return null;
    return { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json", Accept: "application/json" };
  }, [authToken]);

  const appendHistory = useCallback((entry: Omit<HistoryEntry, "id">) => {
    const id = `${entry.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setHistory((prev) => [{ id, ...entry }, ...prev].slice(0, 20));
  }, []);

  const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
    const id = `${entry.ts}-${Math.random().toString(36).slice(2, 6)}`;
    setStreamLogs((prev) => [...prev, { id, ...entry }]);
  }, []);

  // ── Summary fetch ──────────────────────────────────────────────────
  const fetchSummary = useCallback(async (options?: { silent?: boolean; record?: boolean }) => {
    if (!headers) return;
    setLoadingSummary(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/summary`, { method: "GET", headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load status summary");
      const typed = data as SummaryResponse;
      setSummary(typed);
      if (options?.record) appendHistory({ at: new Date().toISOString(), kind: "summary", ok: typed.dbHealth.ok, headline: "Summary refreshed", detail: typed.dbHealth.message });
      if (!options?.silent) toast.success("Status summary refreshed");
    } catch (err) {
      if (!options?.silent) toast.error(err instanceof Error ? err.message : "Unable to fetch summary");
    } finally {
      setLoadingSummary(false);
    }
  }, [headers, appendHistory]);

  // ── Streaming run (live console) ──────────────────────────────────
  const runStreamCheck = useCallback(async () => {
    if (!headers) return;
    if (includeMutations && confirmation.trim() !== MUTATION_CONFIRMATION_PHRASE) {
      toast.error("Mutation confirmation phrase does not match");
      return;
    }

    setStreamLogs([]);
    setConsoleOpen(true);
    setRunningStream(true);
    setRunResult(null);
    setLoadResult(null);

    const startLog = (msg: string) => addLog({ ts: Date.now(), level: "info", message: msg });

    try {
      const response = await fetch(`${API_URL}/api/statuscheck/stream-run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          includeMutations,
          confirmation,
          runLoad: runLoadAlongsideFull,
          loadConfig: { target: loadTarget, customPath, iterations, concurrency },
        }),
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).error || "Stream failed to start");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const lines = rawEvent.split("\n");
          const eventTypeLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!eventTypeLine || !dataLine) continue;
          const eventType = eventTypeLine.slice(7).trim();
          let data: any;
          try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (eventType === "log") {
            addLog({ ts: data.ts || Date.now(), level: data.level as LogLevel, message: data.message });
          } else if (eventType === "section") {
            addLog({ ts: Date.now(), level: "section", message: `━━ ${data.section} ━━` });
          } else if (eventType === "error") {
            addLog({ ts: Date.now(), level: "fail", message: `ERROR: ${data.message}` });
            toast.error(data.message);
          } else if (eventType === "loadResult") {
            if (data.result) setLoadResult(data.result as LoadResult);
          } else if (eventType === "done") {
            const run = data as RunResponse & { sampleRows?: unknown };
            const finalRun: RunResponse = {
              ok: run.ok,
              checkedAt: run.checkedAt,
              durationMs: run.durationMs,
              includeMutations: run.includeMutations || false,
              requestedBy: run.requestedBy || "",
              endpointChecks: run.endpointChecks || [],
              fetchDisplayChecks: run.fetchDisplayChecks || [],
              workflowChecks: run.workflowChecks || [],
              mutationChecks: run.mutationChecks || [],
              loadCheck: run.loadCheck || null,
              summary: run.summary,
            };
            setRunResult(finalRun);
            if (run.loadCheck) setLoadResult(run.loadCheck);

            const hasFailures = Object.values(run.summary).some((b: any) => b.failed > 0);
            appendHistory({
              at: new Date().toISOString(),
              kind: "stream",
              ok: !hasFailures,
              headline: hasFailures ? "Stream run completed with failures" : "Stream run passed",
              detail: `endpoints ${run.summary.endpoints.passed}/${run.summary.endpoints.total} pass`,
            });

            addLog({ ts: Date.now(), level: hasFailures ? "warn" : "pass", message: `✓ Done in ${run.durationMs}ms — endpoints ${run.summary.endpoints.passed}/${run.summary.endpoints.total} | workflows ${run.summary.workflows.passed}/${run.summary.workflows.total}` });
            if (hasFailures) toast.error("Run completed with failures");
            else toast.success("Stream run passed");
          }
        }
      }
    } catch (err) {
      addLog({ ts: Date.now(), level: "fail", message: `Stream error: ${err instanceof Error ? err.message : "Unknown"}` });
      toast.error(err instanceof Error ? err.message : "Stream run failed");
    } finally {
      setRunningStream(false);
    }
  }, [headers, includeMutations, confirmation, runLoadAlongsideFull, loadTarget, customPath, iterations, concurrency, addLog, appendHistory]);

  // ── Classic (non-streaming) full run ──────────────────────────────
  const runFullCheck = useCallback(async () => {
    if (!headers) return;
    if (includeMutations && confirmation.trim() !== MUTATION_CONFIRMATION_PHRASE) {
      toast.error("Mutation confirmation phrase does not match");
      return;
    }
    setRunningFull(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ includeMutations, confirmation, runLoad: runLoadAlongsideFull, loadConfig: { target: loadTarget, customPath, iterations, concurrency } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to run full statuscheck");
      const typed = data as RunResponse;
      setRunResult(typed);
      if (typed.loadCheck) setLoadResult(typed.loadCheck);
      const hasFailures = Object.values(typed.summary).some((b) => b.failed > 0);
      appendHistory({ at: new Date().toISOString(), kind: "full", ok: !hasFailures, headline: hasFailures ? "Full check completed with failures" : "Full check passed", detail: `endpoint pass ${typed.summary.endpoints.passed}/${typed.summary.endpoints.total}` });
      if (hasFailures) toast.error("Statuscheck completed with failing probes");
      else toast.success("Full statuscheck completed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to run statuscheck");
    } finally {
      setRunningFull(false);
    }
  }, [headers, includeMutations, confirmation, runLoadAlongsideFull, loadTarget, customPath, iterations, concurrency, appendHistory]);

  // ── Load-only run ──────────────────────────────────────────────────
  const runLoadCheck = useCallback(async () => {
    if (!headers) return;
    setRunningLoad(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/load`, {
        method: "POST",
        headers,
        body: JSON.stringify({ target: loadTarget, customPath, iterations, concurrency }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || "Failed to run load check");
      const result = (data?.result || null) as LoadResult | null;
      setLoadResult(result);
      if (result) appendHistory({ at: new Date().toISOString(), kind: "load", ok: result.failureCount === 0, headline: result.failureCount === 0 ? "Load check stable" : "Load check detected failures", detail: `p95 ${result.p95Ms}ms | errors ${result.errorRatePercent}%` });
      toast.success("Load check completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to run load check");
    } finally {
      setRunningLoad(false);
    }
  }, [headers, loadTarget, customPath, iterations, concurrency, appendHistory]);

  // ── Insert dummy event ─────────────────────────────────────────────
  const insertDummyEvent = useCallback(async () => {
    if (!headers) return;
    setInsertingDummyEvent(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/insert-dummy-event`, { method: "POST", headers, body: JSON.stringify({}) });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string; event?: DummyEventInsertResult };
      if (!response.ok || !data?.ok || !data?.event) throw new Error(data?.error || data?.message || "Failed to insert dummy event");
      setLastDummyEvent(data.event);
      appendHistory({ at: new Date().toISOString(), kind: "insert", ok: true, headline: "Dummy event inserted", detail: `event_id ${data.event.event_id}` });
      toast.success(`Dummy event inserted: ${data.event.event_id}`);
      void fetchSummary({ silent: true, record: true });
    } catch (err) {
      appendHistory({ at: new Date().toISOString(), kind: "insert", ok: false, headline: "Dummy event insert failed", detail: err instanceof Error ? err.message : "Unknown error" });
      toast.error(err instanceof Error ? err.message : "Unable to insert dummy event");
    } finally {
      setInsertingDummyEvent(false);
    }
  }, [headers, appendHistory, fetchSummary]);

  // ── Auto fetch summary on ready ────────────────────────────────────
  useEffect(() => {
    if (verificationPhase !== "ready" || !headers) return;
    void fetchSummary({ silent: true });
  }, [verificationPhase, headers, fetchSummary]);

  useEffect(() => {
    if (!autoRefreshSummary || !headers || verificationPhase !== "ready") return;
    const timer = window.setInterval(() => void fetchSummary({ silent: true }), 45000);
    return () => window.clearInterval(timer);
  }, [autoRefreshSummary, headers, verificationPhase, fetchSummary]);

  // ── Derived values ─────────────────────────────────────────────────
  const apiBaseForTools = useMemo(() => summary?.apiBaseUrl || API_URL || (typeof window !== "undefined" ? window.location.origin : "<api-base>"), [summary]);

  const currentChecks = useMemo(() => {
    if (!runResult) return [] as CheckItem[];
    return runResult[activeSection].filter((item) => {
      const status = String(item.status ?? "").toLowerCase();
      const isFailed = !item.ok && status !== "skipped";
      if (showFailedOnly && !isFailed) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return [item.name, item.path, item.method, item.message, item.reason].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [runResult, activeSection, showFailedOnly, searchQuery]);

  const issues = useMemo(() => collectIssues(runResult), [runResult]);

  const sectionSummaries = useMemo(() => {
    if (!runResult) return [] as Array<{ key: CheckSectionKey; label: string; bucket: SummaryBucket }>;
    return [
      { key: "endpointChecks" as const, label: "Endpoint", bucket: runResult.summary.endpoints },
      { key: "fetchDisplayChecks" as const, label: "Fetch / Display", bucket: runResult.summary.fetchDisplay },
      { key: "workflowChecks" as const, label: "Workflow", bucket: runResult.summary.workflows },
      { key: "mutationChecks" as const, label: "Mutation", bucket: runResult.summary.mutations },
    ];
  }, [runResult]);

  const totalFailedChecks = useMemo(() => sectionSummaries.reduce((sum, s) => sum + s.bucket.failed, 0), [sectionSummaries]);
  const criticalIssueCount = useMemo(() => issues.filter((i) => i.severity === "critical").length, [issues]);
  const warningIssueCount = useMemo(() => issues.filter((i) => i.severity === "warning").length, [issues]);

  const opsScore = useMemo(() => {
    let score = 100;
    if (summary && !summary.dbHealth.ok) score -= 15;
    score -= totalFailedChecks * 6;
    score -= warningIssueCount * 2;
    if (loadResult) {
      score -= Math.min(20, Math.round(loadResult.errorRatePercent * 2));
      if (loadResult.p95Ms > 1200) score -= 8;
      if (loadResult.p95Ms > 2000) score -= 8;
    }
    return Math.max(0, Math.min(100, score));
  }, [summary, totalFailedChecks, warningIssueCount, loadResult]);

  const opsBand = useMemo(() => {
    if (opsScore >= 90) return { label: "Excellent", accent: "emerald" };
    if (opsScore >= 75) return { label: "Good", accent: "blue" };
    if (opsScore >= 55) return { label: "Watch", accent: "amber" };
    return { label: "Critical", accent: "rose" };
  }, [opsScore]);

  const passFailPieData = useMemo(() => {
    if (!sectionSummaries.length) return [] as Array<{ name: string; value: number; color: string }>;
    const passed = sectionSummaries.reduce((s, x) => s + x.bucket.passed, 0);
    const failed = sectionSummaries.reduce((s, x) => s + x.bucket.failed, 0);
    const skipped = sectionSummaries.reduce((s, x) => s + x.bucket.skipped, 0);
    return [{ name: "Passed", value: passed, color: "#10b981" }, { name: "Failed", value: failed, color: "#f43f5e" }, { name: "Skipped", value: skipped, color: "#f59e0b" }];
  }, [sectionSummaries]);

  const sectionFailureData = useMemo(() => sectionSummaries.map((s) => ({
    section: s.label,
    passRate: Number(asPercent(s.bucket.passed, s.bucket.total).replace("%", "")),
    failed: s.bucket.failed,
  })), [sectionSummaries]);

  const latencyProfileData = useMemo(() => {
    if (!loadResult) return [] as Array<{ metric: string; value: number }>;
    return [{ metric: "p50", value: loadResult.p50Ms }, { metric: "p95", value: loadResult.p95Ms }, { metric: "max", value: loadResult.maxMs }, { metric: "avg", value: loadResult.avgMs }];
  }, [loadResult]);

  const runTrendData = useMemo(() => history.slice(0, 12).reverse().map((e, i) => ({ name: `${e.kind}-${i + 1}`, ok: e.ok ? 1 : 0 })), [history]);

  const commandSnippets = useMemo(() => {
    const tp = loadTarget === "custom" ? customPath || "/api/events?page=1&pageSize=5" : loadTarget;
    return [
      { title: "Fetch Summary", command: `curl -X GET "${apiBaseForTools}/api/statuscheck/summary" -H "Authorization: Bearer <TOKEN>" -H "Accept: application/json"` },
      { title: "Stream Run (SSE)", command: `curl -X POST "${apiBaseForTools}/api/statuscheck/stream-run" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"includeMutations":false,"runLoad":${runLoadAlongsideFull}}' --no-buffer` },
      { title: "Full Run (batch)", command: `curl -X POST "${apiBaseForTools}/api/statuscheck/run" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"includeMutations":false,"runLoad":${runLoadAlongsideFull}}'` },
      { title: "Run Load Check", command: `curl -X POST "${apiBaseForTools}/api/statuscheck/load" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"target":"${tp}","iterations":${iterations},"concurrency":${concurrency}}'` },
      { title: "Insert Dummy Event", command: `curl -X POST "${apiBaseForTools}/api/statuscheck/insert-dummy-event" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{}'` },
    ];
  }, [apiBaseForTools, runLoadAlongsideFull, loadTarget, customPath, iterations, concurrency]);

  const exportSnapshot = useCallback(() => {
    downloadJsonFile(`statuscheck-snapshot-${Date.now()}.json`, { exportedAt: new Date().toISOString(), summary, runResult, loadResult, issues, history, streamLogs });
    toast.success("Snapshot exported");
  }, [summary, runResult, loadResult, issues, history, streamLogs]);

  const applyLoadPreset = useCallback((preset: LoadPreset) => {
    setSelectedPresetId(preset.id);
    setLoadTarget(preset.target);
    setIterations(preset.iterations);
    setConcurrency(preset.concurrency);
    setCustomPath(preset.customPath);
    toast.success(`${preset.label} preset applied`);
  }, []);

  const incidentReportMarkdown = useMemo(() => {
    const lines: string[] = ["# StatusCheck Incident Report", "", `Generated: ${new Date().toISOString()}`, `Ops Score: ${opsScore}/100 (${opsBand.label})`, ""];
    if (summary) {
      lines.push("## Summary", `- Checked At: ${summary.checkedAt}`, `- DB Health: ${summary.dbHealth.ok ? "healthy" : "attention"}`, `- DB Message: ${summary.dbHealth.message}`, "");
    }
    if (runResult) {
      lines.push("## Section Results");
      sectionSummaries.forEach((s) => lines.push(`- ${s.label}: ${s.bucket.passed}/${s.bucket.total} pass, ${s.bucket.failed} failed, ${s.bucket.skipped} skipped`));
      lines.push("");
    }
    if (loadResult) {
      lines.push("## Load Diagnostics", `- Target: ${loadResult.targetPath}`, `- Iterations/Concurrency: ${loadResult.iterations}/${loadResult.concurrency}`, `- Error Rate: ${loadResult.errorRatePercent}%`, `- p95: ${loadResult.p95Ms}ms`, "");
    }
    if (streamLogs.length > 0) {
      lines.push("## Live Console Log");
      streamLogs.forEach((e) => lines.push(`${formatTs(e.ts)} [${e.level.toUpperCase()}] ${e.message}`));
      lines.push("");
    }
    lines.push("## Top Issues");
    if (!issues.length) lines.push("- No critical or warning issues.");
    else issues.slice(0, 12).forEach((i) => lines.push(`- [${i.severity.toUpperCase()}] ${i.title} | ${i.source} | status ${i.status} | ${i.durationMs}ms`));
    return lines.join("\n");
  }, [opsScore, opsBand.label, summary, runResult, sectionSummaries, loadResult, streamLogs, issues]);

  const rawDiagnosticsPayload = useMemo(() => {
    if (rawTab === "summary") return summary || { message: "No summary data loaded yet" };
    if (rawTab === "run") return runResult || { message: "No full run data loaded yet" };
    return loadResult || { message: "No load result data loaded yet" };
  }, [rawTab, summary, runResult, loadResult]);

  const rawDiagnosticsText = useMemo(() => JSON.stringify(rawDiagnosticsPayload, null, 2), [rawDiagnosticsPayload]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    if (verificationPhase !== "ready") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || Boolean(t?.isContentEditable)) return;
      const k = event.key.toLowerCase();
      if (k === "/") { event.preventDefault(); searchInputRef.current?.focus(); }
      else if (k === "r") { event.preventDefault(); void fetchSummary(); }
      else if (k === "s") { event.preventDefault(); void runStreamCheck(); }
      else if (k === "f") { event.preventDefault(); void runFullCheck(); }
      else if (k === "l") { event.preventDefault(); void runLoadCheck(); }
      else if (k === "e") { event.preventDefault(); exportSnapshot(); }
      else if (k === "c") { event.preventDefault(); setConsoleOpen((p) => !p); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [verificationPhase, fetchSummary, runStreamCheck, runFullCheck, runLoadCheck, exportSnapshot]);

  // ── Verification gate ──────────────────────────────────────────────
  if (isLoading || !authToken || verificationPhase === "checking" || verificationPhase === "welcome") {
    return (
      <div className={cn("statuscheck-dark min-h-screen p-8", headingFont.className)}>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_5%,_#0f172a_0%,_#020617_50%,_#000000_100%)]" />
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-slate-900/80 p-10 text-center shadow-[0_24px_60px_-30px_rgba(56,189,248,0.45)] backdrop-blur-sm">
          <RefreshCw className={cn("mx-auto h-10 w-10 text-[#154CB3]", verificationPhase === "checking" && "animate-spin")} />
          <p className="mt-3 text-lg font-semibold text-slate-100">{verificationPhase === "welcome" ? "Welcome, Developer" : "Verifying Access"}</p>
          <p className="mt-1 text-sm text-slate-300">{verificationPhase === "welcome" ? "Opening StatusCheck workspace..." : verificationMessage}</p>
          {verificationPhase === "checking" && verificationAttempt > 0 && <p className="mt-1 text-xs text-slate-400">Attempt {verificationAttempt} of 3</p>}
        </div>
      </div>
    );
  }

  if (verificationPhase === "failed") {
    return (
      <div className={cn("statuscheck-dark min-h-screen p-8", headingFont.className)}>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_5%,_#0f172a_0%,_#020617_50%,_#000000_100%)]" />
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-700/60 bg-slate-900/85 p-10 text-center shadow-[0_20px_50px_-30px_rgba(225,29,72,0.45)] backdrop-blur-sm">
          <p className="text-lg font-semibold text-rose-300">Access verification failed</p>
          <p className="mt-2 text-sm text-slate-300">{verificationMessage}</p>
        </div>
      </div>
    );
  }

  if (verificationPhase !== "ready") return null;

  const isAnyRunning = runningStream || runningFull;

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div className={cn("statuscheck-dark min-h-screen pb-12", headingFont.className)}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_8%,_#1e293b_0%,_#0f172a_35%,_#020617_100%)]" />
      <div className="pointer-events-none fixed -left-16 top-32 -z-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -right-20 top-10 -z-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="mx-auto w-full max-w-7xl px-4 pt-8 md:px-6">

        {/* ── Header ── */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(21,76,179,0.6)] backdrop-blur-sm md:p-8">
          <div className="absolute -right-14 -top-20 h-52 w-52 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <ShieldAlert className="h-3.5 w-3.5" />
                Admin / Organiser Zone
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">StatusCheck Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
                Deep diagnostics — endpoint reliability, workflow health, live console logs, mutation safety, and performance pressure across all {23} API routes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void fetchSummary({ record: true })} disabled={loadingSummary} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <RefreshCw className={cn("h-4 w-4", loadingSummary && "animate-spin")} /> Refresh
              </button>
              <button onClick={() => void runStreamCheck()} disabled={isAnyRunning} className="inline-flex items-center gap-2 rounded-lg bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#154CB3]/90 disabled:opacity-60">
                <Zap className={cn("h-4 w-4", runningStream && "animate-pulse")} />
                {runningStream ? "Streaming..." : "Stream Run"}
              </button>
              <button onClick={() => void runFullCheck()} disabled={isAnyRunning} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <Activity className={cn("h-4 w-4", runningFull && "animate-pulse")} />
                {runningFull ? "Running..." : "Full Run"}
              </button>
              <button onClick={exportSnapshot} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>
        </section>

        {/* ── KPI tiles ── */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiTile label="Database" value={summary?.dbHealth.ok ? "Healthy" : "Attention"} helper={summary?.dbHealth.message || "summary pending"} accent={summary?.dbHealth.ok ? "green" : "amber"} />
          <KpiTile label="Endpoint Pass" value={runResult ? asPercent(runResult.summary.endpoints.passed, runResult.summary.endpoints.total) : "-"} helper={runResult ? `${runResult.summary.endpoints.passed}/${runResult.summary.endpoints.total} probes` : "run checks"} accent="blue" />
          <KpiTile label="Last Runtime" value={runResult ? `${runResult.durationMs}ms` : "-"} helper={runResult ? formatDateTime(runResult.checkedAt) : "no recent run"} accent="slate" />
          <KpiTile label="Load P95" value={loadResult ? `${loadResult.p95Ms}ms` : "-"} helper={loadResult ? `error rate ${loadResult.errorRatePercent}%` : "run load diagnostics"} accent={loadResult && loadResult.errorRatePercent > 0 ? "amber" : "green"} />
          <KpiTile label="Ops Score" value={`${opsScore}`} helper={`${opsBand.label} stability`} accent={opsBand.accent === "emerald" ? "green" : opsBand.accent === "rose" ? "rose" : opsBand.accent === "amber" ? "amber" : "blue"} />
          <KpiTile label="Issues" value={`${criticalIssueCount}c / ${warningIssueCount}w`} helper="critical / warning" accent={criticalIssueCount > 0 ? "rose" : warningIssueCount > 0 ? "amber" : "green"} />
        </section>

        {/* ── Live Console ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
            <button onClick={() => setConsoleOpen((p) => !p)} className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
              <Terminal className="h-4 w-4 text-emerald-500" />
              Live Console
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", streamLogs.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                {streamLogs.length} lines
              </span>
              {runningStream && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
              {consoleOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            </button>
            <div className="flex gap-2">
              {streamLogs.length > 0 && (
                <button
                  onClick={() => void copyToClipboard(streamLogs.map((e) => `${formatTs(e.ts)} [${e.level.toUpperCase()}] ${e.message}`).join("\n"), "Logs copied")}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Logs
                </button>
              )}
              <button onClick={() => setStreamLogs([])} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Clear
              </button>
              <button onClick={() => void runStreamCheck()} disabled={isAnyRunning} className="inline-flex items-center gap-1 rounded-md bg-[#154CB3] px-3 py-1 text-xs font-semibold text-white hover:bg-[#154CB3]/90 disabled:opacity-60">
                <Zap className="h-3.5 w-3.5" /> Stream
              </button>
            </div>
          </div>

          {consoleOpen && (
            <div className={cn("h-80 overflow-y-auto bg-slate-950 p-4 space-y-0.5 font-mono", monoFont.className)}>
              {streamLogs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-600">
                  Press <span className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-400">S</span> or click Stream Run to start live diagnostics
                </div>
              ) : (
                streamLogs.map((entry) => <LogLine key={entry.id} entry={entry} />)
              )}
              <div ref={consoleEndRef} />
            </div>
          )}
        </section>

        {/* ── Charts ── */}
        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
              <BarChart3 className="h-4 w-4" /> Visual Insights <HelpTip text="Health composition and per-section pass rates." />
            </h2>
            {passFailPieData.length === 0 ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Run a check to populate charts.</div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="h-56 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={passFailPieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72}>
                        {passFailPieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-56 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectionFailureData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="section" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <RechartsTooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }} />
                      <Bar dataKey="passRate" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
              <Gauge className="h-4 w-4" /> Performance Trend <HelpTip text="Latency percentiles and historical run results." />
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="h-56 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {latencyProfileData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">Run load diagnostics to draw latency profile.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={latencyProfileData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <RechartsTooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }} />
                      <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="h-56 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {runTrendData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">Trigger checks to build run trend history.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={runTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis domain={[0, 1]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <RechartsTooltip formatter={(v: number) => (v === 1 ? "Pass" : "Fail")} contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }} />
                      <Bar dataKey="ok" radius={[4, 4, 0, 0]}>
                        {runTrendData.map((entry) => <Cell key={entry.name} fill={entry.ok ? "#10b981" : "#f43f5e"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Check results panel ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Search Checks
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="name, path, message" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm text-slate-700 focus:border-[#154CB3] focus:outline-none" />
                </div>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Section
                <select value={activeSection} onChange={(e) => setActiveSection(e.target.value as CheckSectionKey)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#154CB3] focus:outline-none">
                  {SECTION_META.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button onClick={() => setShowFailedOnly((p) => !p)} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold", showFailedOnly ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700")}>
                  <AlertTriangle className="h-4 w-4" /> Failures Only
                </button>
                <button onClick={() => setAutoRefreshSummary((p) => !p)} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold", autoRefreshSummary ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700")}>
                  <Clock3 className="h-4 w-4" /> 45s Auto
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setHistory([])} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear History</button>
              <button onClick={() => void runFullCheck()} disabled={isAnyRunning} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {runningFull ? "Running..." : "Execute Full Suite"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SECTION_META.map((s) => {
              const bucket = runResult?.summary[s.key === "endpointChecks" ? "endpoints" : s.key === "fetchDisplayChecks" ? "fetchDisplay" : s.key === "workflowChecks" ? "workflows" : "mutations"];
              return (
                <button key={s.key} onClick={() => setActiveSection(s.key)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", activeSection === s.key ? "border-[#154CB3] bg-[#154CB3] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>
                  {s.label}{bucket ? ` (${bucket.passed}/${bucket.total})` : ""}
                </button>
              );
            })}
          </div>

          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Keyboard className="h-3.5 w-3.5" />
            <span className={monoFont.className}>/</span> search,
            <span className={monoFont.className}> R</span> refresh,
            <span className={monoFont.className}> S</span> stream run,
            <span className={monoFont.className}> F</span> full run,
            <span className={monoFont.className}> L</span> load,
            <span className={monoFont.className}> C</span> console,
            <span className={monoFont.className}> E</span> export
          </div>

          {runResult && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {sectionSummaries.map((s) => (
                <button key={s.key} onClick={() => setActiveSection(s.key)} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100">
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">{s.label}</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{s.bucket.passed}/{s.bucket.total} pass</div>
                  <div className="mt-1 text-[11px] text-slate-500">fail {s.bucket.failed} · skip {s.bucket.skipped}</div>
                </button>
              ))}
            </div>
          )}

          {!runResult ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Run Stream or Full suite to populate check results.</div>
          ) : currentChecks.length === 0 ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No checks matched the current filter.</div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {currentChecks.map((item) => <CheckCard key={`${item.name}-${item.path || ""}-${String(item.status || "")}`} item={item} />)}
            </div>
          )}
        </section>

        {/* ── Route coverage + data snapshot ── */}
        {summary && (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Route Coverage Matrix</h2>
                <button onClick={() => void copyToClipboard(summary.apiBaseUrl, "API base copied")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Copy className="h-3.5 w-3.5" /> Copy Base
                </button>
              </div>
              <p className={cn("mt-1 text-xs text-slate-500", monoFont.className)}>{summary.apiBaseUrl}</p>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto md:grid-cols-2">
                {summary.routeCoverage.map((entry) => (
                  <div key={entry.group} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">{entry.group}</div>
                    <div className={cn("mt-0.5 text-[11px] text-slate-700", monoFont.className)}>{entry.mount}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">probe: {entry.probe}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Data Snapshot</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {summary.tableCounts.map((table) => (
                  <div key={table.table} className={cn("rounded-lg border px-3 py-2", table.ok ? "border-emerald-500/35 bg-emerald-950/35" : "border-rose-500/35 bg-rose-950/35")}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">{table.table}</div>
                    <div className="mt-0.5 text-lg font-bold text-slate-800">{table.count === null ? "n/a" : table.count}</div>
                    {!table.ok && table.error && <div className="text-[11px] text-rose-600">{table.error}</div>}
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Sample IDs</div>
                {([["event", summary.sampleRows.sampleEventId], ["fest", summary.sampleRows.sampleFestId]] as const).map(([label, id]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className={monoFont.className}>{label}: {id || "n/a"}</span>
                    {id && (
                      <button onClick={() => void copyToClipboard(id, `${label} ID copied`)} className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-white">Copy</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Load testing panel ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
            <Gauge className="h-4 w-4" /> Load Testing
            <HelpTip text="Hammer an endpoint with configurable iterations and concurrency to surface latency regressions." />
          </h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {LOAD_PRESETS.map((preset) => (
              <button key={preset.id} onClick={() => applyLoadPreset(preset)} className={cn("rounded-lg border p-2.5 text-left transition-all", selectedPresetId === preset.id ? "border-cyan-400/60 bg-cyan-500/10 ring-1 ring-cyan-400/25" : "border-slate-300 bg-slate-50 hover:bg-slate-100")}>
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
                  <Rocket className="h-3.5 w-3.5" /> {preset.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{preset.description}</div>
                <div className={cn("mt-0.5 text-[11px] text-slate-400", monoFont.className)}>{preset.iterations} iters / {preset.concurrency} conc</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <label className="text-[11px] font-semibold text-slate-500">
              Load Target
              <select value={loadTarget} onChange={(e) => setLoadTarget(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                {["events","fests","users","notifications","registrations","participants","chat","clubs","custom"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Iterations
              <input type="number" min={1} max={120} value={iterations} onChange={(e) => setIterations(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Concurrency
              <input type="number" min={1} max={12} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Custom Path
              <input type="text" value={customPath} onChange={(e) => setCustomPath(e.target.value)} placeholder="/api/events?page=1" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" />
            </label>
            <div className="flex flex-col gap-2 xl:justify-end">
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={runLoadAlongsideFull} onChange={(e) => setRunLoadAlongsideFull(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                Include in full run
              </label>
              <button onClick={() => void runLoadCheck()} disabled={runningLoad} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                <Gauge className={cn("h-4 w-4", runningLoad && "animate-pulse")} />
                {runningLoad ? "Running..." : "Run Load"}
              </button>
            </div>
          </div>

          {loadResult && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <KpiTile label="Error Rate" value={`${loadResult.errorRatePercent}%`} helper="request failures" accent={loadResult.errorRatePercent > 0 ? "amber" : "green"} />
                <KpiTile label="P50" value={`${loadResult.p50Ms}ms`} helper="median" accent="slate" />
                <KpiTile label="P95" value={`${loadResult.p95Ms}ms`} helper="tail latency" accent="blue" />
                <KpiTile label="Avg" value={`${loadResult.avgMs}ms`} helper="mean" accent="slate" />
                <KpiTile label="Throughput" value={`${loadResult.successCount}/${loadResult.completed}`} helper="success / total" accent="green" />
                <KpiTile label="Total Time" value={`${loadResult.totalDurationMs}ms`} helper={loadResult.targetPath} accent="slate" />
              </div>
              {Array.isArray(loadResult.failures) && loadResult.failures.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Load Failures</div>
                  <div className="mt-2 space-y-1 text-xs text-rose-700">
                    {loadResult.failures.slice(0, 8).map((f) => (
                      <div key={`${f.index}-${f.status}`}>#{f.index} status {String(f.status)} in {f.durationMs}ms{f.message ? ` (${f.message})` : ""}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Mutation guard ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
            <Wrench className="h-4 w-4" /> Mutation Guard Rail
            <HelpTip text="Mutation checks create and clean synthetic fest/event/notification rows. Enable only when validating create/update/delete paths." />
          </h2>
          <p className="mt-2 text-xs text-slate-600">Mutation tests create and clean synthetic rows. Keep disabled unless explicitly needed.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[auto,1fr] md:items-center">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={includeMutations} onChange={(e) => setIncludeMutations(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Enable mutation checks
            </label>
            <input type="text" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={MUTATION_CONFIRMATION_PHRASE} className={cn("w-full rounded-lg border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none", includeMutations ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500" : "border-slate-300 bg-slate-50 text-slate-700 focus:border-[#154CB3]")} />
          </div>
        </section>

        {/* ── Insert dummy event ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
            <Sparkles className="h-4 w-4" /> Insert Dummy Event
            <HelpTip text="Inserts one lightweight event row (text only — no image/banner/PDF) to confirm database write connectivity." />
          </h2>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-600">Creates a synthetic statuscheck event row to verify DB writes work end-to-end. No media is attached.</p>
            <button onClick={() => void insertDummyEvent()} disabled={insertingDummyEvent} className="inline-flex items-center gap-2 rounded-lg bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#154CB3]/90 disabled:opacity-60">
              <Rocket className={cn("h-4 w-4", insertingDummyEvent && "animate-pulse")} />
              {insertingDummyEvent ? "Inserting..." : "Insert Dummy Event"}
            </button>
          </div>
          {lastDummyEvent && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex items-center justify-between gap-2">
                <span className={monoFont.className}>event_id: {lastDummyEvent.event_id}</span>
                <button onClick={() => void copyToClipboard(lastDummyEvent.event_id, "Dummy event ID copied")} className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-white">Copy</button>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{lastDummyEvent.title} | venue: {lastDummyEvent.venue} | image=null, banner=null, pdf=null</div>
            </div>
          )}
        </section>

        {/* ── Developer commands ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
              <TerminalSquare className="h-4 w-4" /> Developer Quick Commands
              <HelpTip text="Prebuilt curl commands for terminal, CI, and scripting." />
            </h2>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {commandSnippets.map((snippet) => (
              <div key={snippet.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{snippet.title}</div>
                <pre className={cn("overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-900/95 p-2 text-[11px] text-slate-100", monoFont.className)}>{snippet.command}</pre>
                <button onClick={() => void copyToClipboard(snippet.command, `${snippet.title} copied`)} className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Raw diagnostics ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
              <BarChart3 className="h-4 w-4" /> Raw Diagnostics
              <HelpTip text="Inspect raw JSON payloads for deeper debugging." />
            </h2>
            <button onClick={() => setShowRawDiagnostics((p) => !p)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {showRawDiagnostics ? "Hide JSON" : "Show JSON"}
            </button>
          </div>
          {showRawDiagnostics && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {(["summary", "run", "load"] as const).map((key) => (
                  <button key={key} onClick={() => setRawTab(key)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", rawTab === key ? "border-[#154CB3] bg-[#154CB3] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>
                    {key === "run" ? "Full Run" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
                <button onClick={() => void copyToClipboard(rawDiagnosticsText, "Raw JSON copied")} className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Copy className="h-3.5 w-3.5" /> Copy JSON
                </button>
              </div>
              <pre className={cn("max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-[11px] text-slate-100", monoFont.className)}>
                {rawDiagnosticsText}
              </pre>
            </div>
          )}
        </section>

        {/* ── Incident feed + timeline ── */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Incident Feed</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void copyToClipboard(incidentReportMarkdown, "Incident report copied")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Copy className="h-3.5 w-3.5" /> Copy Report
                </button>
                <button onClick={() => downloadTextFile(`statuscheck-incident-${Date.now()}.md`, incidentReportMarkdown)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <FileText className="h-3.5 w-3.5" /> Export .md
                </button>
              </div>
            </div>
            {issues.length === 0 ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">No critical or slow-check incidents in the latest run.</div>
            ) : (
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {issues.slice(0, 15).map((issue) => (
                  <div key={issue.id} className={cn("rounded-lg border px-3 py-2", issue.severity === "critical" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50")}>
                    <div className="text-sm font-semibold text-slate-800">{issue.title}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{issue.source} · status {issue.status} · {issue.durationMs}ms</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Run Timeline</h2>
            {history.length === 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No run history yet. Refresh summary or run checks to begin tracking.</div>
            ) : (
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {history.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">{entry.headline}</div>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", entry.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>{entry.kind}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">{entry.detail}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(entry.at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mt-4 text-center text-xs text-slate-500">
          Last summary refresh: {summary ? formatDateTime(summary.checkedAt) : "not available"} · {summary?.requestedBy || ""}
        </div>
      </div>

      <style jsx global>{`
        .statuscheck-dark [class*="bg-white"] { background-color: rgba(15, 23, 42, 0.9) !important; }
        .statuscheck-dark .bg-slate-50 { background-color: rgba(30, 41, 59, 0.55) !important; }
        .statuscheck-dark .bg-slate-100 { background-color: rgba(30, 41, 59, 0.72) !important; }
        .statuscheck-dark .bg-emerald-50 { background-color: rgba(6, 78, 59, 0.34) !important; }
        .statuscheck-dark .bg-rose-50 { background-color: rgba(127, 29, 29, 0.34) !important; }
        .statuscheck-dark .bg-amber-50 { background-color: rgba(120, 53, 15, 0.36) !important; }
        .statuscheck-dark .bg-blue-50 { background-color: rgba(30, 58, 138, 0.34) !important; }
        .statuscheck-dark .bg-cyan-500\/10 { background-color: rgba(6, 182, 212, 0.12) !important; }
        .statuscheck-dark [class*="border-slate-"] { border-color: #334155 !important; }
        .statuscheck-dark [class*="border-emerald-"] { border-color: rgba(16, 185, 129, 0.45) !important; }
        .statuscheck-dark [class*="border-rose-"] { border-color: rgba(244, 63, 94, 0.45) !important; }
        .statuscheck-dark [class*="border-amber-"] { border-color: rgba(245, 158, 11, 0.45) !important; }
        .statuscheck-dark [class*="border-cyan-"] { border-color: rgba(34, 211, 238, 0.45) !important; }
        .statuscheck-dark .text-slate-900, .statuscheck-dark .text-slate-800, .statuscheck-dark .text-slate-700 { color: #e2e8f0 !important; }
        .statuscheck-dark .text-slate-600 { color: #cbd5e1 !important; }
        .statuscheck-dark .text-slate-500 { color: #94a3b8 !important; }
        .statuscheck-dark .text-slate-400 { color: #7c90ac !important; }
        .statuscheck-dark .text-emerald-700 { color: #6ee7b7 !important; }
        .statuscheck-dark .text-emerald-600 { color: #34d399 !important; }
        .statuscheck-dark .text-rose-700 { color: #fda4af !important; }
        .statuscheck-dark .text-rose-600 { color: #fb7185 !important; }
        .statuscheck-dark .text-amber-700 { color: #fcd34d !important; }
        .statuscheck-dark input:not([type="checkbox"]):not([type="radio"]),
        .statuscheck-dark select,
        .statuscheck-dark textarea {
          background-color: rgba(15, 23, 42, 0.78) !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }
        .statuscheck-dark input::placeholder, .statuscheck-dark textarea::placeholder { color: #64748b !important; }
        .statuscheck-dark .shadow-sm { box-shadow: 0 12px 28px -18px rgba(2, 6, 23, 0.95) !important; }
      `}</style>
    </div>
  );
}
