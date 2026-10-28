import assert from "node:assert/strict";
import test from "node:test";

import { whatsappChannel } from "../inngest/channels/whatsapp";
import { assertWhatsAppRealtimeNodeAccess } from "../features/exections/components/whatsapp/realtime-authorization";

test("WhatsApp realtime subscriptions require an authenticated owner of that WhatsApp node", async () => {
  let workflowLookups = 0;
  let nodeLookups = 0;

  await assert.rejects(
    assertWhatsAppRealtimeNodeAccess(
      "node-1",
      "workflow-1",
      undefined,
      async () => { workflowLookups += 1; return null; },
      async () => { nodeLookups += 1; return null; }
    ),
    /Not authenticated/
  );

  assert.equal(workflowLookups, 0);
  assert.equal(nodeLookups, 0);
});

test("saved WhatsApp node subscriptions require the node and workflow to match the signed-in owner", async () => {
  let workflowQuery: unknown;
  let nodeQuery: unknown;
  await assertWhatsAppRealtimeNodeAccess(
    "node-1",
    "workflow-1",
    "user-1",
    async (input) => { workflowQuery = input; return { id: "workflow-1" }; },
    async (input) => { nodeQuery = input; return { type: "WHATSAPP", workflowId: "workflow-1" }; }
  );

  assert.deepEqual(workflowQuery, {
    where: { id: "workflow-1", userId: "user-1" },
    select: { id: true },
  });
  assert.deepEqual(nodeQuery, {
    where: { id: "node-1" },
    select: { type: true, workflowId: true },
  });
});

test("a new unsaved node can subscribe only within a workflow owned by the session user", async () => {
  let nodeLookupCount = 0;
  await assert.rejects(
    assertWhatsAppRealtimeNodeAccess(
      "new-node",
      "foreign-workflow",
      "user-2",
      async () => null,
      async () => { nodeLookupCount += 1; return null; }
    ),
    /WhatsApp node not found/
  );
  assert.equal(nodeLookupCount, 0, "a foreign workflow must be rejected before checking node IDs");

  await assert.doesNotReject(
    assertWhatsAppRealtimeNodeAccess(
      "new-node",
      "owned-workflow",
      "user-1",
      async () => ({ id: "owned-workflow" }),
      async () => { nodeLookupCount += 1; return null; }
    )
  );
  assert.equal(nodeLookupCount, 1, "a free node ID in an owned workflow is authorized for the first save");
});

test("foreign or non-WhatsApp node-ID collisions cannot receive a realtime token", async () => {
  const findWorkflow = async () => ({ id: "owned-workflow" });
  await assert.rejects(
    assertWhatsAppRealtimeNodeAccess(
      "foreign-node",
      "owned-workflow",
      "user-1",
      findWorkflow,
      async () => ({ type: "WHATSAPP", workflowId: "other-workflow" })
    ),
    /WhatsApp node not found/
  );
  await assert.rejects(
    assertWhatsAppRealtimeNodeAccess(
      "trigger-node",
      "owned-workflow",
      "user-1",
      findWorkflow,
      async () => ({ type: "MANUAL_TRIGGER", workflowId: "owned-workflow" })
    ),
    /WhatsApp node not found/
  );
});

test("WhatsApp realtime channel is isolated by both workflow and node", async () => {
  assert.equal(
    whatsappChannel({ workflowId: "workflow-owned", nodeId: "node-owned" }).name,
    "whatsapp-execution:workflow-owned:node-owned"
  );
  assert.notEqual(
    whatsappChannel({ workflowId: "workflow-owned", nodeId: "node-owned" }).name,
    whatsappChannel({ workflowId: "workflow-foreign", nodeId: "node-owned" }).name
  );
  assert.notEqual(
    whatsappChannel({ workflowId: "workflow-owned", nodeId: "node-owned" }).name,
    whatsappChannel({ workflowId: "workflow-owned", nodeId: "another-node" }).name
  );
});

test("invalid or oversized WhatsApp node IDs do not reach the ownership lookup", async () => {
  let workflowLookups = 0;
  let nodeLookups = 0;
  const findWorkflow = async () => { workflowLookups += 1; return null; };
  const findNode = async () => { nodeLookups += 1; return null; };

  await assert.rejects(assertWhatsAppRealtimeNodeAccess(" ", "workflow-1", "user-1", findWorkflow, findNode), /WhatsApp node not found/);
  await assert.rejects(assertWhatsAppRealtimeNodeAccess("n".repeat(121), "workflow-1", "user-1", findWorkflow, findNode), /WhatsApp node not found/);
  await assert.rejects(assertWhatsAppRealtimeNodeAccess("node-1", "w".repeat(121), "user-1", findWorkflow, findNode), /WhatsApp node not found/);
  await assert.rejects(assertWhatsAppRealtimeNodeAccess({ id: "node-1" }, "workflow-1", "user-1", findWorkflow, findNode), /WhatsApp node not found/);
  assert.equal(workflowLookups, 0);
  assert.equal(nodeLookups, 0);
});
