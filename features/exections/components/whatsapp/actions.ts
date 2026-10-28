"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { inngest } from "@/inngest/client";
import { whatsappChannel } from "@/inngest/channels/whatsapp";
import { assertWhatsAppRealtimeNodeAccess } from "./realtime-authorization";

export type WhatsAppToken = Realtime.Token<typeof whatsappChannel, ["status"]>;

export async function fetchWhatsAppRealtimeToken(
  nodeId: string,
  workflowId: string
): Promise<WhatsAppToken> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  await assertWhatsAppRealtimeNodeAccess(
    nodeId,
    workflowId,
    session.user.id,
    (query) => prisma.workflow.findFirst(query),
    (query) => prisma.node.findFirst(query)
  );

  return getSubscriptionToken(inngest, {
    channel: whatsappChannel({ nodeId, workflowId }),
    topics: ["status"],
  });
}
