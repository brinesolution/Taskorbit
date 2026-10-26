import assert from "node:assert/strict";
import test from "node:test";
import { createWebhookToken, hashWebhookToken, isWebhookTokenValid } from "../features/trigger/server/webhook-token";

test("webhook tokens are high entropy and only their hashes are used for verification", () => {
  const token = createWebhookToken();
  const hash = hashWebhookToken(token);
  assert.ok(token.length >= 40);
  assert.notEqual(hash, token);
  assert.equal(isWebhookTokenValid(token, hash), true);
  assert.equal(isWebhookTokenValid("wrong-token", hash), false);
  assert.equal(isWebhookTokenValid(undefined, hash), false);
});

test("rotating a token revokes the prior credential", () => {
  const previous = createWebhookToken();
  const current = createWebhookToken();
  const currentHash = hashWebhookToken(current);
  assert.notEqual(previous, current);
  assert.equal(isWebhookTokenValid(previous, currentHash), false);
  assert.equal(isWebhookTokenValid(current, currentHash), true);
});
