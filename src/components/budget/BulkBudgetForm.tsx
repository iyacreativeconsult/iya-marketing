"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange, LoaderCircle, Save, X } from "lucide-react";
import { formatSen, parseRmToSen } from "@/lib/domain/money";
import { monthShort } from "@/lib/domain/dates";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

/** Admin: isi bajet asas untuk beberapa person dan beberapa bulan sekali gus. */
export function BulkBudgetForm({ teamId, year, members, currentMonth }: { teamId: string; year: number; members: { id: string; name: string }[]; currentMonth: string }) {
  const router = useRouter();
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const defaultFrom = currentMonth.startsWith(String(year)) ? currentMonth : months[0]!;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5000");
  const [people, setPeople] = useState<string[]>(members.map((m) => m.id));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(months[11]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const chosen = months.filter((m) => m >= from && m <= to);
  const sen = parseRmToSen(amount);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api<{ count: number }>("/api/person-budgets/bulk", { body: { teamId, userIds: people, months: chosen, base: amount } });
      setDone(`${r.count} bajet dikemas kini.`);
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={members.length === 0}>
        <CalendarRange className="size-4" /> Isi bajet beberapa bulan
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Isi bajet asas sekali gus</p>
          <p className="text-xs text-muted">Carry forward dan tambahan diluluskan tidak diubah.</p>
        </div>
        <button className="text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label="Tutup"><X className="size-5" /></button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr_1fr]">
        <div>
          <label className="label" htmlFor="b-amt">Bajet seorang (RM)</label>
          <input id="b-amt" className="input tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="b-from">Dari</label>
          <select id="b-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthShort(m)} {year}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="b-to">Hingga</label>
          <select id="b-to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthShort(m)} {year}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="label">Person</p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = people.includes(m.id);
            return (
              <button key={m.id} type="button" aria-pressed={on} onClick={() => setPeople(on ? people.filter((x) => x !== m.id) : [...people, m.id])}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>
                {m.name}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-sm">
        {sen === null ? <span className="text-red-700">Jumlah tidak sah.</span> : (
          <>Tetapkan <b>{formatSen(sen)}</b> untuk <b>{people.length}</b> person x <b>{chosen.length}</b> bulan. Bajet team sebulan: <b>{formatSen(sen * people.length)}</b>.</>
        )}
      </p>
      <ErrorNotice error={error} />
      {done && <p className="text-sm text-emerald-700">{done}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={busy || sen === null || people.length === 0 || chosen.length === 0}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </button>
      </div>
    </div>
  );
}
