import { describe, it, expect } from "vitest";
import { detectImageType, photoPath, isUuid } from "@/lib/upload-rules";

// Build a 16-byte buffer that starts with the given bytes.
const withHeader = (...header) => {
  const bytes = new Uint8Array(16);
  bytes.set(header);
  return bytes;
};

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(detectImageType(withHeader(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(withHeader(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      "image/png",
    );
    const riff = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0];
    expect(detectImageType(withHeader(...riff, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });

  it("rejects other files, even when renamed to .jpg", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 fake document");
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(detectImageType(pdf)).toBeNull();
    expect(detectImageType(html)).toBeNull();
    // RIFF but not WebP (e.g. a .wav file)
    const wav = withHeader(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45);
    expect(detectImageType(wav)).toBeNull();
  });

  it("rejects empty or tiny input", () => {
    expect(detectImageType(undefined)).toBeNull();
    expect(detectImageType(new Uint8Array(0))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });
});

describe("photoPath", () => {
  it("puts the photo in the user's own folder with the right extension", () => {
    expect(photoPath("user123", "meal-1", "image/jpeg")).toBe("user123/meal-1.jpg");
    expect(photoPath("user123", "meal-1", "image/webp")).toBe("user123/meal-1.webp");
  });

  it("throws on missing ids or unsupported types", () => {
    expect(() => photoPath("", "meal-1", "image/jpeg")).toThrow();
    expect(() => photoPath("user123", "meal-1", "image/gif")).toThrow();
  });
});

describe("isUuid", () => {
  it("accepts uuids and rejects anything else", () => {
    expect(isUuid("3f2b8c1e-9a4d-4e6b-8f0a-1c2d3e4f5a6b")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("3f2b8c1e-9a4d-4e6b-8f0a-1c2d3e4f5a6b; drop table meals")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
