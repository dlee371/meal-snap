// Upload rules shared by the browser (PhotoPicker) and the server (POST /api/meals).
// Pure functions only, so they're easy to unit-test.

// Vercel rejects request bodies over 4.5 MB, so stay under that.
// A compressed 1600 px JPEG is usually 200–600 KB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// What the file picker offers. HEIC/HEIF (iPhone) gets converted to JPEG in the
// browser before upload; the server only ever receives the types below.
export const ACCEPTED_INPUT = "image/*";

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Identify an image by its first bytes ("magic numbers") instead of trusting the
// file name or the browser-supplied type, both of which are easy to fake.
// Returns "image/jpeg" | "image/png" | "image/webp" | null.
export function detectImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const startsWith = (sig, offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: "RIFF" <4 size bytes> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

// Where a meal photo lives in Blob storage: <user_id>/<meal_id>.<ext>
export function photoPath(userId, mealId, mimeType) {
  const ext = EXTENSIONS[mimeType];
  if (!userId || !mealId || !ext) throw new Error("photoPath: invalid arguments");
  return `${userId}/${mealId}.${ext}`;
}

// Postgres throws on a malformed uuid, so check route params before querying.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}
