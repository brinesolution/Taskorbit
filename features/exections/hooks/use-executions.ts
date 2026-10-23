"use client";

import { useTRPC } from "@/trpc/client";
import {
  useSuspenseQuery,
} from "@tanstack/react-query";

import { useExecutionsParams } from "./use-executions-params";
import { normalizeExecutionStatus } from "../params";

export const useSuspenseExecutions = () => {
  const trpc = useTRPC();
  const [rawParams] = useExecutionsParams();
  const params = {
    ...rawParams,
    status: normalizeExecutionStatus(rawParams.status),
  };

  return useSuspenseQuery(
    trpc.executions.getMany.queryOptions(params)
  );
};




export const useSuspenseExecution = (executionId: string) => {
  const trpc = useTRPC();

  return useSuspenseQuery(
    trpc.executions.getOne.queryOptions({
      id: executionId,
    })
  );
};
