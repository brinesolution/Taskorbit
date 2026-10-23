"use client";

import { useRef, useState } from "react";
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

import { useWorkflowsParams } from "../hooks/use-workflows-params";
import {
  useCreateWorkflow,
  useImportWorkflow,
  useRemoveWorkflow,
  useSuspenseWorkflows,
} from "../hooks/use-workflows";

import { parseWorkflowFile } from "../import-format";
import { workflowTemplates } from "../demo-templates";

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
  const removeWorkflow = useRemoveWorkflow();
  const workflows = useSuspenseWorkflows();

  const items = workflows.data.items as WorkflowItem[];

  if (items.length === 0) {
    return <WorkflowsEmpty />;
  }

  return (
    <div className="space-y-4">
      {items.map((workflow) => (
        <a
          key={workflow.id}
          href={`/workflows/${workflow.id}`}
          className="taskorbit-card group flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-4">
            <div className="size-11 rounded-xl bg-white shadow-md flex items-center justify-center">
              <WorkflowIcon className="size-5 text-purple-600" />
            </div>

            <div>
              <h3 className="font-bold text-lg text-slate-900">
                {workflow.name}
              </h3>

              <p className="text-sm text-muted-foreground">
                Updated {new Date(workflow.updatedAt).toLocaleDateString()} •
                Created {new Date(workflow.createdAt).toLocaleDateString()}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="taskorbit-badge-green">
                  Active
                </span>

                <span className="taskorbit-badge-blue flex items-center gap-1">
                  <GitBranchIcon className="size-3" />
                  Steps: 12
                </span>

                <span className="taskorbit-badge-gray flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  Last Run: 5 mins ago
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2"
          >
            <Button
              size="sm"
              className="taskorbit-button hidden md:flex"
            >
              <PlayIcon className="mr-1 size-4" />
              Run
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md hover:bg-white/70">
                <MoreVerticalIcon className="size-4" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    removeWorkflow.mutate({
                      id: workflow.id,
                    });
                  }}
                >
                  <TrashIcon className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </a>
      ))}
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
      actions={<WorkflowImportAction />}
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
      toast.success(`${template.name} added to your workspace`);
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
              Start with a demo workflow
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
              Add a ready-made flow to your workspace, inspect the steps, and connect your own service credentials.
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
