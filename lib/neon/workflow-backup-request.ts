export const MAX_WORKFLOW_BACKUP_REQUEST_BYTES = 2_048;

export class WorkflowBackupRequestTooLargeError extends Error {
  constructor() {
    super("Backup requests must be smaller than 2 KB.");
    this.name = "WorkflowBackupRequestTooLargeError";
  }
}

export class InvalidWorkflowBackupRequestError extends Error {
  constructor() {
    super("Backup request must contain valid JSON.");
    this.name = "InvalidWorkflowBackupRequestError";
  }
}

/** Reads at most the configured number of bytes before decoding or parsing JSON. */
export async function readWorkflowBackupRequestJson(
  request: Request
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (
      Number.isSafeInteger(declaredBytes) &&
      declaredBytes > MAX_WORKFLOW_BACKUP_REQUEST_BYTES
    ) {
      throw new WorkflowBackupRequestTooLargeError();
    }
  }

  if (!request.body) {
    throw new InvalidWorkflowBackupRequestError();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WORKFLOW_BACKUP_REQUEST_BYTES) {
        await reader.cancel();
        throw new WorkflowBackupRequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidWorkflowBackupRequestError();
  }
}
