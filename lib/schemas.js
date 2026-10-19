// Zod schemas: the rules the AI's answer must pass before it touches the database.
// The JSON schema in lib/analyzeMeal.js tells the model the *shape*; these add the
// *limits* (ranges, item count) that the API can't enforce for us.
import { z } from "zod";

export const CONFIDENCE_LEVELS = ["high", "medium", "low"];

// Whole numbers within a range. Strict tool use already guarantees integers;
// this double-checks and enforces the range.
const wholeNumber = (max) => z.number().int().min(0).max(max);

export const aiItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  portion: z.string().trim().max(200),
  grams: wholeNumber(2000),
  calories: wholeNumber(3000),
  protein_g: wholeNumber(500),
  carbs_g: wholeNumber(500),
  fat_g: wholeNumber(500),
  confidence: z.enum(CONFIDENCE_LEVELS),
});

export const aiMealSchema = z
  .object({
    is_food: z.boolean(),
    items: z.array(aiItemSchema).max(15),
    notes: z.string().max(1000).default(""),
  })
  // "Food, but zero items" is a contradiction, so treat it as a bad answer (and retry).
  .refine((meal) => !meal.is_food || meal.items.length > 0, {
    message: "is_food is true but no items were returned",
    path: ["items"],
  });

// ---------------------------------------------------------------------------
// What the review form sends when the user saves a meal (PUT /api/meals/[id]).
// Limits are looser than the AI's (a user may really eat a 4000 kcal pizza) and
// match the database check constraints in 001_init.sql.
// ---------------------------------------------------------------------------
export const editItemSchema = z.object({
  id: z.uuid().optional(), // missing = a new item the user added
  name: z.string().trim().min(1, "Every item needs a name").max(200),
  portion: z.string().trim().max(200).default(""),
  grams: z.number().int().min(0).max(5000).nullable(),
  calories: z.number().int().min(0).max(10000),
  protein_g: z.number().int().min(0).max(1000),
  carbs_g: z.number().int().min(0).max(1000),
  fat_g: z.number().int().min(0).max(1000),
});

export const mealEditSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable(),
  // Local wall-clock time from <input type="datetime-local">, e.g. "2026-10-19T12:30".
  // The server converts it to UTC using the user's time zone.
  eaten_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid date and time"),
  items: z
    .array(editItemSchema)
    .min(1, "Add at least one item (or delete the meal)")
    .max(30, "A meal can have at most 30 items"),
});

// Turn a failed safeParse into one readable line for logs, e.g.
// "items.0.calories: Too big: expected number to be <=3000"
export function describeZodError(error) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
