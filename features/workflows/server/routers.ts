import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Node, Edge } from "@xyflow/react";
import { generateSlug } from "random-word-slugs";
import { randomUUID } from "node:crypto";
import { createWebhookToken, hashWebhookToken } from "@/features/trigger/server/webhook-token";
import {
  stripCredentialReferences,
  workflowImportSchema,
} from "../import-format";
import { MAX_PENDING_WORKFLOW_RUNS } from "../constants";
const NodeType = {
  INITIAL: "INITIAL",
  MANUAL_TRIGGER: "MANUAL_TRIGGER",
  GOOGLE_FORM_TRIGGER: "GOOGLE_FORM_TRIGGER",
  STRIPE_TRIGGER: "STRIPE_TRIGGER",
  HTTP_REQUEST: "HTTP_REQUEST",
  GEMINI: "GEMINI",
  DISCORD: "DISCORD",
  WHATSAPP: "WHATSAPP",
  OPENAI: "OPENAI",
  SLACK: "SLACK",
} as const;

type NodeTypeValue = (typeof NodeType)[keyof typeof NodeType];
import prisma from "@/lib/db";
import { PAGINATION } from "@/config/constants";
import { inngest } from "@/inngest/client";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";

export const workflowsRouter = createTRPCRouter({
  webhookCredentialStatus: protectedProcedure
    .input(z.object({ workflowId: z.string(), provider: z.enum(["STRIPE", "GOOGLE_FORM"]) }))
    .query(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirstOrThrow({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
      });
      const triggerType = input.provider === "STRIPE" ? "STRIPE_TRIGGER" : "GOOGLE_FORM_TRIGGER";
      const trigger = await prisma.node.findFirst({ where: { workflowId: workflow.id, type: triggerType } });
      if (!trigger) throw new Error("Add the matching trigger node before configuring its webhook.");
      const credential = await prisma.workflowWebhookCredential.findUnique({
        where: { workflowId_provider: { workflowId: workflow.id, provider: input.provider } },
        select: { id: true },
      });
      return { configured: Boolean(credential) };
    }),

  rotateWebhookCredential: protectedProcedure
    .input(z.object({ workflowId: z.string(), provider: z.enum(["STRIPE", "GOOGLE_FORM"]) }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirstOrThrow({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
      });
      const triggerType = input.provider === "STRIPE" ? "STRIPE_TRIGGER" : "GOOGLE_FORM_TRIGGER";
      const trigger = await prisma.node.findFirst({ where: { workflowId: workflow.id, type: triggerType } });
      if (!trigger) throw new Error("Add the matching trigger node before configuring its webhook.");
      const token = createWebhookToken();
      await prisma.workflowWebhookCredential.upsert({
        where: { workflowId_provider: { workflowId: workflow.id, provider: input.provider } },
        create: { workflowId: workflow.id, provider: input.provider, tokenHash: hashWebhookToken(token) },
        update: { tokenHash: hashWebhookToken(token) },
      });
      return { token };
    }),

  execute: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workflow =
        await prisma.workflow.findFirstOrThrow({
          where: {
            id: input.id,
            userId: ctx.auth.user.id,
          },
        });

      const manualTrigger = await prisma.node.findFirst({
        where: { workflowId: workflow.id, type: "MANUAL_TRIGGER" },
        select: { id: true },
      });
      if (!manualTrigger) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add a Manual Trigger to run this workflow manually.",
        });
      }

      console.log("EXECUTING WORKFLOW:", workflow.id);

      const { ids } = await inngest.send({
        name: "workflows/execute.workflow",
        data: {
          workflowId: workflow.id,
        },
      });

      const eventId = ids[0];
      if (!eventId) throw new Error("Workflow run could not be queued.");

      return {
        success: true,
        workflowId: workflow.id,
        eventId,
      };
    }),

  create: protectedProcedure.mutation(({ ctx }) => {
    return prisma.workflow.create({
      data: {
        name: generateSlug(3),
        userId: ctx.auth.user.id,
        nodes: {
          create: {
            type: NodeType.INITIAL,
            position: { x: 0, y: 0 },
            name: "Initial",
          },
        },
      },
    });
  }),

  importWorkflow: protectedProcedure
    .input(workflowImportSchema)
    .mutation(async ({ ctx, input }) => {
      const importedNodeIds = new Map<string, string>(
        input.graph.nodes.map((node) => [node.id, randomUUID()] as const)
      );

      return prisma.$transaction(async (tx: any) => {
        const workflow = await tx.workflow.create({
          data: {
            name: input.name.trim(),
            userId: ctx.auth.user.id,
          },
        });

        if (input.graph.nodes.length > 0) {
          await tx.node.createMany({
            data: input.graph.nodes.map((node) => ({
              id: importedNodeIds.get(node.id)!,
              workflowId: workflow.id,
              name: node.type,
              type: node.type as NodeTypeValue,
              position: node.position,
              data: JSON.parse(
                JSON.stringify(stripCredentialReferences(node.data))
              ),
            })),
          });
        }

        if (input.graph.edges.length > 0) {
          await tx.connection.createMany({
            data: input.graph.edges.map((edge) => ({
              workflowId: workflow.id,
              fromNodeId: importedNodeIds.get(edge.source)!,
              toNodeId: importedNodeIds.get(edge.target)!,
              fromOutput: edge.sourceHandle ?? "main",
              toInput: edge.targetHandle ?? "main",
            })),
          });
        }

        return { id: workflow.id, name: workflow.name };
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.delete({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        nodes: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            position: z.object({
              x: z.number(),
              y: z.number(),
            }),
            data: z.record(z.string(), z.unknown()).optional(),
          })
        ),
        edges: z.array(
          z.object({
            source: z.string(),
            target: z.string(),
            sourceHandle: z.string().nullish(),
            targetHandle: z.string().nullish(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, nodes, edges } = input;

      await prisma.workflow.findFirstOrThrow({
        where: {
          id,
          userId: ctx.auth.user.id,
        },
      });

      return await prisma.$transaction(async (tx: any) => {
        console.log("NODES:", nodes);
        console.log("EDGES:", edges);

        await tx.connection.deleteMany({
          where: {
            workflowId: id,
          },
        });

        await tx.node.deleteMany({
          where: {
            workflowId: id,
          },
        });

        await tx.node.createMany({
          data: nodes.map((node) => ({
            id: node.id,
            workflowId: id,
            name: node.type || "unknown",
            type: node.type as NodeTypeValue,
            position: node.position,
           data: JSON.parse(JSON.stringify(node.data ?? {})),
          })),
        });

        await tx.connection.createMany({
          data: edges.map((edge) => ({
            workflowId: id,
            fromNodeId: edge.source,
            toNodeId: edge.target,
            fromOutput: edge.sourceHandle ?? "main",
            toInput: edge.targetHandle ?? "main",
          })),
        });

        return tx.workflow.update({
          where: {
            id,
          },
          data: {
            updatedAt: new Date(),
          },
          include: {
            nodes: true,
            connections: true,
          },
        });
      });
    }),

  updateName: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
      })
    )
    .mutation(({ ctx, input }) => {
      return prisma.workflow.update({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
        data: {
          name: input.name,
        },
      });
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow =
        await prisma.workflow.findFirstOrThrow({
          where: {
            id: input.id,
            userId: ctx.auth.user.id,
          },
          include: {
            nodes: true,
            connections: true,
          },
        });

      const nodes: Node[] = workflow.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: node.position as {
          x: number;
          y: number;
        },
        data: (node.data as Record<string, unknown>) || {},
      }));
