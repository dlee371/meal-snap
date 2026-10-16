# Decisions and deviations from the build plan

The architecture and build plan doc is the source of truth. This file records where
we deliberately changed it, and why.

## 1. Neon + Better Auth + Vercel Blob instead of Supabase (Phase 0)

**Why:** the Supabase free-plan project limit was used up, and the project must cost $0.

| Plan doc (Supabase)         | Replacement                                              |
| --------------------------- | -------------------------------------------------------- |
| Supabase Postgres           | Neon Postgres (free plan)                                |
| Supabase Auth               | Better Auth (open-source library, users stored in Neon)  |
| Supabase Storage bucket     | Vercel Blob, served only through our own ownership-checked route |
| `@supabase/ssr` + cookies   | Better Auth session cookie + middleware                  |

**What changes:**

- The browser no longer talks to the database directly. All reads and writes go through
  Next.js server code (route handlers and server actions), which checks the session first.
- Row Level Security stays. The app connects as a restricted Postgres role (`app_user`),
  and every request runs inside a transaction that first sets
  `set_config('app.user_id', <session user id>, true)`. Policies check
  `user_id = current_setting('app.user_id', true)` instead of Supabase's `auth.uid()`.
- Photos: instead of storage policies on `<user_id>/` folders, the server stores each
  photo under `<user_id>/<uuid>.jpg` and serves it via `/api/photos/[mealId]`, which
  checks ownership (through RLS) before streaming the image. The browser never gets a
  permanent photo URL.
- Everything else (SQL dashboard functions, Zod, forced tool calls, `ai_raw`,
  review/edit step, Recharts) is unchanged.

## 2. Local time zone for "today" (Phase 5/6)

The plan's SQL functions take only `start_date, end_date`. We add a `tz` argument
(from a cookie set by the browser) so days are grouped in the user's local time,
not UTC.

## 3. `/dashboard` is protected too (Phase 1)

The plan's middleware protects `/snap`, `/log`, `/meals`. Since Phase 6 makes the
dashboard the home page after login, `/dashboard` is protected as well.

## 3b. How auth works without Supabase (Phase 1)

- Migrations live in `db/migrations/` (not `supabase/migrations/`) and are run by hand
  in the Neon SQL editor. `000_auth.sql` holds Better Auth's tables.
- Better Auth user ids are `text`, not `uuid`, so our `user_id` columns are `text` too.
- Middleware runs on the Node.js runtime (stable in Next.js 15.5) so it can look the
  session up in Postgres and pass on refreshed session cookies. It is only the first
  gate: protected pages and routes also call `requireUser()` themselves.
- `?next=` redirects after login are restricted to same-site paths
  (`lib/safe-redirect.js`) to prevent open redirects.

## 4. AI mock mode (Phase 3)

`AI_MOCK=true` makes `lib/analyzeMeal.js` return saved real AI answers (fixtures)
instead of calling the Claude API, so development and demos cost $0. The plan
already recommends saving fixtures; this just makes them switchable.
