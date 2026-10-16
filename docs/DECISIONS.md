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

## 3c. Database and uploads (Phase 2)

- **Uploads go through our server** (`POST /api/meals`), not browser → storage directly.
  The server picks the `<user_id>/<meal_id>.jpg` path and checks the file's first bytes
  (magic numbers), so users can't write into other folders or upload non-images.
- **Photos are private Vercel Blobs.** Their URLs return 403 without our token. Browsers
  only get them via `/api/photos/[id]`, which looks the meal up under RLS and returns the
  same 404 for "doesn't exist" and "not yours".
- **Upload limit is 4 MB, not 5 MB**, because Vercel rejects request bodies over 4.5 MB.
  Photos are compressed to ~1600 px JPEG in the browser first (usually < 1 MB).
- **HEIC** is accepted by the picker but converted to JPEG in the browser; the server only
  accepts JPEG/PNG/WebP (Claude can't read HEIC anyway).
- **Two picker buttons:** "Take photo" (`capture="environment"`) and "Choose from
  library" (no capture), because `capture` hides the gallery on some phones.
- **Composite foreign key** `meal_items (meal_id, user_id) → meals (id, user_id)`:
  foreign-key checks skip RLS, so without it a user could attach items to someone
  else's meal if they guessed its id.
- **Auth tables have no per-user RLS.** Better Auth must read sessions and password
  hashes before it knows who the user is (Supabase likewise keeps `auth.users` outside
  RLS). `app_user` can reach them, but only `lib/auth.js` queries them.
- Nutrition columns are `not null default 0` so SQL totals never deal with NULLs.

## 4. AI mock mode (Phase 3)

`AI_MOCK=true` makes `lib/analyzeMeal.js` return saved real AI answers (fixtures)
instead of calling the Claude API, so development and demos cost $0. The plan
already recommends saving fixtures; this just makes them switchable.
