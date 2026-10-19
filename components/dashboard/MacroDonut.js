"use client";
// Donut: where today's calories came from (protein / carbs / fat, at 4 / 4 / 9 kcal per gram).
// Three segments, part-to-whole at a glance; the legend beside it carries the exact
// numbers, so identity and value never depend on color alone.
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartTooltip from "@/components/dashboard/ChartTooltip";

const COLORS = { protein: "var(--series-1)", carbs: "var(--series-2)", fat: "var(--series-3)" };

export default function MacroDonut({ split }) {
  const total = split.reduce((sum, part) => sum + part.kcal, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-foreground/60">No meals logged today yet.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative size-40 shrink-0" role="img" aria-label="Donut chart of today's calories by macronutrient">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 160, height: 160 }}>
          <PieChart>
            <Pie
              data={split}
              dataKey="kcal"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              // A 2px ring in the background color separates the segments (no borders).
              stroke="var(--background)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {split.map((part) => (
                <Cell key={part.key} fill={COLORS[part.key]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit="kcal" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold">{total.toLocaleString("en-US")}</span>
          {/* Grams × 4/4/9, so it can differ slightly from the logged calorie total. */}
          <span className="text-center text-[11px] leading-tight text-foreground/60">
            kcal from
            <br />
            macros
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {split.map((part) => (
          <li key={part.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: COLORS[part.key] }} />
            <span className="w-14">{part.label}</span>
            <span className="font-semibold tabular-nums">{part.percent}%</span>
            <span className="text-foreground/60 tabular-nums">{part.kcal.toLocaleString("en-US")} kcal</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
