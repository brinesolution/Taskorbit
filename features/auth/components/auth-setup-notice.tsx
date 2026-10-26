import Link from "next/link";
import { InfoIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthSetupNotice({ missing }: { missing: string[] }) {
  return (
    <Card className="w-full border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl shadow-black/20">
      <CardHeader className="space-y-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
          <InfoIcon className="size-5" />
        </div>
        <CardTitle className="text-2xl font-semibold">
          Sign-in is being set up
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Account sign-in is unavailable until the production database and
          authentication settings are connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm font-medium text-zinc-200">
            Required production settings
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            {missing.map((key) => (
              <li key={key} className="font-mono text-xs">
                {key}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            GitHub and Google sign-in can be enabled separately by adding their
            OAuth client IDs and secrets.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-500 px-4 text-sm font-medium text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          Back to TaskOrbit home
        </Link>
      </CardContent>
    </Card>
  );
}
