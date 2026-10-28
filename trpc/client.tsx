"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import { useState } from "react";

import { makeQueryClient } from "./query-client";
import { resolveTRPCUrl } from "./base-url";
import type { AppRouter } from "./routers/_app";

export const { TRPCProvider, useTRPC } =
  createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

export function TRPCReactProvider(
  props: Readonly<{ children: React.ReactNode }>
) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: resolveTRPCUrl({
            isServer: typeof window === "undefined",
            vercelUrl: process.env.VERCEL_URL,
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
            nodeEnv: process.env.NODE_ENV,
            port: process.env.PORT,
            nextPhase: process.env.NEXT_PHASE,
          }),
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
