import { Suspense } from "react";

import { ExecutionDetails } from "@/features/exections/components/execution-details";
import { requireAuth } from "@/lib/auth-utils";

interface PageProps {
  params: Promise<{
    executionId: string;
  }>;
}

const Page = async ({ params }: PageProps) => {
  const { executionId } = await params;
  const session = await requireAuth();

  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ExecutionDetails executionId={executionId} userId={session.user.id} />
    </Suspense>
  );
};

export default Page;
