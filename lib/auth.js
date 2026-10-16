// Better Auth server configuration (server-only).
// Better Auth stores users and sessions in our own Postgres tables (see
// db/migrations/000_auth.sql) and handles password hashing and session cookies.
import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { pool } from "@/lib/db";

export const auth = betterAuth({
  database: pool,
  // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from env automatically.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Sign the user in right after sign-up (no email verification in v1).
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // a session lasts 7 days...
    updateAge: 60 * 60 * 24, // ...and is extended at most once a day while in use
  },
  // Lets server actions set auth cookies. Must be the last plugin.
  plugins: [nextCookies()],
});
