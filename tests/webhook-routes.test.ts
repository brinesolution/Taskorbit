import assert from "node:assert/strict";
import test from "node:test";

import { hashWebhookToken } from "../features/trigger/server/webhook-token";

// Set the adapter configuration before importing the route dependencies. Tests
// replace Prisma and Inngest calls at their client boundary, so no network call
// is made and no database or Inngest credentials are needed.
test("webhook route authentication", async (t) => {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/taskorbit_test";

  const [{ POST: postGoogleForm }, { POST: postStripe }, { default: prisma }, { inngest }] =
    await Promise.all([
      import("../app/api/webhooks/google-form/route"),
      import("../app/api/webhooks/stripe/route"),
      import("../lib/db"),
      import("../inngest/client"),
    ]);

  const token = "route-test-webhook-token-with-sufficient-entropy";
const tokenHash = hashWebhookToken(token);
const requestBody = { id: "evt_test", type: "payment_intent.succeeded", data: { object: { amount: 500, currency: "usd" } } };

type Provider = "STRIPE" | "GOOGLE_FORM";
type Fixture = {
  credentialExists: boolean;
  triggerExists: boolean;
  triggerIds?: string[];
  dispatches: Array<{ name: string; data: unknown }>;
};

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

function installFixture(fixture: Fixture) {
  credentialDelegate.findUnique = async () =>
    fixture.credentialExists ? { tokenHash } : null;
  const triggerNodes = fixture.triggerIds?.map((id) => ({ id })) ??
    (fixture.triggerExists ? [{ id: "trigger-node" }] : []);
  nodeDelegate.findFirst = async () => triggerNodes[0] ?? null;
  nodeDelegate.findMany = async () => triggerNodes;
  inngest.send = async (event) => {
    fixture.dispatches.push(event as { name: string; data: unknown });
    return { ids: ["test-event"] };
  };
}

function restoreClients() {
  credentialDelegate.findUnique = originalCredentialLookup;
  nodeDelegate.findFirst = originalTriggerLookup;
  nodeDelegate.findMany = originalTriggersLookup;
  inngest.send = originalSend;
}

async function post(provider: Provider, options: {
  workflowId?: string;
  bearer?: string;
  stripeToken?: string;
} = {}) {
  const endpoint = provider === "GOOGLE_FORM"
    ? "https://taskorbit.test/api/webhooks/google-form"
    : "https://taskorbit.test/api/webhooks/stripe";
  const url = new URL(endpoint);
  if (options.workflowId !== undefined) url.searchParams.set("workflowId", options.workflowId);
  if (provider === "STRIPE" && options.stripeToken !== undefined) {
    url.searchParams.set("token", options.stripeToken);
  }
  const headers = new Headers({ "content-type": "application/json" });
  if (provider === "GOOGLE_FORM" && options.bearer !== undefined) {
    headers.set("authorization", `Bearer ${options.bearer}`);
  }
  const request = new Request(url, { method: "POST", headers, body: JSON.stringify(requestBody) });
  const handler = provider === "GOOGLE_FORM" ? postGoogleForm : postStripe;
  return handler(request as Parameters<typeof handler>[0]);
}

  await t.test("Google Forms webhook accepts its Bearer token and dispatches once", async () => {
  const fixture: Fixture = { credentialExists: true, triggerExists: true, dispatches: [] };
  installFixture(fixture);
  try {
    const response = await post("GOOGLE_FORM", { workflowId: "workflow-1", bearer: token });
    assert.equal(response.status, 200);
    assert.equal(fixture.dispatches.length, 1);
    assert.deepEqual(fixture.dispatches[0]?.data, {
      workflowId: "workflow-1",
      triggerNodeId: "trigger-node",
      initialData: { googleForm: {
        formId: undefined,
        formTitle: undefined,
        responseId: undefined,
        timestamp: undefined,
        respondentEmail: undefined,
        responses: undefined,
        raw: requestBody,
      } },
    });
  } finally {
    restoreClients();
  }
});

for (const [label, bearer] of [["missing", undefined], ["wrong", "incorrect-token"]] as const) {
  await t.test(`Google Forms webhook rejects a ${label} Bearer token without dispatching`, async () => {
    const fixture: Fixture = { credentialExists: true, triggerExists: true, dispatches: [] };
    installFixture(fixture);
    try {
      const response = await post("GOOGLE_FORM", { workflowId: "workflow-1", bearer });
      assert.equal(response.status, 401);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

for (const provider of ["GOOGLE_FORM", "STRIPE"] as const) {
  await t.test(`${provider} webhook keeps returning 401 for an unauthenticated duplicate-trigger request`, async () => {
    const fixture: Fixture = {
      credentialExists: true,
      triggerExists: true,
      triggerIds: ["trigger-one", "trigger-two"],
      dispatches: [],
    };
    installFixture(fixture);
    try {
      const response = await post(provider, { workflowId: "workflow-1" });
      assert.equal(response.status, 401);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

for (const provider of ["GOOGLE_FORM", "STRIPE"] as const) {
  await t.test(`${provider} webhook rejects duplicate triggers after authentication without enqueueing`, async () => {
    const fixture: Fixture = {
      credentialExists: true,
      triggerExists: true,
      triggerIds: ["trigger-one", "trigger-two"],
      dispatches: [],
    };
    installFixture(fixture);
    try {
      const response = await post(provider, {
        workflowId: "workflow-1",
        bearer: token,
        stripeToken: token,
      });
      assert.equal(response.status, 409);
      const body = await response.json();
      assert.match(body.error, /multiple.*trigger/i);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

for (const [label, overrides] of [
  ["missing credential", { credentialExists: false, triggerExists: true }],
  ["missing trigger", { credentialExists: true, triggerExists: false }],
] as const) {
  await t.test(`Google Forms webhook rejects a ${label} without dispatching`, async () => {
    const fixture: Fixture = { ...overrides, dispatches: [] };
    installFixture(fixture);
    try {
      const response = await post("GOOGLE_FORM", { workflowId: "workflow-1", bearer: token });
      assert.equal(response.status, 401);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

  await t.test("Stripe webhook accepts its endpoint token and dispatches once", async () => {
  const fixture: Fixture = { credentialExists: true, triggerExists: true, dispatches: [] };
  installFixture(fixture);
  try {
    const response = await post("STRIPE", { workflowId: "workflow-1", stripeToken: token });
    assert.equal(response.status, 200);
    assert.equal(fixture.dispatches.length, 1);
    assert.deepEqual(fixture.dispatches[0]?.data, {
      workflowId: "workflow-1",
      triggerNodeId: "trigger-node",
      initialData: { stripe: {
        eventId: requestBody.id,
        eventType: requestBody.type,
        timestamp: undefined,
        livemode: undefined,
        raw: requestBody.data.object,
        amount: requestBody.data.object.amount,
        currency: requestBody.data.object.currency,
        customerId: undefined,
      } },
    });
  } finally {
    restoreClients();
  }
});

for (const [label, stripeToken] of [["missing", undefined], ["wrong", "incorrect-token"]] as const) {
  await t.test(`Stripe webhook rejects a ${label} endpoint token without dispatching`, async () => {
    const fixture: Fixture = { credentialExists: true, triggerExists: true, dispatches: [] };
    installFixture(fixture);
    try {
      const response = await post("STRIPE", { workflowId: "workflow-1", stripeToken });
      assert.equal(response.status, 401);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

for (const [label, overrides] of [
  ["missing credential", { credentialExists: false, triggerExists: true }],
  ["missing trigger", { credentialExists: true, triggerExists: false }],
] as const) {
  await t.test(`Stripe webhook rejects a ${label} without dispatching`, async () => {
    const fixture: Fixture = { ...overrides, dispatches: [] };
    installFixture(fixture);
    try {
      const response = await post("STRIPE", { workflowId: "workflow-1", stripeToken: token });
      assert.equal(response.status, 401);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

for (const provider of ["GOOGLE_FORM", "STRIPE"] as const) {
  await t.test(`${provider} webhook rejects a missing workflow ID without dispatching`, async () => {
    const fixture: Fixture = { credentialExists: true, triggerExists: true, dispatches: [] };
    installFixture(fixture);
    try {
      const response = await post(provider, { bearer: token, stripeToken: token });
      assert.equal(response.status, 400);
      assert.equal(fixture.dispatches.length, 0);
    } finally {
      restoreClients();
    }
  });
}

});
