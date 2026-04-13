"use client";

import React, { useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export type ApprovalRowStatus = "approved" | "pending" | "rejected";

export interface ApprovalStatusRow {
  id: string;
  roleLabel: string;
  status: ApprovalRowStatus;
  summary: string;
  details: string;
  timestampLabel?: string;
}

interface ApprovalStatusPopoverProps {
  rows: ApprovalStatusRow[];
  submittedLabel?: string;
  loading?: boolean;
  buttonLabel?: string;
}

const getStatusTextClass = (status: ApprovalRowStatus) => {
  if (status === "approved") return "text-emerald-300";
  if (status === "rejected") return "text-rose-300";
  return "text-amber-300";
};

const getStatusText = (status: ApprovalRowStatus) => {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
};

const StatusIcon = ({ status }: { status: ApprovalRowStatus }) => {
  if (status === "approved") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
  }

  if (status === "rejected") {
    return <XCircle className="h-4 w-4 text-rose-400" aria-hidden="true" />;
  }

  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />;
};

export default function ApprovalStatusPopover({
  rows,
  submittedLabel,
  loading = false,
  buttonLabel = "Approval",
}: ApprovalStatusPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPopover = () => {
    clearCloseTimer();
    setIsOpen(true);
  };

  const closePopover = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setExpandedRowId(null);
    }, 120);
  };

  const toggleDetails = (rowId: string) => {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId));
  };

  return (
    <div
      className="relative"
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
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-[#154cb3] font-semibold text-sm hover:underline"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-40 mb-3 w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700/80 bg-[#060B17] shadow-2xl">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-semibold text-white">Approval Timeline</p>
            <p className="mt-1 text-xs text-slate-300">
              {submittedLabel ? `Sent ${submittedLabel}` : "Sent time not available"}
            </p>
          </div>

          {loading ? (
            <div className="px-4 py-4 text-xs text-slate-300">Loading approval details...</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">No approval updates available yet.</div>
          ) : (
            <div>
              {rows.map((row, index) => {
                const isExpanded = expandedRowId === row.id;
                return (
                  <div key={row.id} className={index !== rows.length - 1 ? "border-b border-slate-800" : ""}>
                    <div className="grid grid-cols-[16px_minmax(96px,1fr)_auto_auto] items-center gap-3 px-4 py-3">
                      <StatusIcon status={row.status} />
                      <span className="text-sm font-medium text-slate-100">{row.roleLabel}</span>
                      <span className={`text-xs font-semibold ${getStatusTextClass(row.status)}`}>
                        {getStatusText(row.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleDetails(row.id)}
                        className="text-xs font-medium text-sky-300 transition-colors hover:text-sky-200"
                      >
                        Details
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-3 text-xs leading-relaxed text-slate-300">
                        <p className="font-semibold text-slate-200">
                          {row.timestampLabel || "Last update time unavailable"}
                        </p>
                        <p className="mt-1">{row.details || row.summary}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
