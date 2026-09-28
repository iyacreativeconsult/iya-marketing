import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { getContent } from "@/lib/server/services/content";
import { listAssetsForContent } from "@/lib/server/services/assets";
import { getCampaign } from "@/lib/server/services/campaigns";
import { getBank } from "@/lib/server/services/contentBank";
import { listTeams } from "@/lib/server/services/teams";
import { listAuditLogs } from "@/lib/server/services/logs";
import { productionOptions } from "@/lib/server/services/contentOptions";
import { nameMaps } from "@/lib/server/services/options";
import { canEditContent, canRequestDeleteContent, CONTENT_RULES, CONTENT_STATUS_CLS, contentAllowedActions, rightsState } from "@/lib/domain/content";
import { CONTENT_STATUSES } from "@/lib/domain/types";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { TeamLabel } from "@/components/badges";
import { ContentForm } from "@/components/content/ContentForm";
import { AssetForm } from "@/components/content/AssetForm";
import { PipelineActions } from "@/components/content/Actions";
import { DeleteControl } from "@/components/DeleteControl";
import { AuditTimeline } from "@/components/AuditTimeline";
import { PerformancePanel } from "@/components/reports/PerformancePanel";
import { listPerformanceFor } from "@/lib/server/services/performance";

export const metadata = { title: "Content" };

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const c = await getContent(id);
  if (!c) notFound();
  const [assets, campaign, bank, teams, history, options, names] = await Promise.all([
    listAssetsForContent(c.id),
    c.campaignId ? getCampaign(c.campaignId) : Promise.resolve(null),
    c.bankId ? getBank(c.bankId) : Promise.resolve(null),
    listTeams(),
    listAuditLogs({ entityId: c.id, limit: 40 }),
    productionOptions(user),
    nameMaps(),
  ]);
  const today = todayMYT();
  const perf = c.status === "Published" || c.status === "Archived" ? await listPerformanceFor("content", c.id) : [];
  const actions = contentAllowedActions(user, c).map((a) => ({ action: a, label: CONTENT_RULES[a].label, noteRequired: CONTENT_RULES[a].noteRequired, needsUrl: a === "publish" }));
  const stepIndex = CONTENT_STATUSES.indexOf(c.status);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/content" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Produksi content</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTENT_STATUS_CLS[c.status]}`}>{c.status}</span>
            <TeamLabel team={teams.find((t) => t.id === c.teamId)} fallback={c.teamId} />
            <span className="text-sm text-muted">PIC: <b className="text-ink">{c.ownerName}</b></span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{c.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditContent(user, c) && <ContentForm options={options} content={c} />}
          {user.role === "admin" && <DeleteControl mode="direct" what={`content "${c.title}"`} confirmText={c.title} url={`/api/content/${c.id}`} redirectTo="/content" />}
          {canRequestDeleteContent(user, c) && <DeleteControl mode="request" what={`content "${c.title}"`} entity="content" entityId={c.id} />}
        </div>
      </div>

      {/* Jejak pipeline */}
      <ol className="flex flex-wrap gap-1 text-[11px]">
        {CONTENT_STATUSES.filter((s) => s !== "Archived").map((s, i) => (
          <li key={s} className={`rounded-full px-2.5 py-1 font-semibold ${i < stepIndex ? "bg-emerald-50 text-emerald-800" : i === stepIndex ? "bg-brand-500 text-white" : "bg-stone-100 text-stone-500"}`}>{s}</li>
        ))}
      </ol>

      {c.statusNote && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nota: {c.statusNote}</p>}
      <PipelineActions endpoint={`/api/content/${c.id}/action`} version={c.version} actions={actions} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="card grid gap-4 p-5 sm:grid-cols-3">
            <Info label="Platform">{c.platform || "-"}</Info>
            <Info label="Jenis content">{c.contentType || "-"}</Info>
            <Info label="Tarikh publish">{c.publishDate ? formatDateMs(c.publishDate) : "-"}</Info>
            <Info label="Campaign">{campaign ? <Link href={`/campaigns/${campaign.id}`} className="text-brand-600 hover:underline">{campaign.name}</Link> : "-"}</Info>
            <Info label="Produk">{c.itemIds.map((x) => names.itemName.get(x) ?? x).join(", ") || "-"}</Info>
            <Info label="Dari Content Bank">{bank ? <Link href={`/content-bank/${bank.id}`} className="text-brand-600 hover:underline">&ldquo;{bank.hook}&rdquo;</Link> : "-"}</Info>
            {c.postUrl && (
              <div className="sm:col-span-3"><Info label="URL posting"><a href={c.postUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-brand-600 hover:underline">{c.postUrl} <ExternalLink className="size-3 shrink-0" /></a></Info></div>
            )}
          </section>

          {(c.status === "Published" || c.status === "Archived") && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Prestasi</h2>
              <PerformancePanel targetType="content" targetId={c.id} baseDate={c.publishDate} snapshots={perf} today={today} canEdit={user.role === "admin" || user.teamIds.includes(c.teamId)} />
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-2 font-semibold">Skrip / brief</h2>
            {c.script ? <pre className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 font-mono text-xs">{c.script}</pre> : <p className="text-sm text-muted">Belum ada skrip.</p>}
            {c.notes && <p className="mt-3 text-sm text-muted">Nota: {c.notes}</p>}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Asset ({assets.length})</h2>
              {canEditContent(user, c) && <AssetForm options={options} contentItem={{ id: c.id, teamId: c.teamId, title: c.title }} label="Tambah asset" />}
            </div>
            {assets.length === 0 ? (
              <p className="text-sm text-muted">Belum ada asset. Tambah raw footage, video siap, thumbnail atau caption.</p>
            ) : (
              <ul className="divide-y divide-line">
                {assets.map((a) => {
                  const rs = rightsState(a, today);
                  return (
                    <li key={a.id}>
                      <Link href={`/content/library/${a.id}`} className="flex items-center gap-3 py-2 hover:bg-brand-50/40">
                        {a.file?.type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/files/${a.file.id}`} alt="" className="size-10 rounded-lg object-cover" />
                        ) : (
                          <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600">{a.url ? <ExternalLink className="size-4" /> : <FileText className="size-4" />}</span>
                        )}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.name}</span><span className="text-xs text-muted">{a.kind} · {a.status}</span></span>
                        {rs === "expired" && <span className="text-xs font-semibold text-red-700">Hak guna tamat</span>}
                        {rs === "soon" && <span className="text-xs font-semibold text-amber-700">Hak guna hampir tamat</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Sejarah</h2>
          <AuditTimeline entries={history} />
        </section>
      </div>
      {c.status === "Published" && <p className="flex items-center gap-2 text-xs text-muted"><Archive className="size-3.5" /> Arkibkan content lama supaya papan produksi kekal kemas.</p>}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
