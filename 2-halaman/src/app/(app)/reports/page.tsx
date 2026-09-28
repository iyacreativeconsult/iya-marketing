import Link from "next/link";
import { ClipboardList, Eye, Heart, ShoppingBag, Wallet } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { buildReport } from "@/lib/server/services/reports";
import { compactNum } from "@/lib/domain/report";
import { formatSen } from "@/lib/domain/money";
import { StatCard } from "@/components/StatCard";
import { fmtCpm, fmtEr, fmtNum, fmtRoas, parsePeriod, ReportHeader } from "@/components/reports/ReportHeader";

export const metadata = { title: "Reports" };

export default async function ReportsSummaryPage({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const user = await requirePageUser();
  const { period, anchor } = parsePeriod(await searchParams);
  const r = await buildReport(user, period, anchor);
  const s = r.summary;
  const maxChannel = Math.max(1, ...r.channels.map((c) => c.usedSen + c.pendingSen));

  return (
    <div className="space-y-5">
      <ReportHeader title="Reports" description="Ringkasan prestasi posting, kos dan pulangan untuk tempoh dipilih." base="/reports" period={period} label={r.label} prev={r.range.prev} next={r.range.next} anchor={anchor} />

      {r.pending.length > 0 && (
        <Link href="/reports/pending" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100">
          <ClipboardList className="size-4" aria-hidden /> {r.pending.length} posting belum diisi prestasi. Klik untuk isi supaya laporan tepat.
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Eye} label={`Views (${s.posts} posting, ${s.withData} ada data)`} value={compactNum(s.metrics.views)} />
        <StatCard icon={Heart} label="Engagement / ER" value={`${compactNum(s.kpi.engagement)} · ${fmtEr(s.kpi)}`} tone="green" />
        {r.isAdmin && <StatCard icon={Wallet} label="Kos (tunai + barang diberi)" value={s.kpi.costSen === null ? "-" : formatSen(s.kpi.costSen)} hint={`CPM ${fmtCpm(s.kpi)}`} tone="amber" />}
        <StatCard icon={ShoppingBag} label="Jualan dilaporkan" value={formatSen(s.metrics.salesSen)} hint={r.isAdmin ? `ROAS ${fmtRoas(s.kpi)} · ${fmtNum(s.metrics.orders)} order` : `${fmtNum(s.metrics.orders)} order`} tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Content terbaik (views)</h2><Link href={`/reports/content?p=${period}&d=${anchor}`} className="text-xs text-brand-600 hover:underline">Lihat semua</Link></div>
          <Top rows={r.content.slice(0, 5).map((c) => ({ href: `/content/${c.id}`, name: c.title, sub: [c.platform, c.contentType].filter(Boolean).join(" · "), views: c.metrics.views, er: fmtEr(c.kpi) }))} empty="Tiada content published dalam tempoh ini." />
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">KOL paling berbaloi (CPM terendah)</h2><Link href={`/reports/kol?p=${period}&d=${anchor}`} className="text-xs text-brand-600 hover:underline">Lihat semua</Link></div>
          <Top rows={r.kolRanking.slice(0, 5).map((k) => ({ href: `/kol/${k.kolId}`, name: k.kolName, sub: `${k.posts} posting · CPM ${fmtCpm(k.kpi)}`, views: k.metrics.views, er: fmtEr(k.kpi) }))} empty="Tiada posting KOL dalam tempoh ini." />
        </section>

        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 font-semibold">Ikut platform</h2>
          <table className="table-base">
            <thead><tr><th>Platform</th><th className="text-right">Posting</th><th className="text-right">Views</th><th className="text-right">ER</th></tr></thead>
            <tbody>
              {r.byPlatform.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">Tiada data.</td></tr>}
              {r.byPlatform.map((g) => (
                <tr key={g.key}><td className="font-medium">{g.key}</td><td className="text-right tabular-nums">{g.posts}</td><td className="text-right tabular-nums">{fmtNum(g.metrics.views)}</td><td className="text-right tabular-nums">{fmtEr(g.kpi)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        {r.isAdmin && (
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Perbelanjaan ikut saluran</h2>
            {r.channels.length === 0 ? <p className="text-sm text-muted">Tiada perbelanjaan dalam tempoh ini.</p> : (
              <ul className="space-y-2.5">
                {[...r.channels].sort((a, b) => b.usedSen + b.pendingSen - (a.usedSen + a.pendingSen)).map((c) => {
                  const total = c.usedSen + c.pendingSen;
                  return (
                    <li key={c.category}>
                      <div className="flex justify-between text-sm"><span>{c.category}</span><span className="tabular-nums font-semibold">{formatSen(total)}</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full bg-brand-500" style={{ width: `${(total / maxChannel) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
            {s.inKindSen !== null && s.inKindSen > 0 && <p className="mt-3 text-xs text-muted">Termasuk juga nilai barang diberi kepada KOL: {formatSen(s.inKindSen)} (bukan tunai).</p>}
          </section>
        )}
      </div>
      <p className="text-xs text-muted">Angka prestasi diambil dari snapshot terkini (hari ke-30, jika tiada ke-7, jika tiada ke-1) bagi setiap posting. CPM = kos per 1,000 views. ER = engagement / views.</p>
    </div>
  );
}

function Top({ rows, empty }: { rows: { href: string; name: string; sub: string; views: number; er: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="space-y-2">
      {rows.map((x, i) => (
        <li key={x.href + i}>
          <Link href={x.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-brand-50">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{x.name}</span><span className="block truncate text-xs text-muted">{x.sub}</span></span>
            <span className="shrink-0 text-right text-sm tabular-nums"><b>{compactNum(x.views)}</b><span className="block text-xs text-muted">ER {x.er}</span></span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
