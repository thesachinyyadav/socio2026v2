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
  assignee_user_id: string | null;
  routing_state: string;
  blocking: boolean;
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

function pendingDuration(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function DeanDashboard() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ itemId: string; type: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace("/auth"); return; }
    if (userData && !(userData as any).is_dean && !(userData as any).is_masteradmin) {
      router.replace("/error"); return;
    }
    fetchQueue();
  }, [authLoading, session, userData]);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/approvals/queue`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      setQueue(data.queue.filter((q: QueueItem) => q._queue_role === "dean"));
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(item: QueueItem, action: "approve" | "reject", note?: string) {
    setActionItemId(item.event_or_fest_id);
    try {
      const res = await fetch(`${API_URL}/api/approvals/${item.event_or_fest_id}/action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step_index: item.stages?.find((s) => s.role === "dean")?.step ?? 1,
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
      fetchQueue();
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dean Approval Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Submissions from your school that have passed HOD review.
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading queue…</p>
        ) : queue.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No pending approvals in your queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{item.item_title}</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                      {item.type}
                    </span>
                    {(() => {
                      const hodStage = item.stages?.find((s) => s.role === "hod");
                      const hodDone = !hodStage || hodStage.status === "approved" || hodStage.status === "skipped";
                      return hodDone ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          HOD {hodStage?.status ?? "cleared"}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {item.organizing_school_snapshot || "—"}
                    {item.organizing_department_snapshot ? ` · ${item.organizing_department_snapshot}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Submitted {pendingDuration(item.created_at)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
                    className="text-sm text-blue-600 hover:underline px-2 py-1"
                  >
                    View
                  </Link>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
