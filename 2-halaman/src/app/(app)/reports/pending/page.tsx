import Link from "next/link";
import { requirePageUser } from "@/lib/server/session";
import { buildReport } from "@/lib/server/services/reports";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Prestasi belum diisi" };

export default async function PendingPerfPage() {
  const user = await requirePageUser();
  const r = await buildReport(user, "year", todayMYT().slice(0, 7));
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Prestasi belum diisi" description="Posting yang sudah tiba hari ke-1, ke-7 atau ke-30 tetapi angkanya belum dimasukkan. Klik untuk isi." />
      <div className="card overflow-hidden">
        {r.pending.length === 0 ? (
          <p className="p-6 text-center text-sm text-emerald-800">Semua prestasi sudah diisi.</p>
        ) : (
          <ul className="divide-y divide-line">
            {r.pending.map((p) => (
              <li key={`${p.type}-${p.id}`}>
                <Link href={p.href} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-brand-50">
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.type === "kol" ? "KOL" : "Content"}</span>
                  <span className="min-w-0 flex-1 font-medium">{p.name}</span>
                  <span className="text-sm text-muted">Posting {formatDateMs(p.baseDate)}</span>
                  <span className="text-sm font-semibold text-amber-700">Hari {p.days.join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
