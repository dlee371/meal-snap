// Time zone helpers shared by browser and server (pure, no Next.js imports).
// The browser stores its IANA time zone (e.g. "America/Chicago") in a cookie so
// server code can do "today" and per-day totals in the user's local time.

export const TZ_COOKIE = "tz";
export const DEFAULT_TIME_ZONE = "UTC";

// The cookie comes from the browser, so treat it as untrusted: only accept names
// the JavaScript runtime itself recognises as time zones.
export function isValidTimeZone(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value) {
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}
