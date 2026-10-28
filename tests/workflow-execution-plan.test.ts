import assert from "node:assert/strict";
import test from "node:test";

import { planWorkflowExecution, requireUniqueTrigger } from "../inngest/utils";

type GraphNode = { id: string; type: string; data: unknown };
type GraphConnection = { fromNodeId: string; toNodeId: string };

const node = (id: string, type: string): GraphNode => ({ id, type, data: {} });
const edge = (fromNodeId: string, toNodeId: string): GraphConnection => ({
  fromNodeId,
  toNodeId,
});

const mergedTriggerGraph = () => ({
  nodes: [
    node("manual", "MANUAL_TRIGGER"),
    node("form", "GOOGLE_FORM_TRIGGER"),
    node("stripe", "STRIPE_TRIGGER"),
    node("gemini", "GEMINI"),
    node("telegram", "TELEGRAM"),
    node("discord", "DISCORD"),
  ],
  connections: [
    edge("manual", "gemini"),
    edge("form", "gemini"),
    edge("gemini", "telegram"),
    edge("stripe", "discord"),
  ],
});

test("manual and Google Forms events execute their own trigger branch and shared descendants", () => {
  const graph = mergedTriggerGraph();

  const manual = planWorkflowExecution(graph.nodes, graph.connections, {
    triggerNodeId: "manual",
  });
  const form = planWorkflowExecution(graph.nodes, graph.connections, {
    triggerNodeId: "form",
    initialData: { googleForm: { responseId: "response-1" } },
  });

  assert.deepEqual(manual.nodes.map(({ id }) => id), ["manual", "gemini", "telegram"]);
  assert.deepEqual(form.nodes.map(({ id }) => id), ["form", "gemini", "telegram"]);
});

test("Stripe events execute only the Stripe path", () => {
  const graph = mergedTriggerGraph();

  const plan = planWorkflowExecution(graph.nodes, graph.connections, {
    triggerNodeId: "stripe",
    initialData: { stripe: { eventId: "evt_1" } },
  });

  assert.deepEqual(plan.nodes.map(({ id }) => id), ["stripe", "discord"]);
});

test("legacy queued events infer a unique provider trigger from their payload", () => {
  const graph = mergedTriggerGraph();

  const legacyForm = planWorkflowExecution(graph.nodes, graph.connections, {
    initialData: { googleForm: { responseId: "old-response" } },
  });
  const legacyStripe = planWorkflowExecution(graph.nodes, graph.connections, {
    initialData: { stripe: { eventId: "evt_old" } },
  });
  const legacyManual = planWorkflowExecution(graph.nodes, graph.connections, {});

  assert.equal(legacyForm.triggerNode.id, "form");
  assert.deepEqual(legacyForm.initialData, { googleForm: { responseId: "old-response" } });
  assert.equal(legacyStripe.triggerNode.id, "stripe");
  assert.equal(legacyManual.triggerNode.id, "manual");
});

test("legacy Google Forms events with the old input envelope still select Google Forms", () => {
  const graph = mergedTriggerGraph();

  const plan = planWorkflowExecution(graph.nodes, graph.connections, {
    initialData: {},
    input: { formId: "form-1", responseId: "old-response" },
  });

  assert.equal(plan.triggerNode.id, "form");
  assert.deepEqual(plan.initialData, {
    googleForm: {
      formId: "form-1",
      responseId: "old-response",
      raw: { formId: "form-1", responseId: "old-response" },
    },
  });
});

test("legacy Google Forms input preserves empty, custom, and non-object JSON bodies", () => {
  const graph = mergedTriggerGraph();
  const payloads: unknown[] = [
    {},
    { prompt: "custom question", answer: "custom answer" },
    null,
    ["answer", 42],
    "plain response",
    17,
    false,
  ];

  for (const input of payloads) {
    const plan = planWorkflowExecution(graph.nodes, graph.connections, { input });
    assert.equal(plan.triggerNode.id, "form", `expected Google Forms source for ${JSON.stringify(input)}`);
    assert.deepEqual(plan.initialData, {
      googleForm: {
        ...(input && typeof input === "object" && !Array.isArray(input)
          ? input as Record<string, unknown>
          : {}),
        raw: input,
      },
    });
  }
});

