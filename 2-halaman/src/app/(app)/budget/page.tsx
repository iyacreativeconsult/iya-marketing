import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { getBudgetYear, teamMembers, type MonthCell, type YearRow } from "@/lib/server/services/budget";
import { listTeams } from "@/lib/server/services/teams";
import { monthShort, todayMYT } from "@/lib/domain/dates";
import { compactRm, formatSen } from "@/lib/domain/money";
import { PageHeader } from "@/components/PageHeader";
import { BulkBudgetForm } from "@/components/budget/BulkBudgetForm";

export const metadata = { title: "Budget" };

type SP = { y?: string; team?: string };

function level(c: MonthCell): "none" | "ok" | "warn" | "over" {
  if (!c.set && c.usedSen === 0 && c.pendingSen === 0) return "none";
  if (c.budgetSen > 0 && (c.pctUsed >= 100 || c.availableSen < 0)) return "over";
  if (c.pctUsed >= 80) return "warn";
  return "ok";
}
const BAR = { none: "bg-stone-300", ok: "bg-brand-500", warn: "bg-amber-500", over: "bg-red-500" } as const;

export default async function BudgetYearPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const today = todayMYT();
  const thisMonth = today.slice(0, 7);
  const year = /^\d{4}$/.test(sp.y ?? "") ? Number(sp.y) : Number(today.slice(0, 4));
  const isAdmin = user.role === "admin";
  const team = isAdmin ? sp.team ?? (user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : "all") : "";
  const [data, teams] = await Promise.all([getBudgetYear(user, year, team), listTeams()]);
  const members = data.mode === "persons" ? await teamMembers(team) : [];
  const nav = (y: number, t = team) => `/budget?y=${y}${isAdmin ? `&team=${t}` : ""}`;
  const monthHref = (row: YearRow, m: string) =>
    `/budget/month?m=${m}&team=${data.mode === "teams" ? row.teamId : row.teamId}${data.mode === "persons" && row.userId ? `&person=${row.userId}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description={isAdmin ? "Ringkasan setahun. Klik mana-mana bulan untuk butiran." : "Bajet anda sepanjang tahun. Klik bulan untuk butiran dan mohon tambahan."}
        actions={
          <div className="flex items-center gap-2">
            <Link href={nav(year - 1)} className="btn-secondary px-2.5" aria-label="Tahun sebelum"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-16 text-center text-lg font-bold tabular-nums">{year}</span>
            <Link href={nav(year + 1)} className="btn-secondary px-2.5" aria-label="Tahun seterusnya"><ChevronRight className="size-4" /></Link>
          </div>
        }
      />

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Link href={nav(year, "all")} className={`rounded-full border px-3 py-1.5 text-sm ${team === "all" ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>Semua team</Link>
          {teams.map((t) => (
            <Link key={t.id} href={nav(year, t.id)} className={`rounded-full border px-3 py-1.5 text-sm ${team === t.id ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>{t.name}</Link>
          ))}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-4">
        <Big label={`Bajet ${year}`} value={formatSen(data.yearTotal.budgetSen)} />
        <Big label={`Digunakan (${data.yearTotal.pctUsed}%)`} value={formatSen(data.yearTotal.usedSen)} />
        <Big label="Dalam proses + fee KOL belum bayar" value={formatSen(data.yearTotal.pendingSen + data.yearTotal.committedSen)} />
        <Big label="Baki" value={formatSen(data.yearTotal.availableSen)} negative={data.yearTotal.availableSen < 0} />
      </section>

      {data.mode === "persons" && <BulkBudgetForm teamId={team} year={year} members={members} currentMonth={thisMonth} />}

      {data.mode === "self" ? (
        data.rows.length === 0 ? (
          <p className="card p-6 text-sm">Anda belum ditambah ke mana-mana team. Hubungi Admin.</p>
        ) : (
          data.rows.map((row) => (
            <section key={row.key} className="space-y-3">
              {data.rows.length > 1 && <h2 className="font-semibold">{row.label}</h2>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {row.cells.map((c) => <MonthCard key={c.month} c={c} href={monthHref(row, c.month)} current={c.month === thisMonth} future={c.month > thisMonth} />)}
              </div>
            </section>
          ))
        )
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-line bg-brand-50">
                <th className="sticky left-0 z-10 bg-brand-50 px-4 py-2.5 text-left font-semibold">{data.mode === "teams" ? "Team" : "Person"}</th>
                {data.months.map((m) => (
                  <th key={m} className={`px-2 py-2.5 text-center font-semibold ${m === thisMonth ? "text-brand-700" : ""}`}>{monthShort(m)}</th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold">Setahun</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={14} className="py-8 text-center text-muted">Tiada ahli dalam team ini.</td></tr>}
              {data.rows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-semibold">
                    {data.mode === "teams" ? <Link href={nav(year, row.teamId)} className="hover:text-brand-600">{row.label}</Link> : row.label}
                  </td>
                  {row.cells.map((c) => <MatrixCell key={c.month} c={c} href={monthHref(row, c.month)} current={c.month === thisMonth} />)}
                  <td className="px-4 py-2 text-right tabular-nums">
                    <p className="font-semibold">{formatSen(row.total.usedSen)}</p>
                    <p className="text-xs text-muted">/ {formatSen(row.total.budgetSen)}</p>
                  </td>
                </tr>
              ))}
              {data.rows.length > 1 && (
                <tr className="bg-brand-50/50">
                  <td className="sticky left-0 z-10 bg-brand-50 px-4 py-2 font-semibold">Jumlah</td>
                  {data.totals.map((c) => <MatrixCell key={c.month} c={c} current={c.month === thisMonth} />)}
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatSen(data.yearTotal.usedSen)}<p className="text-xs font-normal text-muted">/ {formatSen(data.yearTotal.budgetSen)}</p></td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted">Setiap petak: digunakan / bajet (RM, k = ribu). Klik petak untuk butiran bulan.</p>
        </div>
      )}
    </div>
  );
}

function Big({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${negative ? "text-red-700" : ""}`}>{value}</p>
    </div>
  );
}

function MonthCard({ c, href, current, future }: { c: MonthCell; href: string; current: boolean; future: boolean }) {
  const lv = level(c);
  const pct = Math.min(100, c.budgetSen > 0 ? (c.usedSen / c.budgetSen) * 100 : c.usedSen > 0 ? 100 : 0);
  return (
    <Link href={href} className={`card block p-4 transition-colors hover:border-brand-300 ${current ? "ring-2 ring-brand-400" : ""} ${future && lv === "none" ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between">
        <p className="font-bold">{monthShort(c.month)}</p>
        {current && <span className="text-[10px] font-semibold text-brand-600">BULAN INI</span>}
      </div>
      {lv === "none" ? (
        <p className="mt-6 text-xs text-muted">Belum ditetapkan</p>
      ) : (
        <>
          <p className="mt-2 text-sm tabular-nums"><b>{formatSen(c.usedSen)}</b> <span className="text-muted">/ {formatSen(c.budgetSen)}</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100"><div className={`h-full ${BAR[lv]}`} style={{ width: `${pct}%` }} /></div>
          <p className={`mt-2 text-xs ${c.availableSen < 0 ? "font-semibold text-red-700" : "text-muted"}`}>Baki {formatSen(c.availableSen)}</p>
        </>
      )}
    </Link>
  );
}

function MatrixCell({ c, href, current }: { c: MonthCell; href?: string; current: boolean }) {
  const lv = level(c);
  const pct = Math.min(100, c.budgetSen > 0 ? (c.usedSen / c.budgetSen) * 100 : c.usedSen > 0 ? 100 : 0);
  const inner =
    lv === "none" ? (
      <span className="text-xs text-muted/60">-</span>
    ) : (
      <>
        <span className="block text-xs tabular-nums"><b>{compactRm(c.usedSen)}</b><span className="text-muted">/{compactRm(c.budgetSen)}</span></span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-brand-100"><span className={`block h-full ${BAR[lv]}`} style={{ width: `${pct}%` }} /></span>
      </>
    );
  return (
    <td className={`px-1.5 py-2 text-center ${current ? "bg-brand-50/60" : ""}`}>
      {href ? <Link href={href} className="block rounded-lg px-1 py-1 hover:bg-brand-100" title={`Digunakan ${formatSen(c.usedSen)} daripada ${formatSen(c.budgetSen)}. Baki ${formatSen(c.availableSen)}`}>{inner}</Link> : inner}
    </td>
  );
}
