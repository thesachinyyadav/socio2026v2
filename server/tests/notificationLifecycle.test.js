import test from "node:test";
import assert from "node:assert/strict";
import { LIFECYCLE_STATUS } from "../utils/lifecycleStatus.js";
import {
  isRecordLiveForNotifications,
  parseBooleanLike,
  shouldSendLifecycleNotification,
} from "../utils/notificationLifecycle.js";

test("Create as draft -> no notification", () => {
  const shouldSend = shouldSendLifecycleNotification({
    record: {
      is_draft: true,
      activation_state: "ACTIVE",
      status: LIFECYCLE_STATUS.DRAFT,
    },
    sendNotificationsInput: true,
  });

  assert.equal(shouldSend, false);
});

test("Submit for approval (pending) -> no notification", () => {
  const shouldSend = shouldSendLifecycleNotification({
    record: {
      is_draft: false,
      activation_state: "PENDING",
      status: LIFECYCLE_STATUS.PENDING_APPROVALS,
    },
    sendNotificationsInput: true,
  });

  assert.equal(shouldSend, false);
});

test("Publish after approvals complete -> notification sent", () => {
  const shouldSend = shouldSendLifecycleNotification({
    record: {
      is_draft: false,
      activation_state: "ACTIVE",
      status: LIFECYCLE_STATUS.PUBLISHED,
    },
    sendNotificationsInput: true,
  });

  assert.equal(shouldSend, true);
});

test("Public visibility blocks draft event", () => {
  const isVisible = isRecordLiveForNotifications({
    is_draft: true,
    activation_state: "ACTIVE",
    status: LIFECYCLE_STATUS.DRAFT,
  });

  assert.equal(isVisible, false);
});

test("Public visibility blocks pending approval event", () => {
  const isVisible = isRecordLiveForNotifications({
    is_draft: false,
    activation_state: "PENDING",
    status: LIFECYCLE_STATUS.PENDING_APPROVALS,
  });

  assert.equal(isVisible, false);
});

test("Public visibility allows approved event", () => {
  const isVisible = isRecordLiveForNotifications({
    is_draft: false,
    activation_state: "ACTIVE",
    status: LIFECYCLE_STATUS.APPROVED,
  });

  assert.equal(isVisible, true);
});

test("Publish notification preference accepts mixed-case truthy strings", () => {
  assert.equal(parseBooleanLike("TRUE"), true);
  assert.equal(parseBooleanLike("Yes"), true);
  assert.equal(parseBooleanLike("on"), true);
  assert.equal(parseBooleanLike("false"), false);
});
