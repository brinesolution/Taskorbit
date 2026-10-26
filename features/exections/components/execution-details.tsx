"use client";

import { useSuspenseExecution } from "../hooks/use-executions";
import {
  executionRealtimeIdentityKey,
  NeonExecutionStatus,
} from "./neon-execution-status";

export const ExecutionDetails = ({
  executionId,
  userId,
}: {
  executionId: string;
  userId: string;
}) => {
  const { data } = useSuspenseExecution(executionId);

  const execution = data as {
    id: string;
    status: "RUNNING" | "SUCCESS" | "FAILED";
    startedAt: string | Date;
    workflow: {
      name: string;
    };
    output?: unknown;
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Execution Details</h1>
        <p className="text-muted-foreground">{execution.id}</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="font-semibold">Workflow</p>
        <p>{execution.workflow.name}</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="font-semibold">Status</p>
        <NeonExecutionStatus
          key={executionRealtimeIdentityKey(userId, executionId)}
          executionId={executionId}
          userId={userId}
          initialStatus={execution.status}
        />
      </div>

      <div className="rounded-lg border p-4">
        <p className="font-semibold">Started At</p>
        <p>{new Date(execution.startedAt).toLocaleString()}</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="font-semibold">Output</p>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-sm">
          {JSON.stringify(execution.output ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
};
