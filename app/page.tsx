import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowRightIcon,
  BracesIcon,
  CirclePlayIcon,
  GitBranchIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "lucide-react";

import { getAuthSetupStatus } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "TaskOrbit — Workflow automation",
  description:
    "Design, run, and monitor event-driven workflows from one visual workspace.",
};

export default async function HomePage() {
  if (getAuthSetupStatus(process.env).ready) {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers: await headers() });

    if (session) redirect("/workflows");
  }

  return (
    <main className="min-h-svh overflow-hidden bg-[#080a10] text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.2),transparent_65%)]" />
      <div className="relative mx-auto flex min-h-svh max-w-7xl flex-col px-5 sm:px-8">
        <header className="flex h-20 items-center justify-between border-b border-white/10">
          <Link href="/" className="flex items-center gap-3" aria-label="TaskOrbit home">
            <span className="flex size-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300">
              <WorkflowIcon className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">TaskOrbit</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-indigo-300"
            >
              Create account
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-16 py-20 lg:grid-cols-[1fr_0.9fr] lg:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.06] px-3 py-1.5 text-xs font-medium text-indigo-200">
              <span className="size-1.5 rounded-full bg-indigo-300" />
              Event-driven workflow automation
            </div>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Make your workflows move.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
              Connect triggers and actions in a visual builder, run automations
              when work happens, and follow each execution from start to result.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-indigo-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-indigo-300"
              >
                Get started <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-lg border border-white/10 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
              >
                Sign in to your workspace
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-500">
              Build and manage workflows in your account. You control which
              connected services each workflow can use.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-[2rem] bg-indigo-500/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1019] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-400/10 text-indigo-300">
                    <GitBranchIcon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Visual workflow builder</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Connect steps and configure each action</p>
                  </div>
                </div>
                <span className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.06] px-2 py-1 text-[11px] text-emerald-200">
                  Node editor
                </span>
              </div>
              <div className="space-y-3 p-5 sm:p-7">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200"><CirclePlayIcon className="size-4" /></span>
                  <div><p className="text-sm font-medium">Choose a trigger</p><p className="mt-1 text-xs text-zinc-500">Start manually or respond to an event</p></div>
                </div>
                <div className="ml-8 h-5 border-l border-dashed border-indigo-300/40" />
                <div className="flex items-center gap-3 rounded-xl border border-indigo-300/25 bg-indigo-300/[0.06] p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-300/10 text-indigo-200"><BracesIcon className="size-4" /></span>
                  <div><p className="text-sm font-medium">Add an action</p><p className="mt-1 text-xs text-zinc-400">Send requests, process data, or notify a team</p></div>
                </div>
                <div className="ml-8 h-5 border-l border-dashed border-indigo-300/40" />
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><ShieldCheckIcon className="size-4" /></span>
                  <div><p className="text-sm font-medium">Run with your credentials</p><p className="mt-1 text-xs text-zinc-500">Review execution status and output</p></div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-zinc-500">
                <span>Configure · Save · Execute</span><WorkflowIcon className="size-4 text-indigo-300" />
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>TaskOrbit</span>
          <span>Build, execute, and monitor your automations.</span>
        </footer>
      </div>
    </main>
  );
}
