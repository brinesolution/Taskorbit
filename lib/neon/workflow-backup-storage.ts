import "server-only";

import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

import {
  MAX_WORKFLOW_BACKUP_BYTES,
  WORKFLOW_BACKUP_BUCKET,
  createWorkflowBackupId,
  workflowBackupDisplayName,
  workflowBackupIdFromKey,
  workflowBackupKey,
  workflowBackupPrefix,
} from "./workflow-backup-keys";

export class ObjectStorageNotConfiguredError extends Error {
  constructor() {
    super("Neon Object Storage is not configured for this branch.");
    this.name = "ObjectStorageNotConfiguredError";
  }
}

export class WorkflowBackupNotFoundError extends Error {
  constructor() {
    super("Workflow backup not found.");
    this.name = "WorkflowBackupNotFoundError";
  }
}

function createFilesClient() {
  const requiredVariables = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ENDPOINT_URL_S3",
    "AWS_REGION",
  ] as const;

  if (requiredVariables.some((name) => !process.env[name])) {
    throw new ObjectStorageNotConfiguredError();
  }

  return new Files({
    adapter: neon({ bucket: WORKFLOW_BACKUP_BUCKET }),
  });
}

let filesClient: ReturnType<typeof createFilesClient> | undefined;

function getFilesClient() {
  filesClient ??= createFilesClient();
  return filesClient;
}

export type WorkflowBackupSummary = {
  id: string;
  name: string;
  createdAt: string | null;
  sizeBytes: number;
};

export async function listWorkflowBackups(
  userId: string
): Promise<WorkflowBackupSummary[]> {
  const result = await getFilesClient().list({
    prefix: workflowBackupPrefix(userId),
    limit: 100,
  });

  return result.items
    .flatMap((item) => {
      const id = workflowBackupIdFromKey(userId, item.key);
      if (!id) {
        return [];
      }

      return [
        {
          id,
          name: workflowBackupDisplayName(id),
          createdAt: item.lastModified
            ? new Date(item.lastModified).toISOString()
            : null,
          sizeBytes: item.size,
        },
      ];
    })
    .sort((left, right) => {
      return (
        (right.createdAt ? Date.parse(right.createdAt) : 0) -
        (left.createdAt ? Date.parse(left.createdAt) : 0)
      );
    });
}

export async function saveWorkflowBackup(
  userId: string,
  name: string,
  content: string
): Promise<WorkflowBackupSummary> {
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes > MAX_WORKFLOW_BACKUP_BYTES) {
    throw new Error("Workflow files must be smaller than 1 MB.");
  }

  const id = createWorkflowBackupId(name);
  const uploaded = await getFilesClient().upload(
    workflowBackupKey(userId, id),
    content,
    {
      contentType: "application/json",
      metadata: {
        workflowName: name.slice(0, 100),
      },
    }
  );

  return {
    id,
    name: workflowBackupDisplayName(id),
    createdAt: uploaded.lastModified
      ? new Date(uploaded.lastModified).toISOString()
      : new Date().toISOString(),
    sizeBytes: uploaded.size,
  };
}

export async function readWorkflowBackup(
  userId: string,
  backupId: string
): Promise<string> {
  const files = getFilesClient();
  const key = workflowBackupKey(userId, backupId);
  if (!(await files.exists(key))) {
    throw new WorkflowBackupNotFoundError();
  }

  const file = await files.download(key);
  if (file.size > MAX_WORKFLOW_BACKUP_BYTES) {
    throw new Error("Stored workflow backup exceeds the 1 MB limit.");
  }

  const content = await file.text();
  if (Buffer.byteLength(content, "utf8") > MAX_WORKFLOW_BACKUP_BYTES) {
    throw new Error("Stored workflow backup exceeds the 1 MB limit.");
  }

  return content;
}
