"use client";
// The review/edit form: the heart of the app. The AI's guesses arrive as editable
// rows; the user fixes names and numbers, adds missing foods, deletes wrong ones,
// sets the meal type and time, then saves → the meal becomes "confirmed".
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sumNutrition } from "@/lib/nutrition";
import { MEAL_TYPES, guessMealType } from "@/lib/meal-edit";
import { ConfidenceBadge } from "@/components/AnalysisResult";

const NUMBER_FIELDS = [
  { field: "grams", label: "Grams" },
  { field: "calories", label: "kcal" },
  { field: "protein_g", label: "Protein g" },
  { field: "carbs_g", label: "Carbs g" },
  { field: "fat_g", label: "Fat g" },
];

let nextKey = 0;
// Form rows keep every value as a string (that's what inputs give us); they're
// converted to numbers only when saving.
function toRow(item) {
  return {
    key: item.id ?? `new-${nextKey++}`,
    id: item.id,
    name: item.name ?? "",
    portion: item.portion ?? "",
    grams: item.grams == null ? "" : String(item.grams),
    calories: String(item.calories ?? ""),
    protein_g: String(item.protein_g ?? ""),
    carbs_g: String(item.carbs_g ?? ""),
    fat_g: String(item.fat_g ?? ""),
    confidence: item.confidence ?? null,
    user_edited: item.user_edited ?? false,
  };
}

// "" → 0 (or null for grams); "12.6" → 13. Returns NaN for junk so we can flag it.
const toInt = (value) => (value.trim() === "" ? 0 : Math.round(Number(value)));

function toPayloadItem(row) {
  return {
    ...(row.id ? { id: row.id } : {}),
    name: row.name,
    portion: row.portion,
    grams: row.grams.trim() === "" ? null : toInt(row.grams),
    calories: toInt(row.calories),
    protein_g: toInt(row.protein_g),
    carbs_g: toInt(row.carbs_g),
    fat_g: toInt(row.fat_g),
  };
}

const inputClass =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-base disabled:opacity-50";

export default function MealEditor({ meal, items: initialItems }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => initialItems.map(toRow));
  const [mealType, setMealType] = useState(meal.meal_type ?? guessMealType(meal.eaten_local));
  const [eatenLocal, setEatenLocal] = useState(meal.eaten_local);
  const [pending, setPending] = useState(""); // "", "save", "delete", "analyze"
  const [error, setError] = useState("");

  const totals = sumNutrition(rows);

  function updateRow(key, field, value) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }
  const removeRow = (key) => setRows((current) => current.filter((row) => row.key !== key));
  const addRow = () => setRows((current) => [...current, toRow({})]);

  async function send(kind, url, options) {
    setError("");
    setPending(kind);
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      return true;
    } catch (err) {
      setError(err instanceof TypeError ? "Network error. Check your connection and try again." : err.message);
      setPending("");
      return false;
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const items = rows.map(toPayloadItem);
    const badRow = items.find((item) =>
      [item.calories, item.protein_g, item.carbs_g, item.fat_g, item.grams ?? 0].some((n) => !Number.isFinite(n)),
    );
    if (badRow) {
      setError("Numbers only, please: check the grams, kcal and macro fields.");
      return;
    }
    const ok = await send("save", `/api/meals/${meal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_type: mealType || null, eaten_local: eatenLocal, items }),
    });
    // Reload the page from the server with a "saved" banner. The page gives this
    // form a new key when the saved data changes, so new rows pick up their ids.
    if (ok) {
      router.replace(`/meals/${meal.id}?saved=1`, { scroll: false });
      router.refresh();
      setPending("");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this meal and its photo? This can't be undone.")) return;
    if (await send("delete", `/api/meals/${meal.id}`, { method: "DELETE" })) {
      router.push("/log");
      router.refresh();
    }
  }

  async function handleAnalyze() {
    if (await send("analyze", `/api/meals/${meal.id}/analyze`, { method: "POST" })) {
      router.refresh();
      setPending("");
    }
  }

  const busy = pending !== "";

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {meal.canAnalyze && (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          {pending === "analyze" ? "Analyzing your meal…" : "Analyze with AI now"}
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Meal
          <select value={mealType} onChange={(e) => setMealType(e.target.value)} disabled={busy} className={inputClass}>
            {MEAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type[0].toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Eaten at
          <input
            type="datetime-local"
            required
            value={eatenLocal}
            onChange={(e) => setEatenLocal(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </label>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-foreground/20 p-4 text-center text-foreground/70">
          No foods yet. Add what you ate below.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className={`flex flex-col gap-2 rounded-lg border p-3 ${
              row.confidence === "low" ? "border-red-500/40" : "border-foreground/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                aria-label="Food name"
                placeholder="Food name"
                required
                value={row.name}
                onChange={(e) => updateRow(row.key, "name", e.target.value)}
                disabled={busy}
                className={`${inputClass} font-medium`}
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={busy}
                aria-label={`Remove ${row.name || "item"}`}
                className="shrink-0 rounded-md border border-foreground/20 px-2.5 py-1.5 text-sm hover:bg-red-500/10"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {row.confidence && <ConfidenceBadge level={row.confidence} />}
              {!row.confidence && <span className="text-foreground/60">added by you</span>}
              {row.user_edited && row.confidence && <span className="text-foreground/60">· edited</span>}
            </div>
            <input
              aria-label="Portion"
              placeholder="Portion, e.g. about 1 cup"
              value={row.portion}
              onChange={(e) => updateRow(row.key, "portion", e.target.value)}
              disabled={busy}
              className={`${inputClass} text-sm`}
            />
            <div className="grid grid-cols-5 gap-1.5">
              {NUMBER_FIELDS.map(({ field, label }) => (
                <label key={field} className="flex min-w-0 flex-col gap-0.5 text-[11px] text-foreground/60">
                  {label}
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={row[field]}
                    onChange={(e) => updateRow(row.key, field, e.target.value)}
                    disabled={busy}
                    className={`${inputClass} px-1.5 text-foreground`}
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        disabled={busy}
        className="rounded-md border border-dashed border-foreground/30 px-4 py-2 text-sm hover:bg-foreground/5"
      >
        + Add a food
      </button>

      {error && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Sticky bar so totals and Save stay in reach on a phone. */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-foreground/10 bg-background px-4 py-3">
        <div className="text-sm">
          <p className="font-semibold">{totals.calories} kcal</p>
          <p className="text-foreground/60">
            P {totals.protein_g} · C {totals.carbs_g} · F {totals.fat_g}
          </p>
        </div>
        <button
          type="submit"
          disabled={busy || rows.length === 0}
          className="rounded-md bg-green-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending === "save" ? "Saving…" : meal.status === "confirmed" ? "Save changes" : "Confirm & save"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="self-start text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        {pending === "delete" ? "Deleting…" : "Delete this meal"}
      </button>
    </form>
  );
}
