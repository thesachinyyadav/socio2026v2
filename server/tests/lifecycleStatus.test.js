import test from "node:test";
import assert from "node:assert/strict";
import {
  LIFECYCLE_STATUS,
  shouldEntityRemainDraft,
} from "../utils/lifecycleStatus.js";

test("Lifecycle draft mapping keeps only draft/revision in draft mode", () => {
  assert.equal(shouldEntityRemainDraft(LIFECYCLE_STATUS.DRAFT), true);
  assert.equal(shouldEntityRemainDraft(LIFECYCLE_STATUS.REVISION_REQUESTED), true);
  assert.equal(shouldEntityRemainDraft(LIFECYCLE_STATUS.PENDING_APPROVALS), true);
  assert.equal(shouldEntityRemainDraft(LIFECYCLE_STATUS.APPROVED), false);
  assert.equal(shouldEntityRemainDraft(LIFECYCLE_STATUS.PUBLISHED), false);
});
