// Pure nutrition helpers, shared by the UI and tests.

const FIELDS = ["calories", "protein_g", "carbs_g", "fat_g"];

// Add up calories and macros across a list of items. Missing or non-numeric
// values count as 0, so a half-edited row never turns the total into NaN.
export function sumNutrition(items = []) {
  const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const item of items) {
    for (const field of FIELDS) {
      const value = Number(item?.[field]);
      if (Number.isFinite(value)) totals[field] += value;
    }
  }
  return totals;
}
