"use client";
// Custom Recharts tooltip: the value is the strong element, the series name is
// secondary, and each row is keyed by a short line in the series color.
export default function ChartTooltip({ active, payload, label, labelFormatter, unit = "" }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm shadow-md">
      <p className="mb-1 text-foreground/60">{labelFormatter ? labelFormatter(label) : label}</p>
      <ul className="flex flex-col gap-0.5">
        {payload
          .filter((entry) => entry.value != null)
          .map((entry) => (
            <li key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: entry.color }} />
              <span className="font-semibold tabular-nums">
                {Number(entry.value).toLocaleString("en-US")}
                {unit && ` ${unit}`}
              </span>
              <span className="text-foreground/60">{entry.name}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
