"use client";

import Image from "next/image";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";

import { useCredentialsByType } from "@/features/credentials/hooks/use-credentials";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
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

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resolveGeminiPrompt } from "./prompt";

const formSchema = z
  .object({
    provider: z.enum(["google", "neon"]),
    credentialId: z.string().optional(),
    model: z.string().optional(),
    prompt: z.string().min(1, "Prompt is required"),
    variableName: z.string().min(1, "Variable name is required"),
  })
  .superRefine((values, context) => {
    if (values.provider === "google" && !values.credentialId) {
      context.addIssue({
        code: "custom",
        message: "Credential is required",
        path: ["credentialId"],
      });
    }

    if (values.provider === "neon" && !values.model?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Choose a model from the Neon AI Gateway catalog",
        path: ["model"],
      });
    }
  });

export type GeminiFormValues = z.infer<typeof formSchema>;

type GatewayModel = { id: string; name: string };

type GeminiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<GeminiFormValues>;
  onSubmit: (values: GeminiFormValues) => void;
};

type CredentialOption = {
  id: string;
  name: string;
  type?: string;
};

export const GeminiDialog = ({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: GeminiDialogProps) => {
  const {
    data: credentials = [],
    isLoading: isLoadingCredentials,
  } = useCredentialsByType("GEMINI");
  const [gatewayModels, setGatewayModels] = useState<GatewayModel[]>([]);
  const [isLoadingGatewayModels, setIsLoadingGatewayModels] = useState(false);
  const [gatewayModelsError, setGatewayModelsError] = useState<string>();

  const form = useForm<GeminiFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: defaultValues?.provider ?? "google",
      credentialId: defaultValues?.credentialId ?? "",
      model: defaultValues?.model ?? "gemini-2.5-flash",
      prompt: resolveGeminiPrompt(defaultValues ?? {}),
      variableName: defaultValues?.variableName ?? "gemini",
    },
  });

  const provider =
    useWatch({ control: form.control, name: "provider" }) ?? "google";

  const loadGatewayModels = async () => {
    setIsLoadingGatewayModels(true);
    setGatewayModelsError(undefined);

    try {
      const response = await fetch("/api/neon/ai/models", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Neon AI Gateway models are unavailable on this branch.");
      }

      const { models = [] } = (await response.json()) as {
        models?: GatewayModel[];
      };
      setGatewayModels(models);

      const currentModel = form.getValues("model");
      if (models.length > 0 && !models.some((model) => model.id === currentModel)) {
        form.setValue("model", models[0].id, { shouldValidate: true });
      }
      if (models.length === 0) {
        setGatewayModelsError("No enabled Gemini models were found for this Neon branch.");
      }
    } catch (error) {
      setGatewayModelsError(
        error instanceof Error
          ? error.message
          : "Neon AI Gateway models are unavailable on this branch."
      );
    } finally {
      setIsLoadingGatewayModels(false);
    }
  };

  const handleSubmit = (values: GeminiFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {provider === "neon" ? "Gemini via Neon AI Gateway" : "Gemini"}
          </DialogTitle>
          <DialogDescription>
            Configure a Gemini prompt. Neon AI Gateway requires a paid Neon
            plan and uses prepaid AI credits.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "neon" && !form.getValues("model")) {
                        form.setValue("model", "gemini-3-flash");
                      }
                      if (value === "neon") {
                        void loadGatewayModels();
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="google">Google Gemini (my credential)</SelectItem>
                      <SelectItem value="neon">Neon AI Gateway (Neon credits)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {provider === "google" ? (
              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credential</FormLabel>
                    <Select
                      disabled={isLoadingCredentials}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Gemini credential" />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        {(credentials as CredentialOption[]).map(
                          (credential) => (
                            <SelectItem
                              key={credential.id}
                              value={credential.id}
                            >
                              <div className="flex items-center gap-2">
                                <Image
                                  src="/logos/gemini.svg"
                                  alt="Gemini"
                                  width={16}
                                  height={16}
                                />
                                {credential.name}
                              </div>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neon Gemini model</FormLabel>
                    <FormControl>
                      <Input
                        list="neon-gemini-models"
                        placeholder="gemini-3-flash"
                        disabled={isLoadingGatewayModels}
                        {...field}
                      />
                    </FormControl>
                    <datalist id="neon-gemini-models">
                      {gatewayModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </datalist>
                    {gatewayModelsError ? (
                      <p className="text-sm text-destructive" role="status">
                        {gatewayModelsError}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Choose an enabled Gemini model from the list or enter its catalog ID.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingGatewayModels}
                      onClick={() => void loadGatewayModels()}
                    >
                      {isLoadingGatewayModels ? "Loading models…" : "Refresh model list"}
                    </Button>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Example: Solve 125 × 48 and explain shortly."
                      rows={6}
                      {...field}
                    />
                  </FormControl>
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
                    <Input placeholder="gemini" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
