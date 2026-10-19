import { describe, it, expect } from "vitest";
import { planItemChanges, guessMealType } from "@/lib/meal-edit";

const rice = { id: "a", name: "white rice", portion: "1 cup", grams: 160, calories: 210, protein_g: 4, carbs_g: 46, fat_g: 0 };
const chicken = { id: "b", name: "chicken", portion: "1 piece", grams: 140, calories: 230, protein_g: 43, carbs_g: 0, fat_g: 5 };

describe("planItemChanges", () => {
  it("does nothing when the user saves without changes", () => {
    const plan = planItemChanges([rice, chicken], [{ ...rice }, { ...chicken }]);
    expect(plan).toEqual({ toInsert: [], toUpdate: [], toDelete: [], unknownIds: [] });
  });

  it("only updates (and flags) items whose values changed", () => {
    const fixedRice = { ...rice, name: "brown rice", calories: 220 };
    const plan = planItemChanges([rice, chicken], [fixedRice, { ...chicken }]);
    expect(plan.toUpdate).toEqual([fixedRice]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it("deletes items the user removed and inserts items they added", () => {
    const salad = { name: "side salad", portion: "", grams: null, calories: 50, protein_g: 1, carbs_g: 5, fat_g: 3 };
    const plan = planItemChanges([rice, chicken], [{ ...chicken }, salad]);
    expect(plan.toDelete).toEqual(["a"]);
    expect(plan.toInsert).toEqual([salad]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("treats blank and null the same, and ignores surrounding spaces", () => {
    const before = { ...rice, portion: null, grams: null };
    const after = { ...rice, portion: "", grams: null, name: " white rice " };
    expect(planItemChanges([before], [after]).toUpdate).toEqual([]);
  });

  it("notices a number changing to or from blank", () => {
    expect(planItemChanges([rice], [{ ...rice, grams: null }]).toUpdate).toHaveLength(1);
  });

  it("reports ids that aren't part of this meal instead of updating them", () => {
    const plan = planItemChanges([rice], [{ ...rice }, { ...chicken, id: "someone-elses-item" }]);
    expect(plan.unknownIds).toEqual(["someone-elses-item"]);
    expect(plan.toUpdate).toEqual([]);
  });
});

describe("guessMealType", () => {
  it.each([
    ["2026-10-19T07:30", "breakfast"],
    ["2026-10-19T12:15", "lunch"],
    ["2026-10-19T16:00", "snack"],
    ["2026-10-19T19:45", "dinner"],
    ["2026-10-19T23:30", "snack"],
    ["2026-10-19T03:00", "snack"],
  ])("%s → %s", (time, expected) => {
    expect(guessMealType(time)).toBe(expected);
  });

  it("falls back to snack for bad input", () => {
    expect(guessMealType("")).toBe("snack");
    expect(guessMealType(undefined)).toBe("snack");
  });
});
