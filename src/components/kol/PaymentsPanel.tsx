"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote, LoaderCircle, Plus, X } from "lucide-react";
import { PAYMENT_KINDS, type KolPayment, type PaymentKind } from "@/lib/domain/types";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { formatSen, senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError, type UploadedFile } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { FileUpload } from "../FileUpload";
import { FileLink, PaymentStatusBadge } from "../finance";

interface Props {
  ckId: string;
  teamId: string;
  picId: string;
  payments: KolPayment[];
  isAdmin: boolean;
  canRequest: boolean;
  remainingSen: number;
}

export function PaymentsPanel({ ckId, teamId, picId, payments, isAdmin, canRequest, remainingSen }: Props) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {payments.length === 0 && <p className="text-sm text-muted">Belum ada bayaran. Bayaran penuh dicipta automatik bila KOL ditanda posting.</p>}
      {payments.map((p) => (
        <PaymentRow key={p.id} p={p} teamId={teamId} picId={picId} isAdmin={isAdmin} />
      ))}
      {canRequest && remainingSen > 0 && !adding && (
        <button className="btn-secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Minta bayaran (contoh deposit)
        </button>
      )}
      {adding && <RequestForm ckId={ckId} teamId={teamId} picId={picId} remainingSen={remainingSen} onDone={() => setAdding(false)} />}
    </div>
  );
}

function PaymentRow({ p, teamId, picId, isAdmin }: { p: KolPayment; teamId: string; picId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [proof, setProof] = useState<UploadedFile | null>(null);
  const [paidDate, setPaidDate] = useState(todayMYT());
  const [note, setNote] = useState("");

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setPaying(false);
      setCancelling(false);
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }
  const action = (a: "process" | "pay" | "cancel") =>
    run(a, () => api(`/api/kol-payments/${p.id}/action`, { body: { action: a, proofFileId: proof?.id ?? null, paidDate: a === "pay" ? paidDate : "", note, version: p.version } }));
  const attachInvoice = (f: UploadedFile | null) =>
    run("invoice", () =>
      api(`/api/kol-payments/${p.id}`, { method: "PATCH", body: { version: p.version, data: { amount: senToInput(p.amountSen), kind: p.kind, invoiceFileId: f?.id ?? null, notes: p.notes } } }),
    );

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-lg font-bold tabular-nums">{formatSen(p.amountSen)}</span>
        <span className="text-sm text-muted">{p.kind}</span>
        <PaymentStatusBadge status={p.status} />
        {p.paidDate && <span className="text-sm text-muted">Dibayar {formatDateMs(p.paidDate)}</span>}
        <span className="ml-auto flex flex-wrap gap-3 text-sm">
          <span>Invois: <FileLink file={p.invoice} /></span>
          <span>Bukti bayaran: <FileLink file={p.proof} /></span>
        </span>
      </div>
      {p.notes && <p className="mt-1 text-xs text-muted">{p.notes}</p>}

      {p.status === "Pending" && !p.invoice && (
        <div className="mt-3 max-w-md">
          <FileUpload teamId={teamId} ownerId={picId} purpose="invoice" value={null} onChange={(f) => f && attachInvoice(f)} label="Lampir invois KOL" />
        </div>
      )}

      {isAdmin && p.status !== "Paid" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.status === "Pending" && (
            <button className="btn-secondary" onClick={() => action("process")} disabled={busy !== null}>
              {busy === "process" && <LoaderCircle className="size-4 animate-spin" />} Proses
            </button>
          )}
          <button className="btn-primary" onClick={() => setPaying(true)} disabled={busy !== null}>
            <Banknote className="size-4" /> Tandakan dibayar
          </button>
          <button className="btn-danger" onClick={() => setCancelling(true)} disabled={busy !== null}>Batal bayaran</button>
        </div>
      )}

      {paying && (
        <div className="mt-3 grid gap-3 rounded-xl bg-brand-50/60 p-3 sm:grid-cols-[1fr_180px_auto]">
          <FileUpload teamId={teamId} ownerId={picId} purpose="payment_proof" value={proof} onChange={setProof} label="Muat naik bukti bayaran" />
          <input type="date" className="input" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} aria-label="Tarikh bayaran" />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => action("pay")} disabled={busy !== null || !proof}>
              {busy === "pay" && <LoaderCircle className="size-4 animate-spin" />} Sahkan
            </button>
            <button className="btn-secondary px-2.5" onClick={() => setPaying(false)} aria-label="Batal"><X className="size-4" /></button>
          </div>
          <p className="text-xs text-muted sm:col-span-3">Bila disahkan, jumlah ini masuk automatik sebagai perbelanjaan Selesai dalam bajet team (kategori KOL).</p>
        </div>
      )}
      {cancelling && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input max-w-md flex-1" placeholder="Sebab dibatalkan" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <button className="btn-danger" onClick={() => action("cancel")} disabled={busy !== null || note.trim().length < 3}>Batal bayaran</button>
          <button className="btn-secondary" onClick={() => setCancelling(false)}>Tutup</button>
        </div>
      )}
      <div className="mt-2"><ErrorNotice error={error} /></div>
    </div>
  );
}

function RequestForm({ ckId, teamId, picId, remainingSen, onDone }: { ckId: string; teamId: string; picId: string; remainingSen: number; onDone: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(senToInput(remainingSen));
  const [kind, setKind] = useState<PaymentKind>("Deposit");
  const [invoice, setInvoice] = useState<UploadedFile | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/kol-payments", { body: { campaignKolId: ckId, amount, kind, invoiceFileId: invoice?.id ?? null, notes } });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-brand-50/40 p-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="r-amt">Jumlah (RM)</label>
          <input id="r-amt" className="input tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Baki fee: {formatSen(remainingSen)}</p>
          {error?.fields.amount && <p className="field-error">{error.fields.amount}</p>}
        </div>
        <div>
          <label className="label" htmlFor="r-kind">Jenis</label>
          <select id="r-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as PaymentKind)}>
            {PAYMENT_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-notes">Nota</label>
          <input id="r-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <FileUpload teamId={teamId} ownerId={picId} purpose="invoice" value={invoice} onChange={setInvoice} label="Lampir invois (pilihan)" />
      <ErrorNotice error={error && !error.fields.amount ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />} Hantar permintaan</button>
      </div>
    </form>
  );
}
