/**
 * Kiraan KPI laporan (pure, diuji dalam tests/report.test.ts).
 * Wang dalam sen. Peratus dan nisbah dibundarkan untuk paparan.
 */
import type { PerfDay, PerfMetrics, PerfSnapshot } from "./types";
import { PERF_DAYS } from "./types";
import { addDays, formatMonthMs, monthRange, shiftMonth } from "./dates";

export function engagementOf(m: Pick<PerfMetrics, "likes" | "comments" | "shares" | "saves">): number {
  return m.likes + m.comments + m.shares + m.saves;
}

/** Snapshot terkini (hari paling besar yang sudah direkod). */
export function latestSnapshot<T extends Pick<PerfSnapshot, "day">>(snaps: T[]): T | null {
  return snaps.reduce<T | null>((best, s) => (!best || s.day > best.day ? s : best), null);
}

export interface Kpi {
  views: number;
  engagement: number;
  /** Engagement rate, % (1 titik perpuluhan). null jika tiada views. */
  er: number | null;
  costSen: number | null;
  /** Kos per 1,000 views (CPM), sen. */
  cpmSen: number | null;
  /** Kos per engagement, sen. */
  cpeSen: number | null;
  salesSen: number;
  orders: number;
  /** Return on ad spend: jualan / kos. */
  roas: number | null;
}

export function kpi(m: Pick<PerfMetrics, "views" | "likes" | "comments" | "shares" | "saves" | "salesSen" | "orders">, costSen: number | null): Kpi {
  const engagement = engagementOf(m);
  const hasCost = costSen !== null && costSen > 0;
  return {
    views: m.views,
    engagement,
    er: m.views > 0 ? Math.round((engagement / m.views) * 1000) / 10 : null,
    costSen,
    cpmSen: hasCost && m.views > 0 ? Math.round((costSen! / m.views) * 1000) : null,
    cpeSen: hasCost && engagement > 0 ? Math.round(costSen! / engagement) : null,
    salesSen: m.salesSen,
    orders: m.orders,
    roas: hasCost && m.salesSen > 0 ? Math.round((m.salesSen / costSen!) * 100) / 100 : null,
  };
}

export const ZERO: PerfMetrics = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, orders: 0, salesSen: 0 };

export function sumMetrics(list: PerfMetrics[]): PerfMetrics {
  return list.reduce(
    (a, m) => ({
      views: a.views + m.views,
      likes: a.likes + m.likes,
      comments: a.comments + m.comments,
      shares: a.shares + m.shares,
      saves: a.saves + m.saves,
      clicks: a.clicks + m.clicks,
      orders: a.orders + m.orders,
      salesSen: a.salesSen + m.salesSen,
    }),
    { ...ZERO },
  );
}

/** Titik semakan yang sudah tiba tetapi belum diisi. */
export function dueCheckpoints(baseDate: string, recorded: PerfDay[], today: string): PerfDay[] {
  if (!baseDate) return [];
  return PERF_DAYS.filter((d) => !recorded.includes(d) && addDays(baseDate, d) <= today);
}

export const PERIODS = ["month", "quarter", "year"] as const;
export type Period = (typeof PERIODS)[number];

/** Julat tarikh laporan dari tempoh + bulan rujukan (YYYY-MM). */
export function periodRange(period: Period, anchorMonth: string): { from: string; to: string; fromMonth: string; toMonth: string; label: string; prev: string; next: string } {
  const [y, m] = anchorMonth.split("-").map(Number) as [number, number];
  if (period === "year") {
    return { from: `${y}-01-01`, to: `${y}-12-31`, fromMonth: `${y}-01`, toMonth: `${y}-12`, label: String(y), prev: `${y - 1}-${String(m).padStart(2, "0")}`, next: `${y + 1}-${String(m).padStart(2, "0")}` };
  }
  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3);
    const fromMonth = `${y}-${String(q * 3 + 1).padStart(2, "0")}`;
    const toMonth = shiftMonth(fromMonth, 2);
    return { from: `${fromMonth}-01`, to: monthRange(toMonth).to, fromMonth, toMonth, label: `S${q + 1} ${y}`, prev: shiftMonth(fromMonth, -3), next: shiftMonth(fromMonth, 3) };
  }
  const r = monthRange(anchorMonth);
  return { from: r.from, to: r.to, fromMonth: anchorMonth, toMonth: anchorMonth, label: formatMonthMs(anchorMonth), prev: shiftMonth(anchorMonth, -1), next: shiftMonth(anchorMonth, 1) };
}

/** Nombor ringkas: 1,234 / 12.3K / 1.2M */
export function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString("en-MY");
}
