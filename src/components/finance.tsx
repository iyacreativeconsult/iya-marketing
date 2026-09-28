import { ExternalLink, FileText } from "lucide-react";
import type { ExpenseStatus, FileRef, KolAccount, KolStage, PaymentStatus } from "@/lib/domain/types";
import type { BudgetSummary } from "@/lib/domain/budget";
import { budgetLevel } from "@/lib/domain/budget";
import { formatSen } from "@/lib/domain/money";

const pill = "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const s = { "Dalam Proses": "bg-amber-50 text-amber-800", Selesai: "bg-emerald-50 text-emerald-800", Ditolak: "bg-red-50 text-red-700" }[status];
  return <span className={`${pill} ${s}`}>{status}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = { Pending: "bg-amber-50 text-amber-800", Processing: "bg-sky-50 text-sky-800", Paid: "bg-emerald-50 text-emerald-800" }[status];
  return <span className={`${pill} ${s}`}>{status}</span>;
}

const STAGE_STYLE: Partial<Record<KolStage, string>> = {
  Selected: "bg-stone-100 text-stone-700",
  Contacted: "bg-stone-100 text-stone-700",
  Negotiation: "bg-amber-50 text-amber-800",
  Confirmed: "bg-sky-50 text-sky-800",
  "Content Brief Sent": "bg-violet-50 text-violet-800",
  "Content Submitted": "bg-violet-50 text-violet-800",
  Approved: "bg-violet-50 text-violet-800",
  "Payment Pending": "bg-brand-100 text-brand-700",
  Paid: "bg-emerald-50 text-emerald-800",
  Completed: "bg-emerald-600 text-white",
  Dropped: "bg-red-50 text-red-700 line-through",
};

export function KolStageBadge({ stage }: { stage: KolStage }) {
  return <span className={`${pill} ${STAGE_STYLE[stage] ?? ""}`}>{stage === "Payment Pending" ? "Posted, bayaran pending" : stage}</span>;
}

export function Money({ sen }: { sen: number | null }) {
  if (sen === null) return <span className="text-muted" title="Maklumat kewangan team lain disorok">Disorok</span>;
  return <span className="tabular-nums">{formatSen(sen)}</span>;
}

export function FileLink({ file, label }: { file: FileRef | null; label?: string }) {
  if (!file) return <span className="text-muted">-</span>;
  return (
    <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
      <FileText className="size-3.5" aria-hidden /> {label ?? "Lihat"}
    </a>
  );
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Pautan akaun media sosial. URL sudah disahkan server (http/https sahaja). */
export function SocialLinks({ accounts }: { accounts: KolAccount[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {accounts.map((a) => (
        <a
          key={`${a.platform}-${a.username}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:border-brand-300 hover:bg-brand-50"
        >
          <span className="font-semibold">{a.platform}</span>
          <span>@{a.username}</span>
          {a.followers > 0 && <span className="text-muted">{formatFollowers(a.followers)}</span>}
          <ExternalLink className="size-3 text-muted" aria-hidden />
        </a>
      ))}
    </div>
  );
}

/** Bar bajet: Digunakan (penuh), Komited (jalur), Baki. */
export function BudgetBar({ s }: { s: BudgetSummary }) {
  const base = Math.max(s.budgetSen, s.usedSen + s.committedSen, 1);
  const used = (s.usedSen / base) * 100;
  const committed = (s.committedSen / base) * 100;
  const level = budgetLevel(s);
  const usedColor = level === "over" ? "bg-red-500" : level === "warn" ? "bg-amber-500" : "bg-brand-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-100" role="img" aria-label={`Digunakan ${s.pctUsed}%`}>
      <div className="flex h-full">
        <div className={usedColor} style={{ width: `${used}%` }} />
        <div className="bg-brand-300" style={{ width: `${committed}%` }} />
      </div>
    </div>
  );
}
