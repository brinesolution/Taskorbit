import assert from "node:assert/strict";
import test from "node:test";

import {
  getClientSafeWhatsAppNodeData,
  getClientSafeDiscordNodeData,
  prepareWhatsAppNodeDataForSave,
  prepareWhatsAppNodeDataForExecution,
} from "../features/workflows/whatsapp-legacy";

test("client-facing WhatsApp node data masks the legacy token and reports only its presence", () => {
  const safe = getClientSafeWhatsAppNodeData({
    accessToken: "legacy-token-for-test",
    phoneNumberId: "number-id",
    hasLegacyAccessToken: false,
  });

  assert.deepEqual(safe, {
    phoneNumberId: "number-id",
    hasLegacyAccessToken: true,
  });
  assert.equal(JSON.stringify(safe).includes("legacy-token-for-test"), false);
});

test("a graph save without a new credential preserves a hidden prior legacy token but ignores client token fields", () => {
  const saved = prepareWhatsAppNodeDataForSave(
    "WHATSAPP",
    { message: "updated", accessToken: "attacker-token", hasLegacyAccessToken: false },
    "WHATSAPP",
    { accessToken: "legacy-token-for-test" }
  );

  assert.deepEqual(saved, {
    message: "updated",
    accessToken: "legacy-token-for-test",
  });
});

test("saving a non-WhatsApp node preserves its own accessToken field", () => {
  const saved = prepareWhatsAppNodeDataForSave(
    "HTTP_REQUEST",
    { accessToken: "http-node-owned-value", url: "https://example.test" },
    "HTTP_REQUEST",
    { accessToken: "previous-http-value" }
  );
  assert.deepEqual(saved, {
    accessToken: "http-node-owned-value",
    url: "https://example.test",
  });
});

test("client-facing Discord node data masks its legacy webhook URL", () => {
  const safe = getClientSafeDiscordNodeData({
    webhookUrl: "https://discord.example/secret-webhook",
    message: "hello",
  });
  assert.deepEqual(safe, { message: "hello", hasLegacyWebhook: true });
  assert.equal(JSON.stringify(safe).includes("secret-webhook"), false);
});

test("selecting a saved credential drops the prior legacy token", () => {
  const saved = prepareWhatsAppNodeDataForSave(
    "WHATSAPP",
    { credentialId: "credential-1", message: "updated", hasLegacyAccessToken: true },
    "WHATSAPP",
    { accessToken: "legacy-token-for-test" }
  );

  assert.deepEqual(saved, { credentialId: "credential-1", message: "updated" });
});

test("Inngest node data contains only the legacy-token presence flag, never the token", () => {
  const prepared = prepareWhatsAppNodeDataForExecution({
    accessToken: "legacy-token-for-test",
    message: "run",
    phoneNumberId: "number-id",
  });

  assert.deepEqual(prepared, {
    hasLegacyAccessToken: true,
    message: "run",
    phoneNumberId: "number-id",
  });
  assert.equal(JSON.stringify(prepared).includes("legacy-token-for-test"), false);
});
