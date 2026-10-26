import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const createWebhookToken = () => randomBytes(32).toString("base64url");

export const hashWebhookToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const isWebhookTokenValid = (
  token: string | null | undefined,
  expectedHash: string | null | undefined
) => {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashWebhookToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
