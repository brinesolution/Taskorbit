"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; nodeId?: string };

export const StripeTriggerDialog = ({ open, onOpenChange }: Props) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const params = useParams();
  const workflowId = params.workflowId as string;
  const [token, setToken] = useState<string | null>(null);
  const status = useQuery(trpc.workflows.webhookCredentialStatus.queryOptions({ workflowId, provider: "STRIPE" }, { enabled: open && Boolean(workflowId) }));
  const rotate = useMutation(trpc.workflows.rotateWebhookCredential.mutationOptions({
    onSuccess: async ({ token: newToken }) => { setToken(newToken); await queryClient.invalidateQueries(trpc.workflows.webhookCredentialStatus.queryFilter({ workflowId, provider: "STRIPE" })); toast.success("New webhook secret created. Copy it now; it is shown only once."); },
    onError: (error) => toast.error(error.message),
  }));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const webhookUrl = token ? `${baseUrl}/api/webhooks/stripe?workflowId=${encodeURIComponent(workflowId)}&token=${encodeURIComponent(token)}` : "Create or rotate the secret to reveal your endpoint URL";
  const copy = async () => { try { await navigator.clipboard.writeText(webhookUrl); toast.success("Endpoint URL copied"); } catch { toast.error("Could not copy endpoint URL"); } };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Stripe Trigger Configuration</DialogTitle><DialogDescription>Configure this endpoint in Stripe to start the workflow for selected events.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{status.data?.configured ? "Secret configured. Rotate to replace the existing endpoint secret." : "Create a unique endpoint secret before connecting Stripe."}</p><Button type="button" variant="outline" onClick={() => rotate.mutate({ workflowId, provider: "STRIPE" })} disabled={rotate.isPending}><RefreshCw className="mr-2 size-4" />{status.data?.configured ? "Rotate secret" : "Create secret"}</Button></div>
      <div className="space-y-2"><Label>Stripe endpoint URL</Label><div className="flex items-center gap-2"><code className="flex-1 break-all rounded-md bg-muted p-3 text-xs">{webhookUrl}</code><Button type="button" variant="outline" size="icon" onClick={copy} disabled={!token}><CopyIcon className="size-4" /></Button></div></div>
      {token && <p className="text-xs text-amber-700">This URL contains the secret. Save it in Stripe now; it cannot be recovered. Rotating invalidates the previous endpoint immediately.</p>}
      <div className="rounded-lg bg-muted p-4"><h4 className="mb-2 text-sm font-medium">Setup</h4><ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground"><li>In Stripe Dashboard, open Developers → Webhooks and add an endpoint.</li><li>Paste the complete URL above, including its token, and select event types.</li><li>Save the endpoint. Stripe&apos;s native signature header is not used by this endpoint; the unique high-entropy URL token authenticates requests.</li></ol></div>
      <div className="rounded-lg bg-muted p-4"><h4 className="mb-2 text-sm font-medium">Available variables</h4><ul className="space-y-1 text-sm text-muted-foreground"><li><code>{"{{stripe.amount}}"}</code> payment amount</li><li><code>{"{{stripe.currency}}"}</code> currency code</li><li><code>{"{{stripe.customerId}}"}</code> customer ID</li><li><code>{"{{stripe.eventType}}"}</code> event type</li><li><code>{"{{json stripe}}"}</code> event payload</li></ul></div>
    </div>
  </DialogContent></Dialog>;
};
