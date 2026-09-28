import Link from "next/link";
import { Clock, ExternalLink, Megaphone, Search, TriangleAlert, Wallet } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listCksForScope } from "@/lib/server/services/campaignKols";
import { listTeams } from "@/lib/server/services/teams";
import { isPostingOverdue, STAGE_GROUPS } from "@/lib/domain/kol";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import type { CampaignKol } from "@/lib/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { TeamLabel } from "@/components/badges";
import { KolStageBadge, Money } from "@/components/finance";
import { Checklist } from "@/components/kol/Checklist";

export const metadata = { title: "Tracker posting KOL" };

type SP = { stage?: string; q?: string };

const FILTERS: Record<string, { label: string; test: (c: CampaignKol, today: string) => boolean }> = {
  aktif: { label: "Aktif", test: (c) => !["Completed", "Dropped"].includes(c.stage) },
  rundingan: { label: "Rundingan", test: (c) => STAGE_GROUPS.rundingan.includes(c.stage) },
  belum: { label: "Belum posting", test: (c) => STAGE_GROUPS.belumPosting.includes(c.stage) },
  lewat: { label: "Lewat posting", test: (c, t) => isPostingOverdue(c, t) },
  bayaran: { label: "Posted, bayaran pending", test: (c) => c.stage === "Payment Pending" },
  selesai: { label: "Selesai", test: (c) => STAGE_GROUPS.selesai.includes(c.stage) },
  semua: { label: "Semua", test: () => true },
};

export default async function KolTrackerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const scope = user.activeTeamId;
  const teams = await listTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  if (!scope) {
    return (
      <div className="space-y-5">
        <PageHeader title="Tracker posting" />
        <p className="card p-6 text-sm">Anda belum ditambah ke mana-mana team.</p>
      </div>
    );
  }

  const today = todayMYT();
  const all = await listCksForScope(user, scope);
  const stageKey = sp.stage && FILTERS[sp.stage] ? sp.stage : "aktif";
  const q = (sp.q ?? "").trim().toLowerCase().replace(/^@/, "");
  const rows = all.filter(
    (c) => FILTERS[stageKey]!.test(c, today) && (!q || c.kolName.toLowerCase().includes(q) || c.kolHandle.toLowerCase().includes(q) || c.campaignName.toLowerCase().includes(q)),
  );
  const count = (k: string) => all.filter((c) => FILTERS[k]!.test(c, today)).length;
  const href = (stage: string) => `/kol/tracker?stage=${stage}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tracker posting"
        description={scope === "all" ? "Semua team. Klik KOL untuk checklist, posting dan bayaran." : `${teamById.get(scope)?.name ?? ""}. Tukar Sesi Aktif untuk team lain.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Megaphone} label="KOL aktif dalam campaign" value={count("aktif")} />
        <StatCard icon={Clock} label="Belum posting" value={count("belum")} tone="amber" />
        <StatCard icon={TriangleAlert} label="Lewat posting" value={count("lewat")} tone={count("lewat") ? "red" : "green"} />
        <StatCard icon={Wallet} label="Posted, bayaran pending" value={count("bayaran")} />
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(FILTERS).map(([k, f]) => (
            <Link key={k} href={href(k)} className={`rounded-full border px-3 py-1.5 text-sm ${k === stageKey ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"} ${k === "lewat" && count(k) > 0 && k !== stageKey ? "border-red-200 text-red-700" : ""}`}>
              {f.label} ({count(k)})
            </Link>
          ))}
        </div>
        <form method="get" className="flex gap-2">
          <input type="hidden" name="stage" value={stageKey} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari KOL atau campaign" className="input max-w-sm" aria-label="Cari" />
          <button className="btn-secondary"><Search className="size-4" /> Cari</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[1060px]">
          <thead><tr><th>KOL</th><th>Campaign</th><th>Tarikh posting</th><th>Checklist</th><th>Status</th><th className="text-right">Fee</th><th className="text-right">Dibayar</th><th>Posting</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">Tiada rekod.</td></tr>}
            {rows.map((c) => {
              const late = isPostingOverdue(c, today);
              return (
                <tr key={c.id} className={`hover:bg-brand-50/40 ${late ? "bg-red-50/40" : ""}`}>
                  <td>
                    <Link href={`/kol/campaign/${c.id}`} className="font-semibold hover:text-brand-600">{c.kolName}</Link>
                    <p className="text-xs text-muted">{c.kolHandle} · {c.platform} · PIC {c.picName || "-"}</p>
                    <p className="text-xs font-medium text-brand-700">{c.collabType}{c.collabType === "Hantar produk (seeding)" && c.details.shipStatus ? ` · ${c.details.shipStatus}` : ""}</p>
                  </td>
                  <td className="text-sm">
                    <Link href={`/campaigns/${c.campaignId}`} className="hover:text-brand-600">{c.campaignName}</Link>
                    {scope === "all" && <div className="mt-1"><TeamLabel team={teamById.get(c.teamId)} /></div>}
                  </td>
                  <td className={`text-sm whitespace-nowrap ${late ? "font-semibold text-red-700" : ""}`}>
                    {c.postingDueDate ? formatDateMs(c.postingDueDate) : "-"}
                    {late && <span className="block text-xs">Lewat</span>}
                  </td>
                  <td><Checklist c={c.checklist} compact /></td>
                  <td><KolStageBadge stage={c.stage} /></td>
                  <td className="text-right"><Money sen={c.feeSen} /></td>
                  <td className="text-right"><Money sen={c.paidSen} /></td>
                  <td className="text-sm">
                    {c.postUrl ? (
                      <a href={c.postUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        Lihat <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
