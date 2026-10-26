import { Suspense } from "react";

import { HydrateClient } from "@/trpc/server";

import { prefetchWorkflow } from "@/features/workflows/server/prefetch";

import {
  Editor,
  EditorErrorBoundary,
  EditorLoading,
} from "@/features/editor/components/editor";

interface PageProps {
  params: Promise<{
    workflowId: string;
  }>;
}

const Page = async ({ params }: PageProps) => {
  const { workflowId } = await params;

  prefetchWorkflow(workflowId);

  return (
    <HydrateClient>
      <EditorErrorBoundary>
        <Suspense fallback={<EditorLoading />}>
          <Editor workflowId={workflowId} />
        </Suspense>
      </EditorErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
