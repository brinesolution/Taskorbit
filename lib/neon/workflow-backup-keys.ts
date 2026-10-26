import { randomUUID } from "node:crypto";

export const WORKFLOW_BACKUP_BUCKET = "assets";
export const MAX_WORKFLOW_BACKUP_BYTES = 1_000_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKUP_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_[a-z0-9](?:[a-z0-9-]{0,59})?$/i;

export function workflowBackupPrefix(userId: string): string {
  if (!userId) {
    throw new Error("A user ID is required to scope workflow backups.");
  }

  const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");
  return "workflow-backups/" + encodedUserId + "/";
}

export function createWorkflowBackupId(
  name: string,
  uuid = randomUUID()
): string {
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error("A workflow backup ID must use a UUID.");
  }

  const slug =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "workflow";

  return uuid + "_" + slug;
}

export function isWorkflowBackupId(value: string): boolean {
  return BACKUP_ID_PATTERN.test(value);
}

export function workflowBackupKey(
  userId: string,
  backupId: string
): string {
  if (!isWorkflowBackupId(backupId)) {
    throw new Error("Invalid workflow backup ID.");
  }

  return workflowBackupPrefix(userId) + backupId + ".json";
}

export function workflowBackupIdFromKey(
  userId: string,
  key: string
): string | null {
  const prefix = workflowBackupPrefix(userId);
  if (!key.startsWith(prefix) || !key.endsWith(".json")) {
    return null;
  }

  const backupId = key.slice(prefix.length, -".json".length);
  return isWorkflowBackupId(backupId) ? backupId : null;
}

export function workflowBackupDisplayName(backupId: string): string {
  if (!isWorkflowBackupId(backupId)) {
    return "Workflow backup";
  }

  const slug = backupId.slice(37).replaceAll("-", " ");
  return slug.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
