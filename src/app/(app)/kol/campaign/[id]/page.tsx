import { WhatsAppButton } from "@/components/kol/WhatsAppButton";
import { kolWhatsapp } from "@/lib/domain/whatsapp";
import { getKol } from "@/lib/server/services/kols";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { getCk, listPaymentsForCk } from "@/lib/server/services/campaignKols";
import { listAuditLogs } from "@/lib/server/services/logs";
import { canEditCkDetails, canEditCkFee, isPostingOverdue, KOL_RULES, kolAllowedActions } from "@/lib/domain/kol";
import { canViewOwnerFinance } from "@/lib/domain/budget";
import { teamMembers } from "@/lib/server/services/budget";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { TeamLabel } from "@/components/badges";
import { KolStageBadge, Money } from "@/components/finance";
import { Checklist } from "@/components/kol/Checklist";
import { CkPanel } from "@/components/kol/CkPanel";
import { PaymentsPanel } from "@/components/kol/PaymentsPanel";
import { AuditTimeline } from "@/components/AuditTimeline";
import { PerformancePanel } from "@/components/reports/PerformancePanel";
import { listPerformanceFor } from "@/lib/server/services/performance";
import { getMasterLists } from "@/lib/server/services/master";
import { listItems, listOutlets } from "@/lib/server/services/catalog";
import { listExpensesForCk } from "@/lib/server/services/budget";
import { formatSen } from "@/lib/domain/money";
import type { CampaignKol } from "@/lib/domain/types";

export const metadata = { title: "KOL dalam campaign" };

