"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type StepStatus = "pending" | "approved" | "rejected" | "skipped";

interface ApprovalStage {
  step: number;
  role: string;
  label: string;
  status: StepStatus;
  assignee_user_id: string | null;
  routing_state: "assigned" | "waiting_for_assignment";
  blocking: boolean;
}

interface ActionLogEntry {
  step_index?: number;
  step: string;
  action: string;
  by: string;
  byEmail: string;
  at: string;
  note?: string | null;
  is_override?: boolean;
}

interface BudgetItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface ApprovalRecord {
  id: string;
  event_or_fest_id: string;
  type: "event" | "fest";
  stages: ApprovalStage[];
  went_live_at: string | null;
  created_at: string;
  updated_at: string;
  organizing_department_snapshot: string | null;
  organizing_school_snapshot: string | null;
  submitted_by: string | null;
  action_log: ActionLogEntry[];
  budget_items?: BudgetItem[];
}

interface ItemMeta {
  title: string;
  type: string;
  organizing_dept: string | null;
  organizing_school: string | null;
  event_date: string | null;
  created_by: string | null;
}

function isPhase1Complete(stages: ApprovalStage[]): boolean {
  return stages.filter((s) => s.blocking).every(
    (s) => s.status === "approved" || s.status === "skipped"
  );
}

const STATUS_COLORS: Record<StepStatus, string> = {
  pending:  "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  skipped:  "bg-gray-100 text-gray-500 border-gray-300",
};

const STATUS_ICONS: Record<StepStatus, string> = {
  pending:  "⏳",
  approved: "✅",
  rejected: "❌",
  skipped:  "⏭️",
};

function StepCard({
  label,
  status,
  routingState,
}: {
  label: string;
  status: StepStatus;
  routingState?: "assigned" | "waiting_for_assignment";
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${STATUS_COLORS[status]}`}>
      <span className="text-lg">{STATUS_ICONS[status]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {status === "pending" && routingState === "waiting_for_assignment" && (
          <p className="text-xs opacity-70 mt-0.5">Awaiting assignment</p>
        )}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide">{status}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ApprovalsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = params?.itemId as string;
  const typeParam = searchParams.get("type") || undefined;

  const { session, isLoading: authLoading } = useAuth();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [item, setItem] = useState<ItemMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace("/auth"); return; }
    fetchApproval();
  }, [authLoading, session, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchApproval() {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_URL}/api/approvals/${itemId}${typeParam ? `?type=${typeParam}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (res.status === 403) { setError("You do not have access to this approval record."); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to load approval record.");
        return;
      }
      const data = await res.json();
      setApproval(data.approval);
      setItem(data.item);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading approval status…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">Go back</button>
      </div>
    );
  }

  if (!approval) return null;

  const blockingStages    = approval.stages.filter((s) => s.blocking);
  const operationalStages = approval.stages.filter((s) => !s.blocking);
  const phase1Done        = isPhase1Complete(approval.stages);
  const hasRejection      = approval.action_log.some((e) => e.action === "reject");

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Approval Status</h1>
          {item && (
            <p className="text-gray-600 mt-1">
              <span className="font-medium">{item.title}</span>{" "}
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-1 uppercase">
                {approval.type}
              </span>
            </p>
          )}
          {item?.organizing_school && (
            <p className="text-sm text-gray-500 mt-1">
              {item.organizing_school}{item.organizing_dept ? ` · ${item.organizing_dept}` : ""}
            </p>
          )}
        </div>

        {/* Stage indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            phase1Done ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
          }`}>
            {phase1Done ? "Stage 2: Operational" : "Stage 1: Pending Approval"}
          </span>
          {approval.went_live_at && (
            <span className="text-sm text-green-700 font-medium">
              Live since {formatDate(approval.went_live_at)}
            </span>
          )}
        </div>

        {/* Rejection alert */}
        {hasRejection && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⛔</span>
              <p className="text-red-700 font-bold text-sm">Submission Returned</p>
            </div>
            {approval.action_log.filter((e) => e.action === "reject").map((e, i) => (
              <div key={i} className={`${i > 0 ? "mt-3 pt-3 border-t border-red-200" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded uppercase">
                    {e.step}
                  </span>
                  <span className="text-xs text-red-500">{e.by} · {formatDate(e.at)}</span>
                  {e.is_override && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Override</span>
                  )}
                </div>
                {e.note ? (
                  <p className="text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2 border border-red-200 italic">
                    "{e.note}"
                  </p>
                ) : (
                  <p className="text-xs text-red-400 italic">No reason provided.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Blocking stages */}
        {blockingStages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Stage 1 — Blocking Approvals
            </h2>
            {blockingStages.map((s) => (
              <StepCard key={s.step} label={s.label} status={s.status} routingState={s.routing_state} />
            ))}
          </div>
        )}

        {/* Operational stages */}
        {operationalStages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Stage 2 — Operational Lanes
            </h2>
            {operationalStages.map((s) => (
              <StepCard key={s.step} label={s.label} status={s.status} />
            ))}
          </div>
        )}

        {/* Budget estimate */}
        {approval.budget_items && approval.budget_items.length > 0 && (
          <div className="bg-white rounded-xl border border-green-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              💰 Budget Estimate
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Item</th>
                    <th className="text-center pb-2 font-semibold">Qty</th>
                    <th className="text-right pb-2 font-semibold">Unit (₹)</th>
                    <th className="text-right pb-2 font-semibold">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {approval.budget_items.map((b, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-800">{b.name || "—"}</td>
                      <td className="py-1.5 text-center text-gray-600">{b.quantity}</td>
                      <td className="py-1.5 text-right text-gray-600">{b.unitPrice.toLocaleString("en-IN")}</td>
                      <td className="py-1.5 text-right font-medium text-gray-800">
                        {(b.quantity * b.unitPrice).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Estimate</td>
                    <td className="pt-3 text-right text-base font-bold text-gray-900">
                      ₹{approval.budget_items.reduce((s, b) => s + b.quantity * b.unitPrice, 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Activity timeline */}
        {approval.action_log.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Activity Timeline
            </h2>
            <ol className="relative border-l border-gray-200 space-y-4 ml-2">
              {[...approval.action_log].reverse().map((entry, i) => (
                <li key={i} className="ml-4">
                  <span className={`absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-white ${
                    entry.action === "approve" ? "bg-green-500" : "bg-red-500"
                  }`} />
                  <p className="text-sm font-medium text-gray-900">
                    {entry.step.toUpperCase()} — {entry.action === "approve" ? "Approved" : "Rejected"}
                    {entry.is_override && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Override</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{entry.by} · {formatDate(entry.at)}</p>
                  {entry.note && <p className="text-sm text-gray-600 mt-1 italic">"{entry.note}"</p>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Submitted on {formatDate(approval.created_at)}
          {approval.submitted_by ? ` by ${approval.submitted_by}` : ""}
        </p>
      </div>
    </div>
  );
}
