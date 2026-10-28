import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveTRPCUrl } from "../trpc/base-url";

test("uses an absolute request URL for server-side fetch in a Vercel deployment", () => {
  const url = resolveTRPCUrl({
    isServer: true,
    vercelUrl: "taskorbit-preview.vercel.app",
    nodeEnv: "production",
  });

  assert.equal(url, "https://taskorbit-preview.vercel.app/api/trpc");
  assert.equal(new URL(url).pathname, "/api/trpc");
});

test("keeps browser requests relative so they use the current origin", () => {
  assert.equal(
    resolveTRPCUrl({ isServer: false, vercelUrl: "taskorbit.vercel.app", nodeEnv: "production" }),
    "/api/trpc"
  );
});

test("uses the configured public app origin when no Vercel deployment host exists", () => {
  assert.equal(
    resolveTRPCUrl({
      isServer: true,
      appUrl: "https://taskorbit.example/path",
      nodeEnv: "production",
    }),
    "https://taskorbit.example/api/trpc"
  );
});

test("uses localhost during development and fails clearly without a production origin", () => {
  assert.equal(resolveTRPCUrl({ isServer: true, nodeEnv: "development", port: "3100" }), "http://localhost:3100/api/trpc");
  assert.throws(
    () => resolveTRPCUrl({ isServer: true, nodeEnv: "production" }),
    /absolute server origin/
  );
});

test("uses an absolute placeholder origin during Next production prerender when no deployment host exists", () => {
  assert.equal(
    resolveTRPCUrl({ isServer: true, nodeEnv: "production", nextPhase: "phase-production-build" }),
    "http://localhost:3000/api/trpc"
  );
});

test("does not accept credentials or malformed origins from environment configuration", () => {
  assert.throws(
    () => resolveTRPCUrl({ isServer: true, appUrl: "https://user:secret@taskorbit.example", nodeEnv: "production" }),
    /valid HTTP\(S\) origin/
  );
});
