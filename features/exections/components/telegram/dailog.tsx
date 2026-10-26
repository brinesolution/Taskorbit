"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCredentialsByType } from "@/features/credentials/hooks/use-credentials";

const variableNameSchema = z.string().max(64, "Variable name cannot exceed 64 characters")
  .regex(/^$|^[A-Za-z_$][A-Za-z0-9_$]*$/, "Use a valid variable name or leave this blank");

const formSchema = z.object({
  credentialId: z.string().min(1, "Select a saved Telegram credential"),
  chatId: z.string().trim().min(1, "Chat ID is required").max(256, "Chat ID is too long")
    .refine((value) => /^-?\d+$/.test(value) || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value), {
      message: "Enter a numeric chat ID or a public channel username such as @my_channel",
    }),
  text: z.string().trim().min(1, "Message text is required")
    .max(4096, "Telegram messages cannot exceed 4096 characters"),
  variableName: variableNameSchema,
});

export type TelegramFormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TelegramFormValues) => void;
  defaultValues?: Partial<TelegramFormValues>;
};

type CredentialOption = { id: string; name: string; type?: string };

export const TelegramDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const {
    data: credentials = [],
    isLoading: isLoadingCredentials,
    isError: credentialsError,
    refetch: refetchCredentials,
  } = useCredentialsByType("TELEGRAM");
  const options = credentials as CredentialOption[];

  const form = useForm<TelegramFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credentialId: defaultValues.credentialId || "",
      chatId: defaultValues.chatId || "",
      text: defaultValues.text || "",
      variableName: defaultValues.variableName || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        credentialId: defaultValues.credentialId || "",
        chatId: defaultValues.chatId || "",
        text: defaultValues.text || "",
        variableName: defaultValues.variableName || "",
      });
    }
  }, [open, defaultValues, form]);

  const credentialStatus = isLoadingCredentials
    ? "Loading saved Telegram credentials."
    : credentialsError
      ? "Saved Telegram credentials could not be loaded."
      : options.length === 0
        ? "No saved Telegram credentials are available."
        : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Telegram Configuration</DialogTitle>
          <DialogDescription>
            Choose a saved bot credential and configure the destination and message.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="credentialId" render={({ field }) => (
              <FormItem>
                <FormLabel>Saved Telegram credential</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}
                  disabled={isLoadingCredentials || credentialsError || options.length === 0}>
                  <FormControl>
                    <SelectTrigger className="w-full" aria-label="Saved Telegram credential">
                      <SelectValue placeholder="Select a saved Telegram credential" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((credential) => (
                      <SelectItem key={credential.id} value={credential.id}>{credential.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {credentialStatus ? (
                  <div className="space-y-2" role="status" aria-live="polite">
                    <p className="text-sm text-muted-foreground">{credentialStatus}</p>
                    {credentialsError && <Button type="button" variant="outline" size="sm" onClick={() => void refetchCredentials()}>Retry</Button>}
                    <p className="text-sm"><Link className="underline" href="/credentials/new">Open credential settings to add a Telegram credential</Link></p>
                  </div>
                ) : (
                  <FormDescription>The bot token remains in secure credential settings and is not stored in this workflow.</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="chatId" render={({ field }) => (
              <FormItem>
                <FormLabel>Chat ID</FormLabel>
                <FormControl><Input placeholder="123456789 or @my_channel" autoComplete="off" {...field} /></FormControl>
                <FormDescription>Use a numeric user/group ID or a public channel username beginning with @. The bot must be allowed to message that chat.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="text" render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl><Textarea placeholder="Hello from my workflow" className="min-h-[120px]" maxLength={4096} {...field} /></FormControl>
                <FormDescription>Supports workflow variables such as {"{{myGemini.text}}"}. Telegram text messages have a 4096-character limit.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="variableName" render={({ field }) => (
              <FormItem>
                <FormLabel>Result variable (optional)</FormLabel>
                <FormControl><Input placeholder="myTelegram" autoComplete="off" {...field} /></FormControl>
                <FormDescription>Set a variable name if later nodes need to reference this send result.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="submit" disabled={isLoadingCredentials || credentialsError || options.length === 0}>Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
