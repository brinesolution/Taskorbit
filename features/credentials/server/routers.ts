import prisma from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { encryptCredentialValue } from "./encryption";

const credentialTypes = [
  "OPENAI",
  "ANTHROPIC",
  "GEMINI",
  "DISCORD",
  "WHATSAPP",
  "TELEGRAM",
  "STRIPE",
] as const;

export const credentialsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        type: z.enum(credentialTypes),
        value: z.string().min(1, "Value is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name, type, value } = input;

      return prisma.credential.create({
        data: {
          name,
          type,
          value: encryptCredentialValue(value),
          userId: ctx.auth.user.id,
        },
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.credential.delete({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
        select: {
          id: true,
          name: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name is required"),
        type: z.enum(credentialTypes),
        value: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, name, type, value } = input;

      return prisma.$transaction(async (tx) => {
        const current = await tx.credential.findFirstOrThrow({
          where: {
            id,
            userId: ctx.auth.user.id,
          },
          select: { type: true },
        });

        if (current.type !== type && !value?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A new secret is required when changing credential type.",
          });
        }

        return tx.credential.update({
          where: {
            id,
            userId: ctx.auth.user.id,
          },
          data: {
            name,
            type,
            ...(value?.trim() ? { value: encryptCredentialValue(value) } : {}),
          },
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const credential = await prisma.credential.findUniqueOrThrow({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...credential,
        hasValue: true,
      };
    }),

  getMany: protectedProcedure
  .input(
    z.object({
      page: z.number().default(1),
      pageSize: z.number().default(10),
      search: z.string().default(""),
    })
  )
  .query(async ({ input, ctx }) => {
    const where = {
      userId: ctx.auth.user.id,
      name: {
        contains: input.search,
        mode: "insensitive" as const,
      },
    };

    const [items, total] = await Promise.all([
      prisma.credential.findMany({
        where,
        orderBy: {
          updatedAt: "desc",
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.credential.count({ where }),
    ]);

    return {
      items,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }),

  getByType: protectedProcedure
    .input(
      z.object({
        type: z.enum(credentialTypes),
      })
    )
    .query(async ({ input, ctx }) => {
      const { type } = input;

      const credentials = await prisma.credential.findMany({
        where: {
          type,
          userId: ctx.auth.user.id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      return credentials;
    }),
});
