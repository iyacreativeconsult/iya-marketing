import "server-only";
import type { CampaignKol, ContentItem, PerfDay, PerfMetrics, PerfSnapshot, SessionUser } from "../../domain/types";
import { dueCheckpoints, kpi, latestSnapshot, periodRange, sumMetrics, ZERO, type Kpi, type Period } from "../../domain/report";
import { byChannel, type ChannelRow } from "../../domain/budget";
import { todayMYT } from "../../domain/dates";
import { listContent } from "./content";
import { listCksForScope } from "./campaignKols";
import { listPerformance } from "./performance";
import { listCampaignsInRange } from "./campaigns";
import { expensesInRange } from "./budget";

/*
 * Laporan dibina dari: snapshot prestasi (terkini bagi setiap posting), kos KOL,
 * dan perbelanjaan. Nilai kos hanya untuk Admin; ahli nampak kos KOL di mana dia PIC sahaja.
 */

export interface ContentRow {
  id: string;
  title: string;
  teamId: string;
  platform: string;
  contentType: string;
  date: string;
  ownerName: string;
  campaignId: string | null;
  lastDay: PerfDay | null;
  metrics: PerfMetrics;
  kpi: Kpi;
}

export interface KolRow {
  id: string;
  kolId: string;
  kolName: string;
  kolHandle: string;
  campaignId: string;
  campaignName: string;
  teamId: string;
  platform: string;
  collabType: string;
  date: string;
  lastDay: PerfDay | null;
  metrics: PerfMetrics;
  kpi: Kpi;
}

export interface CampaignRow {
  id: string;
  name: string;
  teamId: string;
  type: string;
  startDate: string;
  endDate: string;
  plannedSen: number | null;
  posts: number;
  metrics: PerfMetrics;
  kpi: Kpi;
}

export interface PendingRow {
  type: "content" | "kol";
  id: string;
  name: string;
  baseDate: string;
  days: PerfDay[];
  href: string;
}

export interface Report {
  period: Period;
  label: string;
  range: ReturnType<typeof periodRange>;
  isAdmin: boolean;
  summary: { posts: number; withData: number; metrics: PerfMetrics; kpi: Kpi; spendSen: number | null; inKindSen: number | null };
  channels: ChannelRow[];
  content: ContentRow[];
  kol: KolRow[];
  campaigns: CampaignRow[];
  byContentType: { key: string; posts: number; metrics: PerfMetrics; kpi: Kpi }[];
  byPlatform: { key: string; posts: number; metrics: PerfMetrics; kpi: Kpi }[];
  kolRanking: { kolId: string; kolName: string; posts: number; metrics: PerfMetrics; kpi: Kpi }[];
  pending: PendingRow[];
}

function group<T extends { metrics: PerfMetrics }>(rows: T[], keyOf: (r: T) => string, costOf?: (list: T[]) => number | null) {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(keyOf(r) || "-", [...(map.get(keyOf(r) || "-") ?? []), r]);
  return [...map.entries()]
    .map(([key, list]) => {
      const metrics = sumMetrics(list.map((r) => r.metrics));
      return { key, posts: list.length, metrics, kpi: kpi(metrics, costOf ? costOf(list) : null) };
    })
    .sort((a, b) => b.metrics.views - a.metrics.views);
}

