import type { StatUnit } from "@dashboard/shared";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatStatValue(value: number, unit: StatUnit): string {
  switch (unit) {
    case "currency":
      return compactCurrency.format(value);
    case "percent":
      return `${value}%`;
    case "count":
    default:
      return compactNumber.format(value);
  }
}

export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
