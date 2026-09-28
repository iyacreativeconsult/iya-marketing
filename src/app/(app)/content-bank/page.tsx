import Link from "next/link";
import { Archive, CircleCheck, FilePen, Repeat, Search } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listBank } from "@/lib/server/services/contentBank";
import { listTeams } from "@/lib/server/services/teams";
import { listCampaignsInRange } from "@/lib/server/services/campaigns";
import { contentOptions, nameMaps } from "@/lib/server/services/options";
import { addDays, todayMYT } from "@/lib/domain/dates";
import { BANK_STATUSES, FUNNELS } from "@/lib/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { TeamLabel } from "@/components/badges";
import { BankForm } from "@/components/bank/BankForm";

export const metadata = { title: "Content Bank" };

type SP = { q?: string; type?: string; platform?: string; item?: string; funnel?: string; status?: string };

const STATUS_CLS = { Draft: "bg-stone-100 text-stone-700", "Ready to Produce": "bg-emerald-50 text-emerald-800", Archived: "bg-stone-100 text-stone-500 line-through" } as const;

export default async function ContentBankPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const [all, options, names, teams, campaigns] = await Promise.all([listBank(), contentOptions(), nameMaps(), listTeams(), listCampaignsInRange(addDays(todayMYT(), -90), "9999-12-31")]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const myTeams = user.role === "admin" ? teams : teams.filter((t) => user.teamIds.includes(t.id));
  const defaultTeam = user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : myTeams[0]?.id ?? "";
  const status = sp.status ?? "active";
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = all.filter(
    (b) =>
      (status === "all" || (status === "active" ? b.status !== "Archived" : b.status === status)) &&
      (!sp.type || sp.type === "all" || b.contentType === sp.type) &&
      (!sp.platform || sp.platform === "all" || b.platforms.includes(sp.platform)) &&
      (!sp.item || sp.item === "all" || b.itemIds.includes(sp.item)) &&
      (!sp.funnel || sp.funnel === "all" || b.funnel === sp.funnel) &&
      (!q || b.hook.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Content Bank" description="Idea content yang sudah disimpan dan sedia untuk dihasilkan. Boleh diguna semula berulang kali." />
      <BankForm options={options} teams={myTeams} defaultTeamId={defaultTeam} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CircleCheck} label="Ready to Produce" value={all.filter((b) => b.status === "Ready to Produce").length} tone="green" />
        <StatCard icon={FilePen} label="Draf" value={all.filter((b) => b.status === "Draft").length} tone="amber" />
        <StatCard icon={Archive} label="Arkib" value={all.filter((b) => b.status === "Archived").length} />
        <StatCard icon={Repeat} label="Jumlah kali diguna" value={all.reduce((a, b) => a + b.useCount, 0)} />
      </div>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(5,150px)_auto]">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari hook" className="input" aria-label="Cari" />
        <select name="type" defaultValue={sp.type ?? "all"} className="input" aria-label="Jenis content"><option value="all">Semua jenis</option>{options.contentTypes.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="platform" defaultValue={sp.platform ?? "all"} className="input" aria-label="Platform"><option value="all">Semua platform</option>{options.platforms.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="item" defaultValue={sp.item ?? "all"} className="input" aria-label="Produk"><option value="all">Semua produk</option>{options.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        <select name="funnel" defaultValue={sp.funnel ?? "all"} className="input" aria-label="Funnel"><option value="all">Semua funnel</option>{FUNNELS.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="status" defaultValue={status} className="input" aria-label="Status"><option value="active">Kecuali arkib</option><option value="all">Semua</option>{BANK_STATUSES.map((t) => <option key={t}>{t}</option>)}</select>
        <div className="flex gap-2"><button className="btn-secondary"><Search className="size-4" /> Tapis</button>{Object.keys(sp).length > 0 && <Link href="/content-bank" className="btn-secondary">Reset</Link>}</div>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[980px]">
          <thead><tr><th>Hook</th><th>Jenis</th><th>Produk / platform</th><th>Funnel</th><th>Team</th><th className="text-right">Diguna</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted">Tiada entry.</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-brand-50/40">
                <td className="max-w-md">
                  <Link href={`/content-bank/${b.id}`} className="font-semibold hover:text-brand-600">{b.hook}</Link>
                  {b.audience && <p className="text-xs text-muted">Audience: {b.audience}</p>}
                </td>
                <td className="text-sm">{b.contentType}</td>
                <td className="text-xs text-muted">{[...b.itemIds.map((x) => names.itemName.get(x) ?? x), ...b.platforms].join(" · ") || "-"}</td>
                <td className="text-sm">{b.funnel}</td>
                <td><TeamLabel team={teamById.get(b.teamId)} fallback={b.teamId} /></td>
                <td className="text-right tabular-nums">{b.useCount}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[b.status]}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
