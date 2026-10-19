// Four stat tiles for one day's totals (from the daily_totals SQL function).
const TILES = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
];

export default function DayTotals({ totals }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map(({ key, label, unit }) => (
        <div key={key} className="rounded-lg border border-foreground/10 p-3">
          <dt className="text-sm text-foreground/60">{label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {totals[key].toLocaleString("en-US")}
            <span className="ml-1 text-sm font-normal text-foreground/60">{unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
