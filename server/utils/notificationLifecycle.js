import {
  LIFECYCLE_STATUS,
  normalizeLifecycleStatus,
} from "./lifecycleStatus.js";

const LIVE_LIFECYCLE_STATUSES = new Set([
  LIFECYCLE_STATUS.PUBLISHED,
  LIFECYCLE_STATUS.APPROVED,
]);

const normalizeWorkflowStatus = (value, fallback = "ACTIVE") => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || String(fallback || "").trim().toUpperCase();
};

export const parseBooleanLike = (value) => {
  if (value === true || value === 1 || value === "1") {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "yes" ||
      normalized === "on"
    );
  }

  return false;
};

export const isRecordLiveForNotifications = (record) => {
  if (!record) {
    return false;
  }

  const isDraft = parseBooleanLike(record?.is_draft);
  const lifecycleStatus = normalizeLifecycleStatus(
    record?.status,
    isDraft ? LIFECYCLE_STATUS.DRAFT : LIFECYCLE_STATUS.PUBLISHED
  );

  if (!LIVE_LIFECYCLE_STATUSES.has(lifecycleStatus)) {
    return false;
  }

  const activationState = normalizeWorkflowStatus(record?.activation_state, "ACTIVE");
  if (activationState !== "ACTIVE") {
    return false;
  }

  return true;
};

export const shouldSendLifecycleNotification = ({
  record,
  sendNotificationsInput,
  defaultSendNotifications = true,
}) => {
  const hasExplicitNotificationPreference =
    sendNotificationsInput !== undefined &&
    sendNotificationsInput !== null &&
    String(sendNotificationsInput).trim() !== "";

  const notificationsEnabled = hasExplicitNotificationPreference
    ? parseBooleanLike(sendNotificationsInput)
    : Boolean(defaultSendNotifications);

  if (!notificationsEnabled) {
    return false;
  }

  return isRecordLiveForNotifications(record);
};
