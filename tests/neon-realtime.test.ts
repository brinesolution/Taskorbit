import assert from "node:assert/strict";
import test from "node:test";

import {
  databaseNameFromUrl,
  executionRealtimeQuery,
} from "@/lib/neon/execution-realtime";
import { executionRealtimeIdentityKey } from "@/features/exections/components/neon-execution-status";

test("execution Realtime query scopes rows to the requested execution owner", () => {
  const query = executionRealtimeQuery("exec-1", "user-1");

  assert.match(query.sql, /INNER JOIN "Workflow"/);
  assert.match(query.sql, /e\."id" = \$1 AND w\."userId" = \$2/);
  assert.deepEqual(
    query.parameters.map((parameter) => parameter.value),
    ["exec-1", "user-1"],
  );
  assert.equal(query.sql.includes("exec-1"), false);
  assert.equal(query.sql.includes("user-1"), false);
});

test("database name is read from the pooled connection URL", () => {
  assert.equal(
    databaseNameFromUrl(
      "postgresql://user:password@host.neon.tech/taskorbit?sslmode=require",
    ),
    "taskorbit",
  );
});

test("database name parsing rejects a connection URL without a database", () => {
  assert.throws(() =>
    databaseNameFromUrl("postgresql://user:password@host.neon.tech/"),
  );
});

test("execution Realtime key changes when the authenticated user changes", () => {
  const currentUserKey = executionRealtimeIdentityKey("user-a", "execution-1");

  assert.notEqual(
    executionRealtimeIdentityKey("user-b", "execution-1"),
    currentUserKey,
  );
  assert.equal(
    executionRealtimeIdentityKey("user-a", "execution-1"),
    currentUserKey,
  );
});