const edges: Edge[] = workflow.connections.map(
  (connection: any) => ({
    id: connection.id,
    source: connection.fromNodeId,
    target: connection.toNodeId,
    sourceHandle: connection.fromOutput,
    targetHandle: connection.toInput,
  })
);

      return {
        id: workflow.id,
        name: workflow.name,
        nodes,
        edges,
      };
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().default(""),
        pendingEventIds: z
          .array(z.string())
          .max(MAX_PENDING_WORKFLOW_RUNS)
          .default([]),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, pendingEventIds } = input;

      const [items, totalCount] = await Promise.all([
        prisma.workflow.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: {
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          include: {
            nodes: { select: { type: true } },
            executions: {
              take: 1,
              orderBy: { startedAt: "desc" },
              select: { status: true, startedAt: true },
            },
          },
        }),

        prisma.workflow.count({
          where: {
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        }),
      ]);

      const pendingExecutions = pendingEventIds.length
        ? await prisma.execution.findMany({
            where: {
              inngestEventId: { in: pendingEventIds },
              workflow: { is: { userId: ctx.auth.user.id } },
            },
            select: {
              inngestEventId: true,
              status: true,
            },
          })
        : [];

      return {
        items: items.map(({ nodes, executions, ...workflow }) => ({
          ...workflow,
          nodeCount: nodes.length,
          hasManualTrigger: nodes.some((node) => node.type === "MANUAL_TRIGGER"),
          latestExecution: executions[0] ?? null,
        })),
        pendingExecutions,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    }),
});
