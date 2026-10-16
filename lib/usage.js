// Per-user daily cap on AI analyses (server-only), so a bug or a bad actor
// can't run up the API bill. Counts rows in ai_calls (see 002_ai_calls.sql).
import "server-only";

export const DAILY_ANALYSIS_LIMIT = 30;

// Rolling 24-hour window: simpler than "calendar day in the user's time zone"
// and just as effective as a safety cap.
// `db` must be a client from withUser(), so RLS limits the count to this user.
export async function analysesInLast24h(db) {
  const { rows } = await db.query(
    "select count(*)::int as count from ai_calls where created_at > now() - interval '24 hours'",
  );
  return rows[0].count;
}

export const LIMIT_MESSAGE = `You've reached today's limit of ${DAILY_ANALYSIS_LIMIT} meal analyses. Please try again tomorrow.`;
