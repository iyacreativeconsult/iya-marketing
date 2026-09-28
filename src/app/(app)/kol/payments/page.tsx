import Link from "next/link";
import { Banknote, CircleCheck, Clock, LoaderCircle } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listPayments } from "@/lib/server/services/campaignKols";
import { listTeams } from "@/lib/server/services/teams";
import { listUsers } from "@/lib/server/services/users";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import type { KolPayment } from "@/lib/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { TeamLabel } from "@/components/badges";
import { FileLink, PaymentStatusBadge } from "@/components/finance";

export const metadata = { title: "Bayaran KOL" };

const TABS: Record<string, { label: string; test: (p: KolPayment) => boolean }> = {
  belum: { label: "Belum dibayar", test: (p) => p.status !== "Paid" },
  pending: { label: "Pending", test: (p) => p.status === "Pending" },
  processing: { label: "Processing", test: (p) => p.status === "Processing" },
  paid: { label: "Dibayar", test: (p) => p.status === "Paid" },
  semua: { label: "Semua", test: () => true },
};

export default async function KolPaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageUser();
  const { tab: t } = await searchParams;
  const tab = t && TABS[t] ? t : "belum";
  const scope = user.activeTeamId;
  const isAdmin = user.role === "admin";

  if (!scope) {
    return (
      <div className="space-y-5">
        <PageHeader title="Bayaran KOL" />
        <p className="card p-6 text-sm">Anda belum ditambah ke mana-mana team.</p>
      </div>
    );
  }

  const [all, teams, users] = await Promise.all([listPayments(user, scope), listTeams(), listUsers()]);
  const teamById = new Map(teams.map((x) => [x.id, x]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const rows = all.filter(TABS[tab]!.test);
  const thisMonth = todayMYT().slice(0, 7);
  const sum = (list: KolPayment[]) => list.reduce((a, p) => a + p.amountSen, 0);
  const pending = all.filter((p) => p.status === "Pending");
  const processing = all.filter((p) => p.status === "Processing");
  const paidMonth = all.filter((p) => p.status === "Paid" && p.paidDate.startsWith(thisMonth));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bayaran KOL"
        description={isAdmin ? "Proses dan tanda bayaran di halaman KOL. Bayaran Paid masuk automatik ke bajet PIC." : "Bayaran untuk KOL di mana anda PIC. Lampirkan invois supaya Admin boleh proses."}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Clock} label={`Pending (${pending.length})`} value={formatSen(sum(pending))} hint={isAdmin ? "Menunggu Admin proses" : "Menunggu Admin"} tone="amber" />
        <StatCard icon={LoaderCircle} label={`Processing (${processing.length})`} value={formatSen(sum(processing))} hint="Sedang dibayar" />
        <StatCard icon={CircleCheck} label={`Dibayar bulan ini (${paidMonth.length})`} value={formatSen(sum(paidMonth))} tone="green" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(TABS).map(([k, x]) => (
          <Link key={k} href={`/kol/payments?tab=${k}`} className={`rounded-full border px-3 py-1.5 text-sm ${k === tab ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>
            {x.label} ({all.filter(x.test).length})
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[1000px]">
          <thead>
            <tr><th>KOL</th><th>Campaign</th><th>PIC</th><th>Jenis</th><th className="text-right">Jumlah</th><th>Invois</th><th>Bukti bayaran</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted">Tiada bayaran.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-brand-50/40">
                <td className="font-semibold">{p.kolName}</td>
                <td className="text-sm">
                  <Link href={`/campaigns/${p.campaignId}`} className="hover:text-brand-600">{p.campaignName}</Link>
                  {scope === "all" && <div className="mt-1"><TeamLabel team={teamById.get(p.teamId)} /></div>}
                </td>
                <td className="text-sm">{userName.get(p.picId) ?? "-"}</td>
                <td className="text-sm">{p.kind}</td>
                <td className="text-right font-semibold tabular-nums">{formatSen(p.amountSen)}</td>
                <td className="text-sm">{p.invoice ? <FileLink file={p.invoice} /> : <span className={p.status === "Pending" ? "text-amber-700" : "text-muted"}>{p.status === "Pending" ? "Belum ada" : "-"}</span>}</td>
                <td className="text-sm"><FileLink file={p.proof} /></td>
                <td>
                  <PaymentStatusBadge status={p.status} />
                  {p.paidDate && <p className="mt-1 text-xs text-muted">{formatDateMs(p.paidDate)}</p>}
                </td>
                <td className="text-right">
                  <Link href={`/kol/campaign/${p.campaignKolId}`} className="btn-secondary px-3 py-1.5">
                    <Banknote className="size-4" /> {isAdmin && p.status !== "Paid" ? "Proses" : "Buka"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
