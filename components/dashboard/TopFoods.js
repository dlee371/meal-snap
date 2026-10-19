// Top 5 most-logged foods. A ranked list (not a chart): the counts are the story.
export default function TopFoods({ foods }) {
  if (foods.length === 0) {
    return <p className="py-4 text-center text-sm text-foreground/60">No foods logged in this range.</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-foreground/10">
      {foods.map((food, index) => (
        <li key={food.name} className="flex items-center gap-3 py-2">
          <span className="w-5 text-sm text-foreground/50 tabular-nums">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate">{food.name}</span>
          <span className="text-sm font-semibold tabular-nums">{food.times_logged}×</span>
          <span className="w-20 text-right text-sm text-foreground/60 tabular-nums">
            {food.total_calories.toLocaleString("en-US")} kcal
          </span>
        </li>
      ))}
    </ol>
  );
}
