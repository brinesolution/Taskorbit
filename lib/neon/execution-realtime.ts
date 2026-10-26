import { rawSql } from "@neon/realtime/server";

export interface ExecutionRealtimeRow {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  completedAt: Date | null;
  error: string | null;
}

/**
 * Build a read-only query whose row set is restricted to the authenticated
 * workflow owner. Both identifiers are bound as parameters before sealing.
 */
export function executionRealtimeQuery(executionId: string, userId: string) {
  return rawSql<ExecutionRealtimeRow>(
    `SELECT e."id", e."status", e."completedAt", e."error"
     FROM "Execution" AS e
     INNER JOIN "Workflow" AS w ON w."id" = e."workflowId"
     WHERE e."id" = $1 AND w."userId" = $2`,
    [executionId, userId],
  );
}

export function databaseNameFromUrl(connectionString: string): string {
  const pathname = new URL(connectionString).pathname;
  const name = decodeURIComponent(pathname.replace(/^\/+/, ""));

  if (!name || name.includes("/")) {
    throw new Error("DATABASE_URL must include a database name");
  }

  return name;
}
