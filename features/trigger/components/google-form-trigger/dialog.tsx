"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export const GoogleFormTriggerDialog = ({ open, onOpenChange }: Props) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const params = useParams();
  const workflowId = params.workflowId as string;
  const [token, setToken] = useState<string | null>(null);
  const status = useQuery(trpc.workflows.webhookCredentialStatus.queryOptions({ workflowId, provider: "GOOGLE_FORM" }, { enabled: open && Boolean(workflowId) }));
  const rotate = useMutation(trpc.workflows.rotateWebhookCredential.mutationOptions({
    onSuccess: async ({ token: newToken }) => { setToken(newToken); await queryClient.invalidateQueries(trpc.workflows.webhookCredentialStatus.queryFilter({ workflowId, provider: "GOOGLE_FORM" })); toast.success("New webhook secret created. Copy the script now; the secret is shown only once."); },
    onError: (error) => toast.error(error.message),
  }));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const webhookUrl = `${baseUrl}/api/webhooks/google-form?workflowId=${encodeURIComponent(workflowId)}`;
  const script = token ? `function onFormSubmit(e) {\n  const response = e.response;\n  const answers = {};\n  response.getItemResponses().forEach(item => { answers[item.getItem().getTitle()] = item.getResponse(); });\n  const payload = { formId: e.source.getId(), formTitle: e.source.getTitle(), responseId: response.getId(), timestamp: response.getTimestamp(), respondentEmail: response.getRespondentEmail(), responses: answers };\n  UrlFetchApp.fetch(${JSON.stringify(webhookUrl)}, { method: "post", contentType: "application/json", headers: { Authorization: ${JSON.stringify(`Bearer ${token}`)} }, payload: JSON.stringify(payload), muteHttpExceptions: true });\n}` : "Create or rotate the secret to generate the authenticated script.";
  const copy = async (value: string, label: string) => { try { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); } catch { toast.error(`Could not copy ${label.toLowerCase()}`); } };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Google Forms Trigger Configuration</DialogTitle><DialogDescription>Connect a Google Form using an authenticated Apps Script trigger.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{status.data?.configured ? "Secret configured. Rotate to replace it." : "Create a unique secret before installing the script."}</p><Button type="button" variant="outline" onClick={() => rotate.mutate({ workflowId, provider: "GOOGLE_FORM" })} disabled={rotate.isPending}><RefreshCw className="mr-2 size-4" />{status.data?.configured ? "Rotate secret" : "Create secret"}</Button></div>
      <div className="space-y-2"><p className="text-sm font-medium">Webhook URL</p><div className="flex gap-2"><code className="flex-1 break-all rounded-md bg-muted p-3 text-xs">{webhookUrl}</code><Button type="button" size="icon" variant="outline" onClick={() => copy(webhookUrl, "URL")}><CopyIcon className="size-4" /></Button></div></div>
      <div className="space-y-2"><p className="text-sm font-medium">Apps Script</p><pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{script}</pre><Button type="button" variant="outline" disabled={!token} onClick={() => copy(script, "Script")}><CopyIcon className="mr-2 size-4" />Copy authenticated script</Button></div>
      {token && <p className="text-xs text-amber-700">The script includes a one-time bearer secret. Store it privately in Apps Script and replace the trigger script after rotation; the prior secret is revoked immediately.</p>}
      <div className="rounded-lg bg-muted p-4"><h4 className="mb-2 text-sm font-medium">Install</h4><ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground"><li>Open the Google Form, then Extensions → Apps Script.</li><li>Paste and save the script above.</li><li>In Triggers, add <code>onFormSubmit</code> for From form → On form submit.</li><li>Authorize the script when Google prompts.</li></ol></div>
      <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Variables: <code>{"{{googleForm.respondentEmail}}"}</code>, <code>{"{{googleForm.responses['Question Name']}}"}</code>, <code>{"{{json googleForm.responses}}"}</code></div>
    </div>
  </DialogContent></Dialog>;
};
