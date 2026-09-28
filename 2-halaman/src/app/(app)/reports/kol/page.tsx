import Link from "next/link";
import { requirePageUser } from "@/lib/server/session";
import { buildReport } from "@/lib/server/services/reports";
import { formatDateMs } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import { compactNum } from "@/lib/domain/report";
import { fmtCost, fmtCpe, fmtCpm, fmtEr, fmtNum, fmtRoas, parsePeriod, ReportHeader } from "@/components/reports/ReportHeader";

export const metadata = { title: "Laporan KOL" };

export default async function KolReportPage({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const user = await requirePageUser();
  const { period, anchor } = parsePeriod(await searchParams);
  const r = await buildReport(user, period, anchor);
  return (
    <div className="space-y-5">
      <ReportHeader title="Laporan KOL" description="Siapa paling berbaloi: kos per 1,000 views (CPM), kos per engagement (CPE) dan ROAS. Kos = fee + barang diberi + kos lain berkaitan." base="/reports/kol" period={period} label={r.label} prev={r.range.prev} next={r.range.next} anchor={anchor} exportTab="kol" />

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Ranking KOL</h2>
        <table className="table-base min-w-[860px]">
          <thead><tr><th>#</th><th>KOL</th><th className="text-right">Posting</th><th className="text-right">Views</th><th className="text-right">ER</th><th className="text-right">Kos</th><th className="text-right">CPM</th><th className="text-right">CPE</th><th className="text-right">ROAS</th></tr></thead>
          <tbody>
            {r.kolRanking.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted">Tiada posting KOL dalam tempoh ini.</td></tr>}
            {r.kolRanking.map((k, i) => (
              <tr key={k.kolId}>
                <td className="tabular-nums text-muted">{i + 1}</td>
                <td><Link href={`/kol/${k.kolId}`} className="font-semibold hover:text-brand-600">{k.kolName}</Link></td>
                <td className="text-right tabular-nums">{k.posts}</td>
                <td className="text-right tabular-nums">{compactNum(k.metrics.views)}</td>
                <td className="text-right tabular-nums">{fmtEr(k.kpi)}</td>
                <td className="text-right tabular-nums">{fmtCost(k.kpi)}</td>
                <td className="text-right tabular-nums font-semibold">{fmtCpm(k.kpi)}</td>
                <td className="text-right tabular-nums">{fmtCpe(k.kpi)}</td>
                <td className="text-right tabular-nums">{fmtRoas(k.kpi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Setiap posting</h2>
        <table className="table-base min-w-[1000px]">
          <thead><tr><th>KOL</th><th>Campaign</th><th>Posting</th><th>Data</th><th className="text-right">Views</th><th className="text-right">Engagement</th><th className="text-right">ER</th><th className="text-right">Kos</th><th className="text-right">CPM</th><th className="text-right">Jualan</th></tr></thead>
          <tbody>
            {r.kol.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-muted">Tiada posting.</td></tr>}
            {r.kol.map((k) => (
              <tr key={k.id}>
                <td><Link href={`/kol/campaign/${k.id}`} className="font-semibold hover:text-brand-600">{k.kolName}</Link><p className="text-xs text-muted">{k.kolHandle} · {k.platform} · {k.collabType}</p></td>
                <td className="text-sm">{k.campaignName}</td>
                <td className="whitespace-nowrap text-sm">{formatDateMs(k.date)}</td>
                <td className="text-xs">{k.lastDay ? `Hari ${k.lastDay}` : <Link href={`/kol/campaign/${k.id}`} className="font-semibold text-amber-700">Belum diisi</Link>}</td>
                <td className="text-right tabular-nums">{fmtNum(k.metrics.views)}</td>
                <td className="text-right tabular-nums">{fmtNum(k.kpi.engagement)}</td>
                <td className="text-right tabular-nums">{fmtEr(k.kpi)}</td>
                <td className="text-right tabular-nums">{fmtCost(k.kpi)}</td>
                <td className="text-right tabular-nums">{fmtCpm(k.kpi)}</td>
                <td className="text-right tabular-nums">{formatSen(k.metrics.salesSen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {!r.isAdmin && <p className="text-xs text-muted">Kos hanya dipaparkan untuk KOL di mana anda PIC.</p>}
    </div>
  );
}
