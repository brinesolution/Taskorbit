"use client";

import { useTRPC } from "@/trpc/client";
import { PAGINATION } from "@/config/constants";

import {
  useMutation,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useWorkflowsParams } from "./use-workflows-params";

const DEFAULT_PARAMS = {
  page: PAGINATION.DEFAULT_PAGE,
  pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
  search: "",
};

export const WORKFLOW_RUN_DISCOVERY_TIMEOUT_MS = 60_000;
export const WORKFLOW_RUN_STATUS_TIMEOUT_MS = 10 * 60_000;

export type QueuedWorkflowRun = {
  workflowId: string;
  eventId: string;
  queuedAt: number;
  discoveredAt?: number;
};

export const useSuspenseWorkflows = (queuedRuns: QueuedWorkflowRun[] = []) => {
  const trpc = useTRPC();
  const [params] = useWorkflowsParams();
  const queryOptions = trpc.workflows.getMany.queryOptions({
    ...DEFAULT_PARAMS,
    ...params,
    ...(queuedRuns.length > 0
      ? { pendingEventIds: queuedRuns.map((run) => run.eventId) }
      : {}),
  });

  return useSuspenseQuery({
    ...queryOptions,
    refetchInterval: (query) => {
      const waitingForQueuedExecution = queuedRuns.some((run) => {
        const execution = query.state.data?.pendingExecutions.find(
          (pending) => pending.inngestEventId === run.eventId,
        );
        if (execution && execution.status !== "RUNNING") return false;

        const startedAt = run.discoveredAt ?? run.queuedAt;
        const timeout = run.discoveredAt
          ? WORKFLOW_RUN_STATUS_TIMEOUT_MS
          : WORKFLOW_RUN_DISCOVERY_TIMEOUT_MS;
        return Date.now() - startedAt < timeout;
      });

      return waitingForQueuedExecution ? 2_000 : false;
    },
  });
};

export const useCreateWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.workflows.getMany.queryFilter()
        );
      },
    })
  );
};

export const useImportWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.importWorkflow.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.workflows.getMany.queryFilter()
        );
      },
    })
  );
};

export const useRemoveWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.workflows.getMany.queryFilter()
        );
      },
    })
  );
};

/**
 * Hook to fetch a single workflow using suspense
 */
export const useSuspenseWorkflow = (
  id: string
) => {
  const trpc = useTRPC();

  return useSuspenseQuery(
    trpc.workflows.getOne.queryOptions({
      id,
    })
  );
};



export const useUpdateWorkflowName = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.updateName.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.workflows.getMany.queryFilter()
        );
      },
      onError: (error) => {
        console.error(error.message);
      },
    })
  );
};



export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.workflows.getMany.queryFilter()
        );
      },
      onError: (error) => {
        console.error(error.message);
      },
    })
  );
};


export const useExecuteWorkflow = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.execute.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.workflows.getMany.queryFilter(),
        );
      },
    })
  );
};
