// PUT    /api/meals/[id]: save the user's reviewed/corrected meal → status "confirmed"
// DELETE /api/meals/[id]: delete the meal (items cascade) and its photo
import { getSession } from "@/lib/session";
import { withUser } from "@/lib/db";
import { deletePhoto } from "@/lib/storage";
import { isUuid } from "@/lib/upload-rules";
import { mealEditSchema, describeZodError } from "@/lib/schemas";
import { planItemChanges } from "@/lib/meal-edit";
import { getUserTimeZone } from "@/lib/user-timezone";

const fail = (status, error) => Response.json({ error }, { status });

// Stop early with a 4xx response from inside withUser (rolls back the transaction).
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ITEM_COLUMNS = "name, portion, grams, calories, protein_g, carbs_g, fat_g";
const itemValues = (item) => [item.name, item.portion, item.grams, item.calories, item.protein_g, item.carbs_g, item.fat_g];

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");
  const userId = session.user.id;

  const { id: mealId } = await params; // Next.js 15: params is a Promise
  if (!isUuid(mealId)) return fail(404, "Meal not found.");

  const body = await request.json().catch(() => null);
  const parsed = mealEditSchema.safeParse(body);
  if (!parsed.success) return fail(400, `Please fix the form: ${describeZodError(parsed.error)}`);
  const edit = parsed.data;

  const timeZone = await getUserTimeZone();

  try {
    await withUser(userId, async (db) => {
      // Lock the meal row so a late-finishing AI analysis can't interleave with this save.
      const { rows: meals } = await db.query("select id from meals where id = $1 for update", [mealId]);
      if (meals.length === 0) throw new HttpError(404, "Meal not found.");

      const { rows: existing } = await db.query(
        `select id, ${ITEM_COLUMNS} from meal_items where meal_id = $1`,
        [mealId],
      );
      const plan = planItemChanges(existing, edit.items);
      if (plan.unknownIds.length > 0) throw new HttpError(400, "Some items don't belong to this meal. Reload and try again.");

      if (plan.toDelete.length > 0) {
        await db.query("delete from meal_items where meal_id = $1 and id = any($2::uuid[])", [mealId, plan.toDelete]);
      }
      // Only rows that really changed are updated and flagged user_edited.
      for (const item of plan.toUpdate) {
        await db.query(
          `update meal_items
              set name = $3, portion = $4, grams = $5, calories = $6,
                  protein_g = $7, carbs_g = $8, fat_g = $9, user_edited = true
            where id = $1 and meal_id = $2`,
          [item.id, mealId, ...itemValues(item)],
        );
      }
      // Items the user added: no AI confidence, and edited by definition.
      // clock_timestamp() keeps them in the order they were added (see analyze route).
      for (const item of plan.toInsert) {
        await db.query(
          `insert into meal_items (meal_id, user_id, ${ITEM_COLUMNS}, user_edited, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, clock_timestamp())`,
          [mealId, userId, ...itemValues(item)],
        );
      }

      // Postgres turns the local wall-clock time into a UTC timestamp using the
      // user's time zone (handles daylight saving correctly).
      await db.query(
        `update meals
            set meal_type = $2,
                eaten_at = ($3::timestamp at time zone $4),
                status = 'confirmed'
          where id = $1`,
        [mealId, edit.meal_type, edit.eaten_local, timeZone],
      );
    });
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.message);
    // 22007/22008 = Postgres "invalid date/time" (e.g. February 30).
    if (error.code === "22007" || error.code === "22008") return fail(400, "That date and time isn't valid.");
    console.error("Saving meal failed:", error);
    return fail(500, "Couldn't save your changes. Please try again.");
  }

  return Response.json({ ok: true });
}

export async function DELETE(_request, { params }) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");

  const { id: mealId } = await params;
  if (!isUuid(mealId)) return fail(404, "Meal not found.");

  // RLS: this only deletes the meal if it belongs to the signed-in user.
  const deleted = await withUser(session.user.id, async (db) => {
    const { rows } = await db.query("delete from meals where id = $1 returning image_path", [mealId]);
    if (rows.length === 0) return null;
    // Sample (demo) meals share photos, so only remove a photo nobody else uses.
    const { rows: others } = await db.query("select 1 from meals where image_path = $1 limit 1", [rows[0].image_path]);
    return { imagePath: rows[0].image_path, shared: others.length > 0 };
  });
  if (!deleted) return fail(404, "Meal not found.");

  if (!deleted.shared) {
    await deletePhoto(deleted.imagePath).catch((error) => console.error("Photo delete failed:", error));
  }
  return Response.json({ ok: true });
}
