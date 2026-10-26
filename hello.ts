import { timingSafeEqual } from "node:crypto";
import { attachDatabasePool } from "@neon/functions";
import { Pool } from "pg";

// Neon Functions injects the branch's pooled DATABASE_URL at runtime.
// Reuse a small pool across requests handled by this isolate.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

if (pool) {
  attachDatabasePool(pool);
}

function hasValidBearerToken(request: Request, expectedToken: string | undefined) {
  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(match[1]);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function createHelloHandler(
  checkDatabase: () => Promise<unknown>,
  expectedToken: string | undefined = process.env.TASKORBIT_FUNCTION_HEALTH_TOKEN
) {
  return async function hello(request: Request): Promise<Response> {
    if (!hasValidBearerToken(request, expectedToken)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (request.method !== "GET") {
      return Response.json(
        { error: "Request unavailable" },
        { status: 405, headers: { Allow: "GET" } }
      );
    }

    try {
      await checkDatabase();
      return Response.json({ ok: true, service: "neon-functions" });
    } catch {
      // Keep connection details and driver errors out of the public response.
      return Response.json({ ok: false, service: "neon-functions" }, { status: 503 });
    }
  };
}

export default createHelloHandler(async () => {
  if (!pool) {
    throw new Error("DATABASE_URL is unavailable.");
  }

  await pool.query("SELECT 1");
});
