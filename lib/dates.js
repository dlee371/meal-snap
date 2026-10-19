// Pure calendar-date helpers. Dates are plain "YYYY-MM-DD" strings (a calendar
// day, no time or time zone attached), which is what URLs and Postgres `date` use.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// True only for real calendar dates ("2026-02-30" is false).
export function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Today's date in the given IANA time zone, e.g. "2026-10-19".
// ("en-CA" formats dates as YYYY-MM-DD.)
export function todayInTimeZone(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// "2026-10-19" + 1 → "2026-10-20". Uses UTC internally so DST never skews it.
export function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// "2026-10-19" → "Monday, Oct 19, 2026" (for headings).
export function formatLongDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00Z`));
}
