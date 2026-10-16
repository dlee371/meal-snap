-- 002_ai_calls.sql: append-only log of AI analyses, used for the per-user daily cap.
-- Run in the Neon SQL editor after 001_init.sql.
--
-- Why a separate table instead of counting rows in `meals`? Meals can be deleted
-- (a "no food" photo is deleted right away, and users can delete meals later), and
-- every deleted meal would hand back one free analysis. Rows here are never
-- updated or deleted by the app, so the count can't be reset.

create table ai_calls (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references "user" ("id") on delete cascade,
  -- Kept (as NULL) when the meal is deleted, so the call still counts.
  meal_id     uuid references meals (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index ai_calls_user_created_at_idx on ai_calls (user_id, created_at desc);

alter table ai_calls enable row level security;

-- Only select and insert: no update/delete policies, so the app can't erase usage.
create policy ai_calls_select on ai_calls for select to app_user
  using (user_id = current_setting('app.user_id', true));
create policy ai_calls_insert on ai_calls for insert to app_user
  with check (user_id = current_setting('app.user_id', true));

grant select, insert on ai_calls to app_user;
