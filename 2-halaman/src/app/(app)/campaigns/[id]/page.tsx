import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { getCampaign, getConflicts } from "@/lib/server/services/campaigns";
import { listAuditLogs } from "@/lib/server/services/logs";
import { ACTION_RULES, allowedActions, canDeleteCampaign, canEditCampaign, canRequestDeleteCampaign, STATUS_INFO } from "@/lib/domain/campaign";
import { formatDateMs, formatDateTimeMs, todayMYT } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import { StatusBadge, TeamLabel, TypeBadge } from "@/components/badges";
import { CampaignActions } from "@/components/CampaignActions";
import { AuditTimeline } from "@/components/AuditTimeline";
import { listCksForCampaign } from "@/lib/server/services/campaignKols";
import { listKols } from "@/lib/server/services/kols";
import { isOwnerOrAdmin } from "@/lib/domain/campaign";
import { KolStageBadge, Money } from "@/components/finance";
import { Checklist } from "@/components/kol/Checklist";
import { AssignKolForm } from "@/components/kol/AssignKolForm";
import { nameMaps } from "@/lib/server/services/options";
import { getMasterLists } from "@/lib/server/services/master";
import { getCampaignCost, teamMembers } from "@/lib/server/services/budget";

export const metadata = { title: "Campaign" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const c = await getCampaign(id);
  if (!c) notFound();

  const [teams, conflicts, history] = await Promise.all([listTeams(), getConflicts(c), listAuditLogs({ entityId: c.id, limit: 50 })]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const actions = allowedActions(user, c).map((a) => ({ action: a, label: ACTION_RULES[a].label, noteRequired: Boolean(ACTION_RULES[a].noteRequired) }));
  const today = todayMYT();
  const canAssign = isOwnerOrAdmin(user, c) && c.status !== "Completed" && c.status !== "Cancelled";
  const [cks, kols, names, lists, cost] = await Promise.all([
    listCksForCampaign(user, c.id),
    canAssign ? listKols() : Promise.resolve([]),
    nameMaps(),
    getMasterLists(),
    getCampaignCost(user, c),
  ]);
  const members = canAssign && user.role === "admin" ? await teamMembers(c.teamId) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Senarai campaign
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={c.type} />
            <StatusBadge status={c.status} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{c.name}</h1>
          <p className="mt-1 text-sm text-muted">{STATUS_INFO[c.status].hint}</p>
        </div>
      </div>

      {c.statusNote && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">Nota status:</span> {c.statusNote}
        </p>
      )}
      {c.status === "Approved" && c.startDate <= today && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Tarikh mula sudah tiba tetapi campaign belum Scheduled. Campaign hanya jadi Ongoing secara automatik selepas Scheduled.
        </p>
      )}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" aria-hidden /> Bertindih dengan campaign lain untuk produk yang sama
          </p>
          <ul className="mt-2 list-disc pl-6">
            {conflicts.map((o) => (
              <li key={o.id}>
                <Link href={`/campaigns/${o.id}`} className="underline underline-offset-2">{o.name}</Link> ({teamById.get(o.teamId)?.name ?? o.teamId},{" "}
                {formatDateMs(o.startDate)} – {formatDateMs(o.endDate)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <CampaignActions
        campaignId={c.id}
        version={c.version}
        actions={actions}
        canEdit={canEditCampaign(user, c)}
        canDelete={canDeleteCampaign(user, c)}
        canRequestDelete={canRequestDeleteCampaign(user, c)}
        name={c.name}
      />

      {cost && (
        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{cost.scope === "all" ? "Kos campaign" : "Kos yang ditanggung oleh anda"}</h2>
            <p className="text-sm text-muted">Dirancang {formatSen(cost.plannedSen)}</p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <CostStat label="Tunai digunakan" sen={cost.usedSen} />
            <CostStat label="Tunai dalam proses" sen={cost.pendingSen} />
            <CostStat label="Fee KOL belum bayar" sen={cost.kolUnpaidSen} />
            <CostStat label="Nilai barang diberi" sen={cost.inKindSen} hint="In-kind, tidak tolak bajet" />
            <CostStat label="Kos sebenar" sen={cost.totalSen} strong over={cost.plannedSen > 0 && cost.totalSen > cost.plannedSen} />
          </dl>
          {cost.byCategory.length > 0 && (
            <p className="mt-3 text-xs text-muted">Ikut saluran: {cost.byCategory.map((r) => `${r.category} ${formatSen(r.usedSen + r.pendingSen)}`).join(" · ")}</p>
          )}
        </section>
      )}

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-semibold">KOL dalam campaign ini ({cks.filter((k) => k.stage !== "Dropped").length})</h2>
          {canAssign && <AssignKolForm members={members} platforms={lists.platforms} campaignId={c.id} kols={kols.map((k) => ({ id: k.id, name: k.name, accounts: k.accounts, rateSen: k.rateSen, status: k.status }))} defaultDueDate={c.startDate} />}
        </div>
        <table className="table-base min-w-[760px]">
          <thead><tr><th>KOL</th><th>Tarikh posting</th><th>Checklist</th><th>Status</th><th className="text-right">Fee</th></tr></thead>
          <tbody>
            {cks.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Belum ada KOL.</td></tr>}
            {cks.map((k) => (
              <tr key={k.id}>
                <td>
                  <Link href={`/kol/campaign/${k.id}`} className="font-semibold hover:text-brand-600">{k.kolName}</Link>
                  <p className="text-xs text-muted">{k.kolHandle} · {k.platform}</p>
                </td>
                <td className="text-sm">{k.postingDueDate ? formatDateMs(k.postingDueDate) : "-"}</td>
                <td><Checklist c={k.checklist} compact /></td>
                <td><KolStageBadge stage={k.stage} /></td>
                <td className="text-right"><Money sen={k.feeSen} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Team"><TeamLabel team={teamById.get(c.teamId)} fallback={c.teamId} /></Item>
            <Item label="Tarikh">{formatDateMs(c.startDate)} – {formatDateMs(c.endDate)}</Item>
            <Item label="Platform">{c.platforms.join(", ") || "-"}</Item>
            <Item label="Item">{c.itemIds.map((i) => names.itemName.get(i) ?? i).join(", ") || "-"}</Item>
            <Item label="Outlet">{c.outletIds.map((i) => names.outletName.get(i) ?? i).join(", ") || "-"}</Item>
            <Item label="Anggaran bajet">{formatSen(c.plannedBudgetSen)}</Item>
            <Item label="Dicipta oleh">{c.createdByName} <span className="text-muted">({formatDateTimeMs(c.createdAt)})</span></Item>
          </dl>
          <div className="mt-6 space-y-4 border-t border-line pt-5">
            <Item label="Objektif"><p className="whitespace-pre-wrap">{c.objective || "-"}</p></Item>
            <Item label="Nota"><p className="whitespace-pre-wrap">{c.notes || "-"}</p></Item>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-semibold">Sejarah</h2>
          <AuditTimeline entries={history} />
        </section>
      </div>
    </div>
  );
}

function CostStat({ label, sen, hint, strong, over }: { label: string; sen: number; hint?: string; strong?: boolean; over?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-bold" : "font-semibold"} ${over ? "text-red-700" : ""}`}>{formatSen(sen)}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
