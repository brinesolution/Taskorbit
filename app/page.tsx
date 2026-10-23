import type { Metadata } from "next";

import { DemoWorkspace } from "@/features/workflows/components/demo-workspace";

export const metadata: Metadata = {
  title: "Demo workspace",
  description:
    "Explore TaskOrbit workflow templates in a public, interactive demo workspace.",
};

export default function HomePage() {
  return <DemoWorkspace />;
}
