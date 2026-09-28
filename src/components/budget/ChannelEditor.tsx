"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Save, SlidersHorizontal, X } from "lucide-react";
import { formatSen, parseRmToSen, senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

/** Admin: pecahkan bajet team ikut saluran (Meta Ads, KOL, Event ...). */
export function ChannelEditor({ teamId, month, amountSen, channels, categories }: { teamId: string; month: string; amountSen: number; channels: Record<string, number>; categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(channels).map(([k, s]) => [k, senToInput(s)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const sum = Object.values(v).reduce((a, x) => a + (parseRmToSen(x) ?? 0), 0);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x.trim() !== "" && (parseRmToSen(x) ?? 0) > 0));
      await api("/api/budgets", { method: "PUT", body: { teamId, month, channels: body } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" /> Pecahan ikut saluran
      </button>
    );
  }
  return (
    <div className="card space-y-3 p-4">
      <p className="font-semibold">Peruntukan ikut saluran</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <label key={c} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-1.5 text-sm">
            <span className="truncate">{c}</span>
            <span className="flex items-center gap-1 text-muted">RM
              <input className="w-24 rounded-lg border border-line px-2 py-1 text-right tabular-nums text-ink" inputMode="decimal" value={v[c] ?? ""} onChange={(e) => setV({ ...v, [c]: e.target.value })} aria-label={`Peruntukan ${c}`} />
            </span>
          </label>
        ))}
      </div>
      <p className={`text-sm ${sum > amountSen ? "font-semibold text-red-700" : "text-muted"}`}>
        Jumlah peruntukan {formatSen(sum)} daripada bajet {formatSen(amountSen)}{sum > amountSen ? " (melebihi bajet)" : ""}
      </p>
      <ErrorNotice error={error} />
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}><X className="size-4" /> Tutup</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </div>
  );
}
