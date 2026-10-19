"use client";
// Horizontal bars: calories from breakfast / lunch / dinner / snacks.
// One color for every bar (meal types are categories, not a magnitude ramp);
// the value sits at the bar tip in normal text color.
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "@/components/dashboard/ChartTooltip";

export default function MealTypeChart({ rows }) {
  const height = rows.length * 40 + 8;

  return (
    <div className="w-full" style={{ height }} role="img" aria-label="Bar chart of calories by meal type">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        {/* Right margin leaves room for the tip label ("18,964 kcal") so it never wraps or clips. */}
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={84}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--foreground)", fontSize: 13 }}
          />
          <Tooltip content={<ChartTooltip unit="kcal" />} cursor={{ fill: "var(--chart-hover)" }} />
          <Bar
            name="Calories"
            dataKey="calories"
            fill="var(--series-1)"
            maxBarSize={24}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="calories"
              position="right"
              formatter={(value) => `${Number(value).toLocaleString("en-US")} kcal`}
              style={{ fill: "var(--foreground)", fontSize: 12, whiteSpace: "nowrap" }}
              width={96}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
