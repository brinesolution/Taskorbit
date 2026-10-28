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

const variableNameSchema = z.string().trim().max(64, "Variable name cannot exceed 64 characters")
  .regex(/^$|^[A-Za-z_$][A-Za-z0-9_$]*$/, "Use a valid variable name or leave this blank");

const formSchema = z.object({
  credentialId: z.string().min(1, "Select a saved WhatsApp credential"),
  phoneNumberId: z.string().trim().min(1, "Phone Number ID is required").max(128, "Phone Number ID is too long"),
  to: z.string().trim().min(1, "Recipient phone number is required").max(32, "Recipient phone number is too long"),
  message: z.string().trim().min(1, "Message is required").max(4000, "WhatsApp text messages cannot exceed 4000 characters"),
  variableName: variableNameSchema,
});

export type WhatsAppFormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WhatsAppFormValues) => void;
  defaultValues?: Partial<WhatsAppFormValues>;
  hasLegacyAccessToken?: boolean;
};

type CredentialOption = { id: string; name: string; type?: string };

export const WhatsAppDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
  hasLegacyAccessToken = false,
}: Props) => {
  const {
    data: credentials = [],
    isLoading: isLoadingCredentials,
    isError: credentialsError,
    refetch: refetchCredentials,
  } = useCredentialsByType("WHATSAPP");
  const options = credentials as CredentialOption[];

  const form = useForm<WhatsAppFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credentialId: defaultValues.credentialId || "",
      phoneNumberId: defaultValues.phoneNumberId || "",
      to: defaultValues.to || "",
      message: defaultValues.message || "",
      variableName: defaultValues.variableName || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        credentialId: defaultValues.credentialId || "",
        phoneNumberId: defaultValues.phoneNumberId || "",
        to: defaultValues.to || "",
        message: defaultValues.message || "",
        variableName: defaultValues.variableName || "",
      });
    }
  }, [open, defaultValues, form]);

  const credentialStatus = isLoadingCredentials
    ? "Loading saved WhatsApp credentials."
    : credentialsError
      ? "Saved WhatsApp credentials could not be loaded."
      : options.length === 0
        ? "No saved WhatsApp credentials are available."
        : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp Configuration</DialogTitle>
          <DialogDescription>
            Choose a saved WhatsApp Cloud API credential and configure the recipient and message.
          </DialogDescription>
        </DialogHeader>

        {hasLegacyAccessToken && !defaultValues.credentialId && (
          <p className="text-sm text-amber-700" role="status">
            This node uses an older inline token. Select a saved WhatsApp credential and save the workflow to migrate it. Existing saved configuration remains usable until then.
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="credentialId" render={({ field }) => (
              <FormItem>
                <FormLabel>Saved WhatsApp credential</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isLoadingCredentials || credentialsError || options.length === 0}>
                  <FormControl>
                    <SelectTrigger className="w-full" aria-label="Saved WhatsApp credential">
                      <SelectValue placeholder="Select a saved WhatsApp credential" />
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
                    <p className="text-sm"><Link className="underline" href="/credentials/new">Open credential settings to add a WhatsApp credential</Link></p>
                  </div>
                ) : (
                  <FormDescription>The access token remains encrypted in credential settings and is not stored in this workflow.</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phoneNumberId" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number ID</FormLabel>
                <FormControl><Input placeholder="123456789012345" autoComplete="off" {...field} /></FormControl>
                <FormDescription>Find this ID in your Meta WhatsApp Business settings.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="to" render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient phone number</FormLabel>
                <FormControl><Input placeholder="919999999999" autoComplete="tel" {...field} /></FormControl>
                <FormDescription>Include the country calling code. The node sends digits only.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl><Textarea placeholder="Hello from my workflow" className="min-h-[120px]" maxLength={4000} {...field} /></FormControl>
                <FormDescription>Supports workflow variables such as {"{{myGemini.text}}"}. Text messages have a 4000-character limit here.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="variableName" render={({ field }) => (
              <FormItem>
                <FormLabel>Result variable (optional)</FormLabel>
                <FormControl><Input placeholder="myWhatsapp" autoComplete="off" {...field} /></FormControl>
                <FormDescription>Use this variable in later nodes to reference the send result.</FormDescription>
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
