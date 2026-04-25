"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { Pagination } from "../_components/UI/Pagination";

interface ApprovalStage {
  step: number;
  role: string;
  label: string;
  status: string;
  blocking: boolean;
  approved_by: string | null;
}

interface QueueItem {
  id: string;
  event_or_fest_id: string;
  type: "event" | "fest";
  item_title: string;
  item_date: string | null;
  organizing_department_snapshot: string | null;
  organizing_school_snapshot: string | null;
  created_at: string;
  stages: ApprovalStage[];
  _queue_role: string;
}

const safeText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeLower = (value: unknown): string => safeText(value, "").toLowerCase();

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function hodStatus(item: QueueItem) {
  return safeLower(item.stages?.find((s) => s.role === "hod")?.status) || "pending";
}

function hodActedBy(item: QueueItem): string | null {
  return safeText(item.stages?.find((s) => s.role === "hod")?.approved_by, "") || null;
}

export default function HodDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [activeView, setActiveView] = useState<HodView>("analytics");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ itemId: string; type: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Pagination state
  const [pendingPage, setPendingPage] = useState(1);
  const [reviewedPage, setReviewedPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    if (userData && !(userData as any).is_hod && !(userData as any).is_masteradmin) {
      router.replace("/error"); return;
    }
  }, [isLoading, session, userData]);

  // Only fetch queue when the queue tab is active
  useEffect(() => {
    if (activeView === "queue" && session) {
      void fetchQueue();
    }
  }, [activeView, session]);

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
        _queue_role: safeLower(q?._queue_role),
      }));
      setQueue(normalizedQueue.filter((q) => q._queue_role === "hod"));
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(item: QueueItem, action: "approve" | "reject", note?: string) {
    setActionItemId(item.event_or_fest_id);
    try {
      const hodStage = item.stages?.find((s) => s.role === "hod");
      const res = await fetch(`${API_URL}/api/approvals/${item.event_or_fest_id}/action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step_index: hodStage?.step ?? 0,
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
      toast.success(action === "approve" ? "Approved successfully" : "Returned to organiser");
      void fetchQueue();
    } catch {
      toast.error("Network error");
    } finally {
      setActionItemId(null);
    }
  }

  function openRejectModal(item: QueueItem) {
    setRejectModal({ itemId: item.event_or_fest_id, type: item.type });
    setRejectNote("");
  }

  async function confirmReject() {
    if (!rejectModal) return;
    const item = queue.find((q) => q.event_or_fest_id === rejectModal.itemId);
    if (!item) return;
    await handleAction(item, "reject", rejectNote);
    setRejectModal(null);
  }

  const pendingItems = queue.filter((q) => hodStatus(q) === "pending");
  const reviewedItems = queue.filter((q) => hodStatus(q) !== "pending");

  function StatusBadge({ status }: { status: string }) {
    const normalizedStatus = safeLower(status);
    if (normalizedStatus === "approved")
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>;
    if (normalizedStatus === "rejected")
      return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Returned</span>;
    return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>;
  }

  function QueueCard({ item, showActions }: { item: QueueItem; showActions: boolean }) {
    const status = hodStatus(item);
    const actedBy = status !== "pending" ? hodActedBy(item) : null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{item.item_title}</p>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">{item.type}</span>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {item.organizing_school_snapshot || "—"}
            {item.organizing_department_snapshot ? ` · ${item.organizing_department_snapshot}` : ""}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Submitted {timeAgo(item.created_at)}</p>
          {actedBy && (
            <p className="text-xs text-gray-400 mt-0.5">
              {status === "approved" ? "Approved" : "Returned"} by <span className="font-medium text-gray-600">{safeText(actedBy)}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
            className="text-sm text-blue-600 hover:underline px-2 py-1"
          >
            View
          </Link>
          {showActions && (
            <>
              <button
                disabled={actionItemId === item.event_or_fest_id}
                onClick={() => openRejectModal(item)}
                className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Return
              </button>
              <button
                disabled={actionItemId === item.event_or_fest_id}
                onClick={() => handleAction(item, "approve")}
                className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {actionItemId === item.event_or_fest_id ? "…" : "Approve"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Header — full width */}
      <div className="max-w-full mx-auto mb-6 px-0">
        <div className="flex flex-wrap items-start justify-between gap-4 max-w-3xl mx-auto xl:max-w-full">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HOD Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage department approvals and view analytics.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["analytics", "queue"] as HodView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={[
                  "rounded-lg px-4 py-1.5 text-[11px] font-semibold transition-colors",
                  activeView === view ? "bg-[#154CB3] text-white" : "text-slate-600 hover:bg-white",
                ].join(" ")}
              >
                {view === "analytics" ? "Dashboard" : "Approval Queue"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics view — full width */}
      {activeView === "analytics" && (
        <div className="max-w-full xl:px-2">
          <HodFestDashboard />
        </div>
      )}

      {/* Queue view — constrained width */}
      {activeView === "queue" && (
        <div className="max-w-3xl mx-auto space-y-8">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading queue…</p>
          ) : (
            <>
              <section>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                  <span>Pending <span className="text-gray-400 font-normal ml-1">({pendingItems.length})</span></span>
                </h2>
                {pendingItems.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-400 text-sm font-medium">No pending approvals.</p>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-3">
                      {pendingItems
                        .slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE)
                        .map((item) => (
                          <QueueCard key={item.id} item={item} showActions />
                        ))}
                    </div>
                    <Pagination
                      currentPage={pendingPage}
                      totalPages={Math.ceil(pendingItems.length / ITEMS_PER_PAGE)}
                      onNext={() => setPendingPage((p) => p + 1)}
                      onPrev={() => setPendingPage((p) => p - 1)}
                      totalItems={pendingItems.length}
                    />
                  </div>
                )}
              </section>

              {reviewedItems.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                    <span>Reviewed <span className="text-gray-400 font-normal ml-1">({reviewedItems.length})</span></span>
                  </h2>
                  <div>
                    <div className="space-y-3">
                      {reviewedItems
                        .slice((reviewedPage - 1) * ITEMS_PER_PAGE, reviewedPage * ITEMS_PER_PAGE)
                        .map((item) => (
                          <QueueCard key={item.id} item={item} showActions={false} />
                        ))}
                    </div>
                    <Pagination
                      currentPage={reviewedPage}
                      totalPages={Math.ceil(reviewedItems.length / ITEMS_PER_PAGE)}
                      onNext={() => setReviewedPage((p) => p + 1)}
                      onPrev={() => setReviewedPage((p) => p - 1)}
                      totalItems={reviewedItems.length}
                    />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Return to Organiser</h2>
            <p className="text-sm text-gray-600">
              Provide a reason so the organiser can address the issue.
            </p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for returning (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmReject()}
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
