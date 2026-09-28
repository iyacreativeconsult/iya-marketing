import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PERIODS, type Period } from "@/lib/domain/report";
import { todayMYT } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import type { Kpi } from "@/lib/domain/report";

const LABEL: Record<Period, string> = { month: "Bulan", quarter: "Suku tahun", year: "Tahun" };

export function parsePeriod(sp: { p?: string; d?: string }): { period: Period; anchor: string } {
  const period = (PERIODS as readonly string[]).includes(sp.p ?? "") ? (sp.p as Period) : "month";
  const anchor = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.d ?? "") ? sp.d! : todayMYT().slice(0, 7);
  return { period, anchor };
}

export function ReportHeader({ title, description, base, period, label, prev, next, anchor, exportTab }: { title: string; description: string; base: string; period: Period; label: string; prev: string; next: string; anchor: string; exportTab?: string }) {
  const href = (p: Period, d: string) => `${base}?p=${p}&d=${d}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {exportTab && (
          <a href={`/api/reports/export?tab=${exportTab}&p=${period}&d=${anchor}`} className="btn-secondary"><Download className="size-4" /> Muat turun CSV</a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link key={p} href={href(p, anchor)} className={`rounded-full border px-3 py-1.5 text-sm ${p === period ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>{LABEL[p]}</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <Link href={href(period, prev)} className="btn-secondary px-2.5 py-1.5" aria-label="Sebelum"><ChevronLeft className="size-4" /></Link>
        <span className="min-w-24 text-center font-semibold">{label}</span>
        <Link href={href(period, next)} className="btn-secondary px-2.5 py-1.5" aria-label="Seterusnya"><ChevronRight className="size-4" /></Link>
      </div>
    </div>
  );
}

/* ---- format KPI ---- */
export const fmtEr = (k: Kpi) => (k.er === null ? "-" : `${k.er}%`);
export const fmtCpm = (k: Kpi) => (k.cpmSen === null ? "-" : formatSen(k.cpmSen));
export const fmtCpe = (k: Kpi) => (k.cpeSen === null ? "-" : formatSen(k.cpeSen));
export const fmtRoas = (k: Kpi) => (k.roas === null ? "-" : `${k.roas}x`);
export const fmtCost = (k: Kpi) => (k.costSen === null ? "-" : formatSen(k.costSen));
export const fmtNum = (n: number) => n.toLocaleString("en-MY");
