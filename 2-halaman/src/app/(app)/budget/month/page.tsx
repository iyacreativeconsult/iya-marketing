import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt, TriangleAlert } from "lucide-react";
import { SummaryCards } from "@/components/budget/Summary";
import { requirePageUser } from "@/lib/server/session";
import { getAllTeamsBudget, getPersonBudgetView, getTeamBudgetView } from "@/lib/server/services/budget";
import { getMasterLists } from "@/lib/server/services/master";
import { listTeams } from "@/lib/server/services/teams";
import { formatDateMs, formatMonthMs, monthRange, shiftMonth } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import type { Expense, SessionUser } from "@/lib/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { BudgetBar, ExpenseStatusBadge } from "@/components/finance";
import { TeamLabel } from "@/components/badges";
import { ChannelEditor } from "@/components/budget/ChannelEditor";
import { PersonBudgetForm } from "@/components/budget/PersonBudgetForm";
import { TopUpList, TopUpRequestForm } from "@/components/budget/TopUp";

export const metadata = { title: "Budget bulanan" };

type SP = { m?: string; team?: string; person?: string };

export default async function BudgetMonthPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { month } = monthRange(sp.m);
  const isAdmin = user.role === "admin";
  const team = sp.team ?? user.activeTeamId ?? "";

  const qs = (m: string) => `/budget/month?${new URLSearchParams({ m, ...(sp.team ? { team: sp.team } : {}), ...(sp.person ? { person: sp.person } : {}) })}`;
  const header = (
    <PageHeader
      title={`Budget ${formatMonthMs(month)}`}
      description={isAdmin ? "Admin nampak bajet setiap person dan jumlah setiap team." : "Anda hanya nampak bajet dan perbelanjaan anda sendiri."}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/budget?y=${month.slice(0, 4)}${sp.team ? `&team=${sp.team}` : ""}`} className="btn-secondary">Ringkasan tahunan</Link>
          <Link href={qs(shiftMonth(month, -1))} className="btn-secondary px-2.5" aria-label="Bulan sebelum"><ChevronLeft className="size-4" /></Link>
          <span className="min-w-32 text-center font-semibold">{formatMonthMs(month)}</span>
          <Link href={qs(shiftMonth(month, 1))} className="btn-secondary px-2.5" aria-label="Bulan seterusnya"><ChevronRight className="size-4" /></Link>
        </div>
      }
    />
  );

  if (isAdmin && (team === "all" || !team)) return <AllTeams user={user} month={month} header={header} />;
  if (!team || (!isAdmin && !user.teamIds.includes(team))) {
    return <div className="space-y-6">{header}<p className="card p-6 text-sm">Anda belum ditambah ke mana-mana team. Hubungi Admin.</p></div>;
  }
  if (isAdmin && !sp.person) return <TeamView user={user} teamId={team} month={month} header={header} />;
  // Person: ahli sentiasa diri sendiri; Admin boleh buka mana-mana person
  const personId = isAdmin ? sp.person! : user.id;
  return <PersonView user={user} teamId={team} personId={personId} month={month} header={header} />;
}

/* ------------------------------ Admin: semua team ------------------------------ */

async function AllTeams({ user, month, header }: { user: SessionUser; month: string; header: React.ReactNode }) {
  const [data, teams] = await Promise.all([getAllTeamsBudget(user, month), listTeams()]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  return (
    <div className="space-y-6">
      {header}
      <SummaryCards s={data.total} title="Semua team" inKindSen={data.inKindSen} />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[860px]">
          <thead><tr><th>Team</th><th className="text-right">Person</th><th className="text-right">Bajet</th><th className="text-right">Digunakan</th><th className="text-right">Komited</th><th className="text-right">Baki boleh guna</th><th className="w-44">Penggunaan</th><th /></tr></thead>
          <tbody>
            {data.rows.map(({ team, persons, summary: s }) => (
              <tr key={team.id}>
                <td><TeamLabel team={team} /></td>
                <td className="text-right tabular-nums">{persons}</td>
                <td className="text-right tabular-nums">{formatSen(s.budgetSen)}</td>
                <td className="text-right tabular-nums">{formatSen(s.usedSen)}</td>
                <td className="text-right tabular-nums text-muted">{formatSen(s.committedSen)}</td>
                <td className={`text-right font-semibold tabular-nums ${s.availableSen < 0 ? "text-red-700" : ""}`}>{formatSen(s.availableSen)}</td>
                <td><BudgetBar s={s} /><p className="mt-1 text-xs text-muted">{s.pctUsed}%</p></td>
                <td><Link href={`/budget/month?m=${month}&team=${team.id}`} className="btn-secondary px-3 py-1.5">Lihat</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Permohonan tambahan bajet ({data.pendingRequests.length})</h2>
        <TopUpList requests={data.pendingRequests} isAdmin teamNames={teamNames} empty="Tiada permohonan menunggu." />
      </section>
      <PendingExpenses list={data.pendingReview} month={month} teamNames={teamNames} />
    </div>
  );
}

/* ------------------------------ Admin: satu team ------------------------------ */

async function TeamView({ user, teamId, month, header }: { user: SessionUser; teamId: string; month: string; header: React.ReactNode }) {
  const [v, lists] = await Promise.all([getTeamBudgetView(user, teamId, month), getMasterLists()]);
  return (
    <div className="space-y-6">
      {header}
      <div className="flex items-center gap-3">
        <TeamLabel team={v.team} />
        <Link href={`/budget/month?m=${month}&team=all`} className="text-sm text-brand-600 hover:underline">Lihat semua team</Link>
      </div>
      <SummaryCards s={v.summary} title={`${v.team.name} (jumlah ${v.rows.length} person)`} inKindSen={v.inKindSen} />

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Bajet setiap person</h2>
        <table className="table-base min-w-[1040px]">
          <thead><tr><th>Person</th><th>Tetapkan bajet</th><th className="text-right">Tambahan</th><th className="text-right">Jumlah</th><th className="text-right">Digunakan</th><th className="text-right">Komited</th><th className="text-right">Baki</th><th /></tr></thead>
          <tbody>
            {v.rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted">Tiada ahli dalam team ini. Tambah di Admin &gt; Pengguna.</td></tr>}
            {v.rows.map((r) => (
              <tr key={r.user.id}>
                <td className="font-semibold">{r.user.name}</td>
                <td><PersonBudgetForm teamId={teamId} userId={r.user.id} month={month} baseSen={r.budget.baseSen} carrySen={r.budget.carryForwardSen} suggestedCarrySen={r.suggestedCarrySen} /></td>
                <td className="text-right tabular-nums">{formatSen(r.budget.topUpSen)}</td>
                <td className="text-right font-semibold tabular-nums">{formatSen(r.budget.totalSen)}</td>
                <td className="text-right tabular-nums">{formatSen(r.summary.usedSen)}</td>
                <td className="text-right tabular-nums text-muted">{formatSen(r.summary.committedSen)}</td>
                <td className={`text-right font-semibold tabular-nums ${r.summary.availableSen < 0 ? "text-red-700" : ""}`}>{formatSen(r.summary.availableSen)}<div className="mt-1"><BudgetBar s={r.summary} /></div></td>
                <td><Link href={`/budget/month?m=${month}&team=${teamId}&person=${r.user.id}`} className="btn-secondary px-3 py-1.5">Lihat</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-3 text-xs text-muted">Bajet team = jumlah bajet semua person. Setiap person hanya boleh guna bajet sendiri. &quot;Guna baki bulan lepas&quot; mengisi carry forward dengan baki boleh guna bulan sebelumnya.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Permohonan tambahan bajet</h2>
        <TopUpList requests={v.requests} isAdmin empty="Tiada permohonan menunggu untuk team ini." />
      </section>

      <ChannelsSection teamId={teamId} month={month} v={v} categories={lists.expenseCategories} />
      <ExpensesLink list={v.expenses} href={`/budget/expenses?m=${month}&team=${teamId}`} />
    </div>
  );
}

/* ------------------------------ Person ------------------------------ */

async function PersonView({ user, teamId, personId, month, header }: { user: SessionUser; teamId: string; personId: string; month: string; header: React.ReactNode }) {
  const isAdmin = user.role === "admin";
  const v = await getPersonBudgetView(user, teamId, personId, month);
  const self = user.id === personId;
  return (
    <div className="space-y-6">
      {header}
      <div className="flex flex-wrap items-center gap-3">
        <TeamLabel team={v.team} />
        <span className="font-semibold">{v.person.name}</span>
        {isAdmin && <Link href={`/budget/month?m=${month}&team=${teamId}`} className="text-sm text-brand-600 hover:underline">Kembali ke team</Link>}
      </div>
      {!v.budget.set && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Bajet {formatMonthMs(month)} belum ditetapkan oleh Admin.</p>}
      <SummaryCards s={v.summary} title={self ? "Bajet saya" : `Bajet ${v.person.name}`} inKindSen={v.inKindSen}>
        <p className="text-sm text-muted">
          Asas {formatSen(v.budget.baseSen)} + carry forward {formatSen(v.budget.carryForwardSen)} + tambahan diluluskan {formatSen(v.budget.topUpSen)} = <b className="text-ink">{formatSen(v.budget.totalSen)}</b>
        </p>
      </SummaryCards>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Tambahan bajet</h2>
          {self && <TopUpRequestForm teamId={teamId} month={month} />}
        </div>
        <TopUpList viewerId={user.id} requests={v.requests} isAdmin={isAdmin} empty="Belum ada permohonan." />
      </section>

      <ExpensesLink list={v.expenses} href={`/budget/expenses?m=${month}&team=${teamId}${isAdmin ? `&person=${personId}` : ""}`} />
    </div>
  );
}

function ExpensesLink({ list, href }: { list: Expense[]; href: string }) {
  const pending = list.filter((e) => e.status === "Dalam Proses").length;
  const total = list.filter((e) => e.status !== "Ditolak").reduce((a, e) => a + e.amountSen, 0);
  return (
    <Link href={href} className="card flex flex-wrap items-center gap-4 p-5 hover:border-brand-300">
      <Receipt className="size-5 text-brand-600" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Perbelanjaan bulan ini</p>
        <p className="text-sm text-muted">{list.length} rekod, {formatSen(total)}{pending ? `, ${pending} menunggu semakan` : ""}</p>
      </div>
      <span className="btn-secondary">Lihat & catat perbelanjaan</span>
    </Link>
  );
}

/* ------------------------------ Bantuan ------------------------------ */

function ChannelsSection({ teamId, month, v, categories }: { teamId: string; month: string; v: Awaited<ReturnType<typeof getTeamBudgetView>>; categories: string[] }) {
  return (
    <section className="card overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-semibold">Ikut saluran (team)</h2>
        <ChannelEditor teamId={teamId} month={month} amountSen={v.summary.budgetSen} channels={v.channels} categories={categories} />
      </div>
      <table className="table-base min-w-[640px]">
        <thead><tr><th>Saluran</th><th className="text-right">Peruntukan</th><th className="text-right">Digunakan</th><th className="text-right">Dalam proses</th><th className="text-right">Baki</th></tr></thead>
        <tbody>
          {v.channelRows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Belum ada perbelanjaan atau peruntukan saluran.</td></tr>}
          {v.channelRows.map((r) => (
            <tr key={r.category}>
              <td className="font-medium">{r.category}</td>
              <td className="text-right tabular-nums">{r.allocatedSen === null ? <span className="text-muted">-</span> : formatSen(r.allocatedSen)}</td>
              <td className="text-right tabular-nums">{formatSen(r.usedSen)}</td>
              <td className="text-right tabular-nums text-muted">{formatSen(r.pendingSen)}</td>
              <td className={`text-right font-semibold tabular-nums ${r.remainingSen !== null && r.remainingSen < 0 ? "text-red-700" : ""}`}>{r.remainingSen === null ? "-" : formatSen(r.remainingSen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PendingExpenses({ list, month, teamNames }: { list: Expense[]; month: string; teamNames: Record<string, string> }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-5 py-3 font-semibold">Perbelanjaan menunggu semakan ({list.length})</h2>
      {list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Tiada perbelanjaan menunggu semakan.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/budget/expenses?m=${month}&team=${e.teamId}&person=${e.ownerId}&status=Dalam Proses`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-brand-50">
                <span className="text-sm text-muted">{formatDateMs(e.date)}</span>
                <span className="min-w-0 flex-1 font-medium">{e.description}</span>
                {e.overBudget && <TriangleAlert className="size-4 text-red-600" aria-label="Melebihi baki" />}
                <span className="text-sm">{e.ownerName}</span>
                <span className="text-sm text-muted">{teamNames[e.teamId] ?? e.teamId}</span>
                <span className="font-semibold tabular-nums">{formatSen(e.amountSen)}</span>
                <ExpenseStatusBadge status={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

