// Frame for one dashboard panel: title, optional subtitle/legend, the chart, and a
// collapsible data table. The table means no value is ever reachable only by hovering
// (and it's what screen readers use).
export default function ChartCard({ title, subtitle, legend, table, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-foreground/60">{subtitle}</p>}
        {legend}
      </header>

      {children}

      {table && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/60 hover:text-foreground">Show data</summary>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-foreground/60">
                {table.columns.map((column, index) => (
                  <th key={column} className={`py-1 font-medium ${index > 0 ? "text-right" : ""}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-foreground/5">
                  {row.map((cell, index) => (
                    <td key={index} className={`py-1 ${index > 0 ? "text-right tabular-nums" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

// Legend row: a short line or square key in the series color, label in normal text color.
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
      {items.map(({ label, color, shape = "line" }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={shape === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-sm"}
            style={{ background: color }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
