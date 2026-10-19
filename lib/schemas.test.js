import { describe, it, expect } from "vitest";
import { aiMealSchema, mealEditSchema, describeZodError } from "@/lib/schemas";
import plate from "@/lib/fixtures/ai-plate.json";
import drink from "@/lib/fixtures/ai-drink.json";
import notFood from "@/lib/fixtures/ai-not-food.json";
import invalid from "@/lib/fixtures/ai-invalid.json";
// A real answer from claude-haiku-5-5 for a chicken/rice/vegetables plate.
import realPlate from "@/lib/fixtures/ai-real-plate.json";

const item = (overrides = {}) => ({
  name: "apple",
  portion: "1 medium",
  grams: 180,
  calories: 95,
  protein_g: 0,
  carbs_g: 25,
  fat_g: 0,
  confidence: "high",
  ...overrides,
});
const meal = (overrides = {}) => ({ is_food: true, items: [item()], notes: "", ...overrides });

describe("aiMealSchema: good AI answers", () => {
  it("accepts the saved fixtures", () => {
    for (const fixture of [plate, drink, notFood, realPlate]) {
      expect(aiMealSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it("accepts boundary values (0 and the maximums)", () => {
    const result = aiMealSchema.safeParse(meal({ items: [item({ grams: 2000, calories: 3000, protein_g: 0 })] }));
    expect(result.success).toBe(true);
  });

  it("trims names and defaults missing notes to an empty string", () => {
    const { notes, ...withoutNotes } = meal({ items: [item({ name: "  banana  " })] });
    expect(notes).toBe("");
    const result = aiMealSchema.parse(withoutNotes);
    expect(result.items[0].name).toBe("banana");
    expect(result.notes).toBe("");
  });

  it("accepts 'not food' with an empty item list", () => {
    expect(aiMealSchema.safeParse({ is_food: false, items: [], notes: "a shoe" }).success).toBe(true);
  });
});

describe("aiMealSchema: bad AI answers", () => {
  const rejects = (value) => expect(aiMealSchema.safeParse(value).success).toBe(false);

  it("rejects the deliberately invalid fixture", () => rejects(invalid));
  it("rejects calories above 3000", () => rejects(meal({ items: [item({ calories: 3001 })] })));
  it("rejects grams above 2000", () => rejects(meal({ items: [item({ grams: 2001 })] })));
  it("rejects negative numbers", () => rejects(meal({ items: [item({ fat_g: -1 })] })));
  it("rejects decimals (we store whole numbers)", () => rejects(meal({ items: [item({ calories: 412.6 })] })));
  it("rejects numbers sent as strings", () => rejects(meal({ items: [item({ calories: "95" })] })));
  it("rejects unknown confidence levels", () => rejects(meal({ items: [item({ confidence: "certain" })] })));
  it("rejects empty names", () => rejects(meal({ items: [item({ name: "   " })] })));
  it("rejects missing fields", () => {
    const { calories, ...noCalories } = item();
    expect(calories).toBe(95);
    rejects(meal({ items: [noCalories] }));
  });
  it("rejects more than 15 items", () => rejects(meal({ items: Array.from({ length: 16 }, () => item()) })));
  it("rejects 'is food' with no items", () => rejects(meal({ items: [] })));
  it("rejects a missing is_food flag", () => rejects({ items: [item()], notes: "" }));
});

describe("mealEditSchema (what the review form sends)", () => {
  const editItem = (overrides = {}) => ({
    name: "rice", portion: "1 cup", grams: 160, calories: 210, protein_g: 4, carbs_g: 46, fat_g: 0, ...overrides,
  });
  const edit = (overrides = {}) => ({ meal_type: "lunch", eaten_local: "2026-10-19T12:30", items: [editItem()], ...overrides });
  const ok = (value) => expect(mealEditSchema.safeParse(value).success).toBe(true);
  const bad = (value) => expect(mealEditSchema.safeParse(value).success).toBe(false);

  it("accepts a normal save, new items without ids, blank grams and no meal type", () => {
    ok(edit());
    ok(edit({ meal_type: null, items: [editItem({ grams: null })] }));
    ok(edit({ items: [editItem({ id: "3f2b8c1e-9a4d-4e6b-8f0a-1c2d3e4f5a6b" }), editItem()] }));
  });

  it("allows bigger numbers than the AI may return (users know their meals)", () => {
    ok(edit({ items: [editItem({ calories: 4200 })] }));
  });

  it("rejects bad input", () => {
    bad(edit({ items: [] }));
    bad(edit({ items: [editItem({ name: "  " })] }));
    bad(edit({ items: [editItem({ calories: -5 })] }));
    bad(edit({ items: [editItem({ calories: 10001 })] }));
    bad(edit({ items: [editItem({ id: "not-a-uuid" })] }));
    bad(edit({ meal_type: "brunch" }));
    bad(edit({ eaten_local: "yesterday" }));
    bad(edit({ eaten_local: "2026-10-19 12:30" }));
    bad(edit({ items: Array.from({ length: 31 }, () => editItem()) }));
  });
});

describe("describeZodError", () => {
  it("lists each problem with its path", () => {
    const { error } = aiMealSchema.safeParse(meal({ items: [item({ calories: 9999 })] }));
    expect(describeZodError(error)).toMatch(/^items\.0\.calories: /);
  });
});
