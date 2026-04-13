"use client";

import React from "react";

export type LifecycleStatus =
  | "draft"
  | "pending_approvals"
  | "revision_requested"
  | "approved"
  | "published";

export type PublishEntityType = "event" | "fest";

export type PublishActionMode =
  | "send_for_approval"
  | "awaiting_approvals"
  | "resubmit_for_approval"
  | "submit_logistics"
  | "publish"
  | "update";

interface ResolvePublishActionModeOptions {
  lifecycleStatus?: string | null;
  requiresApproval?: boolean;
  requiresLogisticsSubmission?: boolean;
  defaultDraftMode?: "publish" | "send_for_approval";
}

interface PublishActionButtonProps {
  mode: PublishActionMode;
  entityType: PublishEntityType;
  isSubmitting: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const VALID_LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "draft",
  "pending_approvals",
  "revision_requested",
  "approved",
  "published",
];

const normalizeLifecycleStatus = (
  value: string | null | undefined,
  fallback: LifecycleStatus = "draft"
): LifecycleStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  if (VALID_LIFECYCLE_STATUSES.includes(normalized as LifecycleStatus)) {
    return normalized as LifecycleStatus;
  }
  return fallback;
};

const toEntityLabel = (entityType: PublishEntityType) =>
  entityType === "fest" ? "Fest" : "Event";

export const getPublishActionLabel = (
  mode: PublishActionMode,
  entityType: PublishEntityType
) => {
  const entityLabel = toEntityLabel(entityType);

  if (mode === "send_for_approval") {
    return "Send for Approval";
  }

  if (mode === "awaiting_approvals") {
    return "Awaiting Approvals...";
  }

  if (mode === "resubmit_for_approval") {
    return "Resubmit for Approval";
  }

  if (mode === "submit_logistics") {
    return "Submit Logistics Requests";
  }

  if (mode === "publish") {
    return `Publish ${entityLabel}`;
  }

  return `Update ${entityLabel}`;
};

export const getPublishSubmittingLabel = (
  mode: PublishActionMode,
  entityType: PublishEntityType
) => {
  const entityLabel = toEntityLabel(entityType);

  if (mode === "send_for_approval" || mode === "resubmit_for_approval") {
    return "Sending for Approval...";
  }

  if (mode === "submit_logistics") {
    return "Submitting Logistics...";
  }

  if (mode === "publish") {
    return `Publishing ${entityLabel}...`;
  }

  if (mode === "update") {
    return `Updating ${entityLabel}...`;
  }

  return "Working...";
};

export const resolvePublishActionMode = ({
  lifecycleStatus,
  requiresApproval,
  requiresLogisticsSubmission,
  defaultDraftMode = "send_for_approval",
}: ResolvePublishActionModeOptions): PublishActionMode => {
  const normalizedStatus = normalizeLifecycleStatus(lifecycleStatus, "draft");

  if (normalizedStatus === "pending_approvals") {
    return "awaiting_approvals";
  }

  if (normalizedStatus === "revision_requested") {
    return "resubmit_for_approval";
  }

  if (normalizedStatus === "approved") {
    return "publish";
  }

  if (normalizedStatus === "published") {
    return "update";
  }

  if (requiresLogisticsSubmission) {
    return "submit_logistics";
  }

  if (requiresApproval) {
    return "send_for_approval";
  }

  return defaultDraftMode === "publish" ? "publish" : "send_for_approval";
};

export default function PublishActionButton({
  mode,
  entityType,
  isSubmitting,
  disabled,
  className,
  type = "submit",
  onClick,
}: PublishActionButtonProps) {
  const modeDisabled = mode === "awaiting_approvals";
  const isDisabled = Boolean(disabled) || modeDisabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={className}
    >
      {isSubmitting
        ? getPublishSubmittingLabel(mode, entityType)
        : getPublishActionLabel(mode, entityType)}
    </button>
  );
}
