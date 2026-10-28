import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";

import { decryptCredentialValue } from "@/features/credentials/server/encryption";
import prisma from "@/lib/db";
import { whatsappChannel } from "@/inngest/channels/whatsapp";
import type { NodeExecutor } from "../../types";

type WhatsAppData = {
  credentialId?: string;
  hasLegacyAccessToken?: boolean;
  phoneNumberId?: string;
  to?: string;
  message?: string;
  variableName?: string;
};

type WhatsAppSendResponse = {
  messages?: Array<{ id?: string }>;
  [key: string]: unknown;
};

export const DEFAULT_WHATSAPP_GRAPH_API_VERSION = "v26.0";
const GRAPH_API_VERSION_PATTERN = /^v\d+\.\d+$/;

export function getWhatsAppGraphApiVersion(
  configuredVersion = process.env.WHATSAPP_GRAPH_API_VERSION
): string {
  const version = configuredVersion?.trim() || DEFAULT_WHATSAPP_GRAPH_API_VERSION;
  if (!GRAPH_API_VERSION_PATTERN.test(version)) {
    throw new NonRetriableError("WhatsApp node: Graph API version is invalid");
  }
  return version;
}

async function getAccessToken(
  data: WhatsAppData,
  nodeId: string,
  workflowOwnerId: string
): Promise<string> {
  if (data.credentialId) {
    const credential = await prisma.credential.findFirst({
      where: {
        id: data.credentialId,
        userId: workflowOwnerId,
        type: "WHATSAPP",
      },
      select: { value: true },
    });
    if (!credential) {
      throw new NonRetriableError("WhatsApp node: Saved credential not found");
    }

    try {
      return decryptCredentialValue(credential.value);
    } catch {
      throw new NonRetriableError("WhatsApp node: Saved credential could not be read");
    }
  }

  // Legacy inline tokens remain usable for existing workflows. Read them from
  // the owner-scoped database row so node data sent to the browser can be masked.
  const legacyNode = await prisma.node.findFirst({
    where: {
      id: nodeId,
      type: "WHATSAPP",
      workflow: { is: { userId: workflowOwnerId } },
    },
    select: { data: true },
  });
  const legacyData = legacyNode?.data as Record<string, unknown> | undefined;
  const token = legacyData?.accessToken;
  if (typeof token !== "string" || !token.trim()) {
    throw new NonRetriableError(
      data.hasLegacyAccessToken
        ? "WhatsApp node: Legacy credential could not be read"
        : "WhatsApp node: Saved credential is required"
    );
  }
  return token.trim();
}

export const whatsappExecutor: NodeExecutor<WhatsAppData> = async ({
  data,
  nodeId,
  workflowId,
  workflowOwnerId,
  context,
  publish,
}) => {
  if (!workflowId?.trim()) {
    throw new NonRetriableError("WhatsApp node: Workflow context is unavailable");
  }

  const status = async (value: "loading" | "success" | "error") =>
    publish(whatsappChannel({ nodeId, workflowId }).status({ nodeId, status: value }));

  await status("loading");

  try {
    if (!data.phoneNumberId?.trim()) {
      throw new NonRetriableError("WhatsApp node: Phone Number ID is required");
    }
    if (!data.to?.trim()) {
      throw new NonRetriableError("WhatsApp node: Recipient number is required");
    }
    if (typeof data.message !== "string" || !data.message.trim()) {
      throw new NonRetriableError("WhatsApp node: Message is required");
    }

    const token = await getAccessToken(data, nodeId, workflowOwnerId);
    const version = getWhatsAppGraphApiVersion();
    const to = data.to.replace(/\D/g, "");
    if (!to) {
      throw new NonRetriableError("WhatsApp node: Recipient number is invalid");
    }

    const message = Handlebars.compile(data.message, { noEscape: true })(context).slice(0, 4000);
    if (!message.trim()) {
      throw new NonRetriableError("WhatsApp node: Message is required");
    }

    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${version}/${encodeURIComponent(data.phoneNumberId.trim())}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message },
          }),
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
        }
      );
    } catch {
      throw new Error("WhatsApp node: Message delivery failed");
    }

    let result: WhatsAppSendResponse | undefined;
    try {
      result = (await response.json()) as WhatsAppSendResponse;
    } catch {
      result = undefined;
    }
    if (!response.ok || !result) {
      throw new NonRetriableError("WhatsApp node: Message delivery failed");
    }
    const messageId = result.messages?.[0]?.id;
    if (typeof messageId !== "string" || !messageId.trim()) {
      throw new NonRetriableError("WhatsApp node: Message delivery failed");
    }

    await status("success");
    const variableName = data.variableName?.trim() || "whatsapp";
    return {
      ...context,
      [variableName]: {
        sent: true,
        to,
        message,
        result,
      },
    };
  } catch (error) {
    await status("error");
    if (error instanceof NonRetriableError) throw error;
    throw error instanceof Error
      ? error
      : new Error("WhatsApp node: Message delivery failed");
  }
};
