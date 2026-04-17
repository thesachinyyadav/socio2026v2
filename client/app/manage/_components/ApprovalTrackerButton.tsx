"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  ApprovalStatusIcon,
  ApprovalVisualStatus,
  getStatusLabel,
} from "@/app/manage/_components/approvalWorkflowVisuals";
import { supabase } from "@/lib/supabaseClient";
import type {
  WorkflowQuickSummaryItem,
  WorkflowQuickSummaryStageId,
  WorkflowType,
} from "@/lib/hooks/useWorkflowState";

const STAGE_LABELS: Record<WorkflowQuickSummaryStageId, string> = {
  L1_HOD: "HOD Approval",
  L2_DEAN: "Dean Approval",
  L3_CFO: "CFO Approval",
  L4_ACCOUNTS: "Accounts Approval",
};

const STAGE_ORDER: WorkflowQuickSummaryStageId[] = ["L1_HOD", "L2_DEAN", "L3_CFO", "L4_ACCOUNTS"];

const QUICK_SUMMARY_CACHE_TTL_MS = 45_000;

const quickSummaryCache = new Map<
  string,
  {
    fetchedAt: number;
    summary: WorkflowQuickSummaryItem[];
  }
>();

const inflightSummaryFetches = new Map<string, Promise<WorkflowQuickSummaryItem[]>>();

type ApprovalStepRow = {
  id: string;
  step_code?: string | null;
  role_code?: string | null;
  status?: string | null;
  decided_at?: string | null;
  updated_at?: string | null;
};

