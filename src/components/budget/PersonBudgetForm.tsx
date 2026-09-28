"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { formatSen, senToInput } from "@/lib/domain/money";
import { api, toApiError } from "@/lib/client/api";

/** Admin: bajet asas dan carry forward seorang person untuk bulan ini. */
export function PersonBudgetForm({
  teamId,
  userId,
  month,
  baseSen,
  carrySen,
  suggestedCarrySen,
}: {
  teamId: string;
  userId: string;
  month: string;
  baseSen: number;
  carrySen: number;
  suggestedCarrySen: number;
}) {
  const router = useRouter();
  const [base, setBase] = useState(senToInput(baseSen));
  const [carry, setCarry] = useState(senToInput(carrySen));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = base !== senToInput(baseSen) || carry !== senToInput(carrySen);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/person-budgets", { method: "PUT", body: { teamId, userId, month, base, carryForward: carry } });
      router.refresh();
    } catch (err) {
      const x = toApiError(err);
      setError(x.fields.base ?? x.fields.carryForward ?? x.message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-24 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-brand-400 focus:outline-none";
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted">
        Asas (RM)
        <input className={`${input} block`} inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} />
      </label>
      <label className="text-xs text-muted">
        Carry forward
        <input className={`${input} block`} inputMode="decimal" value={carry} onChange={(e) => setCarry(e.target.value)} />
      </label>
      <button className="btn-secondary px-3 py-1.5" disabled={busy || !dirty} aria-label="Simpan bajet person">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
      </button>
      {suggestedCarrySen > 0 && carry !== senToInput(suggestedCarrySen) && (
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setCarry(senToInput(suggestedCarrySen))}>
          Guna baki bulan lepas ({formatSen(suggestedCarrySen)})
        </button>
      )}
      {error && <p className="field-error w-full">{error}</p>}
    </form>
  );
}
