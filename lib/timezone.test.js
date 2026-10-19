import { describe, it, expect } from "vitest";
import { isValidTimeZone, normalizeTimeZone } from "@/lib/timezone";

describe("time zone cookie handling", () => {
  it("accepts real IANA time zone names", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects junk, which falls back to UTC", () => {
    for (const bad of ["Not/AZone", "", "'; drop table meals; --", "x".repeat(100), undefined, 42]) {
      expect(isValidTimeZone(bad)).toBe(false);
      expect(normalizeTimeZone(bad)).toBe("UTC");
    }
  });

  it("keeps valid zones unchanged", () => {
    expect(normalizeTimeZone("Europe/London")).toBe("Europe/London");
  });
});
