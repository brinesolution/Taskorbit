import assert from "node:assert/strict";
import test from "node:test";

import { createWorkflowFile, parseWorkflowFile } from "../features/workflows/import-format";
import {
  MAX_WORKFLOW_BACKUP_REQUEST_BYTES,
  readWorkflowBackupRequestJson,
  WorkflowBackupRequestTooLargeError,
} from "../lib/neon/workflow-backup-request";
import { sanitizeWorkflowBackupValue } from "../lib/neon/workflow-backup-sanitizer";

test("saved and restored workflow backups omit nested WhatsApp bearer credentials", () => {
  const bearerToken = "whatsapp-secret-bearer-token";
  const graph = sanitizeWorkflowBackupValue({
    nodes: [
      {
        id: "whatsapp-1",
        type: "WHATSAPP",
        position: { x: 0, y: 0 },
        data: {
          accessToken: bearerToken,
          config: {
            api_key: "nested-api-key",
            message: "hello",
          },
        },
      },
    ],
    edges: [],
  });
  const content = createWorkflowFile("WhatsApp flow", graph);

  assert.equal(content.includes(bearerToken), false);
  const restored = sanitizeWorkflowBackupValue(parseWorkflowFile(content));
  assert.equal(JSON.stringify(restored).includes(bearerToken), false);
  assert.deepEqual(
    (restored as { graph: { nodes: Array<{ data: Record<string, unknown> }> } })
      .graph.nodes[0].data,
    { config: { message: "hello" } }
  );
});

test("declared oversize backup bodies are rejected before reading", async () => {
  let pulled = false;
  const request = {
    headers: new Headers({
      "content-length": String(MAX_WORKFLOW_BACKUP_REQUEST_BYTES + 1),
    }),
    body: {
      getReader() {
        pulled = true;
        throw new Error("body should not be read");
      },
    },
  } as unknown as Request;

  await assert.rejects(
    readWorkflowBackupRequestJson(request),
    WorkflowBackupRequestTooLargeError
  );
  assert.equal(pulled, false);
});

test("actual streamed bytes are capped when Content-Length is missing or invalid", async () => {
  for (const contentLength of [undefined, "not-a-number"]) {
    const body = new Uint8Array(MAX_WORKFLOW_BACKUP_REQUEST_BYTES + 1);
    const headers = new Headers();
    if (contentLength) headers.set("content-length", contentLength);
    const request = new Request("https://example.test/api/workflow-backups", {
      method: "POST",
      headers,
      body,
    });

    await assert.rejects(
      readWorkflowBackupRequestJson(request),
      WorkflowBackupRequestTooLargeError
    );
  }
});
