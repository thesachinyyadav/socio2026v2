"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, AlertCircle, ArrowLeftRight } from "lucide-react";
import { fetchHodAnalytics, HodAnalyticsBundle } from "@/lib/hodAnalyticsApi";
import DeptOverview from "../_components/Hod/DeptOverview";
import { GlassyCard, StatusPill } from "../_components/Hod/DashboardUI";

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

type ViewType = "overview" | "analytics" | "queue" | "logistics" | "roadmap";

const HodDataExplorer = dynamic(
  () => import("../_components/Hod/HodDataExplorer"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-14 text-center shadow-sm">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#154CB3]" />
        <p className="text-sm font-semibold text-slate-700">Synthesizing intelligence...</p>
      </div>
    ),
  }
);

export default function HodDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = (searchParams.get("view") as ViewType) || "overview";
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [bundle, setBundle] = useState<HodAnalyticsBundle | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ itemId: string; type: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Auth & Permissions
  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    if (userData && !(userData as any).is_hod && !(userData as any).is_masteradmin) {
      router.replace("/error"); return;
    }
  }, [isLoading, session, userData]);

  // Data Fetching
  useEffect(() => {
    if (session && activeView === "overview" && !bundle) {
      void fetchBundle();
    }
    if (session && activeView === "queue") {
      void fetchQueue();
    }
  }, [activeView, session]);

  async function fetchBundle() {
    setLoading(true);
    try {
      const data = await fetchHodAnalytics();
      setBundle(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load department intelligence.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/approvals/queue`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      setQueue(data.queue.filter((q: QueueItem) => q._queue_role === "hod"));
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  // Actions
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

  const pendingItems = useMemo(() => queue.filter(q => (q.stages.find(s => s.role === "hod")?.status === "pending")), [queue]);
  const reviewedItems = useMemo(() => queue.filter(q => (q.stages.find(s => s.role === "hod")?.status !== "pending")), [queue]);

  if (loading && !bundle && activeView === "overview") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-[#154CB3] mb-4" />
        <p className="text-slate-500 font-bold tracking-tight">Initializing Intelligence Center...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Overview View */}
      {activeView === "overview" && bundle && (
        <DeptOverview bundle={bundle} />
      )}

      {/* Analytics View */}
      {activeView === "analytics" && (
        <HodDataExplorer />
      )}

      {/* Queue View */}
      {activeView === "queue" && (
        <div className="space-y-12">
          <header className="mb-8">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">Approval Queue</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Review and sign-off on department-hosted events.</p>
          </header>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Action Required ({pendingItems.length})
            </h3>
            <div className="grid gap-4">
              {pendingItems.length === 0 ? (
                <GlassyCard className="py-20 text-center">
                  <p className="text-slate-400 font-bold">Your queue is clear.</p>
                </GlassyCard>
              ) : (
                pendingItems.map(item => (
                  <GlassyCard key={item.id} className="flex items-center justify-between gap-6 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                         <h4 className="font-extrabold text-slate-900 truncate">{item.item_title}</h4>
                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-500">{item.type}</span>
                         <StatusPill status="pending" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 truncate tracking-tight">
                        Submitted by Organiser · {(new Date(item.created_at)).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link 
                        href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
                        className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-[#154CB3] transition-colors"
                      >
                         Details
                      </Link>
                      <button 
                         disabled={actionItemId === item.event_or_fest_id}
                         onClick={() => setRejectModal({ itemId: item.event_or_fest_id, type: item.type })}
                         className="h-10 px-4 rounded-xl border border-red-100 text-red-600 font-bold text-xs hover:bg-red-50 transition-all disabled:opacity-50"
                      >
                        Return
                      </button>
                      <button 
                         disabled={actionItemId === item.event_or_fest_id}
                         onClick={() => handleAction(item, "approve")}
                         className="h-10 px-6 rounded-xl bg-[#154CB3] text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {actionItemId === item.event_or_fest_id ? "..." : "Approve"}
                      </button>
                    </div>
                  </GlassyCard>
                ))
              )}
            </div>
          </section>

          {reviewedItems.length > 0 && (
            <section className="opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-500">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" /> Activity History ({reviewedItems.length})
              </h3>
              <div className="grid gap-3">
                 {reviewedItems.map(item => (
                   <div key={item.id} className="flex items-center justify-between gap-6 px-6 py-3 rounded-2xl bg-white border border-slate-100">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{item.item_title}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           Final Status: {item.stages.find(s => s.role === 'hod')?.status}
                        </p>
                      </div>
                      <Link 
                        href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
                        className="text-[10px] font-black uppercase tracking-widest text-[#154CB3]"
                      >
                         Review
                      </Link>
                   </div>
                 ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Logistics & Roadmap Placeholders */}
      {(activeView === "logistics" || activeView === "roadmap") && (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
           <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
              <AlertCircle className="h-10 w-10 text-slate-300" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 uppercase">Module Under Deployment</h2>
           <p className="text-slate-500 font-medium max-w-sm mt-2">
             The {activeView} subsystem is being stiched into your workspace. Check back shortly for deep resource pulse monitoring.
           </p>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 scale-in-center">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-100">
            <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Return to Organiser</h2>
            <p className="text-sm font-medium text-slate-500 mb-6">
              Provide actionable feedback so the organiser can fix any issues and resubmit.
            </p>
            <textarea
              rows={4}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g., Please clarify the venue booking times or add more sponsors."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-100 transition-all mb-6"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const item = queue.find(q => q.event_or_fest_id === rejectModal.itemId);
                  if (item) void handleAction(item, "reject", rejectNote);
                  setRejectModal(null);
                }}
                className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Return Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
