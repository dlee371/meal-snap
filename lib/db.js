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
