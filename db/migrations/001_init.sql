-- 001_init.sql: meals, meal_items, Row Level Security, and app_user permissions.
-- Run in the Neon SQL editor AFTER 000_auth.sql and AFTER creating the app_user role.
--
-- How RLS works here (no Supabase): the app connects as `app_user`. Before every
-- query, lib/db.js -> withUser() runs, inside a transaction:
--     select set_config('app.user_id', '<signed-in user id>', true);
-- Every policy below compares rows against that setting. If it isn't set,
-- current_setting(..., true) returns NULL, NULL = anything is never true, and the
-- query sees zero rows. In other words, forgetting withUser() fails closed.

-- Stop early with a clear message if the role doesn't exist yet.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    raise exception 'Role app_user does not exist. Create it first (see Phase 2 instructions).';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- meals: one row per photo
-- ---------------------------------------------------------------------------
create table meals (
  id          uuid primary key default gen_random_uuid(),
  -- Better Auth user ids are text, not uuid.
  user_id     text not null references "user" ("id") on delete cascade,
  image_path  text not null,                       -- e.g. <user_id>/<uuid>.jpg in Vercel Blob
  eaten_at    timestamptz not null default now(),  -- user can change it
  meal_type   text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  status      text not null default 'analyzing'
              check (status in ('analyzing', 'needs_review', 'confirmed', 'failed')),
  ai_model    text,                                -- model name used, for debugging
  ai_raw      jsonb,                               -- AI's original answer, kept after edits
  created_at  timestamptz not null default now(),
  -- Lets meal_items reference (id, user_id) together; see the foreign key below.
  unique (id, user_id)
);

-- The log and dashboard filter by user and time.
create index meals_user_eaten_at_idx on meals (user_id, eaten_at desc);

-- ---------------------------------------------------------------------------
-- meal_items: one row per food detected in a meal
-- ---------------------------------------------------------------------------
create table meal_items (
  id           uuid primary key default gen_random_uuid(),
  meal_id      uuid not null,
  user_id      text not null,   -- duplicated from meals so RLS is a simple check
  name         text not null check (char_length(name) between 1 and 200),
  portion      text,            -- e.g. "about 1 palm-sized piece"
  grams        integer check (grams between 0 and 5000),
  -- Whole numbers. 0 rather than NULL so totals never have to deal with NULLs.
  -- These are loose sanity limits; Zod applies the stricter AI-output limits.
  calories     integer not null default 0 check (calories between 0 and 10000),
  protein_g    integer not null default 0 check (protein_g between 0 and 1000),
  carbs_g      integer not null default 0 check (carbs_g between 0 and 1000),
  fat_g        integer not null default 0 check (fat_g between 0 and 1000),
  confidence   text check (confidence in ('high', 'medium', 'low')),
  user_edited  boolean not null default false,
  created_at   timestamptz not null default now(),
  -- Composite foreign key: an item must belong to a meal owned by the SAME user.
  -- (Foreign key checks skip RLS, so without this a user who guessed another
  -- user's meal id could attach items to it.)
  foreign key (meal_id, user_id) references meals (id, user_id) on delete cascade
);

create index meal_items_meal_id_idx on meal_items (meal_id);
create index meal_items_user_id_idx on meal_items (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: one policy per table per action
-- ---------------------------------------------------------------------------
alter table meals enable row level security;
alter table meal_items enable row level security;

create policy meals_select on meals for select to app_user
  using (user_id = current_setting('app.user_id', true));
create policy meals_insert on meals for insert to app_user
  with check (user_id = current_setting('app.user_id', true));
create policy meals_update on meals for update to app_user
  using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));
create policy meals_delete on meals for delete to app_user
  using (user_id = current_setting('app.user_id', true));

create policy meal_items_select on meal_items for select to app_user
  using (user_id = current_setting('app.user_id', true));
create policy meal_items_insert on meal_items for insert to app_user
  with check (user_id = current_setting('app.user_id', true));
create policy meal_items_update on meal_items for update to app_user
  using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));
create policy meal_items_delete on meal_items for delete to app_user
  using (user_id = current_setting('app.user_id', true));

-- ---------------------------------------------------------------------------
-- Permissions for app_user (the role the app logs in as)
-- ---------------------------------------------------------------------------
-- app_user is not the table owner and has no BYPASSRLS, so the policies above
-- always apply to it.
grant usage on schema public to app_user;
grant select, insert, update, delete on meals, meal_items to app_user;

-- Better Auth's tables. No per-user RLS is possible here: during sign-in, Better
-- Auth must look up a session or password BEFORE it knows who the user is (the
-- same reason Supabase keeps auth.users outside RLS). Only server-side auth code
-- (lib/auth.js) queries these tables.
grant select, insert, update, delete on "user", "session", "account", "verification" to app_user;
