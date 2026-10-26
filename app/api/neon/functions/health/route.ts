import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getNeonFunctionHealth } from "@/lib/neon/functions-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await getNeonFunctionHealth();
    return NextResponse.json(health, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Do not expose internal URL, network, or database details.
    return NextResponse.json(
      { error: "Neon Functions health check is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
