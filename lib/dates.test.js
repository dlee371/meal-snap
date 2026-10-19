import { describe, it, expect } from "vitest";
import { isValidDateString, todayInTimeZone, shiftDate, formatLongDate } from "@/lib/dates";

describe("isValidDateString", () => {
  it("accepts real dates", () => {
    expect(isValidDateString("2026-10-19")).toBe(true);
    expect(isValidDateString("2028-02-29")).toBe(true); // leap year
  });
  it("rejects impossible or malformed dates", () => {
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-5", "19/10/2026", "", null, "2026-10-19T00:00"]) {
      expect(isValidDateString(bad)).toBe(false);
    }
  });
});

describe("todayInTimeZone", () => {
  // 03:30 UTC on Oct 20 is still the evening of Oct 19 in Chicago (UTC-5).
  const instant = new Date("2026-10-20T03:30:00Z");

  it("uses the user's local calendar day, not UTC", () => {
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-20");
    expect(todayInTimeZone("America/Chicago", instant)).toBe("2026-10-19");
    expect(todayInTimeZone("Asia/Tokyo", instant)).toBe("2026-10-20");
  });
});

describe("shiftDate", () => {
  it("moves across month, year and DST boundaries", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-11-01", 1)).toBe("2026-11-02"); // US DST ends Nov 1, 2026
    expect(shiftDate("2026-10-19", -6)).toBe("2026-10-13");
  });
});

describe("formatLongDate", () => {
  it("formats a calendar date without shifting it", () => {
    expect(formatLongDate("2026-10-19")).toBe("Monday, Oct 19, 2026");
  });
});
