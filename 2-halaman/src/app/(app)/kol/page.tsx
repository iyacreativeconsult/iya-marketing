import Link from "next/link";
import { Ban, CircleCheck, CirclePause, Plus, Search, UsersRound } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listKols } from "@/lib/server/services/kols";
import { listTeams } from "@/lib/server/services/teams";
import { getMasterLists } from "@/lib/server/services/master";
import { formatSen } from "@/lib/domain/money";
import { KOL_STATUSES } from "@/lib/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { TeamLabel } from "@/components/badges";
import { SocialLinks } from "@/components/finance";

export const metadata = { title: "Senarai KOL" };

type SP = { q?: string; platform?: string; status?: string; niche?: string; loc?: string };

export default async function KolListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const [all, teams, lists] = await Promise.all([listKols(), listTeams(), getMasterLists()]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const q = (sp.q ?? "").trim().toLowerCase().replace(/^@/, "");
  const loc = (sp.loc ?? "").trim().toLowerCase();
  const kols = all.filter(
    (k) =>
      (!sp.platform || sp.platform === "all" || k.accounts.some((a) => a.platform === sp.platform)) &&
      (!sp.status || sp.status === "all" || k.status === sp.status) &&
      (!sp.niche || sp.niche === "all" || k.niches.includes(sp.niche)) &&
      (!loc || k.location.toLowerCase().includes(loc)) &&
      (!q || k.name.toLowerCase().includes(q) || k.realName.toLowerCase().includes(q) || k.accounts.some((a) => a.username.toLowerCase().includes(q))),
  );
  const filtered = kols.length !== all.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Senarai KOL"
        description="Database dikongsi semua team supaya KOL yang sama tidak didaftar dua kali."
        actions={user.activeTeamId && <Link href="/kol/new" className="btn-primary"><Plus className="size-4" /> Tambah KOL</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UsersRound} label="Jumlah KOL" value={all.length} />
        <StatCard icon={CircleCheck} label="Aktif" value={all.filter((k) => k.status === "Aktif").length} tone="green" />
        <StatCard icon={CirclePause} label="Tidak aktif" value={all.filter((k) => k.status === "Tidak Aktif").length} tone="amber" />
        <StatCard icon={Ban} label="Blacklist" value={all.filter((k) => k.status === "Blacklist").length} tone="red" />
      </div>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_150px_150px_150px_150px_auto]">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari nama atau @username" className="input" aria-label="Cari" />
        <select name="niche" defaultValue={sp.niche ?? "all"} className="input" aria-label="Niche">
          <option value="all">Semua niche</option>
          {lists.niches.map((n) => <option key={n}>{n}</option>)}
        </select>
        <input name="loc" defaultValue={sp.loc ?? ""} placeholder="Lokasi" className="input" aria-label="Lokasi" />
        <select name="platform" defaultValue={sp.platform ?? "all"} className="input" aria-label="Platform">
          <option value="all">Semua platform</option>
          {lists.platforms.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? "all"} className="input" aria-label="Status">
          <option value="all">Semua status</option>
          {KOL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-secondary"><Search className="size-4" /> Tapis</button>
          {filtered && <Link href="/kol" className="btn-secondary">Reset</Link>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
          <span className="font-semibold">{filtered ? `${kols.length} daripada ${all.length} KOL` : `${all.length} KOL`}</span>
          <span className="text-muted">Klik nama untuk profil, sejarah campaign dan maklumat bayaran.</span>
        </div>
        <table className="table-base min-w-[900px]">
          <thead><tr><th>KOL</th><th>Akaun media sosial</th><th>Niche / lokasi</th><th className="text-right">Rate biasa</th><th>Status</th><th>Team</th></tr></thead>
          <tbody>
            {kols.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted">{filtered ? "Tiada KOL untuk tapisan ini." : "Belum ada KOL. Klik Tambah KOL untuk mula."}</td></tr>}
            {kols.map((k) => (
              <tr key={k.id} className="hover:bg-brand-50/40">
                <td>
                  <Link href={`/kol/${k.id}`} className="font-semibold hover:text-brand-600">{k.name}</Link>
                  {k.realName && <p className="text-xs text-muted">{k.realName}</p>}
                </td>
                <td><SocialLinks accounts={k.accounts} /></td>
                <td className="text-sm">{k.niches.join(", ") || "-"}<p className="text-xs text-muted">{k.location}</p></td>
                <td className="text-right tabular-nums">{k.rateSen ? formatSen(k.rateSen) : "-"}</td>
                <td><span className={`text-sm font-semibold ${k.status === "Blacklist" ? "text-red-700" : k.status === "Aktif" ? "text-emerald-700" : "text-muted"}`}>{k.status}</span></td>
                <td><TeamLabel team={teamById.get(k.ownerTeamId)} fallback={k.ownerTeamId} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
