import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowBackupId,
  isWorkflowBackupId,
  workflowBackupIdFromKey,
  workflowBackupKey,
  workflowBackupPrefix,
} from "../lib/neon/workflow-backup-keys";

const testUuid = "123e4567-e89b-42d3-a456-426614174000";

test("workflow backup keys are scoped to an encoded user ID", () => {
  const id = createWorkflowBackupId("My / Workflows", testUuid);
  const prefix = workflowBackupPrefix("user/with/slashes");

  assert.equal(id, testUuid + "_my-workflows");
  assert.equal(prefix, "workflow-backups/dXNlci93aXRoL3NsYXNoZXM/");
  assert.equal(
    workflowBackupKey("user/with/slashes", id),
    prefix + id + ".json"
  );
});

test("backup IDs reject path traversal and keys from another user", () => {
  const id = createWorkflowBackupId("Workflow", testUuid);
  const key = workflowBackupKey("first-user", id);

  assert.equal(isWorkflowBackupId("../workflow.json"), false);
  assert.equal(workflowBackupIdFromKey("first-user", key), id);
  assert.equal(workflowBackupIdFromKey("second-user", key), null);
});

test("workflow backup IDs handle names without ASCII letters", () => {
  const id = createWorkflowBackupId("東京", testUuid);

  assert.equal(id, testUuid + "_workflow");
  assert.equal(isWorkflowBackupId(id), true);
});
