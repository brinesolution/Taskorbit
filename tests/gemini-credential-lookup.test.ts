import assert from "node:assert/strict";
import test from "node:test";
import { encryptCredentialValue } from "../features/credentials/server/encryption";

process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 1)
).toString("base64");
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/taskorbit";

async function assertRejectedCredentialLookup(credentialId: string, matchingRow: Record<string, unknown> | null) {
  const executorPath = process.env.GEMINI_EXECUTOR_MODULE ?? "../features/exections/components/gemini/executor";
  const [{ geminiExecutor }, prismaModule] = await Promise.all([
    import(executorPath),
    import("../lib/db"),
  ]);
  const prisma = prismaModule.default as unknown as {
    credential: {
      findFirst: (...args: unknown[]) => Promise<unknown>;
      findUnique: (...args: unknown[]) => Promise<unknown>;
    };
  };
  const originalFindFirst = prisma.credential.findFirst;
  const originalFindUnique = prisma.credential.findUnique;
  const originalFetch = globalThis.fetch;
  const queries: unknown[] = [];
  let networkCalls = 0;

  const lookup = (args: unknown) => {
    queries.push(args);
    const where = (args as { where?: Record<string, unknown> }).where ?? {};
    return matchingRow && Object.entries(where).every(([key, value]) => matchingRow[key] === value)
      ? matchingRow
      : null;
  };
  prisma.credential.findUnique = async (args) => lookup(args);
  prisma.credential.findFirst = async (args) => lookup(args);
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("Network calls are forbidden in this credential lookup test");
  };

  try {
    let error: unknown;
    try {
      await geminiExecutor({
        data: { credentialId, variableName: "summary", userPrompt: "Summarize this" },
        nodeId: "node-1",
        workflowOwnerId: "owner-1",
        context: {},
        step: {} as never,
        publish: (async () => {}) as never,
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof Error, "unavailable or wrong-type credentials must reject");
    assert.match(error.message, /select a Gemini credential/i);
    assert.match(error.message, /save the node and workflow/i);
    assert.equal(error.message.includes(credentialId), false, "the error must not reveal the credential ID");
    assert.deepEqual(queries, [{
      where: { id: credentialId, userId: "owner-1", type: "GEMINI" },
      select: { value: true },
    }]);
    assert.equal(networkCalls, 0, "invalid credentials must be rejected before any Google request");
  } finally {
    prisma.credential.findFirst = originalFindFirst;
    prisma.credential.findUnique = originalFindUnique;
    globalThis.fetch = originalFetch;
  }
}

test("Gemini rejects a missing credential with a recovery hint", async () => {
  await assertRejectedCredentialLookup("missing", null);
});

test("Gemini rejects a credential owned by another user", async () => {
  await assertRejectedCredentialLookup("foreign-gemini", {
    id: "foreign-gemini",
    userId: "owner-2",
    type: "GEMINI",
    value: encryptCredentialValue("not-a-real-api-key"),
  });
});

test("Gemini rejects an owned credential of another provider before making a request", async () => {
  await assertRejectedCredentialLookup("owned-other-provider", {
    id: "owned-other-provider",
    userId: "owner-1",
    type: "DISCORD",
    value: encryptCredentialValue("not-a-real-api-key"),
  });
});
