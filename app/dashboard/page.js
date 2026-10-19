// /dashboard: "How am I eating lately?" at a glance.
// Every number comes from Postgres (daily_totals, meal_type_totals, top_foods, and
// window functions); the browser only draws what it's given.
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { getUserTimeZone } from "@/lib/user-timezone";
import { todayInTimeZone, shiftDate } from "@/lib/dates";
import { parseRange, macroCalorieSplit, shortDate } from "@/lib/dashboard";
import DayTotals from "@/components/DayTotals";
import ChartCard, { Legend } from "@/components/dashboard/ChartCard";
import RangeSwitcher from "@/components/dashboard/RangeSwitcher";
import CaloriesChart from "@/components/dashboard/CaloriesChart";
import ProteinChart from "@/components/dashboard/ProteinChart";
import MacroDonut from "@/components/dashboard/MacroDonut";
import MealTypeChart from "@/components/dashboard/MealTypeChart";
import TopFoods from "@/components/dashboard/TopFoods";

export const metadata = { title: "Dashboard · Meal Snap Logger" };

const MEAL_TYPE_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
  unspecified: "Not set",
};

export default async function DashboardPage({ searchParams }) {
  const user = await requireUser("/dashboard");
  const timeZone = await getUserTimeZone();

  // Next.js 15: searchParams is a Promise.
  const range = parseRange((await searchParams).range);
  const end = todayInTimeZone(timeZone);
  const start = shiftDate(end, -(range - 1));

  const data = await withUser(user.id, async (db) => {
    const params = [start, end, timeZone];

    // One row per day. The 7-day average is a SQL window function over the 6
    // days before each day plus that day; we fetch 6 extra days so the first
    // points of the range have a full window. Days with no meals are left out of
    // the average (they'd drag it toward 0) but still plot as 0 in the daily line.
    // `day::text` keeps dates as "YYYY-MM-DD" strings (no time zone shifting in JS).
    const { rows: days } = await db.query(
      `select day::text as day, calories, protein_g, carbs_g, fat_g, meal_count, calories_avg7
         from (
           select *,
                  round(avg(case when meal_count > 0 then calories end)
                        over (order by day rows between 6 preceding and current row))::int as calories_avg7
             from daily_totals($1::date - 6, $2::date, $3)
         ) with_avg
        where day >= $1::date
        order by day`,
      params,
    );

    const { rows: summaryRows } = await db.query(
      `select coalesce(sum(meal_count), 0)::int as meals,
              count(*) filter (where meal_count > 0)::int as days_logged,
              coalesce(round(avg(calories) filter (where meal_count > 0)), 0)::int as avg_calories,
              coalesce(round(avg(protein_g) filter (where meal_count > 0)), 0)::int as avg_protein
         from daily_totals($1, $2, $3)`,
      params,
    );

    const { rows: mealTypes } = await db.query("select * from meal_type_totals($1, $2, $3)", params);
    const { rows: topFoods } = await db.query("select * from top_foods($1, $2, $3, 5)", params);

    return { days, summary: summaryRows[0], mealTypes, topFoods };
  });

  const { days, summary, mealTypes, topFoods } = data;
  const today = days[days.length - 1]; // the range always ends today
  const macroSplit = macroCalorieSplit(today);
  const mealTypeRows = mealTypes.map((row) => ({ ...row, label: MEAL_TYPE_LABELS[row.meal_type] }));

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-foreground/60">How am I eating lately?</p>
        </div>
        <RangeSwitcher range={range} />
      </div>

      {summary.meals === 0 && today.meal_count === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-foreground/70">
          Log a few meals and your trends show up here.{" "}
          <Link href="/snap" className="font-medium text-foreground underline">
            Snap a meal
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">Today at a glance</h2>
            <DayTotals totals={today} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Where today's calories came from"
              subtitle="Share of calories from protein, carbs and fat (4 / 4 / 9 kcal per gram)"
              table={{
                columns: ["Macro", "Grams", "kcal", "Share"],
                rows: macroSplit.map((part) => [
                  part.label,
                  today[`${part.key}_g`],
                  part.kcal.toLocaleString("en-US"),
                  `${part.percent}%`,
                ]),
              }}
            >
              <MacroDonut split={macroSplit} />
            </ChartCard>

            <ChartCard
              title="Calories by meal type"
              subtitle={`Last ${range} days`}
              table={{
                columns: ["Meal", "Meals", "kcal"],
                rows: mealTypeRows.map((row) => [row.label, row.meal_count, row.calories.toLocaleString("en-US")]),
              }}
            >
              <MealTypeChart rows={mealTypeRows} />
            </ChartCard>
          </div>

          <ChartCard
            title="Calories over time"
            subtitle={`Average ${summary.avg_calories.toLocaleString("en-US")} kcal on ${summary.days_logged} logged ${
              summary.days_logged === 1 ? "day" : "days"
            } in the last ${range} days`}
            legend={
              <Legend
                items={[
                  { label: "Calories per day", color: "var(--series-1)" },
                  { label: "7-day average (logged days)", color: "var(--series-2)" },
                ]}
              />
            }
            table={{
              columns: ["Day", "kcal", "7-day avg", "Meals"],
              rows: days.map((d) => [shortDate(d.day), d.calories.toLocaleString("en-US"), d.calories_avg7 ?? "-", d.meal_count]),
            }}
          >
            <CaloriesChart days={days} />
          </ChartCard>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Protein per day"
              subtitle={`Average ${summary.avg_protein} g on logged days`}
              table={{ columns: ["Day", "Protein (g)"], rows: days.map((d) => [shortDate(d.day), d.protein_g]) }}
            >
              <ProteinChart days={days} />
            </ChartCard>

            <ChartCard title="Most-logged foods" subtitle={`Top 5, last ${range} days`}>
              <TopFoods foods={topFoods} />
            </ChartCard>
          </div>
        </>
      )}

      <p className="text-xs text-foreground/50">Estimates only, not medical or dietary advice.</p>
    </section>
  );
}
