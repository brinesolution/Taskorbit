import { NonRetriableError } from "inngest";
import type { NodeType } from "@prisma/client";

import { inngest } from "./client";
import prisma from "../lib/db";
import { planWorkflowExecution } from "./utils";
import { getExecutor } from "../lib/executor-registry";

import { httpRequestChannel } from "./channels/http-request";
import { manualTriggerChannel } from "./channels/manual-trigger";
import { googleFormTriggerChannel } from "./channels/google-form-trigger";
import { stripeTriggerChannel } from "./channels/stripe-trigger";
import { geminiChannel } from "./channels/gemini";
import { discordChannel } from "./channels/discord";
import { telegramChannel } from "./channels/telegram";
import { prepareWhatsAppNodeDataForExecution } from "@/features/workflows/whatsapp-legacy";

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    retries: 0,
  },
  {
    event: "workflows/execute.workflow",
    channels: [
      httpRequestChannel(),
      manualTriggerChannel(),
      googleFormTriggerChannel(),
      stripeTriggerChannel(),
      geminiChannel(),
      discordChannel(),
      telegramChannel(),
    ],
  },
  async ({ event, step, publish }) => {
    const workflowId = event.data.workflowId;

    if (!workflowId) {
      throw new NonRetriableError("Workflow ID is missing");
    }

    const execution = await step.run("create-execution", async () => {
      return await prisma.execution.create({
        data: {
          workflowId,
          status: "RUNNING",
          inngestEventId: event.id ?? "",
          startedAt: new Date(),
        },
      });
    });

    try {
      const sortedNodes = await step.run("prepare-workflow", async () => {
        const workflow = await prisma.workflow.findUniqueOrThrow({
          where: {
            id: workflowId,
          },
          include: {
            nodes: true,
            connections: true,
          },
        });

        const plan = planWorkflowExecution(
          workflow.nodes,
          workflow.connections,
          event.data,
        );
        const nodes = plan.nodes.map((node) => {
          if (node.type === "TELEGRAM") {
            const storedData = (node.data as Record<string, unknown>) ?? {};
            const data = Object.fromEntries(
              ["credentialId", "chatId", "text", "variableName"]
                .filter((key) => typeof storedData[key] === "string")
                .map((key) => [key, storedData[key]])
            );
            return { ...node, data };
          }
          if (node.type === "WHATSAPP") {
            return {
              ...node,
              data: prepareWhatsAppNodeDataForExecution(
                (node.data as Record<string, unknown>) ?? {},
              ),
            };
          }
          if (node.type !== "DISCORD") return node;
          const data = { ...((node.data as Record<string, unknown>) ?? {}) };
          const hasLegacyWebhook = typeof data.webhookUrl === "string" && data.webhookUrl.length > 0;
          delete data.webhookUrl;
          delete data.hasLegacyWebhook;
          if (hasLegacyWebhook) data.hasLegacyWebhook = true;
          return { ...node, data };
        });

        return {
          nodes,
          initialData: plan.initialData,
          workflowId: workflow.id,
          workflowOwnerId: workflow.userId,
        };
      });

      let context: Record<string, unknown> = sortedNodes.initialData;

      for (const node of sortedNodes.nodes) {
        console.log("Executing node:", node.type, node.id);

        const executor = getExecutor(node.type as NodeType);

        context = await step.run(
          `execute-${node.type}-${node.id}`,
          async () => {
            console.log("RUNNING EXECUTOR:", node.type);

            return await executor({
              data: node.data as Record<string, unknown>,
              nodeId: node.id,
              workflowId: sortedNodes.workflowId,
              workflowOwnerId: sortedNodes.workflowOwnerId,
              context,
              step,
              publish,
            });
          }
        );
      }

      await step.run("complete-execution", async () => {
        return await prisma.execution.update({
          where: {
            id: execution.id,
          },
          data: {
            status: "SUCCESS",
            output: context as object,
            completedAt: new Date(),
          },
        });
      });

      return {
        success: true,
        workflowId,
        executionId: execution.id,
        result: context,
      };
    } catch (error) {
      await step.run("fail-execution", async () => {
        return await prisma.execution.update({
          where: {
            id: execution.id,
          },
          data: {
            status: "FAILED",
            error:
              error instanceof Error
                ? error.message
                : "Unknown error",
            errorStack:
              error instanceof Error ? error.stack : null,
            completedAt: new Date(),
          },
        });
      });

      throw error;
    }
  }
);
