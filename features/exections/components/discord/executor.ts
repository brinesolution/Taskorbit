import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/db";
import { decryptCredentialValue } from "@/features/credentials/server/encryption";
import { requestSafeHttp } from "../http-request/safe-url";

import type { NodeExecutor } from "../../types";
import { discordChannel } from "@/inngest/channels/discord";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);

  return new Handlebars.SafeString(jsonString);
});

type DiscordData = {
  variableName?: string;
  credentialId?: string;
  webhookUrl?: string;
  hasLegacyWebhook?: boolean;
  content?: string;
  username?: string;
};

export const discordExecutor: NodeExecutor<DiscordData> =
  async ({
    data,
    nodeId,
    workflowOwnerId,
    context,
    publish,
  }) => {

    await publish(
      discordChannel().status({
        nodeId,
        status: "loading",
      })
    );

    let webhookUrl: string | undefined;
    if (data.credentialId) {
      try {
        const credential = await prisma.credential.findFirst({
          where: { id: data.credentialId, userId: workflowOwnerId, type: "DISCORD" },
          select: { value: true },
        });
        if (!credential) {
          await publish(discordChannel().status({ nodeId, status: "error" }));
          throw new NonRetriableError("Discord node: Saved credential not found");
        }
        webhookUrl = decryptCredentialValue(credential.value);
      } catch (error) {
        if (error instanceof NonRetriableError) throw error;
        await publish(discordChannel().status({ nodeId, status: "error" }));
        throw new NonRetriableError("Discord node: Saved credential could not be read");
      }
    } else {
      if (data.hasLegacyWebhook) {
        try {
          const legacyNode = await prisma.node.findFirst({
            where: {
              id: nodeId,
              type: "DISCORD",
              workflow: { is: { userId: workflowOwnerId } },
            },
            select: { data: true },
          });
          const legacyData = legacyNode?.data as Record<string, unknown> | undefined;
          webhookUrl = typeof legacyData?.webhookUrl === "string" ? legacyData.webhookUrl : undefined;
        } catch {
          await publish(discordChannel().status({ nodeId, status: "error" }));
          throw new NonRetriableError("Discord node: Legacy webhook could not be read");
        }
      } else {
        // Fallback for older in-flight Inngest events prepared before URL sanitization.
        webhookUrl = data.webhookUrl;
      }
    }

    if (!webhookUrl) {
      await publish(
        discordChannel().status({
          nodeId,
          status: "error",
        })
      );

      throw new NonRetriableError(
        "Discord node: Webhook URL is required"
      );
    }

    if (!data.content) {
      await publish(
        discordChannel().status({
          nodeId,
          status: "error",
        })
      );

      throw new NonRetriableError(
        "Discord node: Message content is required"
      );
    }

    const rawContent =
      Handlebars.compile(data.content)(context);

    const content = decode(rawContent).slice(0, 2000);

    const username = data.username
      ? decode(Handlebars.compile(data.username)(context))
      : "TaskOrbit Bot";

    try {
      const url = new URL(webhookUrl);
      if (
        url.protocol !== "https:" || url.username || url.password || url.port || url.host !== url.hostname ||
        !["discord.com", "discordapp.com"].includes(url.hostname.toLowerCase()) ||
        !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname) || url.search || url.hash
      ) throw new NonRetriableError("Discord node: Invalid webhook endpoint");

      const response = await requestSafeHttp(webhookUrl, "POST", JSON.stringify({
          content,
          username,
        }));
      if (response.status < 200 || response.status >= 300) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error("Discord node: Temporary webhook delivery failure");
        }
        throw new NonRetriableError("Discord node: Webhook request was rejected");
      }

      await publish(
        discordChannel().status({
          nodeId,
          status: "success",
        })
      );

      const variableName =
        data.variableName || "discord";

      return {
        ...context,
        [variableName]: {
          messageSent: true,
          messageContent: content,
          status: response.status,
        },
      };
    } catch (error) {
      await publish(
        discordChannel().status({
          nodeId,
          status: "error",
        })
      );

      if (error instanceof NonRetriableError) throw error;
      // Do not expose URL, provider response bodies, or low-level network errors.
      throw new Error("Discord node: Temporary webhook delivery failure");
    }
  };
