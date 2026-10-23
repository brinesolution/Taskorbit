"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLineIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleDotIcon,
  Clock3Icon,
  CreditCardIcon,
  GitBranchIcon,
  GlobeIcon,
  MessageSquareIcon,
  SparklesIcon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react";

import {
  serializeWorkflowTemplate,
  workflowTemplates,
} from "../demo-templates";
import type { WorkflowTemplate } from "../demo-templates";

type WorkflowNode = WorkflowTemplate["graph"]["nodes"][number];
type NodeCopy = { label: string; purpose: string };

const nodeCopy: Partial<Record<WorkflowNode["type"], NodeCopy>> = {
  MANUAL_TRIGGER: {
    label: "Manual trigger",
    purpose: "Starts when someone runs the workflow from the workspace.",
  },
  GOOGLE_FORM_TRIGGER: {
    label: "Google Forms",
    purpose: "Starts when a new form response arrives.",
  },
  STRIPE_TRIGGER: {
    label: "Stripe payment",
    purpose: "Starts when Stripe reports a successful payment.",
  },
  HTTP_REQUEST: {
    label: "HTTP request",
    purpose: "Calls an endpoint and passes its response to the next step.",
  },
  GEMINI: {
    label: "Gemini summary",
    purpose: "Turns the incoming data into a concise, useful summary.",
  },
  DISCORD: {
    label: "Discord message",
    purpose: "Sends the finished result to a team Discord channel.",
  },
  WHATSAPP: {
    label: "WhatsApp message",
    purpose: "Sends a payment notification to a WhatsApp number.",
  },
  OPENAI: {
    label: "OpenAI",
    purpose: "Processes the incoming data with an AI model.",
  },
  SLACK: {
    label: "Slack message",
    purpose: "Sends the finished result to a Slack channel.",
  },
  INITIAL: {
    label: "Workflow start",
    purpose: "Marks where this workflow begins.",
  },
};

const nodeIcons: Partial<Record<WorkflowNode["type"], typeof WorkflowIcon>> = {
  MANUAL_TRIGGER: ZapIcon,
  GOOGLE_FORM_TRIGGER: CircleDotIcon,
  STRIPE_TRIGGER: CreditCardIcon,
  HTTP_REQUEST: GlobeIcon,
  GEMINI: SparklesIcon,
  DISCORD: MessageSquareIcon,
  WHATSAPP: MessageSquareIcon,
  OPENAI: SparklesIcon,
  SLACK: MessageSquareIcon,
  INITIAL: WorkflowIcon,
};

function getNodeCopy(node: WorkflowNode): NodeCopy {
  return nodeCopy[node.type] ?? {
    label: node.type.replaceAll("_", " ").toLowerCase(),
    purpose: "Passes workflow data to the next connected step.",
  };
}

