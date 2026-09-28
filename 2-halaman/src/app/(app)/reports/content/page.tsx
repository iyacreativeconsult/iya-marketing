import Link from "next/link";
import { requirePageUser } from "@/lib/server/session";
import { buildReport } from "@/lib/server/services/reports";
import { formatDateMs } from "@/lib/domain/dates";
import { compactNum } from "@/lib/domain/report";
import { fmtEr, fmtNum, parsePeriod, ReportHeader } from "@/components/reports/ReportHeader";

export const metadata = { title: "Laporan content" };

export default async function ContentReportPage({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const user = await requirePageUser();
  const { period, anchor } = parsePeriod(await searchParams);
  const r = await buildReport(user, period, anchor);
  const maxViews = Math.max(1, ...r.byContentType.map((g) => g.metrics.views));
  return (
    <div className="space-y-5">
      <ReportHeader title="Laporan content" description="Jenis content dan posting mana yang paling berkesan." base="/reports/content" period={period} label={r.label} prev={r.range.prev} next={r.range.next} anchor={anchor} exportTab="content" />

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Ikut jenis content</h2>
        {r.byContentType.length === 0 ? <p className="text-sm text-muted">Tiada content published dalam tempoh ini.</p> : (
          <ul className="space-y-3">
            {r.byContentType.map((g) => (
              <li key={g.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{g.key} <span className="text-xs text-muted">({g.posts} posting)</span></span>
                  <span className="tabular-nums"><b>{compactNum(g.metrics.views)}</b> views · ER {fmtEr(g.kpi)} · purata {compactNum(Math.round(g.metrics.views / g.posts))}/posting</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full bg-brand-500" style={{ width: `${(g.metrics.views / maxViews) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Setiap content</h2>
        <table className="table-base min-w-[980px]">
          <thead><tr><th>Content</th><th>Publish</th><th>PIC</th><th>Data</th><th className="text-right">Views</th><th className="text-right">Likes</th><th className="text-right">Komen</th><th className="text-right">Share</th><th className="text-right">Save</th><th className="text-right">ER</th></tr></thead>
          <tbody>
            {r.content.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-muted">Tiada content published.</td></tr>}
            {r.content.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/content/${c.id}`} className="font-semibold hover:text-brand-600">{c.title}</Link><p className="text-xs text-muted">{[c.platform, c.contentType].filter(Boolean).join(" · ")}</p></td>
                <td className="whitespace-nowrap text-sm">{formatDateMs(c.date)}</td>
                <td className="text-sm">{c.ownerName}</td>
                <td className="text-xs">{c.lastDay ? `Hari ${c.lastDay}` : <Link href={`/content/${c.id}`} className="font-semibold text-amber-700">Belum diisi</Link>}</td>
                <td className="text-right tabular-nums font-semibold">{fmtNum(c.metrics.views)}</td>
                <td className="text-right tabular-nums">{fmtNum(c.metrics.likes)}</td>
                <td className="text-right tabular-nums">{fmtNum(c.metrics.comments)}</td>
                <td className="text-right tabular-nums">{fmtNum(c.metrics.shares)}</td>
                <td className="text-right tabular-nums">{fmtNum(c.metrics.saves)}</td>
                <td className="text-right tabular-nums">{fmtEr(c.kpi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