type ApprovalDecisionRow = {
  id: string;
  approval_step_id?: string | null;
  decision?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

function normalizeToken(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeLower(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isSchemaError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  const code = normalizeToken(error?.code);
  const message = normalizeLower(error?.message);

  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("relation")
  );
}

function normalizeTimestamp(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripRevisionPrefix(value?: string | null): string | null {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const prefix = "RETURN_FOR_REVISION:";
  if (text.toUpperCase().startsWith(prefix)) {
    const cleaned = text.slice(prefix.length).trim();
    return cleaned || null;
  }

  return text;
}

function buildSummaryRow(
  stage: WorkflowQuickSummaryStageId,
  status: ApprovalVisualStatus,
  timestamp: string | null = null,
  note: string | null = null
): WorkflowQuickSummaryItem {
  return {
    id: stage,
    label: STAGE_LABELS[stage],
    status,
    statusLabel: getStatusLabel(status),
    timestamp,
    note,
  };
}

function buildInheritedRow(stage: WorkflowQuickSummaryStageId): WorkflowQuickSummaryItem {
  return {
    id: stage,
    label: STAGE_LABELS[stage],
    status: "approved",
    statusLabel: "Via Fest",
    timestamp: null,
    note: null,
  };
}

function getFallbackSummary(
  workflowStatus?: string | null,
  stages: WorkflowQuickSummaryStageId[] = ["L1_HOD", "L2_DEAN"],
  eventContext?: string | null
): WorkflowQuickSummaryItem[] {
  if (normalizeLower(eventContext) === "under_fest") {
    return (stages.length > 0 ? stages : (["L1_HOD", "L2_DEAN"] as WorkflowQuickSummaryStageId[]))
      .filter((s) => s === "L1_HOD" || s === "L2_DEAN")
      .map(buildInheritedRow);
  }

  const token = normalizeLower(workflowStatus);
  const statusByStage: Record<WorkflowQuickSummaryStageId, ApprovalVisualStatus> = {
    L1_HOD: "blocked",
    L2_DEAN: "blocked",
    L3_CFO: "blocked",
    L4_ACCOUNTS: "blocked",
  };

  if (token.includes("pending_hod") || token.includes("pending_level_1")) {
    statusByStage.L1_HOD = "pending";
  } else if (token.includes("pending_dean") || token.includes("pending_level_2")) {
    statusByStage.L1_HOD = "approved";
    statusByStage.L2_DEAN = "pending";
  } else if (token.includes("pending_cfo") || token.includes("pending_level_3")) {
    statusByStage.L1_HOD = "approved";
    statusByStage.L2_DEAN = "approved";
    statusByStage.L3_CFO = "pending";
  } else if (token.includes("pending_accounts") || token.includes("pending_level_4")) {
    statusByStage.L1_HOD = "approved";
    statusByStage.L2_DEAN = "approved";
    statusByStage.L3_CFO = "approved";
    statusByStage.L4_ACCOUNTS = "pending";
  } else if (token.includes("approved") || token.includes("live")) {
    statusByStage.L1_HOD = "approved";
    statusByStage.L2_DEAN = "approved";
    statusByStage.L3_CFO = "approved";
    statusByStage.L4_ACCOUNTS = "approved";
  } else if (token.includes("rejected") || token.includes("return")) {
    statusByStage.L1_HOD = "rejected";
  }

  return stages.map((stage) => buildSummaryRow(stage, statusByStage[stage]));
}

function inferStepStage(step: ApprovalStepRow): WorkflowQuickSummaryStageId | null {
  const signature = `${normalizeToken(step.step_code)} ${normalizeToken(step.role_code)}`;

  if (signature.includes("L1_HOD") || signature.includes("HOD")) {
    return "L1_HOD";
  }

  if (signature.includes("L2_DEAN") || signature.includes("DEAN")) {
    return "L2_DEAN";
  }

  if (signature.includes("L3_CFO") || signature.includes("CFO")) {
    return "L3_CFO";
  }

  if (
    signature.includes("L4_ACCOUNTS") ||
    signature.includes("ACCOUNTS") ||
    signature.includes("ACCOUNT") ||
    signature.includes("FINANCE_OFFICER") ||
    signature.includes("FINANCE")
  ) {
    return "L4_ACCOUNTS";
  }

  return null;
}

function deriveStatusFromStepAndDecision(input: {
  step: ApprovalStepRow | null;
  decision: ApprovalDecisionRow | null;
  fallback: ApprovalVisualStatus;
}): ApprovalVisualStatus {
  const stepToken = normalizeToken(input.step?.status);
  const decisionToken = normalizeToken(input.decision?.decision);
  const commentToken = normalizeToken(input.decision?.comment);

  if (decisionToken === "APPROVED" || stepToken === "APPROVED") {
    return "approved";
  }

  if (decisionToken === "REJECTED" || stepToken === "REJECTED" || commentToken.startsWith("RETURN_FOR_REVISION")) {
    return "rejected";
  }

  if (stepToken === "PENDING" || stepToken === "UNDER_REVIEW") {
    return "pending";
  }

  if (stepToken === "WAITING" || stepToken === "QUEUED" || stepToken === "NOT_STARTED") {
    return "blocked";
  }

  return input.fallback;
}

async function fetchQuickSummaryFromSupabase(input: {
  workflowType: WorkflowType;
  workflowId: string;
  approvalRequestId?: string | null;
  workflowStatus?: string | null;
  eventContext?: string | null;
}): Promise<WorkflowQuickSummaryItem[]> {
  const workflowId = String(input.workflowId || "").trim();
  if (!workflowId) {
    return getFallbackSummary(input.workflowStatus);
  }

  let requestId = String(input.approvalRequestId || "").trim();
  let workflowStatus = input.workflowStatus || null;

  if (!requestId || workflowStatus == null) {
    if (input.workflowType === "event") {
      const { data: eventRow } = await supabase
        .from("events")
        .select("approval_request_id,workflow_status")
        .eq("event_id", workflowId)
        .maybeSingle();

      if (!requestId) {
        requestId = String((eventRow as Record<string, unknown> | null)?.approval_request_id || "").trim();
      }

      if (workflowStatus == null) {
        workflowStatus = String((eventRow as Record<string, unknown> | null)?.workflow_status || "").trim() || null;
      }
    } else {
      const festTables = ["fests", "fest"] as const;

      for (const tableName of festTables) {
        const { data: festRow, error: festError } = await supabase
          .from(tableName)
          .select("approval_request_id,workflow_status")
          .eq("fest_id", workflowId)
          .maybeSingle();

        if (festError) {
          if (isSchemaError(festError)) {
            continue;
          }

          throw new Error(festError.message || "Unable to load fest workflow snapshot.");
        }

        if (!requestId) {
          requestId = String((festRow as Record<string, unknown> | null)?.approval_request_id || "").trim();
        }

        if (workflowStatus == null) {
          workflowStatus = String((festRow as Record<string, unknown> | null)?.workflow_status || "").trim() || null;
        }

        if (festRow) {
          break;
        }
      }
    }
  }

  if (!requestId) {
    const { data: requestRows } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("entity_ref", workflowId)
      .order("created_at", { ascending: false })
      .limit(1);

    requestId = Array.isArray(requestRows) && requestRows[0]?.id ? String(requestRows[0].id) : "";
  }

  const fallbackSummary = getFallbackSummary(workflowStatus, undefined, input.eventContext);

  if (!requestId) {
    return fallbackSummary;
  }

  const [stepsResult, decisionsResult] = await Promise.all([
    supabase
      .from("approval_steps")
      .select("id,step_code,role_code,status,decided_at,updated_at")
      .eq("approval_request_id", requestId)
      .order("sequence_order", { ascending: true }),
    supabase
      .from("approval_decisions")
      .select("id,approval_step_id,decision,comment,created_at")
      .eq("approval_request_id", requestId)
      .order("created_at", { ascending: false }),
  ]);

  const steps = ((stepsResult.data as ApprovalStepRow[] | null) || []).filter(Boolean);
  const decisions = ((decisionsResult.data as ApprovalDecisionRow[] | null) || []).filter(Boolean);

  const latestDecisionByStepId = new Map<string, ApprovalDecisionRow>();
  decisions.forEach((decision) => {
    const stepId = String(decision.approval_step_id || "").trim();
    if (!stepId || latestDecisionByStepId.has(stepId)) {
      return;
    }

    latestDecisionByStepId.set(stepId, decision);
  });

  const stepByStage: Partial<Record<WorkflowQuickSummaryStageId, ApprovalStepRow>> = {};
  steps.forEach((step) => {
    const stage = inferStepStage(step);
    if (!stage || stepByStage[stage]) {
      return;
    }

    stepByStage[stage] = step;
  });

  const presentStages = STAGE_ORDER.filter((stage) => stepByStage[stage]);
  if (presentStages.length === 0) {
    if (normalizeLower(input.eventContext) === "under_fest") {
      return (["L1_HOD", "L2_DEAN"] as WorkflowQuickSummaryStageId[]).map(buildInheritedRow);
    }
    return fallbackSummary;
  }

  const fallbackByStage = new Map<WorkflowQuickSummaryStageId, ApprovalVisualStatus>(
    getFallbackSummary(workflowStatus, presentStages).map((row) => [row.id, row.status])
  );

  let previousApproved = true;
  return presentStages.map((stage) => {
    const step = stepByStage[stage] || null;
    const decision = step ? latestDecisionByStepId.get(step.id) || null : null;
    const fallback: ApprovalVisualStatus = previousApproved
      ? fallbackByStage.get(stage) || "blocked"
      : "blocked";

    const status = deriveStatusFromStepAndDecision({ step, decision, fallback });
    previousApproved = previousApproved && status === "approved";

    return buildSummaryRow(
      stage,
      status,
      normalizeTimestamp(decision?.created_at || step?.decided_at || step?.updated_at || null),
      stripRevisionPrefix(decision?.comment || null)
    );
  });
}

async function loadQuickSummaryWithCache(input: {
  workflowType: WorkflowType;
  workflowId: string;
  approvalRequestId?: string | null;
  workflowStatus?: string | null;
  eventContext?: string | null;
}): Promise<WorkflowQuickSummaryItem[]> {
  const cacheKey = `${input.workflowType}:${String(input.workflowId || "").trim()}`;
  if (!cacheKey) {
    return getFallbackSummary(input.workflowStatus, undefined, input.eventContext);
  }

  const cached = quickSummaryCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < QUICK_SUMMARY_CACHE_TTL_MS) {
    return cached.summary;
  }

  const inflight = inflightSummaryFetches.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const requestPromise = fetchQuickSummaryFromSupabase(input)
    .then((summary) => {
      quickSummaryCache.set(cacheKey, {
        fetchedAt: Date.now(),
        summary,
      });
      inflightSummaryFetches.delete(cacheKey);
      return summary;
    })
    .catch((error) => {
      inflightSummaryFetches.delete(cacheKey);
      throw error;
    });

  inflightSummaryFetches.set(cacheKey, requestPromise);
  return requestPromise;
}

function getDominantStatus(rows: WorkflowQuickSummaryItem[]): ApprovalVisualStatus {
  if (rows.some((row) => row.status === "rejected")) {
    return "rejected";
  }

  if (rows.some((row) => row.status === "pending")) {
    return "pending";
  }

  if (rows.every((row) => row.status === "approved")) {
    return "approved";
  }

  return "blocked";
}

export default function ApprovalTrackerButton({
  workflowType,
  workflowId,
  workflowTitle,
  approvalRequestId,
  workflowStatus,
  eventContext,
  buttonLabel = "Approvals",
  className,
}: {
  workflowType: WorkflowType;
  workflowId: string;
  workflowTitle?: string;
  approvalRequestId?: string | null;
  workflowStatus?: string | null;
  eventContext?: string | null;
  buttonLabel?: string;
  className?: string;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WorkflowQuickSummaryItem[]>(
    getFallbackSummary(workflowStatus, undefined, eventContext)
  );

  const closeTimerRef = useRef<number | null>(null);

  const stableWorkflowId = String(workflowId || "").trim();
  const workflowHref = stableWorkflowId
    ? `/workflows/${workflowType}/${encodeURIComponent(stableWorkflowId)}`
    : "#";

  const refreshSummary = useMemo(
    () => async () => {
      if (!stableWorkflowId) {
        setSummary(getFallbackSummary(workflowStatus, undefined, eventContext));
        setIsLoading(false);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const nextSummary = await loadQuickSummaryWithCache({
          workflowType,
          workflowId: stableWorkflowId,
          approvalRequestId,
          workflowStatus,
          eventContext,
        });

        setSummary(nextSummary);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load approval summary.");
        setSummary(getFallbackSummary(workflowStatus, undefined, eventContext));
      } finally {
        setIsLoading(false);
      }
    },
    [approvalRequestId, eventContext, stableWorkflowId, workflowStatus, workflowType]
  );

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  const dominantStatus = useMemo(() => getDominantStatus(summary), [summary]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPopover = () => {
    clearCloseTimer();
    setIsPopoverOpen(true);
  };

  const closePopover = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsPopoverOpen(false);
    }, 130);
  };

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  return (
    <>
      <div
        className={`relative ${className || ""}`.trim()}
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
        onFocus={openPopover}
        onBlur={(event) => {
          const nextFocusTarget = event.relatedTarget as Node | null;
          if (!nextFocusTarget || !event.currentTarget.contains(nextFocusTarget)) {
            closePopover();
          }
        }}
      >
        <Link
          href={workflowHref}
          title={workflowTitle || `${workflowType} workflow`}
          className="inline-flex items-center gap-2 rounded-full border border-[#154cb3]/20 bg-[#154cb3]/5 px-3 py-1.5 text-sm font-semibold text-[#154cb3] transition-all hover:border-[#154cb3]/40 hover:bg-[#154cb3]/10"
          aria-label={`Open ${workflowType} workflow tracker`}
        >
          <span>{buttonLabel}</span>
          <ApprovalStatusIcon status={dominantStatus} className="h-4 w-4" animatePending />
        </Link>

        {isPopoverOpen ? (
          <div className="absolute bottom-full right-0 z-50 mb-3 w-[min(26rem,calc(100vw-1.25rem))] rounded-2xl border border-white/35 bg-white/20 p-3 shadow-[0_18px_55px_-24px_rgba(15,23,42,0.6)] backdrop-blur-2xl sm:w-[22rem]">
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/25 bg-white/15 px-3 py-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-sky-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">
                  Quick Insights
                </p>
                <p className="mt-0.5 text-xs text-slate-700/90">
                  Hover summary covers every approver this workflow needs. Click to open the full mindmap.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {summary.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between rounded-xl border border-white/35 bg-white/35 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                    {row.timestamp ? <p className="text-[11px] text-slate-600">{row.timestamp}</p> : null}
                    {row.note ? <p className="mt-1 text-[11px] text-rose-700">{row.note}</p> : null}
                  </div>
                  <div className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/55 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    <ApprovalStatusIcon status={row.status} className="h-3.5 w-3.5" animatePending />
                    {row.statusLabel}
                  </div>
                </div>
              ))}
            </div>

            {isLoading ? (
              <p className="mt-3 text-[11px] text-slate-600">Refreshing approval status...</p>
            ) : null}

            {error ? <p className="mt-3 text-[11px] text-rose-700">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
