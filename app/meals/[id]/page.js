// /meals/[id]: review and edit one meal (photo on top, editable items below).
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/upload-rules";
import { aiMealSchema } from "@/lib/schemas";
import { sumNutrition } from "@/lib/nutrition";
import { getUserTimeZone } from "@/lib/user-timezone";
import MealEditor from "@/components/MealEditor";

export const metadata = { title: "Review meal · Meal Snap Logger" };

const BANNERS = {
  needs_review: "Check the AI's guesses (especially anything marked “check this”), fix what's wrong, then save.",
  confirmed: "Saved to your log. You can still edit it.",
  failed: "The AI couldn't analyze this photo. Add what you ate by hand.",
  analyzing: "This photo hasn't been analyzed yet. Run the AI or add foods by hand.",
};

export default async function MealPage({ params, searchParams }) {
  // Next.js 15: params and searchParams are Promises.
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireUser(`/meals/${id}`);
  if (!isUuid(id)) notFound();

  const timeZone = await getUserTimeZone();

  const data = await withUser(user.id, async (db) => {
    // eaten_local: the meal time as wall-clock time in the user's time zone,
    // formatted for <input type="datetime-local">. Postgres does the conversion.
    const { rows: meals } = await db.query(
      `select id, status, meal_type, ai_model, ai_raw, created_at,
              to_char(eaten_at at time zone $2, 'YYYY-MM-DD"T"HH24:MI') as eaten_local
         from meals where id = $1`,
      [id, timeZone],
    );
    if (meals.length === 0) return null;
    const { rows: items } = await db.query(
      `select id, name, portion, grams, calories, protein_g, carbs_g, fat_g, confidence, user_edited
         from meal_items where meal_id = $1 order by created_at, id`,
      [id],
    );
    return { meal: meals[0], items };
  });
  if (!data) notFound(); // doesn't exist, or belongs to someone else (RLS)

  const { meal, items } = data;

  // The AI's original answer (ai_raw) is never changed by edits, so we can show
  // how far the user's corrections moved the total.
  const aiAnswer = aiMealSchema.safeParse(meal.ai_raw);
  const aiCalories = aiAnswer.success && aiAnswer.data.is_food ? sumNutrition(aiAnswer.data.items).calories : null;
  const notes = aiAnswer.success ? aiAnswer.data.notes : "";

  // "Analyze now" only for meals the AI never received (e.g. the tab was closed mid-upload).
  const canAnalyze = meal.status === "analyzing" && !meal.ai_model;
  const bannerText =
    meal.status === "analyzing" && meal.ai_model
      ? "The analysis didn't finish. Add what you ate by hand."
      : BANNERS[meal.status];

  // Remount the form whenever the saved data changes, so its state matches the DB.
  const editorKey = [meal.status, meal.meal_type, meal.eaten_local, ...items.map((i) => `${i.id}:${i.user_edited}`)].join("|");

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/log?date=${meal.eaten_local.slice(0, 10)}`} className="text-sm text-foreground/70 hover:underline">
        ← Back to log
      </Link>
      <h1 className="text-2xl font-bold">Review meal</h1>

      {saved && meal.status === "confirmed" ? (
        <p role="status" className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Saved! Your corrections are in the log.
        </p>
      ) : (
        <p className="rounded-md bg-foreground/5 px-3 py-2 text-sm">{bannerText}</p>
      )}

      <Image
        src={`/api/photos/${meal.id}`}
        alt="Meal photo"
        width={1600}
        height={1200}
        unoptimized
        priority
        className="max-h-80 w-full rounded-lg object-cover"
      />

      {aiCalories !== null && (
        <p className="text-sm text-foreground/70">
          AI&apos;s original estimate: <span className="font-medium">{aiCalories} kcal</span>
          {notes && <> · {notes}</>}
        </p>
      )}

      {/* Only pass what the form needs to the browser (not ai_raw etc.). */}
      <MealEditor
        key={editorKey}
        meal={{ id: meal.id, status: meal.status, meal_type: meal.meal_type, eaten_local: meal.eaten_local, canAnalyze }}
        items={items}
      />

      <p className="text-xs text-foreground/50">Estimates only, not medical or dietary advice.</p>
    </section>
  );
}
