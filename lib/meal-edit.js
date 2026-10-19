// Pure helpers for the review/edit step (no database, easy to unit-test).

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

// The fields a user can edit on an item. If any of them changes, the item is
// marked user_edited, which is what lets us compare AI guesses with corrections.
export const EDITABLE_FIELDS = ["name", "portion", "grams", "calories", "protein_g", "carbs_g", "fat_g"];

// Treat null/undefined/"" the same, and compare numbers as numbers.
function sameValue(a, b) {
  const blank = (v) => v === null || v === undefined || v === "";
  if (blank(a) && blank(b)) return true;
  return String(a).trim() === String(b).trim();
}

/**
 * Work out what to change in the database when a meal is saved.
 * @param {Array} existing - items currently in the DB (each has an `id`)
 * @param {Array} submitted - items from the form (existing ones keep their `id`; new ones have none)
 * @returns {{ toInsert: Array, toUpdate: Array, toDelete: string[], unknownIds: string[] }}
 *   toUpdate only contains items where at least one editable field changed.
 */
export function planItemChanges(existing, submitted) {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const keptIds = new Set();
  const toInsert = [];
  const toUpdate = [];
  const unknownIds = [];

  for (const item of submitted) {
    if (!item.id) {
      toInsert.push(item);
      continue;
    }
    const before = existingById.get(item.id);
    if (!before) {
      unknownIds.push(item.id); // not in this meal: reject rather than guess
      continue;
    }
    keptIds.add(item.id);
    const changed = EDITABLE_FIELDS.some((field) => !sameValue(before[field], item[field]));
    if (changed) toUpdate.push(item);
  }

  const toDelete = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
  return { toInsert, toUpdate, toDelete, unknownIds };
}

// Suggest a meal type from the local time ("2026-10-19T12:30" → "lunch").
export function guessMealType(localDateTime) {
  const hour = Number(String(localDateTime).slice(11, 13));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "snack";
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}
