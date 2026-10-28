import assert from "node:assert/strict";
import test from "node:test";

const encryptionKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64");
process.env.CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/taskorbit";

test("WhatsApp executor resolves an owner-scoped encrypted credential, sends a rendered message and publishes status", async () => {
  const [{ whatsappExecutor }, prismaModule, encryptionModule] = await Promise.all([
    import("../features/exections/components/whatsapp/executor"),
    import("../lib/db"),
    import("../features/credentials/server/encryption"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
    node: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  const originalFindCredential = prisma.credential.findFirst;
  const originalFindNode = prisma.node.findFirst;
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  const token = "fake-meta-access-token-for-unit-test";
  let credentialQuery: unknown;
  let request: { url: string; init?: RequestInit } | undefined;
  const logs: unknown[][] = [];
  const published: unknown[] = [];

  prisma.credential.findFirst = async (args) => {
    credentialQuery = args;
    return { value: encryptionModule.encryptCredentialValue(token) };
  };
  prisma.node.findFirst = async () => {
    throw new Error("Legacy node lookup should not be used for a saved credential");
  };
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response(JSON.stringify({ messages: [{ id: "test-message-id" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  console.log = (...args) => { logs.push(args); };
  process.env.WHATSAPP_GRAPH_API_VERSION = "v26.0";

  try {
    const result = await whatsappExecutor({
      data: {
        credentialId: "credential-1",
        phoneNumberId: "1234567890",
        to: "919999999999",
        message: "Hello {{name}} & {{tag}}",
        variableName: "sent",
      },
      nodeId: "node-1",
      workflowId: "workflow-1",
      workflowOwnerId: "owner-1",
      context: { name: "Tom & Jerry", tag: "<guest>" },
      step: {} as never,
      publish: (async (message: unknown) => { published.push(message); }) as never,
    });

    assert.deepEqual(credentialQuery, {
      where: { id: "credential-1", userId: "owner-1", type: "WHATSAPP" },
      select: { value: true },
    });
    assert.equal(request?.url, "https://graph.facebook.com/v26.0/1234567890/messages");
    assert.equal(request?.init?.method, "POST");
    assert.equal(new Headers(request?.init?.headers).get("authorization"), `Bearer ${token}`);
    assert.deepEqual(JSON.parse(String(request?.init?.body)), {
      messaging_product: "whatsapp",
      to: "919999999999",
      type: "text",
      text: { body: "Hello Tom & Jerry & <guest>" },
    });
    assert.deepEqual(result.sent, {
      sent: true,
      to: "919999999999",
      message: "Hello Tom & Jerry & <guest>",
      result: { messages: [{ id: "test-message-id" }] },
    });
    assert.equal(published.length, 2, "publishes both loading and terminal status updates");
    assert.equal(
      (await published[0] as { channel: string }).channel,
      "whatsapp-execution:workflow-1:node-1",
      "execution status is sent on the same workflow-and-node-specific channel as the UI subscription"
    );
    assert.equal(JSON.stringify(logs).includes(token), false);
    assert.equal(JSON.stringify(logs).includes("Hello Tom"), false);
    assert.equal(JSON.stringify(logs).includes("919999999999"), false);
  } finally {
    prisma.credential.findFirst = originalFindCredential;
    prisma.node.findFirst = originalFindNode;
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    if (originalVersion === undefined) delete process.env.WHATSAPP_GRAPH_API_VERSION;
    else process.env.WHATSAPP_GRAPH_API_VERSION = originalVersion;
  }
});

test("WhatsApp executor reads legacy inline tokens from the owner-scoped node only", async () => {
  const [{ whatsappExecutor }, prismaModule] = await Promise.all([
    import("../features/exections/components/whatsapp/executor"),
    import("../lib/db"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
    node: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  const originalFindCredential = prisma.credential.findFirst;
  const originalFindNode = prisma.node.findFirst;
  const originalFetch = globalThis.fetch;
  const legacyToken = "legacy-test-token";
  let nodeQuery: unknown;
  let request: { init?: RequestInit } | undefined;
  prisma.credential.findFirst = async () => null;
  prisma.node.findFirst = async (args) => {
    nodeQuery = args;
    return { data: { accessToken: legacyToken } };
  };
  globalThis.fetch = async (_input, init) => {
    request = { init };
    return new Response(JSON.stringify({ messages: [{ id: "legacy-message-id" }] }), { status: 200 });
  };

  try {
    const result = await whatsappExecutor({
      data: { phoneNumberId: "1234567890", to: "919999999999", message: "Legacy works" },
      nodeId: "legacy-node",
      workflowId: "workflow-legacy",
      workflowOwnerId: "owner-legacy",
      context: {},
      step: {} as never,
      publish: (async () => {}) as never,
    });
    assert.deepEqual(nodeQuery, {
      where: { id: "legacy-node", type: "WHATSAPP", workflow: { is: { userId: "owner-legacy" } } },
      select: { data: true },
    });
    assert.equal(new Headers(request?.init?.headers).get("authorization"), `Bearer ${legacyToken}`);
    assert.deepEqual(result.whatsapp, {
      sent: true,
      to: "919999999999",
      message: "Legacy works",
      result: { messages: [{ id: "legacy-message-id" }] },
    });
  } finally {
    prisma.credential.findFirst = originalFindCredential;
    prisma.node.findFirst = originalFindNode;
    globalThis.fetch = originalFetch;
  }
});

test("WhatsApp executor rejects wrong credential ownership and invalid Graph API versions before sending", async () => {
  const [executorModule, prismaModule] = await Promise.all([
    import("../features/exections/components/whatsapp/executor"),
    import("../lib/db"),
  ]);
  const { whatsappExecutor, getWhatsAppGraphApiVersion } = executorModule;
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
    node: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  const originalFindCredential = prisma.credential.findFirst;
  const originalFindNode = prisma.node.findFirst;
  const originalFetch = globalThis.fetch;
  const originalVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  let fetchCalls = 0;
  const run = () => whatsappExecutor({
    data: { credentialId: "foreign", phoneNumberId: "1234567890", to: "919999999999", message: "hello" },
    nodeId: "node-3",
    workflowId: "workflow-3",
    workflowOwnerId: "owner-3",
    context: {},
    step: {} as never,
    publish: (async () => {}) as never,
  });
  globalThis.fetch = async () => { fetchCalls += 1; return new Response("{}", { status: 200 }); };

  try {
    delete process.env.WHATSAPP_GRAPH_API_VERSION;
    assert.equal(getWhatsAppGraphApiVersion(), "v26.0");

    prisma.credential.findFirst = async () => null;
    prisma.node.findFirst = async () => null;
    await assert.rejects(run(), /Saved credential not found/);

    prisma.credential.findFirst = async () => ({ value: "unused" });
    process.env.WHATSAPP_GRAPH_API_VERSION = "../../unexpected";
    await assert.rejects(run(), /Graph API version is invalid/);
    assert.equal(fetchCalls, 0);
  } finally {
    prisma.credential.findFirst = originalFindCredential;
    prisma.node.findFirst = originalFindNode;
    globalThis.fetch = originalFetch;
    if (originalVersion === undefined) delete process.env.WHATSAPP_GRAPH_API_VERSION;
    else process.env.WHATSAPP_GRAPH_API_VERSION = originalVersion;
  }
});

test("WhatsApp executor publishes an error and hides provider response bodies on delivery failure", async () => {
  const [{ whatsappExecutor }, prismaModule, encryptionModule] = await Promise.all([
    import("../features/exections/components/whatsapp/executor"),
    import("../lib/db"),
    import("../features/credentials/server/encryption"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  const originalFindCredential = prisma.credential.findFirst;
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const providerBody = "provider diagnostic must stay private";
  const published: unknown[] = [];
  prisma.credential.findFirst = async () => ({
    value: encryptionModule.encryptCredentialValue("fake-token-for-error-test"),
  });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: providerBody } }), { status: 401 });
  console.log = () => { throw new Error("WhatsApp executor should not log message or provider data"); };

  try {
    await assert.rejects(whatsappExecutor({
      data: { credentialId: "credential-error", phoneNumberId: "1234567890", to: "919999999999", message: "private message" },
      nodeId: "node-error",
      workflowId: "workflow-error",
      workflowOwnerId: "owner-error",
      context: {},
      step: {} as never,
      publish: (async (message: unknown) => { published.push(message); }) as never,
    }), /Message delivery failed/);
    assert.equal(published.length, 2, "publishes loading and error statuses");
  } finally {
    prisma.credential.findFirst = originalFindCredential;
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test("WhatsApp executor rejects 2xx responses without a Meta message ID and hides body details", async () => {
  const [{ whatsappExecutor }, prismaModule, encryptionModule] = await Promise.all([
    import("../features/exections/components/whatsapp/executor"),
    import("../lib/db"),
    import("../features/credentials/server/encryption"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  const originalFindCredential = prisma.credential.findFirst;
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const privateBody = { error: { message: "private provider diagnostic" } };
  const published: unknown[] = [];
  prisma.credential.findFirst = async () => ({
    value: encryptionModule.encryptCredentialValue("fake-token-2xx-test"),
  });
  globalThis.fetch = async () => new Response(JSON.stringify(privateBody), { status: 200 });
  console.log = () => { throw new Error("WhatsApp executor must not log provider response bodies"); };

  try {
    await assert.rejects(whatsappExecutor({
      data: { credentialId: "credential-2xx", phoneNumberId: "1234567890", to: "919999999999", message: "hello" },
      nodeId: "node-2xx",
      workflowId: "workflow-2xx",
      workflowOwnerId: "owner-2xx",
      context: {},
      step: {} as never,
      publish: (async (message: unknown) => { published.push(message); }) as never,
    }), /Message delivery failed/);
    assert.equal(JSON.stringify(published).includes("private provider diagnostic"), false);
    assert.equal(published.length, 2, "publishes loading and error statuses");
  } finally {
    prisma.credential.findFirst = originalFindCredential;
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});
