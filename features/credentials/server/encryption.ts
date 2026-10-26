import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENVELOPE_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function parseKey(keyBase64: string | undefined): Buffer {
  if (!keyBase64) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is required to encrypt credentials");
  }

  // A 32-byte key encodes to exactly 44 base64 characters with one trailing '='.
  if (!/^[A-Za-z0-9+/]{43}=$/.test(keyBase64)) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32 || key.toString("base64") !== keyBase64) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return key;
}

export function isEncryptedCredentialValue(value: string): boolean {
  return value.startsWith(ENVELOPE_PREFIX);
}

/** Encrypt a credential value with AES-256-GCM using a fresh 96-bit IV. */
export function encryptCredentialValue(
  value: string,
  keyBase64 = process.env.CREDENTIALS_ENCRYPTION_KEY
): string {
  const key = parseKey(keyBase64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(ENVELOPE_PREFIX, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENVELOPE_PREFIX}${iv.toString("base64url")}:${authTag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/**
 * Decrypt a versioned credential envelope. Legacy plaintext records are returned as-is
 * so existing installations remain readable while the user next updates each value.
 */
export function decryptCredentialValue(
  value: string,
  keyBase64 = process.env.CREDENTIALS_ENCRYPTION_KEY
): string {
  if (value.startsWith("enc:") && !isEncryptedCredentialValue(value)) {
    throw new Error("Stored credential uses an unsupported encryption version");
  }
  if (!isEncryptedCredentialValue(value)) return value;

  const parts = value.slice(ENVELOPE_PREFIX.length).split(":");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]*$/.test(part))) {
    throw new Error("Stored credential has an invalid encryption envelope");
  }

  const [ivPart, tagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (
    iv.length !== IV_LENGTH ||
    authTag.length !== AUTH_TAG_LENGTH ||
    iv.toString("base64url") !== ivPart ||
    authTag.toString("base64url") !== tagPart ||
    ciphertext.toString("base64url") !== ciphertextPart
  ) {
    throw new Error("Stored credential has an invalid encryption envelope");
  }

  const key = parseKey(keyBase64);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(ENVELOPE_PREFIX, "utf8"));
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // GCM verifies the authentication tag using a constant-time primitive in OpenSSL.
    throw new Error("Stored credential failed authentication; check the encryption key and data integrity");
  }
}
