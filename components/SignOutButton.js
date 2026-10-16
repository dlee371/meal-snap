"use client";
// Client component because it handles a click and calls the auth API from the browser.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut(); // deletes the session row and clears the cookie
    router.push("/login");
    router.refresh(); // re-render server components (e.g. the header) as signed out
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="rounded-md border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