function downloadTemplate(template: WorkflowTemplate) {
  const file = new Blob([serializeWorkflowTemplate(template)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  const filename = template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  link.href = url;
  link.download = `${filename}.taskorbit.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function WorkflowPicker({
  selected,
  onSelect,
  compact = false,
}: {
  selected: WorkflowTemplate;
  onSelect: (template: WorkflowTemplate) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "flex gap-2 overflow-x-auto pb-1" : "space-y-1"}
      role="group"
      aria-label="Demo workflows"
    >
      {workflowTemplates.map((template, index) => {
        const isSelected = template.name === selected.name;
        return (
          <button
            key={template.name}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(template)}
            className={[
              "group text-left transition",
              compact
                ? "min-w-56 rounded-xl border px-3 py-3"
                : "flex w-full items-start gap-3 rounded-xl px-3 py-3",
              isSelected
                ? "border-violet-400/30 bg-violet-400/10 text-white"
                : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
            ].join(" ")}
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <span className="text-xs font-semibold">0{index + 1}</span>
            </span>
            <span className="block min-w-0">
              <span className="block text-sm font-medium leading-5">
                {template.name}
              </span>
              <span className="mt-1 block text-xs text-zinc-500">
                {template.graph.nodes.length} steps
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WorkflowCanvas({
  template,
  activeNodeId,
  onSelectNode,
}: {
  template: WorkflowTemplate;
  activeNodeId: string;
  onSelectNode: (id: string) => void;
}) {
  return (
    <section
      aria-label="Workflow canvas preview"
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0d12]"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Workflow canvas</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Select a step to inspect what it does.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400">
          Read-only preview
        </span>
      </div>

      <div className="overflow-x-auto bg-[radial-gradient(#27272a_1px,transparent_1px)] bg-[size:20px_20px] p-5 sm:p-7">
        <div className="flex w-max min-w-full items-center gap-3">
          {template.graph.nodes.map((node, index) => {
            const copy = getNodeCopy(node);
            const Icon = nodeIcons[node.type] ?? WorkflowIcon;
            const isSelected = node.id === activeNodeId;

            return (
              <div key={node.id} className="flex items-center gap-3">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectNode(node.id)}
                  className={[
                    "w-56 rounded-xl border p-4 text-left transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                    isSelected
                      ? "border-violet-400/70 bg-zinc-900 shadow-lg shadow-violet-950/40"
                      : "border-zinc-800 bg-zinc-950/90 hover:border-zinc-600",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-violet-300">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      STEP 0{index + 1}
                    </span>
                  </div>
                  <span className="mt-4 block text-sm font-medium text-zinc-100">
                    {copy.label}
                  </span>
                  <span className="mt-1 block min-h-10 text-xs leading-5 text-zinc-500">
                    {copy.purpose}
                  </span>
                </button>
                {index < template.graph.nodes.length - 1 && (
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-zinc-600"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
        <GitBranchIcon className="size-3.5" />
        {template.graph.edges.length} connected steps
      </div>
    </section>
  );
}

function NodeInspector({
  template,
  node,
}: {
  template: WorkflowTemplate;
  node: WorkflowNode;
}) {
  const copy = getNodeCopy(node);
  const Icon = nodeIcons[node.type] ?? WorkflowIcon;
  const stepIndex = template.graph.nodes.findIndex((item) => item.id === node.id);

  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Step details
        </span>
        <span className="text-xs text-zinc-500">
          {String(stepIndex + 1).padStart(2, "0")} / {String(template.graph.nodes.length).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-5 flex size-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-violet-300">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{copy.label}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{copy.purpose}</p>

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Used by this workflow
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.integrations.map((integration) => (
            <span
              key={integration}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400"
            >
              {integration}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-5 text-zinc-500">
        <Clock3Icon className="mt-0.5 size-3.5 shrink-0" />
        Templates include no personal credentials. Add your own service keys
        before running this workflow.
      </div>
    </aside>
  );
}

export function DemoWorkspace() {
  const [selectedName, setSelectedName] = useState(workflowTemplates[0].name);
  const selectedTemplate =
    workflowTemplates.find((template) => template.name === selectedName) ??
    workflowTemplates[0];
  const [selectedNodeId, setSelectedNodeId] = useState(
    selectedTemplate.graph.nodes[0]?.id ?? "",
  );
  const selectedNode =
    selectedTemplate.graph.nodes.find((node) => node.id === selectedNodeId) ??
    selectedTemplate.graph.nodes[0];

  const selectTemplate = (template: WorkflowTemplate) => {
    setSelectedName(template.name);
    setSelectedNodeId(template.graph.nodes[0]?.id ?? "");
  };

  return (
    <div className="flex min-h-svh bg-[#08090d] text-zinc-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-[#0b0c11] md:flex">
        <Link href="/" className="flex h-16 items-center gap-3 border-b border-zinc-800 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <WorkflowIcon className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-wide">TaskOrbit</span>
        </Link>

        <div className="px-4 pt-6">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Workspace
          </p>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200">
            <WorkflowIcon className="size-4 text-violet-300" />
            Demo workspace
          </div>
        </div>

        <div className="px-4 pt-8">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Workflow templates
          </p>
          <div className="mt-2">
            <WorkflowPicker selected={selectedTemplate} onSelect={selectTemplate} />
          </div>
        </div>

        <div className="mt-auto border-t border-zinc-800 px-5 py-4">
          <p className="text-xs text-zinc-500">Created by</p>
          <p className="mt-1 text-sm font-medium text-zinc-300">Mayank Lohani</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-zinc-800 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-zinc-400 md:hidden">
            <WorkflowIcon className="size-4 text-violet-300" /> TaskOrbit
          </div>
          <span className="hidden text-sm text-zinc-500 md:block">
            Public demo workspace
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-violet-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
            >
              Create account
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                TaskOrbit workspace
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Workflow builder
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Explore working automation templates and inspect how each step
                passes data through the flow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadTemplate(selectedTemplate)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <ArrowDownToLineIcon className="size-4" />
              Download workflow
            </button>
          </div>

          <div className="mt-7 md:hidden">
            <WorkflowPicker
              compact
              selected={selectedTemplate}
              onSelect={selectTemplate}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-5">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-zinc-100">
                  {selectedTemplate.name}
                </h2>
                <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400">
                  Template preview
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {selectedTemplate.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTemplate.integrations.map((integration) => (
                <span
                  key={integration}
                  className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-400"
                >
                  {integration}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <WorkflowCanvas
              template={selectedTemplate}
              activeNodeId={selectedNode?.id ?? ""}
              onSelectNode={setSelectedNodeId}
            />
            {selectedNode && (
              <NodeInspector template={selectedTemplate} node={selectedNode} />
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              <p className="text-zinc-400">
                Download a template to import it into your TaskOrbit workspace.
                Connected services need your credentials before execution.
              </p>
            </div>
            <Link
              href="/login"
              className="shrink-0 text-sm font-medium text-violet-300 hover:text-violet-200"
            >
              Sign in to build <ArrowRightIcon className="ml-1 inline size-3.5" />
            </Link>
          </div>

          <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-800 pt-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <span>TaskOrbit · Created by Mayank Lohani</span>
            <span>Templates are examples; live runs use your connected accounts.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
