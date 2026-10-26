import assert from "node:assert/strict";
import test from "node:test";

import {
  serializeWorkflowTemplate,
  workflowTemplates,
} from "../features/workflows/demo-templates";

test("the public workspace has three valid, connected demo workflows", () => {
  assert.deepEqual(
    workflowTemplates.map((template) => template.name),
    [
      "Lead intake and follow-up",
      "Payment receipt alert",
      "Project activity digest",
    ],
  );

  for (const template of workflowTemplates) {
    const nodeIds = new Set(template.graph.nodes.map((node) => node.id));
    assert.ok(template.graph.nodes.length > 1);
    assert.ok(template.graph.edges.length > 0);
    assert.ok(
      template.graph.edges.every(
        (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
      ),
      `${template.name} contains an edge with a missing node`,
    );
  }
});

test("downloaded templates use TaskOrbit's import format without demo metadata", () => {
  const template = workflowTemplates[0];
  const exported = JSON.parse(serializeWorkflowTemplate(template));

  assert.deepEqual(exported, {
    format: template.format,
    version: template.version,
    name: template.name,
    graph: template.graph,
  });
  assert.equal("description" in exported, false);
  assert.equal("integrations" in exported, false);
});
