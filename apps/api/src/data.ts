import type {
  DashboardSummary,
  DateRange,
  MonthlySales,
  Order,
  OrderStatus,
  RevenueByCategory,
  Stat,
  VisitorPoint,
} from "@dashboard/shared";

const RANGE_DAYS: Record<DateRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const CATEGORIES = ["Software", "Hardware", "Services", "Subscriptions"];

const CUSTOMERS = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Umbrella Inc.",
  "Stark Industries",
  "Wayne Enterprises",
  "Hooli",
  "Soylent Corp",
  "Wonka Industries",
  "Cyberdyne Systems",
  "Aperture Science",
  "Massive Dynamic",
];

const ORDER_STATUSES: OrderStatus[] = ["paid", "pending", "refunded"];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_MONTH_2026 = 8; // "today" is fixed at 2026-08-02, so 2026 data only exists through August

// simple deterministic PRNG (mulberry32) so mock orders are stable across requests/renders
function seededRandom(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pctChange(before: number, after: number): number {
  if (before === 0) return 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

function buildVisitors(days: number): VisitorPoint[] {
  const end = new Date("2026-08-02T00:00:00Z");
  const points: VisitorPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - i);
    // deterministic wave so the demo data is stable across requests/renders
    const weekday = date.getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.75 : 1;
    const wave = Math.sin((days - i) / 4) * 220 + Math.sin((days - i) / 11) * 90;
    const trend = (days - i) * 6;
    const visitors = Math.max(50, Math.round((1400 + wave + trend) * weekendDip));
    points.push({ date: date.toISOString().slice(0, 10), visitors });
  }
  return points;
}

function buildRevenueByCategory(days: number): RevenueByCategory[] {
  const base = [42, 27, 19, 12]; // relative share, sums to 100
  const scale = days * 310;
  return CATEGORIES.map((category, i) => ({
    category,
    revenue: Math.round((base[i]! / 100) * scale),
  }));
}

function buildStats(visitors: VisitorPoint[], revenueByCategory: RevenueByCategory[]): Stat[] {
  const mid = Math.floor(visitors.length / 2) || 1;
  const firstHalf = visitors.slice(0, mid);
  const secondHalf = visitors.slice(mid);
  const sum = (points: VisitorPoint[]) => points.reduce((total, p) => total + p.visitors, 0);

  const totalVisitors = sum(visitors);
  const totalRevenue = revenueByCategory.reduce((total, r) => total + r.revenue, 0);
  const orders = Math.round(totalVisitors * 0.041);
  const conversionRate = Math.round((orders / totalVisitors) * 1000) / 10;
  const avgOrderValue = orders > 0 ? Math.round((totalRevenue / orders) * 100) / 100 : 0;

  return [
    {
      id: "visitors",
      label: "Total visitors",
      value: totalVisitors,
      unit: "count",
      delta: pctChange(sum(firstHalf), sum(secondHalf)),
      higherIsBetter: true,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: totalRevenue,
      unit: "currency",
      delta: pctChange(totalRevenue * 0.46, totalRevenue * 0.54),
      higherIsBetter: true,
    },
    {
      id: "conversion",
      label: "Conversion rate",
      value: conversionRate,
      unit: "percent",
      delta: -3.2,
      higherIsBetter: true,
    },
    {
      id: "aov",
      label: "Avg. order value",
      value: avgOrderValue,
      unit: "currency",
      delta: 1.8,
      higherIsBetter: true,
    },
  ];
}

function buildOrders(days: number): Order[] {
  const end = new Date("2026-08-02T00:00:00Z");
  const count = Math.min(120, days * 4);
  const orders: Order[] = [];

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(seededRandom(i * 7 + 1) * days);
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - dayOffset);

    const category = CATEGORIES[Math.floor(seededRandom(i * 13 + 3) * CATEGORIES.length)]!;
    const customer = CUSTOMERS[Math.floor(seededRandom(i * 17 + 5) * CUSTOMERS.length)]!;
    const amount = Math.round((40 + seededRandom(i * 23 + 9) * 960) * 100) / 100;
    const status = ORDER_STATUSES[Math.floor(seededRandom(i * 29 + 11) * ORDER_STATUSES.length)]!;

    orders.push({
      id: `ORD-${1000 + i}`,
      date: date.toISOString().slice(0, 10),
      customer,
      category,
      amount,
      status,
    });
  }

  return orders.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function buildMonthlySales(): MonthlySales[] {
  return MONTH_LABELS.map((month, i) => {
    const monthNum = i + 1;
    // mild seasonality, peaking mid-year
    const seasonal = 1 + Math.sin(((monthNum - 3) / 12) * Math.PI * 2) * 0.18;
    const sales2025 = Math.round((9000 + seededRandom(monthNum * 31 + 101) * 1400) * seasonal);

    let sales2026: number | null = null;
    if (monthNum <= CURRENT_MONTH_2026) {
      const yoyGrowth = 1.06 + seededRandom(monthNum * 37 + 211) * 0.12; // ~6-18% YoY growth
      sales2026 = Math.round(sales2025 * yoyGrowth);
    }

    return { month, sales2025, sales2026 };
  });
}

export function getDashboardSummary(range: DateRange): DashboardSummary {
  const days = RANGE_DAYS[range];
  const visitors = buildVisitors(days);
  const revenueByCategory = buildRevenueByCategory(days);
  const stats = buildStats(visitors, revenueByCategory);
  const orders = buildOrders(days);
  const monthlySales = buildMonthlySales();
  return { range, stats, visitors, revenueByCategory, orders, monthlySales };
}

export function isDateRange(value: unknown): value is DateRange {
  return value === "7d" || value === "30d" || value === "90d";
}
