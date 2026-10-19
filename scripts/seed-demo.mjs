// Seed a DEMO account with realistic sample meals so the dashboard looks real.
//
// Usage (the demo account must already exist: sign up in the app first):
//   npm run seed:demo -- demo@example.com --yes
//   npm run seed:demo -- demo@example.com --yes --days 30 --tz America/Chicago
//
// What it does:
//   1. Uploads 6 sample photos (scripts/demo-photos, CC0) to <user_id>/demo/ in Blob.
//   2. Deletes this user's previous SAMPLE meals (image_path under <user_id>/demo/)
//      and inserts new ones for the last N days. Real meals are never touched.
// It connects as app_user with app.user_id set, so Row Level Security applies
// exactly as in the app. It needs DATABASE_URL and BLOB_READ_WRITE_TOKEN
// (npm run seed:demo loads them from .env.local).
import { readFile } from "node:fs/promises";
import pg from "pg";
import { put } from "@vercel/blob";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const email = args.find((arg) => arg.includes("@"))?.toLowerCase();
const days = Math.min(Math.max(Number(flag("days", 30)) || 30, 1), 90);
const timeZone = flag("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);

if (!email || !args.includes("--yes")) {
  console.log("Usage: npm run seed:demo -- <demo-email> --yes [--days 30] [--tz America/Chicago]");
  console.log("Replaces that account's SAMPLE meals (real meals are kept). --yes confirms.");
  process.exit(1);
}
for (const name of ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Run via "npm run seed:demo" so .env.local is loaded.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Sample menu: each photo has the items an AI might find in it (whole numbers).
// ---------------------------------------------------------------------------
const item = (name, portion, grams, calories, protein_g, carbs_g, fat_g, confidence = "high") => ({
  name, portion, grams, calories, protein_g, carbs_g, fat_g, confidence,
});
const MENU = {
  oatmeal: [
    item("muesli", "about 2/3 cup", 60, 220, 6, 38, 5),
    item("milk", "about 3/4 cup", 200, 120, 7, 10, 5, "medium"),
    item("banana slices", "half a banana", 60, 55, 1, 14, 0),
    item("raspberries", "a few berries", 30, 15, 0, 4, 0, "low"),
  ],
  pancakes: [
    item("buckwheat pancakes", "stack of 3", 150, 330, 10, 52, 9),
    item("butter", "1 pat", 10, 72, 0, 0, 8, "medium"),
    item("blueberries", "a small handful", 40, 23, 0, 6, 0),
  ],
  sandwich: [
    item("halloumi and roasted vegetable panini", "1 sandwich", 250, 520, 22, 48, 26, "medium"),
    item("red cabbage slaw", "about 1/2 cup", 80, 45, 1, 8, 1),
    item("green olives", "3 olives", 20, 30, 0, 1, 3, "low"),
  ],
  burrito: [item("chicken burrito", "1 large burrito", 350, 650, 38, 68, 22, "medium")],
  pasta: [
    item("spaghetti pomodoro", "about 1.5 cups", 300, 480, 15, 80, 11),
    item("parmesan", "about 1 tablespoon", 10, 40, 4, 0, 3, "medium"),
    item("cherry tomatoes", "4 tomatoes", 60, 11, 1, 2, 0),
  ],
  smoothie: [item("kiwi smoothie", "1 tall glass", 350, 210, 4, 46, 2, "medium")],
};
const SLOTS = [
  { type: "breakfast", photos: ["oatmeal", "pancakes"], hour: [7, 9] },
  { type: "lunch", photos: ["sandwich", "burrito"], hour: [12, 13] },
  { type: "snack", photos: ["smoothie"], hour: [15, 16], chance: 0.45 },
  { type: "dinner", photos: ["pasta", "burrito"], hour: [18, 20] },
];
const SKIPPED_DAYS = new Set([9, 20]); // days ago with nothing logged, to show zero-days

// Small deterministic random generator, so every run produces the same data.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const scaleItem = (food, factor) => ({
  ...food,
  grams: Math.round(food.grams * factor),
  calories: Math.round(food.calories * factor),
  protein_g: Math.round(food.protein_g * factor),
  carbs_g: Math.round(food.carbs_g * factor),
  fat_g: Math.round(food.fat_g * factor),
});

