import assert from "node:assert/strict";
import test from "node:test";

import { createWorkflowFile, parseWorkflowFile } from "../features/workflows/import-format";

test("workflow export and import recursively remove WhatsApp inline access tokens", () => {
  const graph = {
    nodes: [{
      id: "whatsapp-1",
      type: "WHATSAPP",
      position: { x: 0, y: 0 },
      data: {
        accessToken: "legacy-token-root",
        hasLegacyAccessToken: true,
        nested: [{ access_token: "legacy-token-nested", message: "hello" }],
      },
    }],
    edges: [],
  };

  const content = createWorkflowFile("WhatsApp flow", graph);
  assert.equal(content.includes("legacy-token-root"), false);
  assert.equal(content.includes("legacy-token-nested"), false);

  const imported = parseWorkflowFile(content);
  const data = (imported.graph.nodes[0] as { data: Record<string, unknown> }).data;
  assert.deepEqual(data, { nested: [{ message: "hello" }] });
});
