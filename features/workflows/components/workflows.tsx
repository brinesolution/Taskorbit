"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVerticalIcon,
  TrashIcon,
  WorkflowIcon,
  PlayIcon,
  ClockIcon,
  GitBranchIcon,
  UploadIcon,
  ArrowRightIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { MAX_PENDING_WORKFLOW_RUNS } from "../constants";
import { useWorkflowsParams } from "../hooks/use-workflows-params";
import {
  useCreateWorkflow,
  useExecuteWorkflow,
  useImportWorkflow,
  useRemoveWorkflow,
  useSuspenseWorkflows,
} from "../hooks/use-workflows";
import {
  type QueuedWorkflowRun,
  WORKFLOW_RUN_DISCOVERY_TIMEOUT_MS,
  WORKFLOW_RUN_STATUS_TIMEOUT_MS,
} from "../hooks/use-workflows";

import { parseWorkflowFile } from "../import-format";
import { workflowTemplates } from "../demo-templates";
import {
  WorkflowBackupSaveItem,
  WorkflowCloudBackupsButton,
} from "./workflow-cloud-backups";

import {
  EntityHeader,
  EntityContainer,
  EntitySearch,
  LoadingView,
  ErrorView,
  EmptyView,
  EntityList,
} from "./entity-components";

type WorkflowItem = {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  nodeCount: number;
  hasManualTrigger: boolean;
  latestExecution: {
    status: "RUNNING" | "SUCCESS" | "FAILED";
    startedAt: Date | string;
  } | null;
};

export const WorkflowsSearch = () => {
  const [params, setParams] = useWorkflowsParams();

  return (
    <EntitySearch
      
      value={params.search}
      onChange={(value) => {
        setParams({
          search: value,
          page: 1,
        });
      }}
      placeholder="Search workflows"
    />
  );
};

