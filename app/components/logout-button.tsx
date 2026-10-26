"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const LogoutButton = () => {
  return (
    <Button
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/login");
      }}
    >
      Logout
    </Button>
  );
};
