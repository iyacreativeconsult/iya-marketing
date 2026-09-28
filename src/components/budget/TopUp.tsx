"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle, Plus, Send, X } from "lucide-react";
import type { TopUpRequest } from "@/lib/domain/types";
import { formatDateTimeMs, formatMonthMs } from "@/lib/domain/dates";
import { formatSen, senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

/** Person: mohon tambahan bajet untuk bulan ini. */
export function TopUpRequestForm({ teamId, month }: { teamId: string; month: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [forMonth, setForMonth] = useState(month);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/budget-requests", { body: { teamId, month: forMonth, amount, reason } });
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button className="btn-secondary" onClick={() => setOpen(true)}><Plus className="size-4" /> Mohon tambahan bajet</button>;
  return (
    <form onSubmit={submit} className="card space-y-3 p-4" noValidate>
      <p className="font-semibold">Mohon tambahan bajet ({formatMonthMs(forMonth)})</p>
      <div className="grid gap-3 sm:grid-cols-[160px_160px_1fr]">
        <div>
          <label className="label" htmlFor="t-month">Bulan</label>
          <input id="t-month" type="month" className="input" value={forMonth} onChange={(e) => e.target.value && setForMonth(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="t-amt">Jumlah (RM)</label>
          <input id="t-amt" className="input tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {error?.fields.amount && <p className="field-error">{error.fields.amount}</p>}
        </div>
        <div>
          <label className="label" htmlFor="t-reason">Sebab</label>
          <input id="t-reason" className="input" placeholder="Contoh: tambah 2 KOL untuk pelancaran outlet baru" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error?.fields.reason && <p className="field-error">{error.fields.reason}</p>}
        </div>
      </div>
      <ErrorNotice error={error && !error.fields.amount && !error.fields.reason ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Hantar ke Admin</button>
      </div>
    </form>
  );
}

const STATUS_STYLE = { Pending: "bg-amber-50 text-amber-800", Approved: "bg-emerald-50 text-emerald-800", Rejected: "bg-red-50 text-red-700", Cancelled: "bg-stone-100 text-stone-600" } as const;
const STATUS_LABEL = { Pending: "Menunggu Admin", Approved: "Diluluskan", Rejected: "Ditolak", Cancelled: "Ditarik balik" } as const;

/** Senarai permohonan. Admin boleh lulus (dengan jumlah berbeza) atau tolak. */
export function TopUpList({ requests, isAdmin, teamNames, empty, viewerId }: { requests: TopUpRequest[]; isAdmin: boolean; teamNames?: Record<string, string>; empty: string; viewerId?: string }) {
  if (requests.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {requests.map((r) => <TopUpRow key={r.id} r={r} isAdmin={isAdmin} teamName={teamNames?.[r.teamId]} mine={viewerId === r.userId} />)}
    </ul>
  );
}

function TopUpRow({ r, isAdmin, teamName, mine }: { r: TopUpRequest; isAdmin: boolean; teamName?: string; mine: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(senToInput(r.amountSen));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function review(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/budget-requests/${r.id}/review`, { body: { action, amount, note, version: r.version } });
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{r.userName}</span>
        {teamName && <span className="text-sm text-muted">{teamName}</span>}
        <span className="font-semibold tabular-nums">{formatSen(r.amountSen)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
        {r.status === "Approved" && r.approvedSen !== r.amountSen && <span className="text-sm">diluluskan {formatSen(r.approvedSen)}</span>}
        <span className="ml-auto text-xs text-muted">{formatMonthMs(r.month)} · {formatDateTimeMs(r.createdAt)}</span>
      </div>
      <p className="text-sm">{r.reason}</p>
      {r.reviewNote && <p className="text-xs text-muted">Admin ({r.reviewedByName}): {r.reviewNote}</p>}
      {mine && !isAdmin && r.status === "Pending" && (
        <button
          className="btn-secondary px-3 py-1.5"
          disabled={busy !== null}
          onClick={async () => {
            if (!confirm("Tarik balik permohonan ini?")) return;
            setBusy("cancel");
            setError(null);
            try {
              await api(`/api/budget-requests/${r.id}/cancel`, { body: { version: r.version } });
              router.refresh();
            } catch (e) {
              setError(toApiError(e));
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "cancel" && <LoaderCircle className="size-4 animate-spin" />} Tarik balik
        </button>
      )}
      {isAdmin && r.status === "Pending" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-muted">RM
            <input className="w-24 rounded-lg border border-line px-2 py-1.5 text-right tabular-nums text-ink" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Jumlah diluluskan" />
          </label>
          <input className="input max-w-xs flex-1 py-1.5" placeholder="Nota (wajib jika tolak)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary px-3 py-1.5" onClick={() => review("approve")} disabled={busy !== null}>
            {busy === "approve" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Lulus
          </button>
          <button className="btn-danger px-3 py-1.5" onClick={() => review("reject")} disabled={busy !== null}>Tolak</button>
        </div>
      )}
      <ErrorNotice error={error} />
    </li>
  );
}
