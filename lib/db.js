// Shared Postgres connection pool (server-only).
// A "pool" keeps a few open connections and reuses them, instead of opening a new
// connection for every query.
import "server-only";
import { Pool } from "pg";

// In dev, Next.js hot-reloads modules on every save. Storing the pool on globalThis
// stops each reload from creating a new pool and leaking connections.
const globalForDb = globalThis;

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless functions are short-lived; a small pool is plenty.
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

// Run `fn(client)` as the given user so Row Level Security applies.
// ALL queries on meals / meal_items must go through this.
//
// Example:
//   const rows = await withUser(user.id, async (db) => {
//     const { rows } = await db.query("select * from meals");
//     return rows; // only this user's meals, enforced by Postgres
//   });
export async function withUser(userId, fn) {
  if (!userId) throw new Error("withUser() needs a user id");

  const client = await pool.connect();
  try {
    await client.query("begin");
    // The 3rd argument `true` makes the setting last only until this transaction
    // ends, so a reused connection can never carry one user's id into another
    // user's request.
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release(); // give the connection back to the pool
  }
}
