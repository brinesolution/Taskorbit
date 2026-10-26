import assert from "node:assert/strict";
import test from "node:test";
import { encryptCredentialValue } from "../features/credentials/server/encryption";

const encryptionKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64");
process.env.CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/taskorbit";

test("Telegram executor resolves an owner-scoped credential and sends only chat_id and rendered text", async () => {
  const [{ telegramExecutor }, prismaModule] = await Promise.all([
    import("../features/exections/components/telegram/executor"),
    import("../lib/db"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  let query: unknown;
  const originalFindFirst = prisma.credential.findFirst;
  prisma.credential.findFirst = async (args) => {
    query = args;
    return { value: encryptCredentialValue("123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi") };
  };

  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 17 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const published: unknown[] = [];
    const result = await telegramExecutor({
      data: { credentialId: "credential-1", chatId: "42", text: "Hi {{name}} & {{tag}}", variableName: "sent" },
      nodeId: "node-1",
      workflowOwnerId: "owner-1",
      context: { name: "Tom & Jerry", tag: "<guest>" },
      step: {} as never,
      publish: (async (message: unknown) => { published.push(message); }) as never,
    });

    assert.deepEqual(query, {
      where: { id: "credential-1", userId: "owner-1", type: "TELEGRAM" },
      select: { value: true },
    });
    assert.equal(request?.url, "https://api.telegram.org/bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi/sendMessage");
    assert.equal(request?.init?.method, "POST");
    assert.equal(request?.init?.redirect, "error");
    assert.equal(request?.init?.headers instanceof Headers ? request.init.headers.get("content-type") : (request?.init?.headers as Record<string, string>)?.["content-type"], "application/json");
    assert.deepEqual(JSON.parse(String(request?.init?.body)), { chat_id: "42", text: "Hi Tom & Jerry & <guest>" });
    assert.deepEqual(result.sent, { sent: true, chatId: "42", messageId: 17 });
    assert.equal(JSON.stringify(result).includes("123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi"), false);
    assert.ok(published.length >= 2);
  } finally {
    prisma.credential.findFirst = originalFindFirst;
    globalThis.fetch = originalFetch;
  }
});

test("Telegram executor rejects missing or foreign credentials and sanitizes provider failures", async () => {
  const [{ telegramExecutor }, prismaModule] = await Promise.all([
    import("../features/exections/components/telegram/executor"),
    import("../lib/db"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: { findFirst: (...args: unknown[]) => Promise<unknown> };
  };
  const originalFindFirst = prisma.credential.findFirst;
  const originalFetch = globalThis.fetch;
  const run = (data: Record<string, unknown>) => telegramExecutor({
    data,
    nodeId: "node-2",
    workflowOwnerId: "owner-2",
    context: {},
    step: {} as never,
    publish: (async () => {}) as never,
  });

  try {
    prisma.credential.findFirst = async () => null;
    await assert.rejects(run({ credentialId: "foreign", chatId: "42", text: "hello" }), /Saved credential not found/);

    prisma.credential.findFirst = async () => ({ value: encryptCredentialValue("987654321:ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvut") });
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, description: "bad token 987654321:ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvut" }), { status: 401 });
    await assert.rejects(run({ credentialId: "owned", chatId: "42", text: "hello" }), (error: Error) => {
      assert.match(error.message, /Telegram/);
      assert.equal(error.message.includes("987654321:ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvut"), false);
      assert.equal(error.message.includes("https://"), false);
      return true;
    });
  } finally {
    prisma.credential.findFirst = originalFindFirst;
    globalThis.fetch = originalFetch;
  }
});
