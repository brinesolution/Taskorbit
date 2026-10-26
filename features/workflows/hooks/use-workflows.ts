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

export const useSuspenseWorkflows = () => {
  const trpc = useTRPC();
  const [params] = useWorkflowsParams();
  const queryOptions = trpc.workflows.getMany.queryOptions({
    ...DEFAULT_PARAMS,
    ...params,
  });

  return useSuspenseQuery({
    ...queryOptions,
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (workflow) => workflow.latestExecution?.status === "RUNNING",
      )
        ? 2_000
        : false,
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
