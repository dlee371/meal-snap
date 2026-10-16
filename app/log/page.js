// /log: TEMPORARY list of your uploaded meals, so Phase 2 can be verified
// (and so a second account can confirm it sees nothing). Phase 5 replaces this
// with the real daily log and totals.
import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import LocalTime from "@/components/LocalTime";

export const metadata = { title: "Log · Meal Snap Logger" };

export default async function LogPage() {
  // Middleware already redirects signed-out users; this is the second check
  // (never rely on middleware alone).
  const user = await requireUser("/log");

  // No "where user_id = ..." needed: RLS only returns this user's rows.
  const meals = await withUser(user.id, async (db) => {
    const { rows } = await db.query(
      `select id, status, created_at from meals order by created_at desc limit 50`,
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
                <span className="text-foreground/60">{meal.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