test("legacy Google Forms payload shape cannot be used to select a manual trigger", () => {
  const graph = mergedTriggerGraph();

  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, {
      triggerNodeId: "manual",
      input: null,
    }),
    /does not match.*Google Forms/i,
  );
});

test("orphan actions fail clearly, including action-only zero-edge workflows", () => {
  assert.throws(
    () => planWorkflowExecution(
      [node("manual", "MANUAL_TRIGGER"), node("orphan", "GEMINI")],
      [],
      { triggerNodeId: "manual" },
    ),
    /not reachable from any trigger.*orphan/i,
  );

  assert.throws(
    () => planWorkflowExecution([node("orphan", "GEMINI")], [], {}),
    /trigger/i,
  );
});

test("unknown trigger IDs and non-trigger IDs are rejected", () => {
  const graph = mergedTriggerGraph();

  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, { triggerNodeId: "missing" }),
    /trigger.*not found/i,
  );
  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, { triggerNodeId: "gemini" }),
    /must identify a trigger/i,
  );
});

test("ambiguous legacy trigger sources fail instead of running multiple branches", () => {
  const graph = {
    nodes: [
      node("form-1", "GOOGLE_FORM_TRIGGER"),
      node("form-2", "GOOGLE_FORM_TRIGGER"),
      node("action", "GEMINI"),
    ],
    connections: [edge("form-1", "action"), edge("form-2", "action")],
  };

  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, {
      initialData: { googleForm: {} },
    }),
    /ambiguous.*GOOGLE_FORM_TRIGGER/i,
  );
});

test("dangling connections and cycles are rejected with actionable errors", () => {
  const trigger = node("manual", "MANUAL_TRIGGER");
  const action = node("action", "GEMINI");
  const cycle = node("cycle", "DISCORD");

  assert.throws(
    () => planWorkflowExecution([trigger, action], [edge("manual", "missing")], {
      triggerNodeId: "manual",
    }),
    /connection.*missing node/i,
  );
  assert.throws(
    () => planWorkflowExecution(
      [trigger, action, cycle],
      [edge("manual", "action"), edge("action", "cycle"), edge("cycle", "action")],
      { triggerNodeId: "manual" },
    ),
    /cycle/i,
  );
});

test("explicit trigger IDs must agree with provider payloads", () => {
  const graph = mergedTriggerGraph();

  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, {
      triggerNodeId: "manual",
      initialData: { googleForm: { responseId: "response-1" } },
    }),
    /does not match.*Google Forms/i,
  );
  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, {
      triggerNodeId: "form",
    }),
    /Google Forms.*requires.*event data/i,
  );
  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, {
      triggerNodeId: "stripe",
    }),
    /Stripe.*requires.*event data/i,
  );
});

test("the legacy INITIAL placeholder may lead into a trigger branch", () => {
  const graph = {
    nodes: [
      node("initial", "INITIAL"),
      node("manual", "MANUAL_TRIGGER"),
      node("action", "GEMINI"),
    ],
    connections: [edge("initial", "manual"), edge("manual", "action")],
  };

  const plan = planWorkflowExecution(graph.nodes, graph.connections, {
    triggerNodeId: "manual",
  });

  assert.deepEqual(plan.nodes.map(({ id }) => id), ["manual", "action"]);
});

test("real action or trigger nodes cannot feed into a trigger", () => {
  const graph = {
    nodes: [
      node("manual", "MANUAL_TRIGGER"),
      node("form", "GOOGLE_FORM_TRIGGER"),
      node("action", "GEMINI"),
    ],
    connections: [edge("manual", "action"), edge("action", "form")],
  };

  assert.throws(
    () => planWorkflowExecution(graph.nodes, graph.connections, {
      triggerNodeId: "manual",
    }),
    /Trigger node form has an incoming connection.*must start/i,
  );
});

test("duplicate manual triggers fail with a clear remediation message", () => {
  assert.throws(
    () => requireUniqueTrigger([{ id: "manual-one" }, { id: "manual-two" }], "Manual"),
    /multiple Manual trigger nodes.*keep only one/i,
  );
});
