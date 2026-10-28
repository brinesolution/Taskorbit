"use client";

import { useRef } from "react";

import { DownloadIcon, SaveIcon } from "lucide-react";
import { useAtomValue } from "jotai";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  useSuspenseWorkflow,
  useUpdateWorkflow,
  useUpdateWorkflowName,
} from "@/features/workflows/hooks/use-workflows";

import { editorAtom } from "../store/atoms";
import { createWorkflowFile } from "@/features/workflows/import-format";

export const EditorExportButton = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  const editor = useAtomValue(editorAtom);
  const { data: workflow } = useSuspenseWorkflow(workflowId);

  const handleExport = () => {
    if (!editor || !workflow) return;
    const graph = {
      nodes: editor.getNodes().map((node) => ({
        id: node.id,
        type: node.type ?? "INITIAL",
        position: { x: node.position.x, y: node.position.y },
        data: (node.data ?? {}) as Record<string, unknown>,
      })),
      edges: editor.getEdges().map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      })),
    };
    const file = new Blob([createWorkflowFile(workflow.name, graph)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      (workflow.name.trim() || "taskorbit-workflow")
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-|-$/g, "") + ".taskorbit.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={!editor}>
      <DownloadIcon className="mr-2 size-4" />
      Export
    </Button>
  );
};

export const EditorSaveButton = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  const editor = useAtomValue(editorAtom);
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) return;

   const nodes = editor.getNodes().map((node) => ({
  id: node.id,
  type: node.type ?? "INITIAL",
  position: {
    x: node.position.x,
    y: node.position.y,
  },
  data: (node.data ?? {}) as Record<string, unknown>,
}));

    const edges = editor.getEdges().map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle:
        edge.sourceHandle ?? null,
      targetHandle:
        edge.targetHandle ?? null,
    }));

    saveWorkflow.mutate({
      id: workflowId,
      nodes,
      edges,
    });
  };

  return (
    <div className="ml-auto">
      <Button
        onClick={handleSave}
        disabled={saveWorkflow.isPending}
      >
        <SaveIcon className="size-4 mr-2" />
        {saveWorkflow.isPending
          ? "Saving workflow..."
          : "Save workflow"}
      </Button>
    </div>
  );
};

export const EditorNameInput = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  const { data: workflow } =
    useSuspenseWorkflow(workflowId);

  const updateName =
    useUpdateWorkflowName();

  const inputRef =
    useRef<HTMLInputElement>(null);
  const saveRequested = useRef(false);

  const handleSave = () => {
    const trimmedName = inputRef.current?.value.trim() ?? "";

    if (
      saveRequested.current ||
      updateName.isPending ||
      !trimmedName ||
      trimmedName === workflow?.name
    ) {
      return;
    }

    saveRequested.current = true;
    updateName.mutate(
      {
        id: workflowId,
        name: trimmedName,
      },
      { onSettled: () => { saveRequested.current = false; } },
    );
  };

  return (
    <Input
      key={workflow?.name}
      ref={inputRef}
      defaultValue={workflow?.name ?? ""}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleSave();
          inputRef.current?.blur();
        }
      }}
      aria-label="Workflow name"
      disabled={updateName.isPending}
      className="
        border-none
        shadow-none
        p-0
        h-auto
        min-w-0
        w-full
        text-lg
        font-semibold
        focus-visible:ring-0
        max-w-[300px]
      "
    />
  );
};

export const EditorBreadcrumbs = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Breadcrumb className="shrink-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/workflows">
              Workflows
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator />
        </BreadcrumbList>
      </Breadcrumb>

      <EditorNameInput
        workflowId={workflowId}
      />
    </div>
  );
};

export const EditorHeader = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  return (
    <header
      className="
        flex
        min-h-14
        shrink-0
        flex-wrap
        items-center
        gap-2
        border-b
        px-3
        py-2
        bg-background
        sm:px-4
      "
    >
      <SidebarTrigger />

      <div
        className="
          flex
          min-w-0
          flex-1
          flex-col
          gap-2
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <EditorBreadcrumbs
          workflowId={workflowId}
        />

        <div className="flex shrink-0 items-center justify-end gap-2">
          <EditorExportButton workflowId={workflowId} />
          <EditorSaveButton workflowId={workflowId} />
        </div>
      </div>
    </header>
  );
};
