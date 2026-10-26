import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ObjectStorageNotConfiguredError,
  WorkflowBackupNotFoundError,
  listWorkflowBackups,
  readWorkflowBackup,
  saveWorkflowBackup,
} from "@/lib/neon/workflow-backup-storage";
import {
  InvalidWorkflowBackupRequestError,
  readWorkflowBackupRequestJson,
  WorkflowBackupRequestTooLargeError,
} from "@/lib/neon/workflow-backup-request";
import { sanitizeWorkflowBackupValue } from "@/lib/neon/workflow-backup-sanitizer";
import { createWorkflowFile, parseWorkflowFile } from "@/features/workflows/import-format";

export const runtime = "nodejs";

const saveRequestSchema = z.object({
  workflowId: z.string().min(1).max(120),
});

async function getUserId(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return session?.user.id ?? null;
}

function failureResponse(error: unknown): NextResponse {
  if (error instanceof ObjectStorageNotConfiguredError) {
    return NextResponse.json(
      { error: error.message },
      { status: 503 }
    );
  }

  if (error instanceof WorkflowBackupNotFoundError) {
    return NextResponse.json(
      { error: "Workflow backup not found." },
      { status: 404 }
    );
  }

  if (
    error instanceof Error &&
    error.message.includes("smaller than 1 MB")
  ) {
    return NextResponse.json({ error: error.message }, { status: 413 });
  }

  return NextResponse.json(
    { error: "Neon workflow backup storage is unavailable." },
    { status: 502 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Sign in to access backups." }, { status: 401 });
    }

    const backupId = request.nextUrl.searchParams.get("backupId");
    if (backupId) {
      const content = await readWorkflowBackup(userId, backupId);
      const workflow = sanitizeWorkflowBackupValue(parseWorkflowFile(content));
      return NextResponse.json({ workflow });
    }

    const backups = await listWorkflowBackups(userId);
    return NextResponse.json({ backups });
  } catch (error) {
    return failureResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Sign in to save backups." }, { status: 401 });
    }

    const body = await readWorkflowBackupRequestJson(request);
    const input = saveRequestSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "A valid workflow ID is required." },
        { status: 400 }
      );
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: input.data.workflowId,
        userId,
      },
      include: {
        nodes: true,
        connections: true,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found." },
        { status: 404 }
      );
    }

    const graph = sanitizeWorkflowBackupValue({
      nodes: workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })),
      edges: workflow.connections.map((connection) => ({
        id: connection.id,
        source: connection.fromNodeId,
        target: connection.toNodeId,
        sourceHandle: connection.fromOutput,
        targetHandle: connection.toInput,
      })),
    });
    const content = createWorkflowFile(workflow.name, graph);

    parseWorkflowFile(content);

    const backup = await saveWorkflowBackup(userId, workflow.name, content);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkflowBackupRequestTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }

    if (error instanceof InvalidWorkflowBackupRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "This workflow cannot be saved as a portable backup." },
        { status: 422 }
      );
    }

    return failureResponse(error);
  }
}
