import assert from "node:assert/strict";
import test from "node:test";

import { hashWebhookToken } from "../features/trigger/server/webhook-token";

async function setupRoute() {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/taskorbit_test";

  const [{ POST }, { default: prisma }, { inngest }] = await Promise.all([
    import("../app/api/workflows/google-form/route"),
    import("../lib/db"),
    import("../inngest/client"),
  ]);

  const token = "legacy-route-test-webhook-token-with-sufficient-entropy";
  const tokenHash = hashWebhookToken(token);
  const payload = {
    formId: "form-123",
    formTitle: "Feedback",
    responseId: "response-456",
    timestamp: "2026-10-28T12:00:00.000Z",
    respondentEmail: "person@example.com",
    responses: [{ question: "How was it?", answer: "Great" }],
  };
  const dispatches: Array<{ name: string; data: unknown }> = [];
  const credentialDelegate = prisma.workflowWebhookCredential as unknown as {
    findUnique: (args: unknown) => Promise<{ tokenHash: string } | null>;
  };
  const nodeDelegate = prisma.node as unknown as {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    findMany: (args: unknown) => Promise<{ id: string }[]>;
  };
  const originalCredentialLookup = credentialDelegate.findUnique;
  const originalTriggerLookup = nodeDelegate.findFirst;
  const originalTriggersLookup = nodeDelegate.findMany;
  const originalSend = inngest.send;

  credentialDelegate.findUnique = async () => ({ tokenHash });
  nodeDelegate.findFirst = async () => ({ id: "google-form-trigger" });
  nodeDelegate.findMany = async () => [{ id: "google-form-trigger" }];
  inngest.send = async (event) => {
    dispatches.push(event as { name: string; data: unknown });
    return { ids: ["test-event"] };
  };

  const request = (bearer?: string) => {
    const headers = new Headers({ "content-type": "application/json" });
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);
    return new Request("https://taskorbit.test/api/workflows/google-form?workflowId=workflow-1", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  };

  return {
    POST,
    token,
    payload,
    dispatches,
    request,
    restore() {
      credentialDelegate.findUnique = originalCredentialLookup;
      nodeDelegate.findFirst = originalTriggerLookup;
      nodeDelegate.findMany = originalTriggersLookup;
      inngest.send = originalSend;
    },
  };
}

test("legacy Google Forms path rejects unauthenticated requests", async () => {
  const route = await setupRoute();
  try {
    const response = await route.POST(route.request() as Parameters<typeof route.POST>[0]);
    assert.equal(response.status, 401, "requests without a token must be rejected");
    assert.equal(route.dispatches.length, 0, "unauthenticated requests must not enqueue work");
  } finally {
    route.restore();
  }
});

test("legacy Google Forms path preserves canonical payload and does not echo it", async () => {
  const route = await setupRoute();
  try {
    const response = await route.POST(route.request(route.token) as Parameters<typeof route.POST>[0]);
    assert.equal(response.status, 200);
    assert.deepEqual(route.dispatches.map(({ data }) => data), [{
      workflowId: "workflow-1",
      triggerNodeId: "google-form-trigger",
      initialData: {
        googleForm: {
          ...route.payload,
          raw: route.payload,
        },
      },
    }]);
    assert.deepEqual(await response.json(), { success: true }, "the response must not echo form data");
  } finally {
    route.restore();
  }
});
