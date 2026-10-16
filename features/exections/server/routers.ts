import prisma from "@/lib/db";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";

import { PAGINATION } from "@/config/constants";

export const executionsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(({ ctx, input }) => {
      return prisma.execution.findFirstOrThrow({
        where: {
          id: input.id,
          workflow: {
            userId: ctx.auth.user.id,
          },
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().trim().max(100).default(""),
        status: z.enum(["ALL", "RUNNING", "SUCCESS", "FAILED"]).catch("ALL"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status } = input;

      const where = {
        status: status === "ALL" ? undefined : status,
        workflow: {
          userId: ctx.auth.user.id,
          ...(search
            ? {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              }
            : {}),
        },
      };

      const [items, totalCount] = await Promise.all([
        prisma.execution.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: {
            startedAt: "desc",
          },
          include: {
            workflow: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),

        prisma.execution.count({
          where,
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        totalCount,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),
});