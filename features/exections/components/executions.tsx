"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { useSuspenseExecutions } from "../hooks/use-executions";
import { useExecutionsParams } from "../hooks/use-executions-params";

type ExecutionItem = {
  id: string;
  status: string;
  startedAt: Date | string;
  workflow: {
    name: string;
  };
};

export const ExecutionsContainer = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Executions</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
};

export const ExecutionsList = () => {
  const { data } = useSuspenseExecutions();
  const [params, setParams] = useExecutionsParams();
  const items = data.items as ExecutionItem[];
  const hasFilters = Boolean(params.search) || params.status !== "ALL";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search executions by workflow"
            className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"
            placeholder="Search workflow names"
            value={params.search}
            onChange={(event) =>
              setParams({ search: event.target.value, page: 1 })
            }
          />
        </label>
        <select
          aria-label="Filter executions by status"
          className="h-11 rounded-xl border bg-background px-3 text-sm"
          value={params.status}
          onChange={(event) =>
            setParams({ status: event.target.value, page: 1 })
          }
        >
          <option value="ALL">All statuses</option>
          <option value="RUNNING">Running</option>
          <option value="SUCCESS">Successful</option>
          <option value="FAILED">Failed</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {data.totalCount} {data.totalCount === 1 ? "run" : "runs"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {hasFilters
            ? "No executions match these filters."
            : "No executions found yet. Run a workflow to see its history here."}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((execution) => (
            <Link
              key={execution.id}
              href={`/execution/${execution.id}`}
              className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{execution.workflow.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(String(execution.startedAt)).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    execution.status === "SUCCESS"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : execution.status === "FAILED"
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {execution.status.toLowerCase()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const ExecutionsLoading = () => {
  return <div>Loading...</div>;
};

export const ExecutionsError = () => {
  return <div>Error</div>;
};