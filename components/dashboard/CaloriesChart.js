"use client";
// Calories per day (line) with a 7-day average (second line), on ONE y-axis
// since both are kcal. The average is computed in SQL.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "@/components/dashboard/ChartTooltip";
import { compactNumber, niceTicks, shortDate } from "@/lib/dashboard";

export default function CaloriesChart({ days }) {
  const showDots = days.length <= 31; // dots help at 7/30 days; at 90 they're clutter
  const ticks = niceTicks(Math.max(...days.map((d) => Math.max(d.calories, d.calories_avg7 ?? 0))));

  return (
    <div className="h-56 w-full" role="img" aria-label="Line chart of calories per day with a 7-day average">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
        <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="day"
            tickFormatter={shortDate}
            tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
            stroke="var(--chart-axis)"
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            ticks={ticks}
            domain={[0, ticks.at(-1)]}
            tickFormatter={compactNumber}
            tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip labelFormatter={shortDate} unit="kcal" />}
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          />
          <Line
            name="Calories"
            dataKey="calories"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={showDots ? { r: 4, fill: "var(--series-1)", stroke: "var(--background)", strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--series-1)", stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            name="7-day average"
            dataKey="calories_avg7"
            stroke="var(--series-2)"
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 5, fill: "var(--series-2)", stroke: "var(--background)", strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
