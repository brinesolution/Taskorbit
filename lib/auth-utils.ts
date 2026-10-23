import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthSetupStatus } from "@/lib/auth-config";

// Protect private routes
export const requireAuth = async () => {
  if (!getAuthSetupStatus(process.env).ready) {
    redirect("/login?setup=required");
  }

  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session;
};

// Prevent logged-in users from accessing auth pages
export const requireUnAuth = async () => {
  if (!getAuthSetupStatus(process.env).ready) {
    return;
  }

  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }
};
