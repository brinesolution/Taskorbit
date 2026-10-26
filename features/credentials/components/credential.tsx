"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";

import {
  useCreateCredential,
  useUpdateCredential,
} from "../hooks/use-credentials";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const credentialTypes = [
  "OPENAI",
  "ANTHROPIC",
  "GEMINI",
  "DISCORD",
  "WHATSAPP",
  "STRIPE",
] as const;

type CredentialTypeValue = (typeof credentialTypes)[number];

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(credentialTypes),
  value: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface CredentialFormProps {
  initialData?: {
    id?: string;
    name: string;
    type: CredentialTypeValue;
    hasValue?: boolean;
  };
}

export const CredentialForm = ({ initialData }: CredentialFormProps) => {
  const router = useRouter();

  const createCredential = useCreateCredential();
  const updateCredential = useUpdateCredential();

  const isEdit = !!initialData?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      type: initialData?.type ?? "GEMINI",
      value: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!isEdit && !values.value.trim()) {
      form.setError("value", {
        type: "required",
        message: "Credential value is required",
      });
      return;
    }

    if (
      isEdit &&
      initialData &&
      values.type !== initialData.type &&
      !values.value.trim()
    ) {
      form.setError("value", {
        type: "required",
        message: "Enter a new secret when changing credential type",
      });
      return;
    }

    form.clearErrors("value");

    try {
      if (isEdit && initialData?.id) {
        await updateCredential.mutateAsync({
          id: initialData.id,
          name: values.name,
          type: values.type,
          ...(values.value.trim() ? { value: values.value } : {}),
        });
      } else {
        await createCredential.mutateAsync({
          name: values.name,
          type: values.type,
          value: values.value,
        });
      }

      router.push("/credentials");
      router.refresh();
    } catch {
      // The credential mutation hook displays the request error in a toast.
    }
  };

  const isPending =
    createCredential.isPending || updateCredential.isPending;

  return (
    <Card className="mx-auto w-full max-w-3xl border border-border bg-card/90 shadow-xl shadow-black/10">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">
          {isEdit ? "Edit credential" : "Create credential"}
        </CardTitle>
        <CardDescription>
          Add or update a secure connection used by your workflows.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Gemini API Key"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    disabled={isPending}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select credential type" />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="OPENAI">OpenAI</SelectItem>
                      <SelectItem value="ANTHROPIC">
                        Anthropic
                      </SelectItem>
                      <SelectItem value="GEMINI">Gemini</SelectItem>
                      <SelectItem value="DISCORD">Discord</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="STRIPE">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? "Replace secret (optional)" : "Secret value"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        isEdit
                          ? "Leave blank to keep the saved secret"
                          : "Enter an API key, token, or webhook URL"
                      }
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  {isEdit && initialData?.hasValue && (
                    <p className="text-xs text-muted-foreground">
                      A secret is saved. Leave this field blank to keep it unchanged.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => router.push("/credentials")}
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                type="submit"
                className="taskorbit-button"
              >
                {isPending
                  ? isEdit
                    ? "Saving…"
                    : "Creating…"
                  : isEdit
                    ? "Save changes"
                    : "Create credential"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
