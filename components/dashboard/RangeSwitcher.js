// 7 / 30 / 90-day presets in one row above all charts. Each is a plain link that
// changes ?range=, so every panel re-renders from the same server query.
import Link from "next/link";
import { RANGES, DEFAULT_RANGE } from "@/lib/dashboard";

export default function RangeSwitcher({ range }) {
  return (
    <nav aria-label="Date range" className="inline-flex rounded-lg border border-foreground/15 p-0.5 text-sm">
      {RANGES.map((days) => {
        const active = days === range;
        return (
          <Link
            key={days}
            href={days === DEFAULT_RANGE ? "/dashboard" : `/dashboard?range=${days}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${
              active ? "bg-foreground font-medium text-background" : "text-foreground/70 hover:bg-foreground/5"
            }`}
          >
            {days} days
          </Link>
        );
      })}
    </nav>
  );
}