function todayIn(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function shiftDate(date, delta) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const nowHourIn = (tz) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));

// Build the list of sample meals (pure data, no I/O).
function buildMeals() {
  const today = todayIn(timeZone);
  const currentHour = nowHourIn(timeZone);
  const meals = [];

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    if (SKIPPED_DAYS.has(daysAgo)) continue;
    const date = shiftDate(today, -daysAgo);
    const random = mulberry32(daysAgo + 1);

    for (const slot of SLOTS) {
      if (slot.chance && random() > slot.chance) continue;
      const hour = slot.hour[0] + Math.floor(random() * (slot.hour[1] - slot.hour[0] + 1));
      if (daysAgo === 0 && hour >= currentHour) continue; // no meals in the future
      const minute = [0, 15, 30, 45][Math.floor(random() * 4)];
      const photo = slot.photos[Math.floor(random() * slot.photos.length)];

      const portion = 0.85 + random() * 0.35; // 85%–120% of the base portion
      const aiItems = MENU[photo].map((food) => scaleItem(food, portion));
      // About 1 in 4 meals: the user corrected one AI guess (the interview story).
      const editedIndex = random() < 0.25 ? Math.floor(random() * aiItems.length) : -1;
      const items = aiItems.map((food, index) =>
        index === editedIndex ? { ...scaleItem(food, 1.2), user_edited: true } : { ...food, user_edited: false },
      );

      meals.push({
        photo,
        type: slot.type,
        local: `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        // Leave today's latest meal unreviewed so the "Review" prompt shows up.
        status: "confirmed",
        aiRaw: { is_food: true, items: aiItems, notes: "Sample data generated for the demo account." },
        items,
      });
    }
  }
  const last = meals[meals.length - 1];
  if (last?.local.startsWith(today)) {
    last.status = "needs_review";
    last.items = last.aiRaw.items.map((food) => ({ ...food, user_edited: false }));
  }
  return meals;
}

// ---------------------------------------------------------------------------
// Database + storage
// ---------------------------------------------------------------------------
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const token = process.env.BLOB_READ_WRITE_TOKEN;

try {
  const { rows: users } = await pool.query('select id from "user" where lower(email) = $1', [email]);
  if (users.length === 0) throw new Error(`No account with email ${email}. Sign up in the app first.`);
  const userId = users[0].id;

  // 1. Upload the sample photos once; meals share them.
  const photoPath = (name) => `${userId}/demo/${name}.jpg`;
  for (const name of Object.keys(MENU)) {
    const bytes = await readFile(new URL(`./demo-photos/${name}.jpg`, import.meta.url));
    await put(photoPath(name), bytes, {
      access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true, token,
    });
  }
  console.log(`Uploaded ${Object.keys(MENU).length} sample photos.`);

  // 2. Replace the sample meals in one transaction, as the demo user (RLS applies).
  const meals = buildMeals();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    const { rowCount } = await client.query("delete from meals where image_path like $1", [`${userId}/demo/%`]);

    for (const meal of meals) {
      const { rows } = await client.query(
        `insert into meals (user_id, image_path, eaten_at, meal_type, status, ai_model, ai_raw)
         values ($1, $2, ($3::timestamp at time zone $4), $5, $6, 'demo-seed', $7::jsonb)
         returning id`,
        [userId, photoPath(meal.photo), meal.local, timeZone, meal.type, meal.status, JSON.stringify(meal.aiRaw)],
      );
      for (const food of meal.items) {
        await client.query(
          `insert into meal_items
             (meal_id, user_id, name, portion, grams, calories, protein_g, carbs_g, fat_g, confidence, user_edited, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, clock_timestamp())`,
          [rows[0].id, userId, food.name, food.portion, food.grams, food.calories,
            food.protein_g, food.carbs_g, food.fat_g, food.confidence, food.user_edited],
        );
      }
    }
    await client.query("commit");
    console.log(`Removed ${rowCount} old sample meals; added ${meals.length} meals over ${days} days (${timeZone}).`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
