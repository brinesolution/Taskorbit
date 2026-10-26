import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptCredentialValue,
  encryptCredentialValue,
  isEncryptedCredentialValue,
} from "../features/credentials/server/encryption";

const key = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64");

test("credential encryption round-trips and uses a fresh IV per write", () => {
  const first = encryptCredentialValue("provider-secret-123", key);
  const second = encryptCredentialValue("provider-secret-123", key);

  assert.equal(isEncryptedCredentialValue(first), true);
  assert.equal(decryptCredentialValue(first, key), "provider-secret-123");
  assert.notEqual(first, second);
});

test("credential decryption rejects tampered ciphertext and the wrong key", () => {
  const encrypted = encryptCredentialValue("sensitive", key);
  const [prefix, iv, tag, ciphertext] = encrypted.split(":");
  const replacement = ciphertext.endsWith("A") ? "B" : "A";

  assert.throws(() => decryptCredentialValue(`${prefix}:${iv}:${tag}:${ciphertext.slice(0, -1)}${replacement}`, key), /authentication|envelope/i);
  assert.throws(() => decryptCredentialValue(encrypted, Buffer.alloc(32, 7).toString("base64")), /authentication/i);
});

test("credential encryption rejects a missing or malformed key", () => {
  assert.throws(() => encryptCredentialValue("secret", ""), /CREDENTIALS_ENCRYPTION_KEY is required/);
  assert.throws(() => encryptCredentialValue("secret", "not-a-valid-key"), /base64-encoded 32-byte key/);
  assert.throws(() => decryptCredentialValue(encryptCredentialValue("secret", key), "bad"), /base64-encoded 32-byte key/);
});

test("legacy plaintext credential values stay readable until rewritten", () => {
  assert.equal(isEncryptedCredentialValue("legacy-api-key"), false);
  assert.equal(decryptCredentialValue("legacy-api-key", undefined), "legacy-api-key");
  assert.equal(decryptCredentialValue(encryptCredentialValue("legacy-api-key", key), key), "legacy-api-key");
  assert.throws(() => decryptCredentialValue("enc:v2:opaque", key), /unsupported encryption version/);
});
