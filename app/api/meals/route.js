// POST /api/meals: upload a meal photo and create its `meals` row.
// Body: multipart form data with one field, "photo" (already compressed in the browser).
// Returns 201 { id } on success, or { error } with a friendly message.
import { getSession } from "@/lib/session";
import { withUser } from "@/lib/db";
import { savePhoto, deletePhoto } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, detectImageType, photoPath } from "@/lib/upload-rules";
import { DAILY_ANALYSIS_LIMIT, analysesInLast24h, LIMIT_MESSAGE } from "@/lib/usage";

const fail = (status, error) => Response.json({ error }, { status });

export async function POST(request) {
  // Middleware doesn't cover /api routes, so each route checks the session itself.
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");
  const userId = session.user.id;

  // Every upload is followed by an analysis, so refuse early if the daily cap is used up.
  const used = await withUser(userId, (db) => analysesInLast24h(db));
  if (used >= DAILY_ANALYSIS_LIMIT) return fail(429, LIMIT_MESSAGE);

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Upload failed. Please try again.");
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return fail(400, "No photo received.");
  if (photo.size > MAX_UPLOAD_BYTES) return fail(413, "That photo is too large (max 4 MB).");

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return fail(415, "Only JPEG, PNG or WebP photos are supported.");

  // The server picks the path, so a user can never write into someone else's folder.
  const mealId = crypto.randomUUID();
  const path = photoPath(userId, mealId, type);

  try {
    await savePhoto(path, bytes, type);
  } catch (error) {
    console.error("Photo upload to Blob failed:", error);
    return fail(502, "Couldn't store the photo. Please try again.");
  }

  try {
    await withUser(userId, (db) =>
      db.query(
        `insert into meals (id, user_id, image_path, status)
         values ($1, $2, $3, 'analyzing')`,
        [mealId, userId, path],
      ),
    );
  } catch (error) {
    // Don't leave an orphaned photo behind if the database insert fails.
    await deletePhoto(path).catch(() => {});
    console.error("Insert into meals failed:", error);
    return fail(500, "Couldn't save the meal. Please try again.");
  }

  return Response.json({ id: mealId }, { status: 201 });
}
