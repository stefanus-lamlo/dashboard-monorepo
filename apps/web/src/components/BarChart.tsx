import { useState } from "react";
import type { RevenueByCategory } from "@dashboard/shared";

const WIDTH = 320;
const HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 34, left: 12 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
const BAR_MAX_WIDTH = 24;
const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function BarChart({
  data,
  selectedCategory,
  onSelectCategory,
}: {
  data: RevenueByCategory[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.revenue));
  const yMax = max * 1.2; // headroom so the tallest bar's value label doesn't clip
  const bandWidth = INNER_WIDTH / data.length;
  const barWidth = Math.min(BAR_MAX_WIDTH, bandWidth * 0.55);
  const baselineY = PADDING.top + INNER_HEIGHT;

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverCx = hoverIndex !== null ? PADDING.left + bandWidth * hoverIndex + bandWidth / 2 : 0;
  const hoverTopY =
    hoverIndex !== null ? baselineY - (data[hoverIndex]!.revenue / yMax) * INNER_HEIGHT : 0;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h2>Revenue by category</h2>
        {selectedCategory && (
          <button className="clear-filter" onClick={() => onSelectCategory(null)}>
            Clear filter ×
          </button>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" style={{ width: "100%", height: HEIGHT, display: "block" }}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={baselineY} y2={baselineY} className="baseline" />
          {data.map((d, i) => {
            const barHeight = (d.revenue / yMax) * INNER_HEIGHT;
            const cx = PADDING.left + bandWidth * i + bandWidth / 2;
            const x = cx - barWidth / 2;
            const y = baselineY - barHeight;
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const isDimmed = selectedCategory !== null && selectedCategory !== d.category;
            return (
              <g
                key={d.category}
                className="bar-hit"
                style={{ opacity: isDimmed ? 0.35 : 1 }}
                tabIndex={0}
                role="button"
                aria-pressed={selectedCategory === d.category}
                aria-label={`${d.category}: ${currency.format(d.revenue)}`}
                onPointerEnter={() => setHoverIndex(i)}
                onPointerLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                onClick={() => onSelectCategory(selectedCategory === d.category ? null : d.category)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectCategory(selectedCategory === d.category ? null : d.category);
                  }
                }}
              >
                <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={4} ry={4} fill={color} className="bar" />
                {barHeight > 4 && <rect x={x} y={baselineY - 4} width={barWidth} height={4} fill={color} className="bar" />}
                <rect x={cx - bandWidth / 2} y={PADDING.top} width={bandWidth} height={INNER_HEIGHT} fill="transparent" />
                <text x={cx} y={y - 8} textAnchor="middle" className="axis-label" fill="var(--text-secondary)">
                  {currency.format(d.revenue)}
                </text>
                <text x={cx} y={HEIGHT - 12} textAnchor="middle" className="axis-label">
                  {d.category}
                </text>
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoverCx / WIDTH) * 100}%`,
              top: `${(hoverTopY / HEIGHT) * 100}%`,
            }}
          >
            <span className="tt-value">{currency.format(hovered.revenue)}</span>
            <span className="tt-label">{hovered.category}</span>
          </div>
        )}
      </div>
      <details className="table-toggle">
        <summary>View as table</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.category}>
                <td>{d.category}</td>
                <td>{currency.format(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
