import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import {
  assertSafeHttpUrl,
  createPinnedLookup,
  requestSafeHttp,
  sendPinnedRequest,
  type HttpResponse,
} from "../features/exections/components/http-request/safe-url";

test("rejects local, private, special-use, and documentation IPv4 destinations", async () => {
  for (const host of [
    "127.0.0.1", "10.0.0.5", "172.20.1.4", "192.168.1.2", "169.254.169.254",
    "100.64.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "240.0.0.1",
  ]) {
    await assert.rejects(assertSafeHttpUrl(`http://${host}/`), /publicly routable/);
  }
});

test("rejects non-HTTP schemes, embedded credentials and local hostnames", async () => {
  for (const value of [
    "file:///etc/passwd",
    "https://user:pass@example.com/",
    "http://localhost/",
    "http://service.local/",
  ]) {
    await assert.rejects(assertSafeHttpUrl(value));
  }
});

test("rejects unsafe IPv6 and permits a public IPv6 literal", async () => {
  for (const host of ["::", "::1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1"]) {
    await assert.rejects(assertSafeHttpUrl(`http://[${host}]/`), /publicly routable/);
  }
  const safe = await assertSafeHttpUrl("https://[2606:4700:4700::1111]/status");
  assert.equal(safe.address.address, "2606:4700:4700::1111");
  assert.equal(safe.address.family, 6);
});

test("rejects the 2001::/23 protocol-assignment range but permits its next boundary", async () => {
  for (const host of ["2001::1", "2001:1::1", "2001:1ff::1"]) {
    await assert.rejects(
      assertSafeHttpUrl(`https://[${host}]/`),
      /publicly routable/
    );
  }

  const boundary = await assertSafeHttpUrl("https://[2001:200::1]/");
  assert.equal(boundary.address.address, "2001:200::1");
});

test("pins the actual Node socket lookup to the vetted address and preserves hostname", async () => {
  const endpoint = await assertSafeHttpUrl("https://service.example.test/path", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  assert.equal(endpoint.url.hostname, "service.example.test");
  const lookup = createPinnedLookup(endpoint.address);

  const pinned = await new Promise<{ address: string; family: number }>((resolve, reject) => {
    lookup("service.example.test", {}, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address: address as string, family: family as number });
    });
  });
  assert.deepEqual(pinned, { address: "93.184.216.34", family: 4 });

  const allPinned = await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
    lookup("service.example.test", { all: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses as Array<{ address: string; family: number }>);
    });
  });
  assert.deepEqual(allPinned, [{ address: "93.184.216.34", family: 4 }]);
});

test("rejects private DNS answers before the transport can send", async () => {
  let sends = 0;
  const send = async (): Promise<HttpResponse> => {
    sends += 1;
    return { status: 200, statusText: "OK", contentType: "text/plain", body: "unexpected" };
  };
  await assert.rejects(
    requestSafeHttp(
      "https://attacker-controlled.example/",
      "GET",
      undefined,
      async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.8", family: 4 }],
      send
    ),
    /non-public address/
  );
  assert.equal(sends, 0);
});

test("allows and pins a public IPv4 endpoint", async () => {
  const endpoint = await assertSafeHttpUrl("https://8.8.8.8/status");
  assert.equal(endpoint.url.hostname, "8.8.8.8");
  assert.deepEqual(endpoint.address, { address: "8.8.8.8", family: 4 });
});

test("bounds request duration and response body size", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/slow") {
      response.writeHead(200);
      response.write("waiting");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("x".repeat(128));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = {
    url: new URL(`http://127.0.0.1:${address.port}/slow`),
    address: { address: "127.0.0.1", family: 4 as const },
  };

  await assert.rejects(
    sendPinnedRequest(endpoint, "GET", undefined, { timeoutMs: 25 }),
    /timed out/
  );
  await assert.rejects(
    sendPinnedRequest({ ...endpoint, url: new URL(`http://127.0.0.1:${address.port}/large`) }, "GET", undefined, {
      timeoutMs: 1_000,
      maxResponseBytes: 32,
    }),
    /size limit/
  );
});
