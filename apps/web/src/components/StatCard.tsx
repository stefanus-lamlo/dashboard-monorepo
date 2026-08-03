import type { Stat } from "@dashboard/shared";
import { formatDelta, formatStatValue } from "../format";

export function StatCard({ stat }: { stat: Stat }) {
  const isIncrease = stat.delta > 0;
  const isGood = isIncrease === stat.higherIsBetter;
  const arrow = isIncrease ? "↑" : "↓";

  return (
    <div className="stat-card">
      <div className="label">{stat.label}</div>
      <div className="value">{formatStatValue(stat.value, stat.unit)}</div>
      <div className={`delta ${isGood ? "good" : "bad"}`}>
        <span aria-hidden="true">{arrow}</span>
        <span>{formatDelta(stat.delta)} vs. previous period</span>
      </div>
    </div>
  );
}
