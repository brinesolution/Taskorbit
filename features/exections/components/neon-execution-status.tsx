"use client";

import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import { useCallback, useEffect, useState } from "react";

import type { ExecutionRealtimeRow } from "@/lib/neon/execution-realtime";

interface LiveBootstrap {
  executionId: string;
  sealedQuery: SealedLiveQuery<ExecutionRealtimeRow>;
  realtimeUrl: string;
}

export function executionRealtimeIdentityKey(userId: string, executionId: string) {
  return `${userId}:${executionId}`;
}

interface NeonExecutionStatusProps {
  executionId: string;
  userId: string;
  initialStatus: ExecutionRealtimeRow["status"];
  initialError?: string | null;
}

let sessionChangeReloadStarted = false;

function reloadForSessionChange() {
  if (sessionChangeReloadStarted) return;
  sessionChangeReloadStarted = true;
  window.location.reload();
}

async function fetchLiveBootstrap(
  executionId: string,
  userId: string,
): Promise<LiveBootstrap> {
  const response = await fetch(
    `/api/executions/${encodeURIComponent(executionId)}/live`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    },
  );
  if (response.status === 401) {
    reloadForSessionChange();
    throw new Error("Session changed");
  }
  const payload = (await response.json()) as
    | LiveBootstrap
    | { error?: string };

  if (!response.ok || !("sealedQuery" in payload)) {
    throw new Error("Could not open live execution status");
  }

  return { ...payload, executionId };
}

export function NeonExecutionStatus({
  executionId,
  userId,
  initialStatus,
  initialError,
}: NeonExecutionStatusProps) {
  const [request, setRequest] = useState<
    | { executionId: string; status: "ready"; bootstrap: LiveBootstrap }
    | { executionId: string; status: "error" }
  >();

  useEffect(() => {
    let cancelled = false;

    void fetchLiveBootstrap(executionId, userId).then(
      (result) => {
        if (!cancelled) {
          setRequest({ executionId, status: "ready", bootstrap: result });
        }
      },
      () => {
        if (!cancelled) {
          setRequest({ executionId, status: "error" });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [executionId, userId]);

  const currentRequest =
    request?.executionId === executionId ? request : undefined;

  if (currentRequest?.status !== "ready") {
    return (
      <div>
        <p>{initialStatus}</p>
        <p className="text-sm text-muted-foreground" role="status">
          {currentRequest?.status === "error"
            ? "Live status is unavailable. Showing the last saved status."
            : "Connecting to live status…"}
        </p>
        {initialStatus === "FAILED" && initialError ? (
          <p className="mt-2 text-sm text-destructive">{initialError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <ExecutionStatusSubscription
      key={currentRequest.bootstrap.sealedQuery.queryFingerprint}
      bootstrap={currentRequest.bootstrap}
      executionId={executionId}
      userId={userId}
      initialStatus={initialStatus}
      initialError={initialError}
    />
  );
}

function ExecutionStatusSubscription({
  bootstrap,
  executionId,
  userId,
  initialStatus,
  initialError,
}: NeonExecutionStatusProps & { bootstrap: LiveBootstrap }) {
  // This component mounts only after the browser fetched the public Realtime URL.
  const [client] = useState(() =>
    createRealtimeClient({ url: bootstrap.realtimeUrl }),
  );

  return (
    <RealtimeProvider client={client}>
      <LiveExecutionStatus
        bootstrap={bootstrap}
        executionId={executionId}
        userId={userId}
        initialStatus={initialStatus}
        initialError={initialError}
      />
    </RealtimeProvider>
  );
}

function LiveExecutionStatus({
  bootstrap,
  executionId,
  userId,
  initialStatus,
  initialError,
}: NeonExecutionStatusProps & { bootstrap: LiveBootstrap }) {
  const refreshQuery = useCallback(async () => {
    const renewed = await fetchLiveBootstrap(executionId, userId);
    return renewed.sealedQuery;
  }, [executionId, userId]);

  const { data, status: liveQueryStatus } = useLiveQuery(bootstrap.sealedQuery, {
    refreshQuery,
  });
  const execution = data?.[0];
  const status = execution?.status ?? initialStatus;
  const error = execution?.error ?? (status === "FAILED" ? initialError : null);

  return (
    <div>
      <p>{status}</p>
      <p className="text-sm text-muted-foreground" role="status">
        {liveQueryStatus === "error"
          ? "Live updates stopped. Showing the last saved status."
          : liveQueryStatus === "stale"
            ? "Refreshing live status…"
            : "Live status connected"}
      </p>
      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
