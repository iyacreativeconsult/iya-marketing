import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Lightbulb } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { getBank } from "@/lib/server/services/contentBank";
import { listTeams } from "@/lib/server/services/teams";
import { getCampaign, listCampaignsInRange } from "@/lib/server/services/campaigns";
import { listAuditLogs } from "@/lib/server/services/logs";
import { contentOptions, nameMaps } from "@/lib/server/services/options";
import { canEditBank, canRequestDeleteBank } from "@/lib/domain/idea";
import { addDays, formatDateTimeMs, todayMYT } from "@/lib/domain/dates";
import { TeamLabel } from "@/components/badges";
import { BankForm } from "@/components/bank/BankForm";
import { DeleteControl } from "@/components/DeleteControl";
import { AuditTimeline } from "@/components/AuditTimeline";
import { ReferenceView } from "@/components/ideas/References";
import { ContentForm } from "@/components/content/ContentForm";
import { productionOptions } from "@/lib/server/services/contentOptions";

export const metadata = { title: "Content Bank" };

export default async function BankEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const b = await getBank(id);
  if (!b) notFound();
  const [options, names, teams, campaign, campaigns, history] = await Promise.all([
    contentOptions(),
    nameMaps(),
    listTeams(),
    b.campaignId ? getCampaign(b.campaignId) : Promise.resolve(null),
    listCampaignsInRange(addDays(todayMYT(), -90), "9999-12-31"),
    listAuditLogs({ entityId: id, limit: 30 }),
  ]);
  const production = await productionOptions(user);
  const myTeams = user.role === "admin" ? teams : teams.filter((t) => user.teamIds.includes(t.id));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/content-bank" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Content Bank</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{b.contentType}</span>
            <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold">{b.funnel}</span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{b.status}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">&ldquo;{b.hook}&rdquo;</h1>
          <p className="mt-1 text-sm text-muted">{b.createdByName} · {formatDateTimeMs(b.createdAt)} · diguna {b.useCount} kali</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === "admin" && <DeleteControl mode="direct" what="entry Content Bank ini" confirmText="PADAM" url={`/api/content-bank/${b.id}`} redirectTo="/content-bank" />}
          {canRequestDeleteBank(user, b) && <DeleteControl mode="request" what="entry Content Bank ini" entity="bank" entityId={b.id} />}
        </div>
      </div>

      {b.status !== "Archived" && (
        <ContentForm options={production} label="Guna idea ini" fromBank={{ id: b.id, hook: b.hook, itemIds: b.itemIds, platforms: b.platforms, contentType: b.contentType, teamId: b.teamId, campaignId: b.campaignId }} />
      )}
      {canEditBank(user, b) && <BankForm options={options} teams={myTeams} defaultTeamId={b.teamId} entry={b} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card space-y-4 p-5">
          <p className="whitespace-pre-wrap text-sm">{b.description || <span className="text-muted">Tiada huraian.</span>}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Team</dt><dd><TeamLabel team={teams.find((t) => t.id === b.teamId)} fallback={b.teamId} /></dd></div>
            <div><dt className="text-xs text-muted">Target audience</dt><dd>{b.audience || "-"}</dd></div>
            <div><dt className="text-xs text-muted">Produk</dt><dd>{b.itemIds.map((x) => names.itemName.get(x) ?? x).join(", ") || "-"}</dd></div>
            <div><dt className="text-xs text-muted">Platform</dt><dd>{b.platforms.join(", ") || "-"}</dd></div>
            <div><dt className="text-xs text-muted">Campaign</dt><dd>{campaign ? <Link href={`/campaigns/${campaign.id}`} className="text-brand-600 hover:underline">{campaign.name}</Link> : "-"}</dd></div>
            <div><dt className="text-xs text-muted">Asal idea</dt><dd>{b.ideaId ? <Link href={`/ideas/${b.ideaId}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Lightbulb className="size-3.5" /> Idea Hub</Link> : "-"}</dd></div>
          </dl>
          <ReferenceView images={b.images} links={[]} />
          {b.references.length > 0 && (
            <ul className="space-y-1 text-sm">
              {b.references.map((r) => <li key={r}><a href={r} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 break-all text-brand-600 hover:underline">{r} <ExternalLink className="size-3 shrink-0" /></a></li>)}
            </ul>
          )}

        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Sejarah</h2>
          <AuditTimeline entries={history} />
        </section>
      </div>
    </div>
  );
}
