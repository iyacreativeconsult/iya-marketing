import type { LucideIcon } from "lucide-react";

/** Kad ringkasan kecil untuk bahagian atas halaman. tone mengubah warna ikon. */
export function StatCard({ icon: Icon, label, value, hint, tone = "brand" }: { icon: LucideIcon; label: string; value: string | number; hint?: string; tone?: "brand" | "red" | "amber" | "green" }) {
  const t = { brand: "bg-brand-100 text-brand-600", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" }[tone];
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${t}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
