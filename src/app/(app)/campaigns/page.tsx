import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { listCampaignsInRange } from "@/lib/server/services/campaigns";
import { formatDateMs, formatMonthMs, monthRange, shiftMonth } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import { CAMPAIGN_STATUSES } from "@/lib/domain/types";
import { getMasterLists } from "@/lib/server/services/master";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, TeamLabel, TypeBadge } from "@/components/badges";

export const metadata = { title: "Campaign" };

type SP = { m?: string; team?: string; status?: string; type?: string; q?: string };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { month, from, to } = monthRange(sp.m);
  const [teams, campaigns, lists] = await Promise.all([listTeams(), listCampaignsInRange(from, to), getMasterLists()]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // Lalai: team sesi aktif
  const team = sp.team ?? (user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : "all");
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = campaigns.filter(
    (c) =>
      (team === "all" || c.teamId === team) &&
      (!sp.status || sp.status === "all" || c.status === sp.status) &&
      (!sp.type || sp.type === "all" || c.type === sp.type) &&
      (q === "" || c.name.toLowerCase().includes(q)),
  );

  const qs = (m: string) => {
    const p = new URLSearchParams({ m, team, status: sp.status ?? "all", type: sp.type ?? "all", q: sp.q ?? "" });
    return `/campaigns?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Campaign"
        description="Senarai campaign yang berjalan dalam bulan dipilih."
        actions={
          user.activeTeamId && (
            <Link href="/campaigns/new" className="btn-primary">
              <Plus className="size-4" /> Tambah Campaign
            </Link>
          )
        }
      />

      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]">
        <div className="flex items-center gap-2">
          <Link href={qs(shiftMonth(month, -1))} className="btn-secondary px-2.5" aria-label="Bulan sebelum"><ChevronLeft className="size-4" /></Link>
          <span className="min-w-32 text-center text-sm font-semibold">{formatMonthMs(month)}</span>
          <Link href={qs(shiftMonth(month, 1))} className="btn-secondary px-2.5" aria-label="Bulan seterusnya"><ChevronRight className="size-4" /></Link>
          <input type="hidden" name="m" value={month} />
        </div>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari nama" className="input" aria-label="Cari" />
        <select name="team" defaultValue={team} className="input" aria-label="Team">
          <option value="all">Semua Team</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? "all"} className="input" aria-label="Jenis">
          <option value="all">Semua Jenis</option>
          {lists.campaignTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? "all"} className="input" aria-label="Status">
          <option value="all">Semua Status</option>
          {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-secondary"><Search className="size-4" /> Tapis</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Jenis</th>
              <th>Team</th>
              <th>Tarikh</th>
              <th className="text-right">Anggaran bajet</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted">Tiada campaign untuk tapisan ini.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-brand-50/60">
                <td><Link href={`/campaigns/${c.id}`} className="font-semibold hover:text-brand-600">{c.name}</Link></td>
                <td><TypeBadge type={c.type} /></td>
                <td><TeamLabel team={teamById.get(c.teamId)} fallback={c.teamId} /></td>
                <td className="whitespace-nowrap">{formatDateMs(c.startDate)} – {formatDateMs(c.endDate)}</td>
                <td className="text-right tabular-nums">{formatSen(c.plannedBudgetSen)}</td>
                <td><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
