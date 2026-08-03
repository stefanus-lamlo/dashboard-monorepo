import { useState } from "react";
import type { MonthlySales } from "@dashboard/shared";

const WIDTH = 960;
const HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFull = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function niceMax(value: number): number {
  const step = value > 40000 ? 10000 : value > 10000 ? 2000 : value > 2000 ? 500 : 100;
  return Math.ceil(value / step) * step;
}

export function MonthlySalesChart({ data }: { data: MonthlySales[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const available2026 = data.filter((d) => d.sales2026 !== null);
  const yMax = niceMax(Math.max(...data.map((d) => d.sales2025), ...available2026.map((d) => d.sales2026!)));

  const xAt = (i: number) => PADDING.left + (i / (data.length - 1)) * INNER_WIDTH;
  const yAt = (v: number) => PADDING.top + INNER_HEIGHT - (v / yMax) * INNER_HEIGHT;
  const baselineY = PADDING.top + INNER_HEIGHT;

  const path2025 = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.sales2025)}`).join(" ");
  const path2026 = available2026.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.sales2026!)}`).join(" ");
  const area2026 = `${path2026} L${xAt(available2026.length - 1)},${baselineY} L${xAt(0)},${baselineY} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));

  const sum2026 = available2026.reduce((total, d) => total + d.sales2026!, 0);
  const sum2025SamePeriod = available2026.reduce((total, d) => total + d.sales2025, 0);
  const yoyPct =
    sum2025SamePeriod === 0 ? 0 : Math.round(((sum2026 - sum2025SamePeriod) / sum2025SamePeriod) * 1000) / 10;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const index = Math.round(fraction * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="chart-card monthly-sales-card">
      <div className="chart-card-header">
        <h2>Sales, 2025 vs. 2026 (by month)</h2>
        <div className="monthly-legend">
          <span className="legend-item">
            <span className="legend-swatch swatch-2025" /> 2025
          </span>
          <span className="legend-item">
            <span className="legend-swatch swatch-2026" /> 2026
          </span>
          <span className={`delta ${yoyPct >= 0 ? "good" : "bad"}`}>
            <span aria-hidden="true">{yoyPct >= 0 ? "↑" : "↓"}</span>
            <span>
              {yoyPct >= 0 ? "+" : ""}
              {yoyPct}% YTD vs. 2025
            </span>
          </span>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" style={{ width: "100%", height: HEIGHT, display: "block" }}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yAt(tick)} y2={yAt(tick)} className="gridline" />
              <text x={PADDING.left - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" className="axis-label">
                {currency.format(tick)}
              </text>
            </g>
          ))}
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={baselineY} y2={baselineY} className="baseline" />
          {data.map((d, i) => (
            <text key={d.month} x={xAt(i)} y={HEIGHT - 8} textAnchor="middle" className="axis-label">
              {d.month}
            </text>
          ))}

          <path d={path2025} fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />

          <path d={area2026} fill="var(--series-1)" fillOpacity={0.1} stroke="none" />
          <path d={path2026} fill="none" stroke="var(--series-1)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {available2026.length > 0 && (
            <circle
              cx={xAt(available2026.length - 1)}
              cy={yAt(available2026[available2026.length - 1]!.sales2026!)}
              r={5}
              fill="var(--series-1)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          )}

          {hoverIndex !== null && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PADDING.top}
              y2={PADDING.top + INNER_HEIGHT}
              className="crosshair-line"
            />
          )}
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={INNER_WIDTH}
            height={INNER_HEIGHT}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>
        {hovered && (
          <div
            className="chart-tooltip monthly-tooltip"
            style={{
              left: `${(xAt(hoverIndex!) / WIDTH) * 100}%`,
              top: `${(yAt(Math.max(hovered.sales2025, hovered.sales2026 ?? 0)) / HEIGHT) * 100}%`,
            }}
          >
            <div className="tt-label">{hovered.month}</div>
            <div>
              <span className="legend-swatch swatch-2025" /> {currencyFull.format(hovered.sales2025)}
            </div>
            {hovered.sales2026 !== null && (
              <div>
                <span className="legend-swatch swatch-2026" /> {currencyFull.format(hovered.sales2026)}
              </div>
            )}
          </div>
        )}
      </div>
      <details className="table-toggle">
        <summary>View as table</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>2025</th>
              <th>2026</th>
              <th>YoY</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const yoy = d.sales2026 === null ? null : Math.round(((d.sales2026 - d.sales2025) / d.sales2025) * 1000) / 10;
              return (
                <tr key={d.month}>
                  <td className="col-left">{d.month}</td>
                  <td>{currencyFull.format(d.sales2025)}</td>
                  <td>{d.sales2026 === null ? "—" : currencyFull.format(d.sales2026)}</td>
                  <td>{yoy === null ? "—" : `${yoy >= 0 ? "+" : ""}${yoy}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
