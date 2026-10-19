-- 003_daily_totals.sql: per-day nutrition totals, computed in Postgres (never stored).
-- Run in the Neon SQL editor after 002_ai_calls.sql.
--
-- daily_totals('2026-10-01', '2026-10-07', 'America/Chicago') returns one row per
-- day in that range, grouped by the user's LOCAL calendar day, with zeros for days
-- that have no meals (thanks to generate_series). Because totals are computed on
-- every read, they're always correct right after an edit.
--
-- `security invoker` = the function runs with the caller's permissions, so the RLS
-- policies on meals/meal_items still apply. It also filters on app.user_id itself,
-- so it returns nothing if withUser() wasn't used.

create or replace function daily_totals(start_date date, end_date date, tz text)
returns table (
  day         date,
  calories    integer,
  protein_g   integer,
  carbs_g     integer,
  fat_g       integer,
  meal_count  integer
)
language sql
stable
security invoker
as $$
  with days as (
    -- Every day in the range (capped at 366 days), even days with no meals.
    select d::date as day
      from generate_series(start_date, least(end_date, start_date + 366), interval '1 day') as d
  ),
  meal_sums as (
    -- One row per meal: its local day and the sum of its items.
    select (m.eaten_at at time zone tz)::date as day,
           m.id,
           coalesce(sum(i.calories), 0)  as calories,
           coalesce(sum(i.protein_g), 0) as protein_g,
           coalesce(sum(i.carbs_g), 0)   as carbs_g,
           coalesce(sum(i.fat_g), 0)     as fat_g
      from meals m
      left join meal_items i on i.meal_id = m.id
     where m.user_id = current_setting('app.user_id', true)
       -- Unreviewed AI drafts count (it's food you ate); failed/analyzing meals have no items.
       and m.status in ('needs_review', 'confirmed')
       -- Local midnight at the start of start_date ... local midnight after end_date.
       and m.eaten_at >= (start_date::timestamp at time zone tz)
       and m.eaten_at <  ((end_date + 1)::timestamp at time zone tz)
     group by m.id
  )
  select d.day,
         coalesce(sum(s.calories), 0)::integer,
         coalesce(sum(s.protein_g), 0)::integer,
         coalesce(sum(s.carbs_g), 0)::integer,
         coalesce(sum(s.fat_g), 0)::integer,
         count(s.id)::integer
    from days d
    left join meal_sums s on s.day = d.day
   group by d.day
   order by d.day;
$$;

grant execute on function daily_totals(date, date, text) to app_user;
