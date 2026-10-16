import { describe, it, expect } from "vitest";
import { sumNutrition } from "@/lib/nutrition";
import plate from "@/lib/fixtures/ai-plate.json";

describe("sumNutrition", () => {
  it("adds up calories and macros", () => {
    expect(sumNutrition(plate.items)).toEqual({
      calories: 230 + 210 + 28 + 90,
      protein_g: 43 + 4 + 2 + 1,
      carbs_g: 0 + 46 + 6 + 2,
      fat_g: 5 + 0 + 0 + 9,
    });
  });

  it("returns zeros for an empty or missing list", () => {
    const zeros = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    expect(sumNutrition([])).toEqual(zeros);
    expect(sumNutrition()).toEqual(zeros);
  });

  it("treats blank or invalid values as 0 instead of producing NaN", () => {
    const items = [{ calories: "120", protein_g: "", carbs_g: undefined, fat_g: "abc" }, { calories: 30 }];
    expect(sumNutrition(items)).toEqual({ calories: 150, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
});
