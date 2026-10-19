// Server-side: read the user's time zone from the `tz` cookie (set by TimeZoneSync).
import "server-only";
import { cookies } from "next/headers";
import { TZ_COOKIE, normalizeTimeZone } from "@/lib/timezone";

export async function getUserTimeZone() {
  // Next.js 15: cookies() is async, so it must be awaited.
  const cookieStore = await cookies();
  return normalizeTimeZone(cookieStore.get(TZ_COOKIE)?.value);
}
