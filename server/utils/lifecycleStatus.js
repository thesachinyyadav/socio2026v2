export const LIFECYCLE_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING_APPROVALS: "pending_approvals",
  REVISION_REQUESTED: "revision_requested",
  APPROVED: "approved",
  PUBLISHED: "published",
});

export const LIFECYCLE_STATUS_VALUES = Object.freeze(Object.values(LIFECYCLE_STATUS));

export const normalizeLifecycleStatus = (value, fallback = LIFECYCLE_STATUS.DRAFT) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (LIFECYCLE_STATUS_VALUES.includes(normalized)) {
    return normalized;
  }

  const fallbackNormalized = String(fallback || "").trim().toLowerCase();
  return LIFECYCLE_STATUS_VALUES.includes(fallbackNormalized)
    ? fallbackNormalized
    : LIFECYCLE_STATUS.DRAFT;
};

const normalizeWorkflowStatus = (value, fallback = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || String(fallback || "").trim().toUpperCase();
};

export const deriveLifecycleStatus = ({
  currentStatus,
  approvalState,
  serviceApprovalState,
  isDraft,
}) => {
  const normalizedCurrent = normalizeLifecycleStatus(
    currentStatus,
    isDraft ? LIFECYCLE_STATUS.DRAFT : LIFECYCLE_STATUS.PUBLISHED
  );
  const normalizedApproval = normalizeWorkflowStatus(approvalState);
  const normalizedService = normalizeWorkflowStatus(serviceApprovalState);

  if (normalizedApproval === "REJECTED" || normalizedService === "REJECTED") {
    return LIFECYCLE_STATUS.REVISION_REQUESTED;
  }

  if (
    normalizedApproval === "UNDER_REVIEW" ||
    normalizedApproval === "PENDING" ||
    normalizedService === "PENDING"
  ) {
    return LIFECYCLE_STATUS.PENDING_APPROVALS;
  }

  if (
    normalizedApproval === "APPROVED" &&
    (!normalizedService || normalizedService === "APPROVED")
  ) {
    if (normalizedCurrent === LIFECYCLE_STATUS.PUBLISHED && !isDraft) {
      return LIFECYCLE_STATUS.PUBLISHED;
    }

    return LIFECYCLE_STATUS.APPROVED;
  }

  if (normalizedCurrent === LIFECYCLE_STATUS.PUBLISHED && !isDraft) {
    return LIFECYCLE_STATUS.PUBLISHED;
  }

  if (isDraft) {
    return LIFECYCLE_STATUS.DRAFT;
  }

  return normalizedCurrent;
};

export const isPublishableLifecycleStatus = (status) =>
  normalizeLifecycleStatus(status) === LIFECYCLE_STATUS.APPROVED;

export const shouldEntityRemainDraft = (status) => {
  const normalizedStatus = normalizeLifecycleStatus(status);
  return (
    normalizedStatus === LIFECYCLE_STATUS.DRAFT ||
    normalizedStatus === LIFECYCLE_STATUS.REVISION_REQUESTED
  );
};
