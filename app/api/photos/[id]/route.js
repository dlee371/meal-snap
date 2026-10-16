// GET /api/photos/[id]: stream a meal's photo, but only to the meal's owner.
// The ownership check is Row Level Security: if the meal isn't yours, the query
// returns no row, exactly as if it didn't exist.
import { getSession } from "@/lib/session";
import { withUser } from "@/lib/db";
import { readPhoto } from "@/lib/storage";
import { isUuid } from "@/lib/upload-rules";

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_request, { params }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Next.js 15: params is a Promise, so it must be awaited.
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const meal = await withUser(session.user.id, async (db) => {
    const { rows } = await db.query("select image_path from meals where id = $1", [id]);
    return rows[0];
  });
  // Same 404 for "doesn't exist" and "not yours", so ids can't be probed.
  if (!meal) return notFound();

  const photo = await readPhoto(meal.image_path);
  if (!photo || photo.statusCode !== 200) return notFound();

  return new Response(photo.stream, {
    headers: {
      "Content-Type": photo.blob.contentType,
      // "private": browsers may cache it, shared caches/CDNs must not.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
