// /log: one day's meals and totals, in the user's local time zone.
// /log            → today
// /log?date=2026-10-19 → that day
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { getUserTimeZone } from "@/lib/user-timezone";
import { todayInTimeZone, isValidDateString, formatLongDate } from "@/lib/dates";
import DateNav from "@/components/DateNav";
import DayTotals from "@/components/DayTotals";
import MealCard from "@/components/MealCard";

export const metadata = { title: "Log · Meal Snap Logger" };

export default async function LogPage({ searchParams }) {
  // Middleware already redirects signed-out users; this is the second check.
  const user = await requireUser("/log");
  const timeZone = await getUserTimeZone();
  const today = todayInTimeZone(timeZone);

  // Next.js 15: searchParams is a Promise. Bad or future dates fall back to today.
  const { date: requested } = await searchParams;
  const date = isValidDateString(requested) && requested <= today ? requested : today;

  const { totals, meals } = await withUser(user.id, async (db) => {
    // Totals come from the daily_totals SQL function (003_daily_totals.sql).
    const { rows: totalRows } = await db.query(
      "select calories, protein_g, carbs_g, fat_g, meal_count from daily_totals($1, $1, $2)",
      [date, timeZone],
    );

    // The day's meals: everything eaten between local midnight and the next local
    // midnight. RLS limits this to the signed-in user.
    const { rows: mealRows } = await db.query(
      `select m.id, m.status, m.meal_type,
              to_char(m.eaten_at at time zone $2, 'FMHH12:MI AM') as time_local,
              coalesce(sum(i.calories), 0)::int as calories,
              string_agg(i.name, ', ' order by i.created_at) as item_names
         from meals m
         left join meal_items i on i.meal_id = m.id
        where m.eaten_at >= ($1::date::timestamp at time zone $2)
          and m.eaten_at <  (($1::date + 1)::timestamp at time zone $2)
        group by m.id
        order by m.eaten_at`,
      [date, timeZone],
    );
    return { totals: totalRows[0], meals: mealRows };
  });

  const isToday = date === today;
  const toReview = meals.filter((meal) => meal.status !== "confirmed").length;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{isToday ? "Today" : formatLongDate(date)}</h1>
        <DateNav date={date} today={today} />
      </div>

      <DayTotals totals={totals} />

      {toReview > 0 && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          {toReview === 1 ? "1 meal needs" : `${toReview} meals need`} your review. AI estimates can be off, so
          check them and save.
        </p>
      )}

      {meals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/20 p-6 text-center text-foreground/70">
          {isToday ? (
            <>
              Nothing logged today.{" "}
              <Link href="/snap" className="font-medium text-foreground underline">
                Snap your first meal.
              </Link>
            </>
          ) : (
            "Nothing logged on this day."
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </ul>
      )}

      <p className="text-xs text-foreground/50">Estimates only, not medical or dietary advice.</p>
    </section>
  );
}
