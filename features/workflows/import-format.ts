import { z } from "zod";

const workflowNodeTypes = [
  "INITIAL",
  "MANUAL_TRIGGER",
  "GOOGLE_FORM_TRIGGER",
  "STRIPE_TRIGGER",
  "HTTP_REQUEST",
  "GEMINI",
  "OPENAI",
  "DISCORD",
  "SLACK",
  "WHATSAPP",
] as const;

const workflowGraphSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string().min(1).max(120),
          type: z.enum(workflowNodeTypes),
          position: z.object({
            x: z.number().finite().min(-50_000).max(50_000),
            y: z.number().finite().min(-50_000).max(50_000),
          }),
          data: z.record(z.string(), z.unknown()).default({}),
        })
      )
      .max(100),
    edges: z
      .array(
        z.object({
          id: z.string().max(200).optional(),
          source: z.string().min(1).max(120),
          target: z.string().min(1).max(120),
          sourceHandle: z.string().nullable().optional(),
          targetHandle: z.string().nullable().optional(),
        })
      )
      .max(300),
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set<string>();
    graph.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: "Workflow node IDs must be unique.",
        });
      }
      nodeIds.add(node.id);
    });

    const connections = new Set<string>();
    graph.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message: "Every connection must point to an existing node.",
        });
      }
      if (edge.source === edge.target) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message: "A node cannot connect to itself.",
        });
      }
      const key = JSON.stringify([
        edge.source,
        edge.target,
        edge.sourceHandle ?? "main",
        edge.targetHandle ?? "main",
      ]);
      if (connections.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message: "Duplicate connections are not allowed.",
        });
      }
      connections.add(key);
    });
  });

export const workflowImportSchema = z.object({
  format: z.literal("taskorbit.workflow"),
  version: z.literal(1),
  name: z.string().trim().min(1).max(100),
  graph: workflowGraphSchema,
});

export type WorkflowImportFile = z.infer<typeof workflowImportSchema>;

export function stripCredentialReferences(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripCredentialReferences);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      const normalized = key.toLowerCase().replaceAll("_", "");
      if (normalized === "credentialid" || normalized === "webhookurl" || normalized === "haslegacywebhook") return [];
      return [[key, stripCredentialReferences(nested)]];
    })
  );
}

export function parseWorkflowFile(content: string): WorkflowImportFile {
  if (content.length > 1_000_000) {
    throw new Error("Workflow files must be smaller than 1 MB.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  return workflowImportSchema.parse(stripCredentialReferences(parsed));
}

export function createWorkflowFile(
  name: string,
  graph: unknown
): string {
  const cleanGraph = stripCredentialReferences(graph);
  return JSON.stringify(
    workflowImportSchema.parse({
      format: "taskorbit.workflow",
      version: 1,
      name: name.trim() || "Untitled workflow",
      graph: cleanGraph,
    }),
    null,
    2
  );
}
