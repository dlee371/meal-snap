-- 004_dashboard.sql: aggregation functions for the dashboard.
-- Run in the Neon SQL editor after 003_daily_totals.sql.
-- (daily_totals lives in 003; it's reused by the dashboard.)
--
-- Every function is `security invoker` (RLS still applies), filters on
-- app.user_id, counts only needs_review + confirmed meals, and groups by the
-- user's LOCAL day via the `tz` argument - the same rules as daily_totals.

-- Shared filter: the signed-in user's countable meals eaten between local
-- midnight on start_date and local midnight after end_date.
create or replace function meals_in_range(start_date date, end_date date, tz text)
returns setof meals
language sql
stable
security invoker
as $$
  select *
    from meals m
   where m.user_id = current_setting('app.user_id', true)
     and m.status in ('needs_review', 'confirmed')
     and m.eaten_at >= (start_date::timestamp at time zone tz)
     and m.eaten_at <  ((end_date + 1)::timestamp at time zone tz);
$$;

-- Calories per meal type. Always returns breakfast, lunch, dinner and snack (zeros
-- included) in that order, plus "unspecified" only if some meals have no type yet.
create or replace function meal_type_totals(start_date date, end_date date, tz text)
returns table (meal_type text, calories integer, meal_count integer)
language sql
stable
security invoker
as $$
  with meal_sums as (
    select m.id,
           coalesce(m.meal_type, 'unspecified') as meal_type,
           coalesce(sum(i.calories), 0) as calories
      from meals_in_range(start_date, end_date, tz) m
      left join meal_items i on i.meal_id = m.id
     group by m.id, m.meal_type
  )
  select t.meal_type,
         coalesce(sum(s.calories), 0)::integer,
         count(s.id)::integer
    from (values ('breakfast', 1), ('lunch', 2), ('dinner', 3), ('snack', 4), ('unspecified', 5))
         as t(meal_type, sort_order)
    left join meal_sums s on s.meal_type = t.meal_type
   group by t.meal_type, t.sort_order
  having t.meal_type <> 'unspecified' or count(s.id) > 0
   order by t.sort_order;
$$;

-- Most-logged foods. "Rice", "rice " and "RICE" count as the same food; the name
-- shown is the most common spelling.
create or replace function top_foods(start_date date, end_date date, tz text, n integer)
returns table (name text, times_logged integer, total_calories integer)
language sql
stable
security invoker
as $$
  select mode() within group (order by i.name) as name,
         count(*)::integer as times_logged,
         sum(i.calories)::integer as total_calories
    from meals_in_range(start_date, end_date, tz) m
    join meal_items i on i.meal_id = m.id
   group by lower(trim(i.name))
   order by times_logged desc, total_calories desc, name
   limit least(greatest(n, 1), 50);
$$;

grant execute on function meals_in_range(date, date, text) to app_user;
grant execute on function meal_type_totals(date, date, text) to app_user;
grant execute on function top_foods(date, date, text, integer) to app_user;