export async function buildReport(user: SessionUser, period: Period, anchorMonth: string): Promise<Report> {
  const range = periodRange(period, anchorMonth);
  const scope = user.activeTeamId;
  const isAdmin = user.role === "admin";
  const empty: Report = {
    period, label: range.label, range, isAdmin,
    summary: { posts: 0, withData: 0, metrics: { ...ZERO }, kpi: kpi(ZERO, null), spendSen: null, inKindSen: null },
    channels: [], content: [], kol: [], campaigns: [], byContentType: [], byPlatform: [], kolRanking: [], pending: [],
  };
  if (!scope) return empty;

  const [contents, cks, perf, campaigns, expenses] = await Promise.all([
    listContent(scope),
    listCksForScope(user, scope),
    listPerformance(scope),
    listCampaignsInRange(range.from, range.to),
    isAdmin ? expensesInRange(range.fromMonth, range.toMonth, scope) : Promise.resolve([]),
  ]);

  const perfBy = new Map<string, PerfSnapshot[]>();
  for (const s of perf) perfBy.set(`${s.targetType}|${s.targetId}`, [...(perfBy.get(`${s.targetType}|${s.targetId}`) ?? []), s]);
  const latest = (t: string, id: string) => latestSnapshot(perfBy.get(`${t}|${id}`) ?? []);
  const metricsOf = (s: PerfSnapshot | null): PerfMetrics =>
    s ? { views: s.views, likes: s.likes, comments: s.comments, shares: s.shares, saves: s.saves, clicks: s.clicks, orders: s.orders, salesSen: s.salesSen } : { ...ZERO };
  const inRange = (d: string) => Boolean(d) && d >= range.from && d <= range.to;

  // ---- Content published dalam tempoh
  const published = (c: ContentItem) => c.status === "Published" || c.status === "Archived";
  const content: ContentRow[] = contents
    .filter((c) => published(c) && inRange(c.publishDate))
    .map((c) => {
      const s = latest("content", c.id);
      const m = metricsOf(s);
      return { id: c.id, title: c.title, teamId: c.teamId, platform: c.platform, contentType: c.contentType, date: c.publishDate, ownerName: c.ownerName, campaignId: c.campaignId, lastDay: s?.day ?? null, metrics: m, kpi: kpi(m, null) };
    })
    .sort((a, b) => b.metrics.views - a.metrics.views);

  // ---- KOL yang posting dalam tempoh. Kos = fee + barang diberi + kos lain berkaitan (Admin).
  const relatedBy = new Map<string, number>();
  for (const e of expenses) if (e.campaignKolId && !e.kolPaymentId) relatedBy.set(e.campaignKolId, (relatedBy.get(e.campaignKolId) ?? 0) + e.amountSen);
  const kolCost = (k: CampaignKol) => (k.feeSen === null ? null : k.feeSen + (k.inKindSen ?? 0) + (relatedBy.get(k.id) ?? 0));
  const kol: KolRow[] = cks
    .filter((k) => k.checklist.posted && inRange(k.postedDate))
    .map((k) => {
      const s = latest("kol", k.id);
      const m = metricsOf(s);
      return {
        id: k.id, kolId: k.kolId, kolName: k.kolName, kolHandle: k.kolHandle, campaignId: k.campaignId, campaignName: k.campaignName, teamId: k.teamId,
        platform: k.platform, collabType: k.collabType, date: k.postedDate, lastDay: s?.day ?? null, metrics: m, kpi: kpi(m, kolCost(k)),
      };
    })
    .sort((a, b) => b.metrics.views - a.metrics.views);

  // ---- Campaign
  const expByCampaign = new Map<string, number>();
  for (const e of expenses) if (e.campaignId) expByCampaign.set(e.campaignId, (expByCampaign.get(e.campaignId) ?? 0) + e.amountSen);
  const inKindByCampaign = new Map<string, number>();
  for (const k of cks) if (k.stage !== "Dropped" && k.inKindSen) inKindByCampaign.set(k.campaignId, (inKindByCampaign.get(k.campaignId) ?? 0) + k.inKindSen);
  const campaignRows: CampaignRow[] = campaigns
    .filter((c) => c.status !== "Cancelled" && (scope === "all" || c.teamId === scope))
    .map((c) => {
      const rows = [...content.filter((r) => r.campaignId === c.id), ...kol.filter((r) => r.campaignId === c.id)];
      const m = sumMetrics(rows.map((r) => r.metrics));
      const cost = isAdmin ? (expByCampaign.get(c.id) ?? 0) + (inKindByCampaign.get(c.id) ?? 0) : null;
      return { id: c.id, name: c.name, teamId: c.teamId, type: c.type, startDate: c.startDate, endDate: c.endDate, plannedSen: isAdmin ? c.plannedBudgetSen : null, posts: rows.length, metrics: m, kpi: kpi(m, cost) };
    })
    .sort((a, b) => b.metrics.views - a.metrics.views);

  // ---- Ringkasan
  const all = [...content, ...kol];
  const totals = sumMetrics(all.map((r) => r.metrics));
  const spendSen = isAdmin ? expenses.reduce((a, e) => a + e.amountSen, 0) : null;
  const inKindSen = isAdmin ? cks.filter((k) => k.stage !== "Dropped" && inRange(k.postedDate || k.postingDueDate)).reduce((a, k) => a + (k.inKindSen ?? 0), 0) : null;
  const totalCost = spendSen === null ? null : spendSen + (inKindSen ?? 0);

  // ---- Prestasi belum diisi (semua masa, dalam skop)
  const today = todayMYT();
  const pending: PendingRow[] = [
    ...contents.filter(published).map((c) => ({ type: "content" as const, id: c.id, name: c.title, baseDate: c.publishDate, days: dueCheckpoints(c.publishDate, (perfBy.get(`content|${c.id}`) ?? []).map((s) => s.day), today), href: `/content/${c.id}` })),
    ...cks.filter((k) => k.checklist.posted).map((k) => ({ type: "kol" as const, id: k.id, name: `${k.kolName} · ${k.campaignName}`, baseDate: k.postedDate, days: dueCheckpoints(k.postedDate, (perfBy.get(`kol|${k.id}`) ?? []).map((s) => s.day), today), href: `/kol/campaign/${k.id}` })),
  ]
    .filter((p) => p.days.length > 0)
    .sort((a, b) => a.baseDate.localeCompare(b.baseDate));

  const kolRanking = group(kol, (r) => r.kolId, (list) => (list.some((r) => r.kpi.costSen === null) ? null : list.reduce((a, r) => a + (r.kpi.costSen ?? 0), 0)))
    .map((g) => ({ kolId: g.key, kolName: kol.find((k) => k.kolId === g.key)?.kolName ?? g.key, posts: g.posts, metrics: g.metrics, kpi: g.kpi }))
    .sort((a, b) => (a.kpi.cpmSen ?? Infinity) - (b.kpi.cpmSen ?? Infinity) || b.metrics.views - a.metrics.views);

  return {
    period, label: range.label, range, isAdmin,
    summary: { posts: all.length, withData: all.filter((r) => r.lastDay !== null).length, metrics: totals, kpi: kpi(totals, totalCost), spendSen, inKindSen },
    channels: isAdmin ? byChannel(expenses, {}) : [],
    content,
    kol,
    campaigns: campaignRows,
    byContentType: group(content, (r) => r.contentType),
    byPlatform: group(all, (r) => r.platform),
    kolRanking,
    pending,
  };
}
