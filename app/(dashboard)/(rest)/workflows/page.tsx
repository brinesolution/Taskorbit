import { Suspense } from "react";

import {
  WorkflowsContainer,
  WorkflowsList,
  WorkflowsErrorBoundary,
} from "@/features/workflows/components/workflows";

import { LoadingView } from "@/features/workflows/components/entity-components";

const Page = () => {
  return (
      <WorkflowsErrorBoundary>
        <Suspense fallback={<LoadingView message="Loading workflows..." />}>
          <WorkflowsContainer>
            <WorkflowsList />
          </WorkflowsContainer>
        </Suspense>
      </WorkflowsErrorBoundary>
  );
};

export default Page;
