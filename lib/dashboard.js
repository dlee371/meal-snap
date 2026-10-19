// Pure helpers for the dashboard (no database; unit-tested).
// The heavy lifting (sums, averages, grouping by day) happens in Postgres;
// these only interpret query params and convert units for display.

export const RANGES = [7, 30, 90];
export const DEFAULT_RANGE = 7;

// ?range=30 → 30. Anything unexpected → the default (7).
export function parseRange(value) {
  // A repeated param (?range=30&range=90) arrives as an array; Number(["30"]) is
  // 30 in JavaScript, so only accept plain strings.
  if (typeof value !== "string") return DEFAULT_RANGE;
  const days = Number(value);
  return RANGES.includes(days) ? days : DEFAULT_RANGE;
}

// Energy per gram of each macronutrient (the standard Atwater factors).
export const KCAL_PER_GRAM = { protein_g: 4, carbs_g: 4, fat_g: 9 };

/**
 * Split a day's calories by macronutrient, for the donut.
 * Uses grams × 4/4/9, so the total can differ a little from the logged
 * calories (which are per-item estimates).
 * @returns {Array<{key, label, kcal, percent}>} percent values add up to 100 (or all 0).
 */
export function macroCalorieSplit(totals) {
  const parts = [
    { key: "protein", label: "Protein", kcal: (totals?.protein_g || 0) * KCAL_PER_GRAM.protein_g },
    { key: "carbs", label: "Carbs", kcal: (totals?.carbs_g || 0) * KCAL_PER_GRAM.carbs_g },
    { key: "fat", label: "Fat", kcal: (totals?.fat_g || 0) * KCAL_PER_GRAM.fat_g },
  ];
  const total = parts.reduce((sum, part) => sum + part.kcal, 0);
  if (total === 0) return parts.map((part) => ({ ...part, percent: 0 }));

  // Round percentages so they still add up to exactly 100 (largest remainder method).
  const exact = parts.map((part) => (part.kcal / total) * 100);
  const percents = exact.map(Math.floor);
  let leftover = 100 - percents.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (leftover-- <= 0) break;
    percents[index] += 1;
  }
  return parts.map((part, index) => ({ ...part, percent: percents[index] }));
}

// Clean y-axis ticks from 0 to just above `max`: steps of 1, 2, 2.5 or 5 × 10^n,
// e.g. max 2,430 → [0, 500, 1000, 1500, 2000, 2500]. Never fewer than 2 ticks.
export function niceTicks(max, targetCount = 4) {
  if (!(max > 0)) return [0, 1];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Math.round(value * 100) / 100);
  return ticks;
}

// "2026-10-19" → "Oct 19" for chart axes.
export function shortDate(dateString) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${dateString}T00:00:00Z`),
  );
}

// 1284 → "1.3K" for compact axis ticks; small numbers stay as-is.
export function compactNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
