// Browser-side helper for calling Better Auth's /api/auth/* endpoints.
// Used by client components (login form, sign-out button).
import { createAuthClient } from "better-auth/react";

// No baseURL needed: the browser calls the same site it was loaded from.
export const authClient = createAuthClient();
