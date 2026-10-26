import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";

import { decryptCredentialValue } from "@/features/credentials/server/encryption";
import prisma from "@/lib/db";
import { telegramChannel } from "@/inngest/channels/telegram";
import type { NodeExecutor } from "../../types";

type TelegramData = {
  credentialId?: string;
  chatId?: string;
  text?: string;
  variableName?: string;
};

type TelegramSendResponse = {
  ok?: boolean;
  result?: { message_id?: number };
};

export const telegramExecutor: NodeExecutor<TelegramData> = async ({
  data,
  nodeId,
  workflowOwnerId,
  context,
  publish,
}) => {
  const status = async (value: "loading" | "success" | "error") =>
    publish(telegramChannel().status({ nodeId, status: value }));

  await status("loading");

  if (!data.credentialId) {
    await status("error");
    throw new NonRetriableError("Telegram node: Saved credential is required");
  }
  if (!data.chatId?.trim()) {
    await status("error");
    throw new NonRetriableError("Telegram node: Chat ID is required");
  }
  if (typeof data.text !== "string" || !data.text.trim()) {
    await status("error");
    throw new NonRetriableError("Telegram node: Message text is required");
  }

  let token: string;
  try {
    const credential = await prisma.credential.findFirst({
      where: {
        id: data.credentialId,
        userId: workflowOwnerId,
        type: "TELEGRAM",
      },
      select: { value: true },
    });
    if (!credential) {
      await status("error");
      throw new NonRetriableError("Telegram node: Saved credential not found");
    }
    token = decryptCredentialValue(credential.value);
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
      await status("error");
      throw new NonRetriableError("Telegram node: Saved credential is invalid");
    }
  } catch (error) {
    if (error instanceof NonRetriableError) throw error;
    await status("error");
    throw new NonRetriableError("Telegram node: Saved credential could not be read");
  }

  const text = Handlebars.compile(data.text, { noEscape: true })(context).slice(0, 4096);
  const chatId = data.chatId.trim();
  if (!text.trim()) {
    await status("error");
    throw new NonRetriableError("Telegram node: Message text is required");
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    await status("error");
    throw new Error("Telegram node: Message delivery failed");
  }

  let body: TelegramSendResponse | undefined;
  try {
    body = (await response.json()) as TelegramSendResponse;
  } catch {
    body = undefined;
  }
  if (!response.ok || body?.ok !== true) {
    await status("error");
    throw new NonRetriableError("Telegram node: Message delivery failed");
  }

  await status("success");
  return {
    ...context,
    [data.variableName?.trim() || "telegram"]: {
      sent: true,
      chatId,
      messageId: body.result?.message_id,
    },
  };
};
