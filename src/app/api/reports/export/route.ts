import { userRoute } from "@/lib/server/api";
import { buildReport } from "@/lib/server/services/reports";
import { PERIODS, type Kpi, type Period } from "@/lib/domain/report";
import { todayMYT } from "@/lib/domain/dates";
import type { PerfMetrics } from "@/lib/domain/types";

/** Muat turun laporan sebagai CSV (dibuka terus dalam Excel / Google Sheets). */
export const GET = userRoute(async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const period = (PERIODS as readonly string[]).includes(sp.get("p") ?? "") ? (sp.get("p") as Period) : "month";
  const d = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.get("d") ?? "") ? sp.get("d")! : todayMYT().slice(0, 7);
  const tab = sp.get("tab") ?? "content";
  const r = await buildReport(user, period, d);

  const rm = (sen: number | null) => (sen === null ? "" : (sen / 100).toFixed(2));
  const perf = (m: PerfMetrics, k: Kpi) => [m.views, k.engagement, k.er ?? "", m.likes, m.comments, m.shares, m.saves, m.clicks, m.orders, rm(m.salesSen), rm(k.costSen), rm(k.cpmSen), rm(k.cpeSen), k.roas ?? ""];
  const perfHead = ["Views", "Engagement", "ER %", "Likes", "Komen", "Share", "Save", "Klik", "Order", "Jualan RM", "Kos RM", "CPM RM", "CPE RM", "ROAS"];

  let head: string[];
  let rows: (string | number)[][];
  if (tab === "kol") {
    head = ["KOL", "Handle", "Campaign", "Platform", "Jenis kerjasama", "Tarikh posting", "Data hari", ...perfHead];
    rows = r.kol.map((x) => [x.kolName, x.kolHandle, x.campaignName, x.platform, x.collabType, x.date, x.lastDay ?? "", ...perf(x.metrics, x.kpi)]);
  } else if (tab === "campaign") {
    head = ["Campaign", "Jenis", "Mula", "Tamat", "Bajet dirancang RM", "Posting", ...perfHead];
    rows = r.campaigns.map((x) => [x.name, x.type, x.startDate, x.endDate, rm(x.plannedSen), x.posts, ...perf(x.metrics, x.kpi)]);
  } else {
    head = ["Content", "Platform", "Jenis", "Tarikh publish", "PIC", "Data hari", ...perfHead];
    rows = r.content.map((x) => [x.title, x.platform, x.contentType, x.date, x.ownerName, x.lastDay ?? "", ...perf(x.metrics, x.kpi)]);
  }
  const esc = (v: string | number) => {
    const s = String(v);
    // Elak formula injection dalam Excel
    const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = "\uFEFF" + [head, ...rows].map((row) => row.map(esc).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-${tab}-${period}-${d}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
