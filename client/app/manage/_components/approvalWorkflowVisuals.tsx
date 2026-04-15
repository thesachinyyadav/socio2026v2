"use client";

import { AlertTriangle, CheckCircle2, Clock3, Lock } from "lucide-react";

export type ApprovalVisualStatus = "approved" | "pending" | "blocked" | "rejected";

type StatusVisualConfig = {
  label: string;
  iconClassName: string;
  badgeClassName: string;
  nodeClassName: string;
  helperTextClassName: string;
};

const STATUS_CONFIG: Record<ApprovalVisualStatus, StatusVisualConfig> = {
  approved: {
    label: "Approved",
    iconClassName: "text-emerald-600",
    badgeClassName: "border border-emerald-300/80 bg-emerald-50 text-emerald-700",
    nodeClassName: "border border-emerald-300/80 bg-emerald-50/95 shadow-emerald-200/40",
    helperTextClassName: "text-emerald-700/80",
  },
  pending: {
    label: "Pending",
    iconClassName: "text-amber-600",
    badgeClassName: "border border-amber-300/80 bg-amber-50 text-amber-700",
    nodeClassName: "border border-amber-300/80 bg-amber-50/95 shadow-amber-200/40",
    helperTextClassName: "text-amber-700/80",
  },
  blocked: {
    label: "Blocked",
    iconClassName: "text-slate-500",
    badgeClassName: "border border-slate-300 bg-slate-100 text-slate-600",
    nodeClassName: "border border-slate-300 bg-slate-100/95 shadow-slate-300/30 opacity-85",
    helperTextClassName: "text-slate-500",
  },
  rejected: {
    label: "Revision Required",
    iconClassName: "text-rose-600",
    badgeClassName: "border border-rose-300/80 bg-rose-50 text-rose-700",
    nodeClassName: "border border-rose-300/80 bg-rose-50/95 shadow-rose-200/40",
    helperTextClassName: "text-rose-700/85",
  },
};

function joinClasses(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function getStatusVisualConfig(status: ApprovalVisualStatus): StatusVisualConfig {
  return STATUS_CONFIG[status];
}

export function getStatusLabel(status: ApprovalVisualStatus): string {
  return STATUS_CONFIG[status].label;
}

export function ApprovalStatusIcon({
  status,
  className,
  animatePending = false,
}: {
  status: ApprovalVisualStatus;
  className?: string;
  animatePending?: boolean;
}) {
  const config = STATUS_CONFIG[status];

  if (status === "approved") {
    return <CheckCircle2 className={joinClasses("h-4 w-4", config.iconClassName, className)} aria-hidden="true" />;
  }

  if (status === "pending") {
    return (
      <Clock3
        className={joinClasses(
          "h-4 w-4",
          animatePending ? "animate-pulse" : "",
          config.iconClassName,
          className
        )}
        aria-hidden="true"
      />
    );
  }

  if (status === "rejected") {
    return <AlertTriangle className={joinClasses("h-4 w-4", config.iconClassName, className)} aria-hidden="true" />;
  }

  return <Lock className={joinClasses("h-4 w-4", config.iconClassName, className)} aria-hidden="true" />;
}

export function ApprovalStatusBadge({
  status,
  className,
}: {
  status: ApprovalVisualStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={joinClasses(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        config.badgeClassName,
        className
      )}
    >
      <ApprovalStatusIcon status={status} className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
