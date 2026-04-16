"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRoleCode } from "@/lib/roleDashboards";

type ApprovalLog = {
  id: string;
  step: string;
  action: string;
  actor_email: string;
  actor_role: string;
  notes?: string | null;
  created_at: string;
};

type EventContextResponse = {
  event: {
    event_id: string;
    title: string;
    description?: string | null;
    event_date?: string | null;
    venue?: string | null;
    campus_hosted_at?: string | null;
    organizing_dept?: string | null;
    organizer_email?: string | null;
    registration_fee?: number | null;
    budget_amount?: number | null;
    estimated_budget_amount?: number | null;
    total_estimated_expense?: number | null;
    participants_per_team?: number | null;
    workflow_status?: string | null;
    needs_budget_approval?: boolean | null;
  };
  approvers?: {
    hod?: { name?: string | null; email?: string | null } | null;
    dean?: { name?: string | null; email?: string | null } | null;
    cfo?: { name?: string | null; email?: string | null } | null;
    accounts?: { name?: string | null; email?: string | null } | null;
  };
  logs?: ApprovalLog[];
};

const API_URL = "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const normalizeToken = (value: unknown) => String(value || "").trim().toLowerCase();

const HUMAN_STEP_LABEL: Record<string, string> = {
  hod_review: "HOD Review",
  dean_review: "Dean Review",
  cfo_review: "CFO Review",
  accounts_review: "Accounts Review",
  organiser_review: "Organiser Review",
};

const HUMAN_ACTION_LABEL: Record<string, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  returned_for_revision: "Returned For Revision",
  auto_approved: "Auto Approved",
  hod_dean_combined: "HOD+Dean Combined",
};

