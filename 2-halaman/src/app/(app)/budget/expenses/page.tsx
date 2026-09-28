import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listExpenses, teamMembers } from "@/lib/server/services/budget";
import { getMasterLists } from "@/lib/server/services/master";
import { listTeams } from "@/lib/server/services/teams";
import { expenseOptions, withPerms } from "@/lib/server/budgetOptions";
import { EXPENSE_STATUSES } from "@/lib/domain/types";
import { formatMonthMs, monthRange, shiftMonth } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import { PageHeader } from "@/components/PageHeader";
import { ExpensesPanel } from "@/components/budget/ExpensesPanel";

export const metadata = { title: "Perbelanjaan" };

type SP = { m?: string; team?: string; person?: string; status?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { month } = monthRange(sp.m);
  const isAdmin = user.role === "admin";
  const team = isAdmin
    ? sp.team ?? (user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : "all")
    : sp.team && user.teamIds.includes(sp.team) ? sp.team : user.activeTeamId ?? "";
  const person = isAdmin && team !== "all" ? sp.person ?? "" : "";
  const status = sp.status ?? "all";

  const [list, teams, lists, members] = await Promise.all([
    team ? listExpenses(user, { month, teamId: team, ownerId: person || undefined, status }) : Promise.resolve([]),
    listTeams(),
    getMasterLists(),
    isAdmin && team !== "all" && team ? teamMembers(team) : Promise.resolve([]),
  ]);
  const canAdd = Boolean(team) && team !== "all";
  const options = canAdd
    ? await expenseOptions(user, team, month, person || undefined)
    : { campaigns: [], categories: lists.expenseCategories, paymentMethods: lists.paymentMethods, kols: [], owners: null };
  const rows = list.map((e) => ({ ...withPerms(user, e), canEdit: canAdd && withPerms(user, e).canEdit }));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const totalSen = list.filter((e) => e.status !== "Ditolak").reduce((a, e) => a + e.amountSen, 0);

  const q = (patch: Partial<SP>) => {
    const p = { m: month, team: isAdmin ? team : undefined, person: person || undefined, status, ...patch };
    return `/budget/expenses?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== "") as [string, string][])}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Perbelanjaan"
        description={isAdmin ? "Semak, sahkan dan rekod perbelanjaan setiap person." : "Perbelanjaan anda sendiri. Setiap rekod ditolak dari bajet anda."}
        actions={
          <div className="flex items-center gap-2">
            <Link href={q({ m: shiftMonth(month, -1) })} className="btn-secondary px-2.5" aria-label="Bulan sebelum"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-32 text-center font-semibold">{formatMonthMs(month)}</span>
            <Link href={q({ m: shiftMonth(month, 1) })} className="btn-secondary px-2.5" aria-label="Bulan seterusnya"><ChevronRight className="size-4" /></Link>
          </div>
        }
      />

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {[{ id: "all", name: "Semua team" }, ...teams].map((t) => (
            <Link key={t.id} href={q({ team: t.id, person: undefined })} className={`rounded-full border px-3 py-1.5 text-sm ${team === t.id ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>{t.name}</Link>
          ))}
        </div>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="m" value={month} />
        {isAdmin && <input type="hidden" name="team" value={team} />}
        {isAdmin && team !== "all" && (
          <label className="text-sm">
            <span className="label">Person</span>
            <select name="person" defaultValue={person} className="input min-w-48">
              <option value="">Semua person</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="label">Status</span>
          <select name="status" defaultValue={status} className="input min-w-44">
            <option value="all">Semua status</option>
            {EXPENSE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <button className="btn-secondary"><Search className="size-4" /> Tapis</button>
        <p className="ml-auto text-sm text-muted">{list.length} rekod · {formatSen(totalSen)}{team === "all" ? "" : ` · ${teamName.get(team) ?? ""}`}</p>
      </form>

      {!team ? (
        <p className="card p-6 text-sm">Anda belum ditambah ke mana-mana team.</p>
      ) : (
        <>
          {team === "all" && <p className="text-sm text-muted">Pilih satu team untuk catat atau ubah perbelanjaan. Semakan (Sahkan / Tolak) boleh dibuat di sini.</p>}
          <ExpensesPanel teamId={canAdd ? team : ""} month={month} expenses={rows} options={options} />
        </>
      )}
    </div>
  );
}
