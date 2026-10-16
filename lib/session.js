// Server-side helpers for "who is signed in?". Use these in server components,
// route handlers and server actions. Middleware is only the first gate; every
// protected page/route should still call requireUser() itself.
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Returns { user, session } or null when signed out.
export async function getSession() {
  // Next.js 15: headers() is async, so it must be awaited.
  return auth.api.getSession({ headers: await headers() });
}

// Returns the signed-in user, or redirects to /login.
export async function requireUser(nextPath) {
  const session = await getSession();
  if (!session) {
    const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${query}`);
  }
  return session.user;
}
