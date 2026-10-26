import { Suspense } from "react";
import { type SearchParams } from "nuqs";

import { HydrateClient } from "@/trpc/server";

import { executionsParamsLoader } from "@/features/exections/server/params-loader";
import { prefetchExecutions } from "@/features/exections/server/prefetch";

import {
  ExecutionsContainer,
  ExecutionsList,
  ExecutionsLoading,
  ExecutionsErrorBoundary,
} from "@/features/exections/components/executions";

type Props = {
  searchParams: Promise<SearchParams>;
};

const Page = async ({ searchParams }: Props) => {
  const params = await executionsParamsLoader(searchParams);

  prefetchExecutions(params);

  return (
    <HydrateClient>
      <ExecutionsErrorBoundary>
        <Suspense fallback={<ExecutionsLoading />}>
          <ExecutionsContainer>
            <ExecutionsList />
          </ExecutionsContainer>
        </Suspense>
      </ExecutionsErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
