import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { getAuthSetupStatus } from "@/lib/auth-config";

let handlers: ReturnType<typeof toNextJsHandler> | undefined;

async function getAuthHandlers() {
  if (!handlers) {
    const { auth } = await import("@/lib/auth");
    handlers = toNextJsHandler(auth);
  }

  return handlers;
}

function unavailable() {
  return Response.json(
    {
      error: "Authentication is not configured for this deployment.",
      code: "AUTH_NOT_CONFIGURED",
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  if (!getAuthSetupStatus(process.env).ready) return unavailable();
  return (await getAuthHandlers()).GET(request);
}

export async function POST(request: NextRequest) {
  if (!getAuthSetupStatus(process.env).ready) return unavailable();
  return (await getAuthHandlers()).POST(request);
}
