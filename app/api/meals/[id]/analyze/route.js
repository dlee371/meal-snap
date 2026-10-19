// POST /api/meals/[id]/analyze: run AI analysis on an uploaded meal photo.
//
// Flow:
//   1. Short transaction: check the daily cap, "claim" the meal (so it can't be
//      analyzed twice), and log the AI call.
//   2. Download the photo from private storage (never trust a URL from the browser).
//   3. Call analyzeMeal(). No database transaction is held open during this
//      5–10 second call.
//   4. Save the items + ai_raw and set status needs_review, or mark the meal failed,
//      or (no food) delete it.
import { getSession } from "@/lib/session";
import { withUser } from "@/lib/db";
import { readPhoto, deletePhoto } from "@/lib/storage";
import { isUuid, detectImageType } from "@/lib/upload-rules";
import { analyzeMeal, currentModelName } from "@/lib/analyzeMeal";
import { DAILY_ANALYSIS_LIMIT, analysesInLast24h, LIMIT_MESSAGE } from "@/lib/usage";

// Give the AI call time to finish (Vercel's default can be shorter).
export const maxDuration = 60;

const fail = (status, error, extra = {}) => Response.json({ error, ...extra }, { status });

export async function POST(_request, { params }) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");
  const userId = session.user.id;

  const { id: mealId } = await params; // Next.js 15: params is a Promise
  if (!isUuid(mealId)) return fail(404, "Meal not found.");

  const model = currentModelName();

  // 1. Cap + claim + log, in one transaction.
  const claim = await withUser(userId, async (db) => {
    // Lock per user so two simultaneous requests can't both slip under the cap.
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);
    if ((await analysesInLast24h(db)) >= DAILY_ANALYSIS_LIMIT) return { limited: true };

    // Only a meal that is still waiting and has never been sent to the AI can be
    // claimed. RLS makes other users' meals invisible, so they can't be claimed either.
    const { rows } = await db.query(
      `update meals set ai_model = $2
        where id = $1 and status = 'analyzing' and ai_model is null
        returning image_path`,
      [mealId, model],
    );
    if (rows.length === 0) return { notClaimable: true };

    await db.query("insert into ai_calls (user_id, meal_id) values ($1, $2)", [userId, mealId]);
    return { imagePath: rows[0].image_path };
  });

  if (claim.limited) return fail(429, LIMIT_MESSAGE);
  if (claim.notClaimable) return fail(409, "This meal was already analyzed or doesn't exist.");

  // Only touch the status if it's still "analyzing": if the user already saved the
  // meal by hand while we waited, their work wins.
  const markFailed = (raw) =>
    withUser(userId, (db) =>
      db.query(
        `update meals set status = 'failed', ai_raw = $2::jsonb where id = $1 and status = 'analyzing'`,
        [mealId, raw ? JSON.stringify(raw) : null],
      ),
    );
  const FAILED_MESSAGE = "We couldn't analyze this photo. You can add the foods by hand.";

  // 2. Download the photo on the server.
  let bytes;
  try {
    const photo = await readPhoto(claim.imagePath);
    if (!photo || photo.statusCode !== 200) throw new Error("photo missing");
    bytes = new Uint8Array(await new Response(photo.stream).arrayBuffer());
  } catch (error) {
    console.error("Could not read meal photo:", error);
    await markFailed(null);
    return fail(502, FAILED_MESSAGE, { status: "failed" });
  }
  const mediaType = detectImageType(bytes);

  // 3. Ask the AI.
  let result;
  try {
    result = await analyzeMeal(bytes, mediaType);
  } catch (error) {
    // Full details go to the server log only; the user gets a friendly message.
    console.error("analyzeMeal failed:", error);
    await markFailed(error.raw ?? null);
    return fail(502, FAILED_MESSAGE, { status: "failed" });
  }

  // 4. Save the outcome. Lock the meal row first: if the user saved it by hand while
  //    the AI was thinking (status no longer "analyzing"), keep their version and
  //    only record the AI's answer in ai_raw.
  const items = result.meal.items;
  const outcome = await withUser(userId, async (db) => {
    const { rows } = await db.query("select status from meals where id = $1 for update", [mealId]);
    if (rows[0]?.status !== "analyzing") {
      await db.query("update meals set ai_raw = $2::jsonb where id = $1", [mealId, JSON.stringify(result.raw)]);
      return "kept_user_version";
    }

    // 4a. Not food: don't save junk. The ai_calls row stays, so it still counts.
    if (!result.meal.is_food) {
      await db.query("delete from meals where id = $1", [mealId]);
      return "not_food";
    }

    // 4b. Save items and the untouched AI answer, then hand over to the review step.
    // clock_timestamp() (not now(), which is fixed for the whole transaction) gives
    // each row a distinct created_at, so the review page lists items in the AI's order.
    for (const item of items) {
      await db.query(
        `insert into meal_items
           (meal_id, user_id, name, portion, grams, calories, protein_g, carbs_g, fat_g, confidence, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, clock_timestamp())`,
        [mealId, userId, item.name, item.portion, item.grams, item.calories,
          item.protein_g, item.carbs_g, item.fat_g, item.confidence],
      );
    }
    await db.query(
      `update meals set status = 'needs_review', ai_raw = $2::jsonb where id = $1`,
      [mealId, JSON.stringify(result.raw)],
    );
    return "saved";
  });

  if (outcome === "not_food") {
    await deletePhoto(claim.imagePath).catch(() => {});
    return fail(422, "No food detected, try another photo.", { notFood: true });
  }
  if (outcome === "kept_user_version") {
    return fail(409, "You already saved this meal, so the AI's answer wasn't applied.");
  }
  return Response.json({ status: "needs_review", items, notes: result.meal.notes });
}
