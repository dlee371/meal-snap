// Shows what the AI found: one row per item plus a total. Low-confidence items get
// a badge so the user knows what to double-check in the review step.
import { sumNutrition } from "@/lib/nutrition";

const BADGE_STYLES = {
  high: "bg-green-500/15 text-green-700 dark:text-green-400",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  low: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function ConfidenceBadge({ level }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[level] ?? ""}`}>
      {level === "low" ? "check this" : level}
    </span>
  );
}

export default function AnalysisResult({ items, notes }) {
  const totals = sumNutrition(items);

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
        {items.map((item, index) => (
          <li key={index} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-foreground/60">
                {item.portion} · {item.grams} g
              </p>
              <p className="text-xs text-foreground/60">
                P {item.protein_g} g · C {item.carbs_g} g · F {item.fat_g} g
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold">{item.calories} kcal</span>
              <ConfidenceBadge level={item.confidence} />
            </div>
          </li>
        ))}
      </ul>

      <p className="flex justify-between rounded-lg bg-foreground/5 px-3 py-2 font-semibold">
        <span>Total</span>
        <span>
          {totals.calories} kcal · P {totals.protein_g} · C {totals.carbs_g} · F {totals.fat_g}
        </span>
      </p>

      {notes && <p className="text-sm text-foreground/70">Note from the AI: {notes}</p>}
      <p className="text-xs text-foreground/50">Estimates only, not medical or dietary advice.</p>
    </div>
  );
}
