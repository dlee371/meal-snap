import { describe, it, expect } from "vitest";
import { parseRange, macroCalorieSplit, niceTicks, shortDate, compactNumber } from "@/lib/dashboard";

describe("parseRange", () => {
  it("accepts the three presets", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("30")).toBe(30);
    expect(parseRange("90")).toBe(90);
  });
  it("falls back to 7 days for anything else", () => {
    for (const bad of [undefined, "", "14", "365", "-7", "abc", ["30"]]) expect(parseRange(bad)).toBe(7);
  });
});

describe("macroCalorieSplit (4 / 4 / 9 kcal per gram)", () => {
  it("converts grams to calories", () => {
    const split = macroCalorieSplit({ protein_g: 50, carbs_g: 100, fat_g: 20 });
    expect(split.map((p) => p.kcal)).toEqual([200, 400, 180]);
  });

  it("returns percentages that add up to exactly 100", () => {
    // 1/3 each would round to 33+33+33 = 99 without correction.
    const split = macroCalorieSplit({ protein_g: 9, carbs_g: 9, fat_g: 4 }); // 36, 36, 36 kcal
    expect(split.reduce((sum, p) => sum + p.percent, 0)).toBe(100);

    const uneven = macroCalorieSplit({ protein_g: 43, carbs_g: 54, fat_g: 14 });
    expect(uneven.reduce((sum, p) => sum + p.percent, 0)).toBe(100);
  });

  it("returns zeros (not NaN) for a day with no food", () => {
    expect(macroCalorieSplit({ protein_g: 0, carbs_g: 0, fat_g: 0 }).map((p) => p.percent)).toEqual([0, 0, 0]);
    expect(macroCalorieSplit(undefined).map((p) => p.kcal)).toEqual([0, 0, 0]);
  });
});

describe("niceTicks", () => {
  it("produces round steps that cover the data", () => {
    expect(niceTicks(2430)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(2430, 5)).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    expect(niceTicks(118)).toEqual([0, 50, 100, 150]);
    expect(niceTicks(90)).toEqual([0, 25, 50, 75, 100]);
  });
  it("always ends at or above the maximum", () => {
    for (const max of [1, 7, 99, 101, 1999, 2001, 4567]) {
      const ticks = niceTicks(max);
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
    }
  });
  it("handles an all-zero range", () => expect(niceTicks(0)).toEqual([0, 1]));
});

describe("formatting", () => {
  it("shortDate keeps the calendar day", () => expect(shortDate("2026-10-19")).toBe("Oct 19"));
  it("compactNumber shortens thousands", () => {
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(1284)).toBe("1.3K");
    expect(compactNumber(2000)).toBe("2K");
  });
});
