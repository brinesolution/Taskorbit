"use client";

import Link from "next/link";
import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCredentialsByType } from "@/features/credentials/hooks/use-credentials";

const formSchema = z.object({
  variableName: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  credentialId: z.string().min(1, "Select a saved Discord credential"),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(2000, "Discord messages cannot exceed 2000 characters"),
  username: z.string().optional(),
});

export type DiscordFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DiscordFormValues) => void;
  defaultValues?: Partial<DiscordFormValues>;
  hasLegacyWebhook?: boolean;
}

type CredentialOption = { id: string; name: string; type?: string };

export const DiscordDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
  hasLegacyWebhook = false,
}: Props) => {
  const {
    data: credentials = [],
    isLoading: isLoadingCredentials,
    isError: credentialsError,
    refetch: refetchCredentials,
  } = useCredentialsByType("DISCORD");
  const options = credentials as CredentialOption[];

  const form = useForm<DiscordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "myDiscord",
      credentialId: defaultValues.credentialId || "",
      content: defaultValues.content || "",
      username: defaultValues.username || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "myDiscord",
        credentialId: defaultValues.credentialId || "",
        content: defaultValues.content || "",
        username: defaultValues.username || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "myDiscord";

  const handleSubmit = (values: DiscordFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const credentialStatus = isLoadingCredentials
    ? "Loading saved Discord credentials…"
    : credentialsError
      ? "Saved Discord credentials could not be loaded."
      : options.length === 0
        ? "No saved Discord credentials are available."
        : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discord Configuration</DialogTitle>
          <DialogDescription>
            Configure which saved Discord webhook this node uses and the message it sends.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {hasLegacyWebhook && !form.watch("credentialId") && (
              <p className="text-sm text-destructive" role="alert">
                This node has an older webhook setting. It is hidden for security;
                select a saved Discord credential to replace it before saving.
              </p>
            )}

            <FormField
              control={form.control}
              name="credentialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saved Discord credential</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoadingCredentials || credentialsError || options.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full" aria-label="Saved Discord credential">
                        <SelectValue placeholder="Select a saved Discord credential" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((credential) => (
                        <SelectItem key={credential.id} value={credential.id}>
                          {credential.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {credentialStatus ? (
                    <div className="space-y-2" role="status" aria-live="polite">
                      <p className="text-sm text-muted-foreground">{credentialStatus}</p>
                      {credentialsError && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void refetchCredentials()}
                        >
                          Retry
                        </Button>
                      )}
                      <p className="text-sm">
                        <Link className="underline" href="/credentials/new">
                          Open credential settings to add a Discord credential
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <FormDescription>
                      The webhook URL stays encrypted in credential settings and is not stored in this workflow.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="variableName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variable Name</FormLabel>
                  <FormControl>
                    <Input placeholder="myDiscord" {...field} />
                  </FormControl>
                  <FormDescription>
                    Reference the result in other nodes: {`{{${watchVariableName}.text}}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Summary: {{myGemini.text}}"
                      className="min-h-[100px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The message to send. Use variables like {" {{myGemini.text}}"}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Username (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Workflow Bot" {...field} />
                  </FormControl>
                  <FormDescription>
                    Override the webhook default username.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isLoadingCredentials || credentialsError || options.length === 0}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