export default async function CkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const ck = await getCk(user, id);
  if (!ck) notFound();
  const finance = canViewOwnerFinance(user, ck.picId);
  const [teams, payments, history, lists, items, outlets, related] = await Promise.all([
    listTeams(),
    listPaymentsForCk(user, ck.id, ck.picId),
    finance ? listAuditLogs({ entityId: ck.id, limit: 50 }) : Promise.resolve([]),
    getMasterLists(),
    listItems(),
    listOutlets(),
    listExpensesForCk(user, ck.id, ck.picId),
  ]);
  const options = {
    members: user.role === "admin" ? await teamMembers(ck.teamId) : null,
    platforms: lists.platforms,
    items: items.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name, unit: i.unit, costSen: i.costSen })),
    outlets: outlets.filter((o) => o.active).map((o) => ({ id: o.id, name: o.name })),
  };
  const outletName = new Map(outlets.map((o) => [o.id, o.name]));
  const relatedSen = related.reduce((a, e) => a + e.amountSen, 0);
  const team = teams.find((t) => t.id === ck.teamId);
  const actions = kolAllowedActions(user, ck).map((a) => ({ action: a, label: KOL_RULES[a].label, noteRequired: Boolean(KOL_RULES[a].noteRequired) }));
  const overdue = isPostingOverdue(ck, todayMYT());
  const remaining = (ck.feeSen ?? 0) - (ck.requestedSen ?? 0);
  const canRequest = finance && ["Confirmed", "Content Brief Sent", "Content Submitted", "Approved", "Payment Pending"].includes(ck.stage);

  const kolPhone = kolWhatsapp((await getKol(ck.kolId)) ?? {});

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/kol/tracker" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Tracker KOL</Link>

      <div>
        <div className="flex flex-wrap items-center gap-2"><KolStageBadge stage={ck.stage} /><TeamLabel team={team} /><span className="text-sm text-muted">PIC: <b className="text-ink">{ck.picName || "-"}</b></span></div>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">
            <Link href={`/kol/${ck.kolId}`} className="hover:text-brand-600">{ck.kolName}</Link> <span className="text-lg font-medium text-muted">{ck.kolHandle}</span>
          </h1>
          <WhatsAppButton name={ck.kolName} phone={kolPhone} message={`Hai ${ck.kolName}, saya ${user.name}${team ? ` dari ${team.name}` : ""} berkenaan campaign ${ck.campaignName}.`} />
        </div>
        <p className="mt-1 text-sm font-semibold text-brand-700">{ck.collabType}</p>
        <p className="mt-1 text-sm">Campaign: <Link href={`/campaigns/${ck.campaignId}`} className="font-semibold text-brand-600 hover:underline">{ck.campaignName}</Link></p>
      </div>

      {overdue && (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <TriangleAlert className="size-4" aria-hidden /> Tarikh posting ({formatDateMs(ck.postingDueDate)}) sudah lepas tetapi belum posting.
        </p>
      )}
      {ck.stageNote && finance && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nota: {ck.stageNote}</p>}

      <CkPanel options={options} ck={ck} actions={actions} canEditDetails={canEditCkDetails(user, ck)} canEditFee={canEditCkFee(user, ck)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <Info label="Platform">{ck.platform}</Info>
              <Info label="Deliverable">{ck.deliverables || "-"}</Info>
              <Info label="Tarikh posting dijanjikan">{ck.postingDueDate ? formatDateMs(ck.postingDueDate) : "-"}</Info>
              <Info label="Tarikh posting sebenar">{ck.postedDate ? formatDateMs(ck.postedDate) : "-"}</Info>
              <Info label="Fee dipersetujui"><Money sen={ck.feeSen} /></Info>
              <Info label="Sudah dibayar"><Money sen={ck.paidSen} /></Info>
              <div className="sm:col-span-2">
                <Info label="URL posting">
                  {ck.postUrl ? (
                    <a href={ck.postUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 break-all text-brand-600 hover:underline">
                      {ck.postUrl} <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  ) : "-"}
                </Info>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-muted">Checklist</p>
              <Checklist c={ck.checklist} />
            </div>
            {finance && ck.notes && <Info label="Nota"><span className="whitespace-pre-wrap">{ck.notes}</span></Info>}
          </section>

          {ck.checklist.posted && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Prestasi posting</h2>
              <PerformancePanel targetType="kol" targetId={ck.id} baseDate={ck.postedDate} snapshots={await listPerformanceFor("kol", ck.id)} today={todayMYT()} canEdit={user.role === "admin" || user.teamIds.includes(ck.teamId)} />
            </section>
          )}

          {finance && (
            <section className="card space-y-4 p-5">
              <h2 className="font-semibold">Kerjasama dan kos</h2>
              <CollabInfo ck={ck} outletName={outletName} />
              {ck.inKind.length > 0 && (
                <table className="table-base">
                  <thead><tr><th>Barang diberi</th><th className="text-right">Kuantiti</th><th className="text-right">Nilai</th></tr></thead>
                  <tbody>
                    {ck.inKind.map((l) => (
                      <tr key={l.itemId}><td>{l.name}</td><td className="text-right tabular-nums">{l.qty}</td><td className="text-right tabular-nums">{formatSen(l.qty * l.unitCostSen)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Info label="Fee (tunai)"><Money sen={ck.feeSen} /></Info>
                <Info label="Nilai barang diberi"><Money sen={ck.inKindSen} /></Info>
                <Info label="Kos lain berkaitan"><span className="tabular-nums">{formatSen(relatedSen)}</span>{related.length > 0 && <span className="block text-xs text-muted">{related.map((e) => e.description).join(", ")}</span>}</Info>
                <Info label="Jumlah kos kerjasama"><b className="tabular-nums">{formatSen((ck.feeSen ?? 0) + (ck.inKindSen ?? 0) + relatedSen)}</b></Info>
              </dl>
              <p className="text-xs text-muted">Kos lain (penghantaran, bil makan dan lain-lain) direkod di Budget dengan memilih KOL ini.</p>
            </section>
          )}

          {finance && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Bayaran KOL</h2>
              <PaymentsPanel ckId={ck.id} teamId={ck.teamId} picId={ck.picId} payments={payments} isAdmin={user.role === "admin"} canRequest={canRequest} remainingSen={remaining} />
            </section>
          )}
        </div>
        {finance && (
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Sejarah</h2>
            <AuditTimeline entries={history} />
          </section>
        )}
      </div>
    </div>
  );
}

function CollabInfo({ ck, outletName }: { ck: CampaignKol; outletName: Map<string, string> }) {
  const d = ck.details;
  const rows: [string, string][] = [];
  if (ck.collabType === "Review kedai (dine-in)") rows.push(["Outlet", outletName.get(d.outletId) ?? "-"], ["Lawatan", [d.visitDate && formatDateMs(d.visitDate), d.visitTime].filter(Boolean).join(", ") || "-"], ["Pax", String(d.pax || "-")]);
  if (ck.collabType === "Hantar produk (seeding)") rows.push(["Alamat", d.shipAddress || "-"], ["Kurier", [d.courier, d.trackingNo].filter(Boolean).join(" · ") || "-"], ["Status", d.shipStatus], ["Diterima", d.receivedDate ? formatDateMs(d.receivedDate) : "-"]);
  if (ck.collabType === "Affiliate") rows.push(["Komisen", `${d.commissionPct}%`], ["Kod", d.affiliateCode || "-"]);
  if (ck.collabType === "Live / event") rows.push(["Tarikh", d.eventDate ? formatDateMs(d.eventDate) : "-"], ["Lokasi", d.eventLocation || "-"]);
  if (ck.collabType === "Ambassador") rows.push(["Kontrak", [d.contractStart, d.contractEnd].filter(Boolean).map(formatDateMs).join(" hingga ") || "-"]);
  if (ck.collabType === "Whitelisting / Spark Ads") rows.push(["Kod iklan", d.adCode || "-"], ["Hak guna sehingga", d.rightsUntil ? formatDateMs(d.rightsUntil) : "-"]);
  if (rows.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-4">
      {rows.map(([k, v]) => (
        <Info key={k} label={k}>{v}</Info>
      ))}
    </dl>
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
