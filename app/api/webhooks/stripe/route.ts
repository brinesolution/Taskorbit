import { sendWorkflowExecution } from "@/inngest/utils";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isWebhookTokenValid } from "@/features/trigger/server/webhook-token";

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required query parameter: workflowId",
        },
        { status: 400 }
      );
    }

    const credential = await prisma.workflowWebhookCredential.findUnique({
      where: { workflowId_provider: { workflowId, provider: "STRIPE" } },
      select: { tokenHash: true },
    });
    const workflowHasTrigger = await prisma.node.findFirst({
      where: { workflowId, type: "STRIPE_TRIGGER" }, select: { id: true },
    });
    if (!workflowHasTrigger || !isWebhookTokenValid(url.searchParams.get("token"), credential?.tokenHash)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const stripeData = {
      eventId: body.id,
      eventType: body.type,
      timestamp: body.created,
      livemode: body.livemode,
      raw: body.data?.object,

      amount: body.data?.object?.amount,
      currency: body.data?.object?.currency,
      customerId: body.data?.object?.customer,
    };

    await sendWorkflowExecution({
      workflowId,
      initialData: {
        stripe: stripeData,
      },
    });

    return NextResponse.json({
      success: true,
      workflowId,
      stripe: stripeData,
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process Stripe event",
      },
      { status: 500 }
    );
  }
}
