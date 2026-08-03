import { useRef, useState } from "react";
import type { VisitorPoint } from "@dashboard/shared";
import { formatDate } from "../format";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 28, left: 44 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

function niceMax(value: number): number {
  const step = value > 4000 ? 1000 : value > 1000 ? 500 : 100;
  return Math.ceil(value / step) * step;
}

export function LineChart({ data }: { data: VisitorPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) return null;

  const yMax = niceMax(Math.max(...data.map((d) => d.visitors)));
  const xAt = (i: number) => PADDING.left + (i / (data.length - 1)) * INNER_WIDTH;
  const yAt = (v: number) => PADDING.top + INNER_HEIGHT - (v / yMax) * INNER_HEIGHT;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.visitors)}`).join(" ");
  const areaPath = `${linePath} L${xAt(data.length - 1)},${PADDING.top + INNER_HEIGHT} L${xAt(0)},${PADDING.top + INNER_HEIGHT} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const xTickEvery = Math.max(1, Math.ceil(data.length / 6));

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const index = Math.round(fraction * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="chart-card">
      <h2>Visitors</h2>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" style={{ width: "100%", height: HEIGHT, display: "block" }}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yAt(tick)} y2={yAt(tick)} className="gridline" />
              <text x={PADDING.left - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" className="axis-label">
                {tick >= 1000 ? `${tick / 1000}k` : tick}
              </text>
            </g>
          ))}
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={PADDING.top + INNER_HEIGHT}
            y2={PADDING.top + INNER_HEIGHT}
            className="baseline"
          />
          {data.map(
            (d, i) =>
              i % xTickEvery === 0 && (
                <text key={d.date} x={xAt(i)} y={HEIGHT - 8} textAnchor="middle" className="axis-label">
                  {formatDate(d.date)}
                </text>
              ),
          )}
          <path d={areaPath} fill="var(--series-1)" fillOpacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle
            cx={xAt(data.length - 1)}
            cy={yAt(data[data.length - 1]!.visitors)}
            r={5}
            fill="var(--series-1)"
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
          <text
            x={xAt(data.length - 1) - 8}
            y={yAt(data[data.length - 1]!.visitors) - 10}
            textAnchor="end"
            className="axis-label"
            fill="var(--text-secondary)"
          >
            {data[data.length - 1]!.visitors.toLocaleString()}
          </text>
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
            className="chart-tooltip"
            style={{
              left: `${(xAt(hoverIndex!) / WIDTH) * 100}%`,
              top: `${(yAt(hovered.visitors) / HEIGHT) * 100}%`,
            }}
          >
            <span className="tt-value">{hovered.visitors.toLocaleString()}</span>
            <span className="tt-label">{formatDate(hovered.date)}</span>
          </div>
        )}
      </div>
      <details className="table-toggle">
        <summary>View as table</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Visitors</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{formatDate(d.date)}</td>
                <td>{d.visitors.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
