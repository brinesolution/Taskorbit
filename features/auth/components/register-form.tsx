"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { authClient } from "@/lib/auth-client";
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

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.email(),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
});

export function RegisterForm({
  providers,
}: {
  providers: { github: boolean; google: boolean };
}) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const signInGithub = async () => {
    await authClient.signIn.social(
      {
        provider: "github",
        callbackURL: "/workflows",
      },
      {
        onError: () => {
          toast.error("GitHub login failed");
        },
      }
    );
  };

  const signInGoogle = async () => {
    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/workflows",
      },
      {
        onError: () => {
          toast.error("Google login failed");
        },
      }
    );
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.name,
    });

    if (error) {
      toast.error(error.message || "Failed to create account");
      return;
    }

    toast.success("Account created successfully");
    router.push("/workflows");
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl shadow-black/20">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">
          Create account
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Sign up to continue
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {(providers.github || providers.google) && (
          <div className="grid gap-3">
            {providers.github && (
              <Button
                onClick={signInGithub}
                variant="outline"
                className="h-12 w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                type="button"
              >
                <Image
                  src="/logos/github.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="mr-2 dark:invert"
                />
                Continue with GitHub
              </Button>
            )}

            {providers.google && (
              <Button
                onClick={signInGoogle}
                variant="outline"
                className="h-12 w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                type="button"
              >
                <Image
                  src="/logos/google.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="mr-2"
                />
                Continue with Google
              </Button>
            )}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-200">Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Om Jha"
                      className="h-12 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-200">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="m@example.com"
                      className="h-12 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-200">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Create password"
                      className="h-12 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="h-12 w-full bg-[#e85d36] text-white hover:bg-[#d94c2d]"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Creating account..." : "Sign up"}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-300 underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
