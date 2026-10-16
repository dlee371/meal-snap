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

// Turn a failed safeParse into one readable line for logs, e.g.
// "items.0.calories: Too big: expected number to be <=3000"
export function describeZodError(error) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
