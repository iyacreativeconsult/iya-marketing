import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { canEditKol, getKol, getKolPrivate } from "@/lib/server/services/kols";
import { listCksForKol } from "@/lib/server/services/campaignKols";
import { listAuditLogs } from "@/lib/server/services/logs";
import { formatDateMs } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import { TeamLabel } from "@/components/badges";
import { KolStageBadge, Money, SocialLinks } from "@/components/finance";
import { KolPrivateForm } from "@/components/kol/KolPrivateForm";
import { AuditTimeline } from "@/components/AuditTimeline";
import { DeleteControl } from "@/components/DeleteControl";

export const metadata = { title: "KOL" };

export default async function KolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const kol = await getKol(id);
  if (!kol) notFound();
  const [teams, bank, cks, history] = await Promise.all([listTeams(), getKolPrivate(user, id), listCksForKol(user, id), listAuditLogs({ entityId: id, limit: 30 })]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const posted = cks.filter((c) => c.checklist.posted).length;
  const onTime = cks.filter((c) => c.checklist.posted && c.postingDueDate && c.postedDate && c.postedDate <= c.postingDueDate).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/kol" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Senarai KOL</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{kol.name}</h1>
          <p className="mt-1 text-sm text-muted">{[kol.realName, kol.niches.join(", "), kol.location].filter(Boolean).join(" · ")}</p>
          <div className="mt-3"><SocialLinks accounts={kol.accounts} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditKol(user, kol) && <Link href={`/kol/${kol.id}/edit`} className="btn-secondary"><Pencil className="size-4" /> Ubah profil</Link>}
          {user.role === "admin" && <DeleteControl mode="direct" what={`KOL "${kol.name}"`} confirmText={kol.name} url={`/api/kols/${kol.id}`} redirectTo="/kol" />}
          {user.role !== "admin" && canEditKol(user, kol) && <DeleteControl mode="request" what={`KOL "${kol.name}"`} entity="kol" entityId={kol.id} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card grid gap-4 p-5 sm:grid-cols-4">
            <Info label="Status"><span className={kol.status === "Blacklist" ? "font-semibold text-red-700" : ""}>{kol.status}</span></Info>
            <Info label="Rate biasa">{kol.rateSen ? formatSen(kol.rateSen) : "-"}</Info>
            <Info label="Campaign">{cks.length}</Info>
            <Info label="Posting tepat masa">{posted ? `${onTime}/${posted}` : "-"}</Info>
            <Info label="Contact">{kol.contact || "-"}</Info>
            <Info label="Team pemilik"><TeamLabel team={teamById.get(kol.ownerTeamId)} /></Info>
            <div className="sm:col-span-2"><Info label="Catatan"><span className="whitespace-pre-wrap">{kol.remark || "-"}</span></Info></div>
          </section>

          <section className="card overflow-x-auto">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Sejarah campaign</h2>
            <table className="table-base min-w-[640px]">
              <thead><tr><th>Campaign</th><th>Team</th><th>Tarikh posting</th><th>Status</th><th className="text-right">Fee</th></tr></thead>
              <tbody>
                {cks.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Belum pernah ditugaskan.</td></tr>}
                {cks.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/kol/campaign/${c.id}`} className="font-medium hover:text-brand-600">{c.campaignName}</Link></td>
                    <td><TeamLabel team={teamById.get(c.teamId)} /></td>
                    <td className="text-sm">{c.postingDueDate ? formatDateMs(c.postingDueDate) : "-"}</td>
                    <td><KolStageBadge stage={c.stage} /></td>
                    <td className="text-right"><Money sen={c.feeSen} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Maklumat bayaran</h2>
            {bank ? <KolPrivateForm kolId={kol.id} initial={bank} /> : <p className="text-sm text-muted">Hanya Admin dan team yang menguruskan KOL ini boleh lihat maklumat bank.</p>}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Sejarah profil</h2>
            <AuditTimeline entries={history} />
          </section>
        </div>
      </div>
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
