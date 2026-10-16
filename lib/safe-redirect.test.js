import { describe, it, expect } from "vitest";
import { safeRedirectPath, DEFAULT_AFTER_LOGIN } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths, including query strings", () => {
    expect(safeRedirectPath("/snap")).toBe("/snap");
    expect(safeRedirectPath("/meals/abc?x=1")).toBe("/meals/abc?x=1");
  });

  it("falls back to the default for missing or non-string values", () => {
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath(["/snap"])).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath("")).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("blocks redirects to other websites", () => {
    expect(safeRedirectPath("https://evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath("//evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath("/\\evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath("javascript:alert(1)")).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("does not redirect back to /login", () => {
    expect(safeRedirectPath("/login")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectPath("/login?next=/log")).toBe(DEFAULT_AFTER_LOGIN);
  });
});
