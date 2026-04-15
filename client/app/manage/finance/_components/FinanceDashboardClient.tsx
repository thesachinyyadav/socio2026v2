"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  closeSettlementAction,
  recordAdvancePaidAction,
  submitFinanceApprovalDecisionAction,
  toggleExpenseDocumentVerificationAction,
} from "../actions";
import AccountsApproveAndRouteButton from "./AccountsApproveAndRouteButton";
import {
  FinanceAdvanceRequestItem,
  FinanceApprovalAction,
  FinanceDashboardData,
  FinanceSettlementItem,
} from "../types";

type FinanceTab = "approvals" | "advances" | "settlements";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FinanceDashboardClient({
  initialData,
}: {
  initialData: FinanceDashboardData;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FinanceTab>("approvals");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [advanceAmounts, setAdvanceAmounts] = useState<Record<string, string>>({});
  const [advanceNotes, setAdvanceNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const tabs = useMemo(
    () => [
      { key: "approvals" as const, label: "Budget Approvals (L4)", count: initialData.approvals.length },
      { key: "advances" as const, label: "Vendor Advances", count: initialData.advances.length },
      { key: "settlements" as const, label: "Final Settlements", count: initialData.settlements.length },
    ],
    [initialData.approvals.length, initialData.advances.length, initialData.settlements.length]
  );

  const setFeedbackMessage = (message: string) => {
    setFeedback(message);
  };

  const submitDecision = (requestId: string, action: FinanceApprovalAction) => {
    const note = (decisionNotes[requestId] || "").trim();

    startTransition(async () => {
      const result = await submitFinanceApprovalDecisionAction({
        requestId,
        action,
        note,
      });

      setFeedbackMessage(result.message);
      if (result.ok) {
        setDecisionNotes((previous) => ({ ...previous, [requestId]: "" }));
        router.refresh();
      }
    });
  };

  const recordAdvance = (item: FinanceAdvanceRequestItem) => {
    const rawAmount = (advanceAmounts[item.budgetId] || "").trim();
    const amount = Number.parseFloat(rawAmount);
    const note = (advanceNotes[item.budgetId] || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedbackMessage("Enter a valid advance amount greater than 0.");
      return;
    }

    startTransition(async () => {
      const result = await recordAdvancePaidAction({
        budgetId: item.budgetId,
        eventId: item.eventId,
        amount,
        note,
      });

      setFeedbackMessage(result.message);
      if (result.ok) {
        setAdvanceAmounts((previous) => ({ ...previous, [item.budgetId]: "" }));
        setAdvanceNotes((previous) => ({ ...previous, [item.budgetId]: "" }));
        router.refresh();
      }
    });
  };

  const toggleDocumentVerification = (documentId: string, eventId: string, verified: boolean) => {
    startTransition(async () => {
      const result = await toggleExpenseDocumentVerificationAction({
        documentId,
        eventId,
        verified,
      });

      setFeedbackMessage(result.message);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  const closeSettlement = (item: FinanceSettlementItem) => {
    startTransition(async () => {
      const result = await closeSettlementAction({
        budgetId: item.budgetId,
        eventId: item.eventId,
      });

      setFeedbackMessage(result.message);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Finance Officer Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          All budget-bearing events require Finance L4 approval. Event details here are strictly read-only.
        </p>
      </header>

      {initialData.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {initialData.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[#154CB3] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {activeTab === "approvals" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Department / School</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Estimated Budget</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">CFO Approved</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {initialData.approvals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No pending L4 budget approvals.
                    </td>
                  </tr>
                )}

                {initialData.approvals.map((item) => {
                  const noteValue = decisionNotes[item.id] || "";
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{item.eventName}</p>
                        <p className="text-xs text-slate-500">ID: {item.eventId}</p>
                        <p className="text-xs text-slate-500">Coordinator: {item.coordinatorName}</p>
                        <p className="text-xs text-slate-500">Date: {formatDate(item.eventDate)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-800">{item.departmentName}</p>
                        <p className="text-xs text-slate-500">{item.schoolName}</p>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(item.totalEstimatedExpense)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.cfoApprovedAt)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.requestedAt)}</td>
                      <td className="px-4 py-4">
                        <textarea
                          value={noteValue}
                          onChange={(event) =>
                            setDecisionNotes((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Required for reject/return (min 20 chars)"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#154CB3] focus:outline-none"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AccountsApproveAndRouteButton
                            onClick={() => submitDecision(item.id, "approve")}
                            disabled={isPending}
                          />
                          <button
                            type="button"
                            onClick={() => submitDecision(item.id, "return")}
                            disabled={isPending}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            Return
                          </button>
                          <button
                            type="button"
                            onClick={() => submitDecision(item.id, "reject")}
                            disabled={isPending}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "advances" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Vendor Sources</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Record Advance Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {initialData.advances.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      No vendor advances pending action.
                    </td>
                  </tr>
                )}

                {initialData.advances.map((item) => {
                  const amountValue = advanceAmounts[item.budgetId] || "";
                  const noteValue = advanceNotes[item.budgetId] || "";

                  return (
                    <tr key={`${item.budgetId}-${item.eventId}`} className="align-top">
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{item.eventName}</p>
                        <p className="text-xs text-slate-500">ID: {item.eventId}</p>
                        <p className="text-xs text-slate-500">Department: {item.departmentName}</p>
                        <p className="text-xs text-slate-500">Budget: {formatCurrency(item.totalEstimatedExpense)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {item.vendors.length === 0 ? (
                            <span className="text-xs text-slate-500">No vendor names provided</span>
                          ) : (
                            item.vendors.map((vendor) => (
                              <span
                                key={`${item.budgetId}-${vendor}`}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                              >
                                {vendor}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                        <p>{formatCurrency(item.advanceRequestedAmount)}</p>
                        <p className="text-xs font-normal text-slate-500">
                          Remaining: {formatCurrency(item.advanceRemainingAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(item.advancePaidAmount)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountValue}
                            onChange={(event) =>
                              setAdvanceAmounts((previous) => ({
                                ...previous,
                                [item.budgetId]: event.target.value,
                              }))
                            }
                            placeholder="Amount paid"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#154CB3] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={noteValue}
                            onChange={(event) =>
                              setAdvanceNotes((previous) => ({
                                ...previous,
                                [item.budgetId]: event.target.value,
                              }))
                            }
                            placeholder="Optional note"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#154CB3] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => recordAdvance(item)}
                            disabled={isPending}
                            className="rounded-lg bg-[#154CB3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#124099] disabled:opacity-50"
                          >
                            Record Advance Paid
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "settlements" && (
        <div className="space-y-4">
          {initialData.settlements.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No submitted settlements are pending finance closure.
            </div>
          )}

          {initialData.settlements.map((item) => (
            <article
              key={`${item.budgetId}-${item.eventId}`}
              className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{item.eventName}</p>
                <p className="mt-1 text-xs text-slate-500">Event ID: {item.eventId}</p>
                <p className="text-xs text-slate-500">{item.departmentName} - {item.schoolName}</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Estimated</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(item.totalEstimatedExpense)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Actual</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(item.totalActualExpense)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Variance</dt>
                    <dd className={`font-semibold ${item.varianceAmount > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {formatCurrency(item.varianceAmount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Settlement Status</dt>
                    <dd className="font-semibold text-slate-900">{item.settlementStatus}</dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-1 text-xs">
                  <p className={item.allDocumentsVerified ? "text-emerald-700" : "text-amber-700"}>
                    Documents verified: {item.allDocumentsVerified ? "Yes" : "No"}
                  </p>
                  <p className={item.mathChecksOut ? "text-emerald-700" : "text-rose-700"}>
                    Math checks out: {item.mathChecksOut ? "Yes" : "No"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => closeSettlement(item)}
                  disabled={isPending || !item.allDocumentsVerified || !item.mathChecksOut}
                  className="mt-4 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close & Settle Event
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Invoice / Receipt Verification</h3>
                <div className="mt-3 space-y-3">
                  {item.documents.length === 0 && (
                    <p className="text-xs text-slate-500">No expense documents uploaded.</p>
                  )}

                  {item.documents.map((document) => (
                    <div
                      key={document.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-medium text-slate-900">{document.fileName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {document.documentType} | Uploaded {formatDate(document.uploadedAt)}
                      </p>
                      {typeof document.amount === "number" && (
                        <p className="mt-0.5 text-xs text-slate-600">Amount: {formatCurrency(document.amount)}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {document.fileUrl ? (
                          <a
                            href={document.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            View File
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">No file URL</span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            toggleDocumentVerification(document.id, document.eventId, !document.financeVerified)
                          }
                          disabled={isPending}
                          className={`rounded-md px-2 py-1 text-xs font-semibold text-white ${
                            document.financeVerified
                              ? "bg-rose-600 hover:bg-rose-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          } disabled:opacity-50`}
                        >
                          {document.financeVerified ? "Unverify Document" : "Verify Document"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
