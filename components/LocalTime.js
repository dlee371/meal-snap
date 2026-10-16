"use client";
// Shows a timestamp in the viewer's own time zone. The server (UTC on Vercel)
// and the browser can format it differently, so suppressHydrationWarning tells
// React that the browser's version is the one we want.
export default function LocalTime({ iso }) {
  const date = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}