export const WorkflowsList = () => {
  const [queuedRuns, setQueuedRuns] = useState<QueuedWorkflowRun[]>([]);
  const activeRunIdsRef = useRef(new Set<string>());
  const [activeRunCount, setActiveRunCount] = useState(0);
  const removeWorkflow = useRemoveWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  const workflows = useSuspenseWorkflows(queuedRuns);
  const items = workflows.data.items as WorkflowItem[];

  useEffect(() => {
    if (queuedRuns.length === 0) return;

    const observedExecutions = workflows.data.pendingExecutions;
    const terminalRuns = queuedRuns.filter((run) =>
      observedExecutions.some(
        (execution) =>
          execution.inngestEventId === run.eventId &&
          execution.status !== "RUNNING",
      ),
    );
    if (terminalRuns.length > 0) {
      terminalRuns.forEach((run) => activeRunIdsRef.current.delete(run.workflowId));
      setActiveRunCount(activeRunIdsRef.current.size);
      const terminalEventIds = new Set(terminalRuns.map((run) => run.eventId));
      setQueuedRuns((current) =>
        current.filter((run) => !terminalEventIds.has(run.eventId)),
      );
    }

    setQueuedRuns((current) => {
      let changed = false;
      const updated = current.map((run) => {
        const execution = observedExecutions.find(
          (item) => item.inngestEventId === run.eventId,
        );
        if (execution?.status === "RUNNING" && !run.discoveredAt) {
          changed = true;
          return { ...run, discoveredAt: Date.now() };
        }
        return run;
      });
      return changed ? updated : current;
    });
  }, [queuedRuns, workflows.data.pendingExecutions]);

  useEffect(() => {
    if (queuedRuns.length === 0) return;

    const timers = queuedRuns.map((run) => {
      const timeout = run.discoveredAt
        ? WORKFLOW_RUN_STATUS_TIMEOUT_MS
        : WORKFLOW_RUN_DISCOVERY_TIMEOUT_MS;
      const start = run.discoveredAt ?? run.queuedAt;

      return window.setTimeout(() => {
        activeRunIdsRef.current.delete(run.workflowId);
        setActiveRunCount(activeRunIdsRef.current.size);
        setQueuedRuns((current) =>
          current.filter((item) => item.eventId !== run.eventId),
        );
        toast.warning(
          run.discoveredAt
            ? "Run status tracking timed out. Check Executions for the latest status."
            : "No execution record appeared yet. Check Executions before retrying.",
        );
      }, Math.max(0, timeout - (Date.now() - start)));
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [queuedRuns]);
  if (items.length === 0) {
    return <WorkflowsEmpty />;
  }

  return (
    <div className="space-y-4">
      {items.map((workflow) => {
        const isExecuting =
          executeWorkflow.isPending && executeWorkflow.variables?.id === workflow.id;
        const queuedRun = queuedRuns.find(
          (run) => run.workflowId === workflow.id,
        );
        const queuedExecution = queuedRun
          ? workflows.data.pendingExecutions.find(
              (execution) => execution.inngestEventId === queuedRun.eventId,
            )
          : undefined;
        const runLimitReached = activeRunCount >= MAX_PENDING_WORKFLOW_RUNS;
        const runDisabled =
          !workflow.hasManualTrigger ||
          executeWorkflow.isPending ||
          Boolean(queuedRun) ||
          runLimitReached;
        const executionLabel = workflow.latestExecution
          ? workflow.latestExecution.status === "SUCCESS"
            ? "Succeeded"
            : workflow.latestExecution.status === "FAILED"
              ? "Failed"
              : "Running"
          : "Not run yet";

        return (
          <div
            key={workflow.id}
            className="taskorbit-card group flex flex-wrap items-center justify-between gap-4 p-5"
          >
            <Link
              href={`/workflows/${workflow.id}`}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-md">
                <WorkflowIcon className="size-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-slate-900">
                  {workflow.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Updated {new Date(workflow.updatedAt).toLocaleDateString()} · Created {new Date(workflow.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="taskorbit-badge-blue flex items-center gap-1">
                    <GitBranchIcon className="size-3" />
                    Nodes: {workflow.nodeCount}
                  </span>
                  <span className="taskorbit-badge-gray flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {workflow.latestExecution
                      ? `Last run: ${executionLabel} · ${new Date(workflow.latestExecution.startedAt).toLocaleString()}`
                      : executionLabel}
                  </span>
                </div>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="taskorbit-button"
                disabled={runDisabled}
                title={
                  !workflow.hasManualTrigger
                    ? "Add a Manual Trigger to run this workflow from the list."
                    : runLimitReached
                      ? `Wait for a tracked run to finish. The limit is ${MAX_PENDING_WORKFLOW_RUNS}.`
                      : undefined
                }
                onClick={() => {
                  if (activeRunIdsRef.current.has(workflow.id)) return;
                  if (activeRunIdsRef.current.size >= MAX_PENDING_WORKFLOW_RUNS) {
                    toast.warning(
                      `Wait for a tracked run to finish. The limit is ${MAX_PENDING_WORKFLOW_RUNS}.`,
                    );
                    return;
                  }

                  activeRunIdsRef.current.add(workflow.id);
                  setActiveRunCount(activeRunIdsRef.current.size);
                  executeWorkflow.mutate(
                    { id: workflow.id },
                    {
                      onSuccess: ({ eventId }) => {
                        setQueuedRuns((current) => [
                          ...current.filter((run) => run.workflowId !== workflow.id),
                          { workflowId: workflow.id, eventId, queuedAt: Date.now() },
                        ]);
                        toast.success("Run queued. Waiting for its execution record.");
                      },
                      onError: (error) => {
                        activeRunIdsRef.current.delete(workflow.id);
                        setActiveRunCount(activeRunIdsRef.current.size);
                        toast.error(error.message || "Could not run workflow.");
                      },
                    },
                  );
                }}
              >
                {queuedRun ? (
                  <Loader2Icon className="mr-1 size-4 animate-spin" />
                ) : isExecuting ? (
                  <Loader2Icon className="mr-1 size-4 animate-spin" />
                ) : (
                  <PlayIcon className="mr-1 size-4" />
                )}
                {queuedRun
                  ? queuedExecution
                    ? "Running…"
                    : "Queued…"
                  : isExecuting
                    ? "Starting…"
                    : "Run"}
              </Button>
              {!workflow.hasManualTrigger && (
                <span className="max-w-48 text-xs text-muted-foreground">
                  Add a Manual Trigger to run from this list.
                </span>
              )}
              {workflow.hasManualTrigger && runLimitReached && !queuedRun && (
                <span role="status" className="max-w-52 text-xs text-muted-foreground">
                  {MAX_PENDING_WORKFLOW_RUNS} runs are being tracked. Wait for one to finish.
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`More actions for ${workflow.name}`}
                  className="inline-flex size-8 items-center justify-center rounded-md hover:bg-white/70"
                >
                  <MoreVerticalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <WorkflowBackupSaveItem workflowId={workflow.id} />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() =>
                      removeWorkflow.mutate(
                        { id: workflow.id },
                        { onError: (error) => toast.error(error.message || "Could not delete workflow.") },
                      )
                    }
                  >
                    <TrashIcon className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
};
const WorkflowImportAction = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const importWorkflow = useImportWorkflow();
  const [error, setError] = useState("");

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const workflow = parseWorkflowFile(await file.text());
      const created = await importWorkflow.mutateAsync(workflow);
      router.push(`/workflows/${created.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to import this workflow."
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".taskorbit.json,.json,application/json"
        aria-label="Import workflow file"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        disabled={importWorkflow.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="mr-2 size-4" />
        {importWorkflow.isPending ? "Importing..." : "Import"}
      </Button>
      {error && (
        <span className="max-w-64 text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export const WorkflowsHeader = ({
  disabled,
}: {
  disabled?: boolean;
}) => {
  const createWorkflow = useCreateWorkflow();

  return (
    <EntityHeader
      title="Workflows"
      description="Create and manage your workflows"
      onNew={() => createWorkflow.mutate()}
      newButtonLabel="New workflow"
      disabled={disabled}
      isCreating={createWorkflow.isPending}
      actions={
        <div className="flex items-center gap-2">
          <WorkflowCloudBackupsButton disabled={disabled} />
          <WorkflowImportAction />
        </div>
      }
    />
  );
};

export const WorkflowsContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <EntityContainer
      header={<WorkflowsHeader />}
      search={<WorkflowsSearch />}
    >
      {children}
    </EntityContainer>
  );
};

export const WorkflowsLoading = () => {
  return <LoadingView entity="workflows" />;
};

export const WorkflowsError = () => {
  return <ErrorView message="Error loading workflows" />;
};

export const WorkflowsEmpty = () => {
  const createWorkflow = useCreateWorkflow();
  const importWorkflow = useImportWorkflow();
  const router = useRouter();

  const addTemplate = async (template: (typeof workflowTemplates)[number]) => {
    try {
      const created = await importWorkflow.mutateAsync({
        format: template.format,
        version: template.version,
        name: template.name,
        graph: template.graph,
      });
      toast.success(`${template.name} added to your workflows`);
      router.push(`/workflows/${created.id}`);
    } catch {
      toast.error("Could not add this workflow. Please try again.");
    }
  };

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-purple-200 bg-white/80 p-6 shadow-lg shadow-purple-500/5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Start with a template
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
              Choose a workflow template, review its steps, then connect your own service credentials before running it.
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-500">
            3 templates
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {workflowTemplates.map((template) => {
            const isAdding = importWorkflow.isPending;
            return (
              <article
                key={template.name}
                className="flex min-h-56 flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/70"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                    <WorkflowIcon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-zinc-100">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                      {template.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {template.integrations.map((integration) => (
                    <span
                      key={integration}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      {integration}
                    </span>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-auto w-full justify-between border-slate-200 bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-900"
                  disabled={isAdding}
                  onClick={() => void addTemplate(template)}
                >
                  {isAdding ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      Adding workflow...
                    </>
                  ) : (
                    <>
                      Use template
                      <ArrowRightIcon className="size-4" />
                    </>
                  )}
                </Button>
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
          Gemini, Discord, and WhatsApp steps need your own credentials before live execution.
        </p>
      </section>

      <EmptyView
        message="Or start with an empty canvas and build your own automation."
        onNew={() => createWorkflow.mutate()}
      />
    </div>
  );
};
