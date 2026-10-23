import assert from "node:assert/strict";
import test from "node:test";

import { getAuthSetupStatus } from "../lib/auth-config.ts";

test("auth remains unavailable until database, secret, and app URLs are configured", () => {
  assert.deepEqual(getAuthSetupStatus({}), {
    ready: false,
    missing: [
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "NEXT_PUBLIC_APP_URL",
    ],
    providers: { github: false, google: false },
  });
});

test("social providers are available only when both OAuth credentials exist", () => {
  const status = getAuthSetupStatus({
    DATABASE_URL: "postgres://db",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "https://taskorbit.example",
    NEXT_PUBLIC_APP_URL: "https://taskorbit.example",
    GITHUB_CLIENT_ID: "github-id",
    GITHUB_CLIENT_SECRET: "",
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
  });

  assert.deepEqual(status, {
    ready: true,
    missing: [],
    providers: { github: false, google: true },
  });
});
