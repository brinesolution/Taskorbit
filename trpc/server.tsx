import "server-only";
import { headers } from "next/headers";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import {
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { cache } from "react";

import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: async () => {
    return createTRPCContext({
      headers: await headers(),
    });
  },
  router: appRouter,
  queryClient: getQueryClient,
});

export const caller = appRouter.createCaller(async () => {
  return createTRPCContext({
    headers: await headers(),
  });
});

export function HydrateClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

type QueryOptions = Parameters<ReturnType<typeof makeQueryClient>["prefetchQuery"]>[0];
type InfiniteQueryOptions = Parameters<
  ReturnType<typeof makeQueryClient>["prefetchInfiniteQuery"]
>[0];
type PrefetchOptions = { queryKey: readonly unknown[] };

export function prefetch(queryOptions: PrefetchOptions) {
  const queryClient = getQueryClient();
  const metadata = queryOptions.queryKey[1];
  const isInfiniteQuery =
    typeof metadata === "object" &&
    metadata !== null &&
    "type" in metadata &&
    metadata.type === "infinite";

  if (isInfiniteQuery) {
    void queryClient.prefetchInfiniteQuery(
      queryOptions as unknown as InfiniteQueryOptions
    );
  } else {
    void queryClient.prefetchQuery(queryOptions as unknown as QueryOptions);
  }
}
