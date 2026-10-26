import assert from "node:assert/strict";
import test from "node:test";

import { listNeonGeminiModels } from "../lib/neon/ai-gateway";

test("Neon Gemini model discovery requires both server credentials", async () => {
  await assert.rejects(
    listNeonGeminiModels({ env: {}, fetcher: fetch }),
    /NEON_AI_GATEWAY_TOKEN and NEON_AI_GATEWAY_BASE_URL/
  );
});

test("Neon model discovery returns only enabled Gemini models and never needs a client token", async () => {
  let requestedUrl = "";
  let authorization = "";

  const models = await listNeonGeminiModels({
    env: {
      NEON_AI_GATEWAY_TOKEN: "test-token",
      NEON_AI_GATEWAY_BASE_URL: "https://branch-api.ai.aws.neon.tech/",
    },
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({
        data: [
          { id: "gemini-3-flash", name: "Gemini 3 Flash", enabled: true },
          { id: "gemini-3-pro", name: "Gemini 3 Pro", enabled: false },
          { id: "gpt-5-mini", name: "GPT 5 Mini", enabled: true },
        ],
      });
    },
  });

  assert.equal(requestedUrl, "https://branch-api.ai.aws.neon.tech/v1/models");
  assert.equal(authorization, "Bearer test-token");
  assert.deepEqual(models, [{ id: "gemini-3-flash", name: "Gemini 3 Flash" }]);
});

test("Neon AI Gateway refuses a non-HTTPS or path-based base URL", async () => {
  await assert.rejects(
    listNeonGeminiModels({
      env: {
        NEON_AI_GATEWAY_TOKEN: "test-token",
        NEON_AI_GATEWAY_BASE_URL: "http://example.com/ai-gateway",
      },
      fetcher: fetch,
    }),
    /must be an HTTPS host without a path/
  );
});

test("model catalog failures do not include the gateway token in errors", async () => {
  const secret = "nt_live_do_not_expose";

  await assert.rejects(
    listNeonGeminiModels({
      env: {
        NEON_AI_GATEWAY_TOKEN: secret,
        NEON_AI_GATEWAY_BASE_URL: "https://branch-api.ai.aws.neon.tech",
      },
      fetcher: async () => new Response("secret response", { status: 503 }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 503/);
      assert.equal(error.message.includes(secret), false);
      return true;
    }
  );
});
