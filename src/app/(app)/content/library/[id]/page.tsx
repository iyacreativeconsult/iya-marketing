import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { getAsset } from "@/lib/server/services/assets";
import { getContent } from "@/lib/server/services/content";
import { getCampaign } from "@/lib/server/services/campaigns";
import { listTeams } from "@/lib/server/services/teams";
import { listAuditLogs } from "@/lib/server/services/logs";
import { productionOptions } from "@/lib/server/services/contentOptions";
import { nameMaps } from "@/lib/server/services/options";
import { ASSET_ACTION_LABEL, assetAllowedActions, canEditAsset, canRequestDeleteAsset, canUseForAds, rightsState } from "@/lib/domain/content";
import { detectPlatform } from "@/lib/domain/links";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { TeamLabel } from "@/components/badges";
import { AssetForm } from "@/components/content/AssetForm";
import { PipelineActions } from "@/components/content/Actions";
import { DeleteControl } from "@/components/DeleteControl";
import { AuditTimeline } from "@/components/AuditTimeline";

export const metadata = { title: "Asset" };

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const a = await getAsset(id);
  if (!a) notFound();
  const [content, campaign, teams, history, options, names] = await Promise.all([
    a.contentItemId ? getContent(a.contentItemId) : Promise.resolve(null),
    a.campaignId ? getCampaign(a.campaignId) : Promise.resolve(null),
    listTeams(),
    listAuditLogs({ entityId: a.id, limit: 30 }),
    productionOptions(user),
    nameMaps(),
  ]);
  const today = todayMYT();
  const rs = rightsState(a, today);
  const actions = assetAllowedActions(user, a).map((x) => ({ action: x, label: ASSET_ACTION_LABEL[x], noteRequired: x === "revise" }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/content/library" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Content Library</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{a.kind}</span>
            <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold">{a.status}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{a.name}</h1>
          <p className="mt-1 text-sm text-muted">{a.createdByName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditAsset(user, a) && <AssetForm options={options} asset={a} />}
          {user.role === "admin" && <DeleteControl mode="direct" what={`asset "${a.name}"`} confirmText={a.name} url={`/api/assets/${a.id}`} redirectTo="/content/library" />}
          {canRequestDeleteAsset(user, a) && <DeleteControl mode="request" what={`asset "${a.name}"`} entity="asset" entityId={a.id} />}
        </div>
      </div>

      {rs === "expired" && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Hak guna tamat pada {formatDateMs(a.rightsUntil)}. Jangan guna asset ini lagi tanpa kebenaran baru.</p>}
      {rs === "soon" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Hak guna akan tamat pada {formatDateMs(a.rightsUntil)}.</p>}
      {a.statusNote && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nota: {a.statusNote}</p>}
      <PipelineActions endpoint={`/api/assets/${a.id}/action`} version={a.version} actions={actions} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card space-y-4 p-5">
          {a.file?.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${a.file.id}`} alt={a.name} className="max-h-[480px] w-full rounded-xl bg-stone-50 object-contain" />
          )}
          <div className="flex flex-wrap gap-2">
            {a.file && <a href={`/api/files/${a.file.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary"><Download className="size-4" /> {a.file.name}</a>}
            {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary"><ExternalLink className="size-4" /> Buka di {detectPlatform(a.url)}</a>}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Team"><TeamLabel team={teams.find((t) => t.id === a.teamId)} fallback={a.teamId} /></Info>
            <Info label="Pencipta">{a.creator || "-"}</Info>
            <Info label="Platform">{a.platform || "-"}</Info>
            <Info label="Jenis content">{a.contentType || "-"}</Info>
            <Info label="Produk">{a.itemIds.map((x) => names.itemName.get(x) ?? x).join(", ") || "-"}</Info>
            <Info label="Hak guna">{a.usageRights}{a.rightsUntil ? ` sehingga ${formatDateMs(a.rightsUntil)}` : ""}</Info>
            <Info label="Boleh untuk iklan">{canUseForAds(a, today) ? "Ya" : "Tidak"}</Info>
            <Info label="Content">{content ? <Link href={`/content/${content.id}`} className="text-brand-600 hover:underline">{content.title}</Link> : "-"}</Info>
            <Info label="Campaign">{campaign ? <Link href={`/campaigns/${campaign.id}`} className="text-brand-600 hover:underline">{campaign.name}</Link> : "-"}</Info>
          </dl>
          {a.remark && <p className="text-sm text-muted">Catatan: {a.remark}</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Sejarah</h2>
          <AuditTimeline entries={history} />
        </section>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
