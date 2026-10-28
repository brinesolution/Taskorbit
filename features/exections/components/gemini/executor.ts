import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

import prisma from "@/lib/db";
import { getNeonGeminiModel } from "@/lib/neon/ai-gateway";
import type { NodeExecutor } from "../../types";
import { geminiChannel } from "@/inngest/channels/gemini";
import { resolveGeminiPrompt } from "./prompt";
import { createGoogleGeminiModel } from "./model-policy";
import { decryptCredentialValue } from "@/features/credentials/server/encryption";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  return new Handlebars.SafeString(jsonString);
});

export type GeminiData = {
  provider?: "google" | "neon";
  variableName?: string;
  credentialId?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  prompt?: string;
};

export const geminiExecutor: NodeExecutor<GeminiData> = async ({
  data,
  nodeId,
  workflowOwnerId,
  context,
  publish,
}) => {
  await publish(
    geminiChannel().status({
      nodeId,
      status: "loading",
    })
  );

  try {
    if (!data.variableName) {
      throw new NonRetriableError("Gemini node: Variable name is missing");
    }

    const promptTemplate = resolveGeminiPrompt(data);
    if (!promptTemplate) {
      throw new NonRetriableError("Gemini node: User prompt is missing");
    }

    const systemPrompt = data.systemPrompt
      ? Handlebars.compile(data.systemPrompt)(context)
      : "You are a helpful assistant.";

    const userPrompt = Handlebars.compile(promptTemplate)(context);

    // IMPORTANT:
    // Do not use step.run here.
    // This executor already runs inside a step.run from functions.ts.
    const provider = data.provider ?? "google";
    let model;

    if (provider === "neon") {
      try {
        model = getNeonGeminiModel(data.model);
      } catch (error) {
        throw new NonRetriableError(
          error instanceof Error
            ? error.message
            : "Gemini node: Neon AI Gateway is not configured"
        );
      }
    } else {
      if (!data.credentialId) {
        throw new NonRetriableError("Gemini node: Credential is required");
      }

      const credential = await prisma.credential.findFirst({
        where: {
          id: data.credentialId,
          userId: workflowOwnerId,
          type: "GEMINI",
        },
        select: { value: true },
      });

      if (!credential) {
        throw new NonRetriableError(
          "Gemini node: Select a Gemini credential, then save the node and workflow."
        );
      }

      const google = createGoogleGenerativeAI({
        apiKey: decryptCredentialValue(credential.value),
      });
      model = createGoogleGeminiModel(data.model, google);
    }

    const aiResult = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    const text = aiResult.text ?? JSON.stringify(aiResult, null, 2);

    await publish(
      geminiChannel().status({
        nodeId,
        status: "success",
      })
    );

    return {
      ...context,
      [data.variableName]: {
        text,
        aiResponse: text,
      },
    };
  } catch (error) {
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );

    throw error;
  }
};
