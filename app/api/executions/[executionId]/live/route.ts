import { headers } from "next/headers";
import { createRealtime } from "@neon/realtime/server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  databaseNameFromUrl,
  executionRealtimeQuery,
} from "@/lib/neon/execution-realtime";

type RouteContext = {
  params: Promise<{ executionId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let expectedUserId: unknown;
  try {
    expectedUserId = (await request.json() as { userId?: unknown }).userId;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (expectedUserId !== session.user.id) {
    return Response.json({ error: "Session changed" }, { status: 401 });
  }

  const { executionId } = await params;
  if (!executionId || executionId.length > 128) {
    return Response.json({ error: "Invalid execution ID" }, { status: 400 });
  }

  const ownedExecution = await prisma.execution.findFirst({
    where: {
      id: executionId,
      workflow: { userId: session.user.id },
    },
    select: { id: true },
  });

  if (!ownedExecution) {
    return Response.json({ error: "Execution not found" }, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  const realtimeSecret = process.env.NEON_REALTIME_SECRET;
  const realtimeUrl = process.env.NEON_REALTIME_URL;

  if (!databaseUrl || !realtimeSecret || !realtimeUrl) {
    return Response.json(
      { error: "Neon Realtime is not configured" },
      { status: 503 },
    );
  }

  try {
    const realtime = createRealtime({
      secret: realtimeSecret,
      db: databaseNameFromUrl(databaseUrl),
    });
    const sealedQuery = await realtime.seal({
      query: executionRealtimeQuery(executionId, session.user.id),
    });

    return Response.json({ sealedQuery, realtimeUrl });
  } catch {
    // Avoid logging server credentials or details that could contain them.
    return Response.json(
      { error: "Could not create a live execution subscription" },
      { status: 503 },
    );
  }
}
