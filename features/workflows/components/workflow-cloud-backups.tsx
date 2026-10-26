"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CloudDownloadIcon,
  CloudUploadIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useImportWorkflow } from "../hooks/use-workflows";
import { parseWorkflowFile } from "../import-format";

type WorkflowBackup = {
  id: string;
  name: string;
  createdAt: string | null;
  sizeBytes: number;
};

async function responseError(response: Response): Promise<string> {
  try {
    const result = (await response.json()) as { error?: string };
    if (result.error) return result.error;
  } catch {
    // Fall back to the local message below.
  }
  return "The backup request failed.";
}

export function WorkflowBackupSaveItem({
  workflowId,
}: {
  workflowId: string;
}) {
  const [saving, setSaving] = useState(false);

  const save = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;

    setSaving(true);
    try {
      const response = await fetch("/api/workflow-backups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });

      if (!response.ok) {
        throw new Error(await responseError(response));
      }

      toast.success("Workflow backup saved to Neon.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save this backup."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenuItem onClick={(event) => void save(event)} disabled={saving}>
      {saving ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <CloudUploadIcon className="mr-2 size-4" />
      )}
      Save cloud backup
    </DropdownMenuItem>
  );
}

export function WorkflowCloudBackupsButton({
  disabled,
}: {
  disabled?: boolean;
}) {
  const router = useRouter();
  const importWorkflow = useImportWorkflow();
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<WorkflowBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadBackups = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workflow-backups");
      if (!response.ok) {
        throw new Error(await responseError(response));
      }

      const result = (await response.json()) as { backups: WorkflowBackup[] };
      setBackups(result.backups);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load cloud backups."
      );
    } finally {
      setLoading(false);
    }
  };

  const openBackups = () => {
    setOpen(true);
    void loadBackups();
  };

  const restore = async (backupId: string) => {
    if (restoringId) return;

    setRestoringId(backupId);
    setError("");
    try {
      const response = await fetch(
        "/api/workflow-backups?backupId=" + encodeURIComponent(backupId)
      );
      if (!response.ok) {
        throw new Error(await responseError(response));
      }

      const result = (await response.json()) as { workflow: unknown };
      const workflow = parseWorkflowFile(JSON.stringify(result.workflow));
      const created = await importWorkflow.mutateAsync(workflow);
      toast.success("Workflow restored from Neon.");
      setOpen(false);
      router.push("/workflows/" + created.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not restore this workflow backup."
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={openBackups}
      >
        <CloudDownloadIcon className="mr-2 size-4" />
        Cloud backups
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Workflow backups</DialogTitle>
          <DialogDescription>
            Private backups are stored in your Neon project and can be restored
            as a new workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading backups...
            </p>
          )}

          {!loading && !error && backups.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No cloud backups yet. Use a workflow menu to save one.
            </p>
          )}

          {!loading &&
            backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{backup.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {backup.createdAt
                      ? new Date(backup.createdAt).toLocaleString()
                      : "Date unavailable"}{" "}
                    · {Math.ceil(backup.sizeBytes / 1024)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={restoringId !== null || importWorkflow.isPending}
                  onClick={() => void restore(backup.id)}
                >
                  {restoringId === backup.id ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "Restore"
                  )}
                </Button>
              </div>
            ))}

          {error && (
            <p className="py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
