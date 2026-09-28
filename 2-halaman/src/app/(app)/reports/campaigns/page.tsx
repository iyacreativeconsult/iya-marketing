import Link from "next/link";
import { requirePageUser } from "@/lib/server/session";
import { buildReport } from "@/lib/server/services/reports";
import { listTeams } from "@/lib/server/services/teams";
import { formatDateMs } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import { TeamLabel, TypeBadge } from "@/components/badges";
import { fmtCost, fmtCpm, fmtEr, fmtNum, fmtRoas, parsePeriod, ReportHeader } from "@/components/reports/ReportHeader";

export const metadata = { title: "Laporan campaign" };

export default async function CampaignReportPage({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const user = await requirePageUser();
  const { period, anchor } = parsePeriod(await searchParams);
  const [r, teams] = await Promise.all([buildReport(user, period, anchor), listTeams()]);
  const team = new Map(teams.map((t) => [t.id, t]));
  return (
    <div className="space-y-5">
      <ReportHeader title="Laporan campaign" description="Prestasi semua posting (content + KOL) dalam setiap campaign, berbanding kos." base="/reports/campaigns" period={period} label={r.label} prev={r.range.prev} next={r.range.next} anchor={anchor} exportTab="campaign" />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[1100px]">
          <thead><tr><th>Campaign</th><th>Team</th><th>Tarikh</th><th className="text-right">Posting</th><th className="text-right">Views</th><th className="text-right">ER</th>{r.isAdmin && <><th className="text-right">Dirancang</th><th className="text-right">Kos sebenar</th><th className="text-right">CPM</th></>}<th className="text-right">Jualan</th>{r.isAdmin && <th className="text-right">ROAS</th>}</tr></thead>
          <tbody>
            {r.campaigns.length === 0 && <tr><td colSpan={11} className="py-8 text-center text-muted">Tiada campaign dalam tempoh ini.</td></tr>}
            {r.campaigns.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/campaigns/${c.id}`} className="font-semibold hover:text-brand-600">{c.name}</Link><div className="mt-1"><TypeBadge type={c.type} /></div></td>
                <td><TeamLabel team={team.get(c.teamId)} fallback={c.teamId} /></td>
                <td className="whitespace-nowrap text-sm">{formatDateMs(c.startDate)} – {formatDateMs(c.endDate)}</td>
                <td className="text-right tabular-nums">{c.posts}</td>
                <td className="text-right tabular-nums">{fmtNum(c.metrics.views)}</td>
                <td className="text-right tabular-nums">{fmtEr(c.kpi)}</td>
                {r.isAdmin && <>
                  <td className="text-right tabular-nums text-muted">{c.plannedSen === null ? "-" : formatSen(c.plannedSen)}</td>
                  <td className={`text-right tabular-nums ${c.plannedSen && c.kpi.costSen && c.kpi.costSen > c.plannedSen ? "font-semibold text-red-700" : ""}`}>{fmtCost(c.kpi)}</td>
                  <td className="text-right tabular-nums">{fmtCpm(c.kpi)}</td>
                </>}
                <td className="text-right tabular-nums">{formatSen(c.metrics.salesSen)}</td>
                {r.isAdmin && <td className="text-right tabular-nums font-semibold">{fmtRoas(c.kpi)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!r.isAdmin && <p className="text-xs text-muted">Kos dan ROAS campaign hanya dipaparkan kepada Admin.</p>}
    </div>
  );
}
