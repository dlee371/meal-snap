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

## 2. Local time zone (cookie added in Phase 4; used again in Phases 5/6)

- `components/TimeZoneSync.js` stores the browser's IANA zone in a `tz` cookie; the
  server validates it (`lib/timezone.js`) and falls back to UTC.
- Postgres does every conversion: `to_char(eaten_at at time zone $tz, …)` to show a
  meal time, and `($local::timestamp at time zone $tz)` to save one. This handles
  daylight saving correctly and keeps date math out of JavaScript.
- The plan's SQL functions take only `start_date, end_date`. We add a `tz` argument so
  days are grouped in the user's local time, not UTC.

## 2b. Review and edit (Phase 4)

- `planItemChanges()` (pure, unit-tested) diffs the saved form against the DB:
  inserts new rows, deletes removed ones, and updates **only rows whose values
  changed**, so `user_edited` honestly marks AI guesses the user corrected.
- The review page shows the AI's original total (from `ai_raw`, which is never
  edited) next to the corrected total.
- A save locks the meal row; a late AI answer for a meal the user already saved is
  stored in `ai_raw` only and never overwrites the user's items.
- Items are inserted with `clock_timestamp()` so they keep the AI's order (all rows
  in one transaction would otherwise share the same `now()`).
- "Delete meal" was added (not in the plan) so failed or wrong uploads can be removed.

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

## 4. AI analysis (Phase 3)

- **Mock mode:** `AI_MOCK=true|plate|drink|not_food|invalid` swaps the Anthropic client
  for a fake one that returns a saved answer from `lib/fixtures/`. It goes through the
  exact same validation/retry path, so every UI state can be tried for $0.
  `ai-real-plate.json` is a real answer from `claude-haiku-5-5`.
- **Forced tool call + strict schema + Zod:** `tool_choice` forces `record_meal`;
  `strict: true` guarantees the JSON *shape*; Zod enforces the *limits* (calories
  0–3000, grams 0–2000, ≤ 15 items), which the API can't express with strict tools.
  One retry on invalid output; then the meal is `failed` and the bad answer is kept
  in `ai_raw`.
- **Rate limit moved up from Phase 7**, because real API spend starts in Phase 3. It
  counts rows in a new append-only `ai_calls` table (`002_ai_calls.sql`) instead of
  `meals`: deleting a meal (including "no food" photos, which are deleted right away)
  must not hand back a free analysis. Rolling 24-hour window, 30 calls, enforced on
  both upload and analyze, with a per-user advisory lock so parallel requests can't
  both slip under the cap. **The dashboard migration becomes `003_dashboard.sql`.**
- **Claiming a meal:** analyze only runs on a meal with status `analyzing` and no
  `ai_model` yet, set atomically, so a double-click or replay can't pay twice.
- **No DB transaction is held open during the AI call** (5–10 s); the work is split
  into a short "claim" transaction and a short "save" transaction.
- **Vercel Blob credentials:** `lib/storage.js` passes `BLOB_READ_WRITE_TOKEN`
  explicitly when it's set, because `vercel link` adds a `VERCEL_OIDC_TOKEN` to
  `.env.local` that the SDK would otherwise prefer and that Vercel rejects outside
  deployments. On Vercel, OIDC is used.
