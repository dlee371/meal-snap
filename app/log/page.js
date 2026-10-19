// /log: TEMPORARY list of your meals with their AI totals. Phase 5 replaces this
// with the real daily log (date picker, per-day totals in your time zone).
import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import LocalTime from "@/components/LocalTime";

export const metadata = { title: "Log · Meal Snap Logger" };

const STATUS_LABELS = {
  analyzing: "Analyzing…",
  needs_review: "Needs review",
  confirmed: "Confirmed",
  failed: "Analysis failed",
};

export default async function LogPage() {
  // Middleware already redirects signed-out users; this is the second check
  // (never rely on middleware alone).
  const user = await requireUser("/log");

  // No "where user_id = ..." needed: RLS only returns this user's rows.
  // Totals are summed in SQL, not in JavaScript.
  const meals = await withUser(user.id, async (db) => {
    const { rows } = await db.query(
      `select m.id, m.status, m.created_at,
              count(i.id)::int as item_count,
              coalesce(sum(i.calories), 0)::int as calories
         from meals m
         left join meal_items i on i.meal_id = m.id
        group by m.id
        order by m.created_at desc
        limit 50`,
    );
    return rows;
  });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Your meals</h1>
        <p className="text-sm text-foreground/70">Signed in as {user.email}</p>
      </div>

      {meals.length === 0 ? (
        <p className="text-foreground/70">
          Nothing logged yet.{" "}
          <Link href="/snap" className="underline">
            Snap your first meal.
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {meals.map((meal) => (
            <li key={meal.id} className="overflow-hidden rounded-lg border border-foreground/10">
              <Link href={`/meals/${meal.id}`} className="block hover:opacity-90">
              <Image
                src={`/api/photos/${meal.id}`}
                alt="Meal photo"
                width={400}
                height={300}
                unoptimized
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-col p-2 text-xs">
                <LocalTime iso={meal.created_at.toISOString()} />
                <span className="font-medium">
                  {meal.item_count > 0 ? `${meal.calories} kcal · ${meal.item_count} items` : "—"}
                </span>
                <span className={meal.status === "confirmed" ? "text-foreground/60" : "font-medium text-amber-600"}>
                  {STATUS_LABELS[meal.status] ?? meal.status}
                </span>
              </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
