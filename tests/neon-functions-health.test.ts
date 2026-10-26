import assert from "node:assert/strict";
import test from "node:test";

import { createHelloHandler } from "../hello";
import { getNeonFunctionHealth } from "../lib/neon/functions-health";

test("Neon Function health handler runs a database check and returns safe JSON", async () => {
  let queryRan = false;
  const handler = createHelloHandler(async () => {
    queryRan = true;
    return { rows: [{ "?column?": 1 }] };
  }, "expected-secret");

  const response = await handler(
    new Request("https://function.example/", {
      method: "GET",
      headers: { Authorization: "Bearer expected-secret" },
    })
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "neon-functions" });
  assert.equal(queryRan, true);
});

test("Neon Function health handler hides database failures", async () => {
  const handler = createHelloHandler(async () => {
    throw new Error("postgres://private/credential");
  }, "expected-secret");

  const response = await handler(
    new Request("https://function.example/", {
      method: "GET",
      headers: { Authorization: "Bearer expected-secret" },
    })
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, service: "neon-functions" });
});

test("Neon Function health rejects missing and incorrect bearer tokens before querying", async () => {
  let queryRan = false;
  const handler = createHelloHandler(async () => {
    queryRan = true;
  }, "expected-secret");

  for (const authorization of [undefined, "Bearer wrong-secret"]) {
    const response = await handler(
      new Request("https://function.example/", {
        method: "GET",
        headers: authorization ? { Authorization: authorization } : undefined,
      })
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }

  assert.equal(queryRan, false);
});

test("Neon Function health requires an invocation URL", async () => {
  await assert.rejects(
    getNeonFunctionHealth({ env: {}, fetcher: fetch }),
    /Neon Functions health check failed/
  );
});

test("Neon Function health calls the configured HTTPS URL and returns a safe result", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const health = await getNeonFunctionHealth({
    env: {
      NEON_HELLO_FUNCTION_URL: "https://branch-hello.compute.aws.neon.tech/",
      TASKORBIT_FUNCTION_HEALTH_TOKEN: "test-health-token",
    },
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      requestedMethod = init?.method ?? "";
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-health-token");
      return Response.json({ ok: true, service: "neon-functions", detail: "must be ignored" });
    },
  });

  assert.equal(requestedUrl, "https://branch-hello.compute.aws.neon.tech/");
  assert.equal(requestedMethod, "GET");
  assert.deepEqual(health, { ok: true, service: "neon-functions" });
});

test("Neon Function health rejects non-HTTPS URLs without making a request", async () => {
  let fetched = false;
  await assert.rejects(
    getNeonFunctionHealth({
      env: {
        NEON_HELLO_FUNCTION_URL: "http://localhost:3000/health",
        TASKORBIT_FUNCTION_HEALTH_TOKEN: "test-health-token",
      },
      fetcher: async () => {
        fetched = true;
        return Response.json({ ok: true, service: "neon-functions" });
      },
    }),
    /Neon Functions health check failed/
  );
  assert.equal(fetched, false);
});

test("Neon Function health hides upstream errors and malformed responses", async () => {
  const secretDetail = "postgres://secret.internal/db";
  await assert.rejects(
    getNeonFunctionHealth({
      env: {
        NEON_HELLO_FUNCTION_URL: "https://branch-hello.compute.aws.neon.tech",
        TASKORBIT_FUNCTION_HEALTH_TOKEN: "test-health-token",
      },
      fetcher: async () => new Response(secretDetail, { status: 503 }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(secretDetail), false);
      return true;
    }
  );

  await assert.rejects(
    getNeonFunctionHealth({
      env: {
        NEON_HELLO_FUNCTION_URL: "https://branch-hello.compute.aws.neon.tech",
        TASKORBIT_FUNCTION_HEALTH_TOKEN: "test-health-token",
      },
      fetcher: async () => Response.json({ ok: true, service: "wrong-service" }),
    }),
    /Neon Functions health check failed/
  );
});
