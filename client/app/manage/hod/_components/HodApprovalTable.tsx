"use client";

import { HodApprovalAction, HodApprovalQueueItem } from "../types";

interface HodApprovalTableProps {
  rows: HodApprovalQueueItem[];
  completedActions: Record<string, HodApprovalAction>;
  activeRequestId: string | null;
  onApprove: (requestId: string) => void;
  onReturn: (requestId: string) => void;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  eventDetailBasePath?: string;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatDateLabel(dateValue: string | null): string {
  if (!dateValue) {
    return "TBD";
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "TBD";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HodApprovalTable({
  rows,
  completedActions,
  activeRequestId,
  onApprove,
  onReturn,
  emptyStateTitle = "No pending L1 approvals",
  emptyStateDescription =
    "You are all caught up for event and fest approvals in your department.",
  eventDetailBasePath = "/approvals/hod-dean",
}: HodApprovalTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h3 className="text-lg font-semibold text-slate-800">{emptyStateTitle}</h3>
        <p className="mt-2 text-sm text-slate-600">{emptyStateDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Event / Fest
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Total Budget
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Coordinator
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Date
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isWorking = activeRequestId === row.id;
              const completedAction = completedActions[row.id] || null;
              const isCompleted = Boolean(completedAction);
              const isFest = row.entityType === "fest";
              const detailHref = isFest
                ? `/fest/${row.eventId}`
                : `${eventDetailBasePath}/${row.eventId}`;

              return (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 align-top">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isFest ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {row.entityType}
                    </span>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{row.eventName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Dept: {row.departmentName}</p>
                    <a href={detailHref} className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline">
                      View Details →
                    </a>
                  </td>
                  <td className="px-5 py-4 align-top text-sm font-medium text-slate-800">
                    {currencyFormatter.format(row.totalBudget || 0)}
                  </td>
                  <td className="px-5 py-4 align-top text-sm text-slate-700">{row.coordinatorName}</td>
                  <td className="px-5 py-4 align-top text-sm text-slate-700">{formatDateLabel(row.eventDate)}</td>
                  <td className="px-5 py-4 align-top">
                    {isCompleted ? (
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          completedAction === "approve"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {completedAction === "approve" ? "Approved" : "Returned for Revision"}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onApprove(row.id)}
                          disabled={isWorking}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onReturn(row.id)}
                          disabled={isWorking}
                          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Return for Revision
                        </button>
                      </div>
                    )}
                    {isWorking ? <p className="mt-2 text-xs text-slate-500">Processing...</p> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
