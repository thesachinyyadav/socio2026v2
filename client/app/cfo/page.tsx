"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

interface ApprovalStage {
  step: number;
  role: string;
  label: string;
  status: string;
  blocking: boolean;
  approved_by: string | null;
}

interface BudgetItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface QueueItem {
  id: string;
  event_or_fest_id: string;
  type: "event" | "fest";
  item_title: string;
  item_date: string | null;
  organizing_department_snapshot: string | null;
  organizing_school_snapshot: string | null;
  organizing_campus_snapshot: string | null;
  created_at: string;
  stages: ApprovalStage[];
  budget_items?: BudgetItem[];
  _queue_role: string;
}

const safeText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeLower = (value: unknown): string => safeText(value, "").toLowerCase();

function pendingDuration(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function budgetTotal(items: BudgetItem[]) {
  return items.reduce((s, b) => s + Number(b.quantity || 0) * Number(b.unitPrice || 0), 0);
}

function cfoStatus(item: QueueItem) {
  return safeLower(item.stages?.find((s) => s.role === "cfo")?.status) || "pending";
}

export default function CfoDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ itemId: string; type: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    if (userData && !(userData as any).is_cfo && !(userData as any).is_masteradmin) {
      router.replace("/error"); return;
    }
    fetchQueue();
  }, [isLoading, session, userData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/approvals/queue`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      const queueItems = Array.isArray(data?.queue) ? data.queue : [];
      const normalizedQueue: QueueItem[] = queueItems.map((q: any) => ({
        id: safeText(q?.id),
        event_or_fest_id: safeText(q?.event_or_fest_id),
        type: safeLower(q?.type) === "fest" ? "fest" : "event",
        item_title: safeText(q?.item_title, "Untitled"),
        item_date: safeText(q?.item_date, "") || null,
        organizing_department_snapshot: safeText(q?.organizing_department_snapshot, "") || null,
        organizing_school_snapshot: safeText(q?.organizing_school_snapshot, "") || null,
        organizing_campus_snapshot: safeText(q?.organizing_campus_snapshot, "") || null,
        created_at: safeText(q?.created_at, new Date().toISOString()),
        stages: Array.isArray(q?.stages)
          ? q.stages.map((s: any) => ({
              step: Number(s?.step ?? 0),
              role: safeText(s?.role),
              label: safeText(s?.label),
              status: safeText(s?.status, "pending"),
              blocking: Boolean(s?.blocking),
              approved_by: safeText(s?.approved_by, "") || null,
            }))
          : [],
        budget_items: Array.isArray(q?.budget_items)
          ? q.budget_items.map((b: any) => ({
              id: safeText(b?.id, "") || undefined,
              name: safeText(b?.name, ""),
              quantity: Number(b?.quantity ?? 0),
              unitPrice: Number(b?.unitPrice ?? 0),
            }))
          : [],
        _queue_role: safeLower(q?._queue_role),
      }));
      setQueue(normalizedQueue.filter((q) => q._queue_role === "cfo"));
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(item: QueueItem, action: "approve" | "reject", note?: string) {
    setActionItemId(item.event_or_fest_id);
    try {
      const cfoStage = item.stages?.find((s) => s.role === "cfo");
      const res = await fetch(`${API_URL}/api/approvals/${item.event_or_fest_id}/action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step_index: cfoStage?.step ?? 0,
          action,
          note: note || null,
          type: item.type,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(action === "approve" ? "Approved" : "Returned to organiser");
      fetchQueue();
    } catch {
      toast.error("Network error");
    } finally {
      setActionItemId(null);
    }
  }

  async function confirmReject() {
    if (!rejectModal) return;
    const item = queue.find((q) => q.event_or_fest_id === rejectModal.itemId);
    if (!item) return;
    await handleAction(item, "reject", rejectNote);
    setRejectModal(null);
  }

  const pendingItems = queue.filter((q) => cfoStatus(q) === "pending");
  const reviewedItems = queue.filter((q) => cfoStatus(q) !== "pending");

  function StatusBadge({ status }: { status: string }) {
    const normalizedStatus = safeLower(status);
    if (normalizedStatus === "approved") {
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>;
    }
    if (normalizedStatus === "rejected") {
      return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Returned</span>;
    }
    return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>;
  }

  function QueueCard({ item, showActions }: { item: QueueItem; showActions: boolean }) {
    const hasBudget = Array.isArray(item.budget_items) && item.budget_items.length > 0;
    const isExpanded = expandedId === item.id;
    const status = cfoStatus(item);

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 truncate">{item.item_title}</p>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                {item.type}
              </span>
              <StatusBadge status={status} />
              {hasBudget && (
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full tabular-nums">
                  ₹{budgetTotal(item.budget_items!).toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {item.organizing_school_snapshot || "—"}
              {item.organizing_campus_snapshot ? ` · ${item.organizing_campus_snapshot}` : ""}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Submitted {pendingDuration(item.created_at)}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasBudget && (
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {isExpanded ? "Hide budget" : "View budget"}
              </button>
            )}
            <Link
              href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
              className="text-sm text-blue-600 hover:underline px-2 py-1"
            >
              Details
            </Link>
            {showActions && (
              <>
                <button
                  disabled={actionItemId === item.event_or_fest_id}
                  onClick={() => { setRejectModal({ itemId: item.event_or_fest_id, type: item.type }); setRejectNote(""); }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Return
                </button>
                <button
                  disabled={actionItemId === item.event_or_fest_id}
                  onClick={() => handleAction(item, "approve")}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[#154CB3] text-white hover:bg-[#0f3a7a] disabled:opacity-50"
                >
                  {actionItemId === item.event_or_fest_id ? "…" : "Approve"}
                </button>
              </>
            )}
          </div>
        </div>

        {isExpanded && hasBudget && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget Breakdown</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 font-medium">Item</th>
                  <th className="text-center pb-1.5 font-medium w-16">Qty</th>
                  <th className="text-right pb-1.5 font-medium w-24">Unit (₹)</th>
                  <th className="text-right pb-1.5 font-medium w-24">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {item.budget_items!.map((b, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 text-gray-800">{b.name || "—"}</td>
                    <td className="py-1 text-center text-gray-600">{b.quantity}</td>
                    <td className="py-1 text-right text-gray-600">{b.unitPrice.toLocaleString("en-IN")}</td>
                    <td className="py-1 text-right font-medium text-gray-800">
                      {(b.quantity * b.unitPrice).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right text-xs font-semibold text-gray-500">Total</td>
                  <td className="pt-2 text-right font-bold text-gray-900">
                    ₹{budgetTotal(item.budget_items!).toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CFO Approval Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review budget estimates and approve or return submissions.
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading queue…</p>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Pending <span className="text-gray-400 font-normal">({pendingItems.length})</span>
              </h2>
              {pendingItems.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <p className="text-gray-500">No pending approvals in your queue.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingItems.map((item) => (
                    <QueueCard key={item.id} item={item} showActions />
                  ))}
                </div>
              )}
            </section>

            {reviewedItems.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Reviewed <span className="text-gray-400 font-normal">({reviewedItems.length})</span>
                </h2>
                <div className="space-y-3">
                  {reviewedItems.map((item) => (
                    <QueueCard key={item.id} item={item} showActions={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Return to Organiser</h2>
            <p className="text-sm text-gray-600">Provide a reason so the organiser can address the issue.</p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for returning (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
