// Catch-all route: every request to /api/auth/* (sign-up, sign-in, sign-out,
// get-session, ...) is handled by Better Auth.
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
