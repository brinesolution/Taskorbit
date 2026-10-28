import assert from "node:assert/strict";
import { test } from "node:test";

import { createHttpRequestExecutor } from "../features/exections/components/executor";
import type { HttpResponse } from "../features/exections/components/http-request/safe-url";

const successfulResponse: HttpResponse = {
  status: 200,
  statusText: "OK",
  contentType: "application/json",
  body: JSON.stringify({ answer: 42 }),
};

function makeExecutor(request: () => Promise<HttpResponse>) {
  const executor = createHttpRequestExecutor(request as never);
  const published: Array<{ channel: string; topic: string; data: { status: string } }> = [];
  const params = {
    data: {
      endpoint: "https://example.com/api",
      method: "GET",
      variableName: "httpResult",
    },
    nodeId: "http-node",
    workflowOwnerId: "owner",
    context: { input: "test" },
    // The node executor must run its request in the enclosing workflow step.
    step: { run: () => { throw new Error("HTTP executor must not create a nested step"); } },
    publish: async (event: Promise<{ channel: string; topic: string; data: { status: string } }>) => {
      const message = await event;
      published.push(message);
      return message.data;
    },
  } as never;

  return { run: () => executor(params), published };
}

test("HTTP executor publishes success and preserves a successful JSON response", async () => {
  const { run, published } = makeExecutor(async () => successfulResponse);

  const result = await run();

  assert.deepEqual(result, {
    input: "test",
    httpResult: { status: 200, statusText: "OK", data: { answer: 42 } },
  });
  assert.deepEqual(published.map((message) => message.data.status), ["loading", "success"]);
});

test("HTTP executor parses JSON media types without case sensitivity or vendor suffix loss", async () => {
  for (const contentType of ["APPLICATION/JSON; charset=utf-8", "Application/Problem+JSON; charset=utf-8"]) {
    const { run } = makeExecutor(async () => ({
      ...successfulResponse,
      contentType,
    }));

    const result = await run();
    assert.deepEqual(
      (result.httpResult as { data: unknown }).data,
      { answer: 42 }
    );
  }
});

test("HTTP executor accepts an empty successful response", async () => {
  const { run, published } = makeExecutor(async () => ({
    status: 204,
    statusText: "No Content",
    contentType: "application/json",
    body: "",
  }));

  const result = await run();

  assert.deepEqual(result, {
    input: "test",
    httpResult: { status: 204, statusText: "No Content", data: null },
  });
  assert.deepEqual(published.map((message) => message.data.status), ["loading", "success"]);
});

test("HTTP executor treats a non-2xx response as a failure", async () => {
  const { run, published } = makeExecutor(async () => ({
    status: 503,
    statusText: "Service Unavailable",
    contentType: "text/plain",
    body: "private upstream details",
  }));

  let failure: unknown;
  try {
    await run();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof Error);
  assert.match(failure.message, /HTTP Request node: Request failed with HTTP 503/);
  assert.ok(!failure.message.includes("private upstream details"));
  assert.deepEqual(published.map((message) => message.data.status), ["loading", "error"]);
  assert.ok(!published.some((message) => message.data.status === "success"));
});

test("HTTP executor publishes an error when the transport throws", async () => {
  const { run, published } = makeExecutor(async () => {
    throw new Error("connect ECONNREFUSED");
  });

  await assert.rejects(run(), /HTTP Request node: Could not reach the endpoint/);
  assert.deepEqual(published.map((message) => message.data.status), ["loading", "error"]);
});

test("HTTP executor publishes an error when a JSON response is malformed", async () => {
  const { run, published } = makeExecutor(async () => ({
    ...successfulResponse,
    body: "not-json",
  }));

  await assert.rejects(run(), /HTTP Request node: Response contained invalid JSON/);
  assert.deepEqual(published.map((message) => message.data.status), ["loading", "error"]);
});

test("HTTP executor rejects invalid request JSON before sending and publishes an error", async () => {
  let requests = 0;
  const executor = createHttpRequestExecutor((async () => {
    requests += 1;
    return successfulResponse;
  }) as never);
  const published: string[] = [];
  const params = {
    data: {
      endpoint: "https://example.com/api",
      method: "POST",
      variableName: "httpResult",
      body: "{ invalid json",
    },
    nodeId: "http-node",
    workflowOwnerId: "owner",
    context: {},
    step: {},
    publish: async (event: Promise<{ data: { status: string } }>) => {
      published.push((await event).data.status);
    },
  } as never;

  await assert.rejects(executor(params), /Request body must render to valid JSON/);
  assert.equal(requests, 0);
  assert.deepEqual(published, ["loading", "error"]);
});
