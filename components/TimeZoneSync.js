"use client";
// Renders nothing. On load, saves the browser's time zone in the `tz` cookie so
// the server can show times and daily totals in the user's local time. If the
// cookie was missing or out of date (first visit, travel), re-render the page.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/timezone";

export default function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${TZ_COOKIE}=`))
      ?.split("=")[1];
    if (timeZone && decodeURIComponent(current ?? "") !== timeZone) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [router]);

  return null;
}
