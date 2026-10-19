"use client";
// Protein per day: one bar per day, one color (a single series never needs a rainbow).
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "@/components/dashboard/ChartTooltip";
import { compactNumber, niceTicks, shortDate } from "@/lib/dashboard";

export default function ProteinChart({ days }) {
  const ticks = niceTicks(Math.max(...days.map((d) => d.protein_g)));
  return (
    <div className="h-48 w-full" role="img" aria-label="Bar chart of protein grams per day">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 192 }}>
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap={2}>
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
            content={<ChartTooltip labelFormatter={shortDate} unit="g" />}
            cursor={{ fill: "var(--chart-hover)" }}
          />
          <Bar
            name="Protein"
            dataKey="protein_g"
            fill="var(--series-1)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