export default function HodDeanApprovalPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { userData } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contextData, setContextData] = useState<EventContextResponse | null>(null);
  const [notes, setNotes] = useState("");

  const userRecord = (userData as Record<string, unknown> | null) ?? null;
  const isMasterAdmin = Boolean((userData as any)?.is_masteradmin) || hasAnyRoleCode(userRecord, ["MASTER_ADMIN"]);
  const isHod = Boolean((userData as any)?.is_hod) || hasAnyRoleCode(userRecord, ["HOD"]);
  const isDean = Boolean((userData as any)?.is_dean) || hasAnyRoleCode(userRecord, ["DEAN"]);
  const isCfo = Boolean((userData as any)?.is_cfo) || hasAnyRoleCode(userRecord, ["CFO"]);
  const isFinanceOfficer =
    Boolean((userData as any)?.is_finance_officer) ||
    Boolean((userData as any)?.is_finance_office) ||
    hasAnyRoleCode(userRecord, ["ACCOUNTS", "FINANCE_OFFICER"]);

  useEffect(() => {
    const loadToken = async () => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setToken(session?.access_token || null);
    };

    loadToken();
  }, []);

  const fetchContext = useCallback(async () => {
    if (!token || !eventId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/events/${encodeURIComponent(eventId)}/context`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load approval context.");
      }

      setContextData(payload as EventContextResponse);
    } catch (error: any) {
      toast.error(error?.message || "Unable to load approval context.");
    } finally {
      setIsLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const logs = useMemo(() => {
    return Array.isArray(contextData?.logs) ? contextData!.logs : [];
  }, [contextData]);

  const latestStepDecision = useMemo(() => {
    const result: Record<string, ApprovalLog | undefined> = {};
    const reversed = [...logs].reverse();

    for (const row of reversed) {
      const step = normalizeToken(row.step);
      if (!step || result[step]) continue;
      if (normalizeToken(row.action) === "submitted") continue;
      result[step] = row;
    }

    return result;
  }, [logs]);

  const latestHodDecision = latestStepDecision.hod_review;
  const latestDeanDecision = latestStepDecision.dean_review;
  const latestCfoDecision = latestStepDecision.cfo_review;
  const latestAccountsDecision = latestStepDecision.accounts_review;

  const workflowStatus = normalizeToken(contextData?.event?.workflow_status);
  const canHodAct = (isHod || isMasterAdmin) && workflowStatus === "pending_hod";
  const canDeanAct = (isDean || isMasterAdmin) && workflowStatus === "pending_dean";
  const canCfoAct = (isCfo || isMasterAdmin) && workflowStatus === "pending_cfo";
  const canAccountsAct = (isFinanceOfficer || isMasterAdmin) && workflowStatus === "pending_accounts";
  const canReview = canHodAct || canDeanAct || canCfoAct || canAccountsAct;
  const budgetAmount =
    contextData?.event?.budget_amount ||
    contextData?.event?.estimated_budget_amount ||
    contextData?.event?.total_estimated_expense ||
    contextData?.event?.registration_fee ||
    null;

  const submitAction = async (
    actor: "hod" | "dean",
    action: "approved" | "rejected" | "returned_for_revision"
  ) => {
    if (!token || !eventId) return;

    if (action !== "approved" && notes.trim().length < 20) {
      toast.error("Notes must be at least 20 characters for rejection/revision.");
      return;
    }

    setIsSubmitting(true);
    try {
      const body =
        actor === "hod"
          ? {
              hod_action: action,
              hod_notes: notes.trim() || null,
              dean_action: null,
              dean_notes: null,
            }
          : {
              hod_action: null,
              hod_notes: null,
              dean_action: action,
              dean_notes: notes.trim() || null,
            };

      const response = await fetch(`${API_URL}/api/events/${encodeURIComponent(eventId)}/hod-dean-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to submit decision.");
      }

      toast.success("Decision submitted successfully.");
      setNotes("");
      await fetchContext();
    } catch (error: any) {
      toast.error(error?.message || "Unable to submit decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFinanceAction = async (
    reviewer: "cfo" | "accounts",
    action: "approved" | "rejected" | "returned_for_revision"
  ) => {
    if (!token || !eventId) return;

    if (action !== "approved" && notes.trim().length < 20) {
      toast.error("Notes must be at least 20 characters for rejection/revision.");
      return;
    }

    const endpoint = reviewer === "cfo" ? "cfo-action" : "accounts-action";

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/events/${encodeURIComponent(eventId)}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          notes: notes.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to submit decision.");
      }

      toast.success("Decision submitted successfully.");
      setNotes("");
      await fetchContext();
    } catch (error: any) {
      toast.error(error?.message || "Unable to submit decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading approval context...</p>
      </main>
    );
  }

  if (!contextData?.event) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Event Not Found</h1>
          <p className="text-sm text-slate-500 mt-2">Unable to load this approval context.</p>
          <Link href="/manage" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
            Back to Manage
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Standalone Approval Workflow</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{contextData.event.title}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {contextData.event.organizing_dept || "Department"} | {contextData.event.campus_hosted_at || "Campus"}
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {contextData.event.workflow_status || "unknown"}
          </span>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Event Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
            <div>Date: {contextData.event.event_date ? new Date(contextData.event.event_date).toLocaleString() : "TBD"}</div>
            <div>Venue: {contextData.event.venue || "TBD"}</div>
            <div>Organizer: {contextData.event.organizer_email || "Unknown"}</div>
            <div>Budget: {budgetAmount ? `Rs ${budgetAmount}` : "Not specified"}</div>
          </div>
          {contextData.event.description && (
            <p className="text-sm text-slate-700 mt-3 leading-relaxed">{contextData.event.description}</p>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">HOD Review</h3>
            <p className="text-xs text-slate-500 mt-1">
              {contextData.approvers?.hod?.name || "HOD"} {contextData.approvers?.hod?.email ? `(${contextData.approvers.hod.email})` : ""}
            </p>
            {latestHodDecision ? (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-800">{HUMAN_ACTION_LABEL[normalizeToken(latestHodDecision.action)] || latestHodDecision.action}</p>
                {latestHodDecision.notes ? <p className="text-slate-600 mt-1">{latestHodDecision.notes}</p> : null}
                <p className="text-xs text-slate-500 mt-2">{new Date(latestHodDecision.created_at).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">No HOD decision yet.</p>
            )}

            {canHodAct && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitAction("hod", "approved")}
                  className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitAction("hod", "returned_for_revision")}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold disabled:opacity-60"
                >
                  Return for Revision
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitAction("hod", "rejected")}
                  className="w-full px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-semibold disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">Dean Review</h3>
            <p className="text-xs text-slate-500 mt-1">
              {contextData.approvers?.dean?.name || "Dean"} {contextData.approvers?.dean?.email ? `(${contextData.approvers.dean.email})` : ""}
            </p>
            {workflowStatus === "pending_hod" && !latestHodDecision ? (
              <p className="text-sm text-amber-700 mt-3">Waiting for HOD to review first.</p>
            ) : latestDeanDecision ? (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-800">{HUMAN_ACTION_LABEL[normalizeToken(latestDeanDecision.action)] || latestDeanDecision.action}</p>
                {latestDeanDecision.notes ? <p className="text-slate-600 mt-1">{latestDeanDecision.notes}</p> : null}
                <p className="text-xs text-slate-500 mt-2">{new Date(latestDeanDecision.created_at).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">No Dean decision yet.</p>
            )}

            {canDeanAct && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitAction("dean", "approved")}
                  className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitAction("dean", "returned_for_revision")}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold disabled:opacity-60"
                >
                  Return for Revision
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitAction("dean", "rejected")}
                  className="w-full px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-semibold disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">CFO Review</h3>
            <p className="text-xs text-slate-500 mt-1">
              {contextData.approvers?.cfo?.name || "CFO"} {contextData.approvers?.cfo?.email ? `(${contextData.approvers.cfo.email})` : ""}
            </p>
            {latestCfoDecision ? (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-800">{HUMAN_ACTION_LABEL[normalizeToken(latestCfoDecision.action)] || latestCfoDecision.action}</p>
                {latestCfoDecision.notes ? <p className="text-slate-600 mt-1">{latestCfoDecision.notes}</p> : null}
                <p className="text-xs text-slate-500 mt-2">{new Date(latestCfoDecision.created_at).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">No CFO decision yet.</p>
            )}

            {canCfoAct && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitFinanceAction("cfo", "approved")}
                  className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitFinanceAction("cfo", "returned_for_revision")}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold disabled:opacity-60"
                >
                  Return for Revision
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitFinanceAction("cfo", "rejected")}
                  className="w-full px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-semibold disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">Finance Officer Review</h3>
            <p className="text-xs text-slate-500 mt-1">
              {contextData.approvers?.accounts?.name || "Finance Officer"} {contextData.approvers?.accounts?.email ? `(${contextData.approvers.accounts.email})` : ""}
            </p>
            {latestAccountsDecision ? (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-800">{HUMAN_ACTION_LABEL[normalizeToken(latestAccountsDecision.action)] || latestAccountsDecision.action}</p>
                {latestAccountsDecision.notes ? <p className="text-slate-600 mt-1">{latestAccountsDecision.notes}</p> : null}
                <p className="text-xs text-slate-500 mt-2">{new Date(latestAccountsDecision.created_at).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">No finance decision yet.</p>
            )}

            {canAccountsAct && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitFinanceAction("accounts", "approved")}
                  className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitFinanceAction("accounts", "returned_for_revision")}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold disabled:opacity-60"
                >
                  Return for Revision
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitFinanceAction("accounts", "rejected")}
                  className="w-full px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-semibold disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </section>

        {canReview && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <label htmlFor="review-notes" className="block text-sm font-semibold text-slate-800 mb-2">
              Review Notes (required for reject or return)
            </label>
            <textarea
              id="review-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Enter notes here..."
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 20 characters for rejection/revision actions.</p>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Timeline</h3>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">No timeline entries yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-800">
                    {HUMAN_STEP_LABEL[normalizeToken(row.step)] || row.step} | {HUMAN_ACTION_LABEL[normalizeToken(row.action)] || row.action}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {row.actor_email} | {new Date(row.created_at).toLocaleString()}
                  </p>
                  {row.notes ? <p className="text-sm text-slate-700 mt-2">{row.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <Link href="/manage" className="inline-flex text-sm text-blue-600 hover:underline">
          Back to Manage
        </Link>
      </div>
    </main>
  );
}
