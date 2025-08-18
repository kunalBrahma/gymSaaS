// components/AuthButtons.tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button"; // Assuming you use shadcn/ui

export function LogoutButton() {
  return (
    <Button
      // On click, sign the user out and redirect them to the login page
      onClick={() => signOut({ callbackUrl: "/login" })}
      variant="destructive" // Makes the button red
      className="w-full"
    >
      Sign Out
    </Button>
  );
}