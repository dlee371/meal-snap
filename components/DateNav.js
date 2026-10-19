"use client";
// Day switcher for /log: ← previous day, a date picker, next day →, and "Today".
// Changing the date just changes the URL (?date=YYYY-MM-DD); the server page does the rest.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shiftDate, isValidDateString } from "@/lib/dates";

const buttonClass = "rounded-md border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5";

export default function DateNav({ date, today }) {
  const router = useRouter();
  const href = (day) => (day === today ? "/log" : `/log?date=${day}`);
  const isToday = date === today;

  return (
    <nav aria-label="Choose day" className="flex flex-wrap items-center gap-2">
      <Link href={href(shiftDate(date, -1))} className={buttonClass} aria-label="Previous day">
        ←
      </Link>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => isValidDateString(e.target.value) && router.push(href(e.target.value))}
        className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5"
        aria-label="Date"
      />
      {/* No "next" past today: you can't have eaten tomorrow's lunch yet. */}
      {isToday ? (
        <span className={`${buttonClass} opacity-40`} aria-hidden="true">
          →
        </span>
      ) : (
        <Link href={href(shiftDate(date, 1))} className={buttonClass} aria-label="Next day">
          →
        </Link>
      )}
      {!isToday && (
        <Link href="/log" className={buttonClass}>
          Today
        </Link>
      )}
    </nav>
  );
}
