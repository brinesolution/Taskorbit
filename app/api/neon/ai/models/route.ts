import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { listNeonGeminiModels } from "@/lib/neon/ai-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const models = await listNeonGeminiModels();
    return NextResponse.json({ models }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Neon AI Gateway models are unavailable on this branch." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
