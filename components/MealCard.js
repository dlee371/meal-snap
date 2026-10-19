// One meal in the daily log: thumbnail, type, local time, calories, and a prompt
// when the meal still needs the user's attention.
import Link from "next/link";
import Image from "next/image";

const PROMPTS = {
  needs_review: "Review",
  failed: "Add foods",
  analyzing: "Add foods",
};

const capitalize = (text) => text[0].toUpperCase() + text.slice(1);

export default function MealCard({ meal }) {
  const prompt = PROMPTS[meal.status];

  return (
    <li>
      <Link
        href={`/meals/${meal.id}`}
        className="flex items-center gap-3 rounded-lg border border-foreground/10 p-2 hover:bg-foreground/5"
      >
        <Image
          src={`/api/photos/${meal.id}`}
          alt=""
          width={160}
          height={160}
          unoptimized
          className="size-16 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {meal.meal_type ? capitalize(meal.meal_type) : "Meal"}
            <span className="ml-2 text-sm font-normal text-foreground/60">{meal.time_local}</span>
          </p>
          <p className="truncate text-sm text-foreground/60">{meal.item_names || "No foods yet"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-semibold tabular-nums">{meal.calories} kcal</span>
          {prompt && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {prompt} →
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
