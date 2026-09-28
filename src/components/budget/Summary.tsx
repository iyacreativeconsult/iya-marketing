import { TriangleAlert } from "lucide-react";
import { budgetLevel, type BudgetSummary } from "@/lib/domain/budget";
import { formatSen } from "@/lib/domain/money";
import { BudgetBar } from "../finance";

export function SummaryCards({ s, title, inKindSen, children }: { s: BudgetSummary; title: string; inKindSen: number; children?: React.ReactNode }) {
  const level = budgetLevel(s);
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {level !== "ok" && (
          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${level === "over" ? "text-red-700" : "text-amber-700"}`}>
            <TriangleAlert className="size-4" aria-hidden /> {level === "over" ? "Bajet terlebih" : "Penggunaan 80% atau lebih"}
          </span>
        )}
      </div>
      {children}
      <BudgetBar s={s} />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Bajet" value={formatSen(s.budgetSen)} />
        <Stat label={`Digunakan (${s.pctUsed}%)`} value={formatSen(s.usedSen)} />
        <Stat label="Dalam proses" value={formatSen(s.pendingSen)} hint="Belum disahkan Admin" />
        <Stat label="Fee KOL belum bayar" value={formatSen(s.kolCommittedSen)} hint="KOL Confirmed" />
        <Stat label="Baki boleh guna" value={formatSen(s.availableSen)} strong negative={s.availableSen < 0} />
      </dl>
      <p className="border-t border-line pt-3 text-sm text-muted">
        Nilai barang / makanan diberi kepada KOL (in-kind): <b className="text-ink tabular-nums">{formatSen(inKindSen)}</b>. Tidak ditolak dari bajet tunai.
      </p>
    </section>
  );
}

export function Stat({ label, value, hint, strong, negative }: { label: string; value: string; hint?: string; strong?: boolean; negative?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${strong ? "text-lg font-bold" : "font-semibold"} ${negative ? "text-red-700" : ""}`}>{value}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
    </div>
  );
}
