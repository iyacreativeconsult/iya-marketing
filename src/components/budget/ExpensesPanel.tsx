"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, Save, TriangleAlert, X } from "lucide-react";
import type { Expense } from "@/lib/domain/types";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { formatSen, senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError, type UploadedFile } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { FileUpload } from "../FileUpload";
import { ExpenseStatusBadge, FileLink } from "../finance";
import { DeleteControl } from "../DeleteControl";

interface Row extends Expense {
  canEdit: boolean;
  canDelete: boolean;
  canRequestDelete: boolean;
  canReview: boolean;
}

export interface ExpenseOptions {
  campaigns: { id: string; name: string }[];
  categories: string[];
  paymentMethods: string[];
  kols: { id: string; campaignId: string; picId: string; label: string }[];
  /** Admin sahaja: person dalam team (untuk rekod bagi pihak). null = ahli (sentiasa diri sendiri). */
  owners: { id: string; name: string }[] | null;
}

interface Props {
  teamId: string;
  month: string;
  expenses: Row[];
  options: ExpenseOptions;
}

export function ExpensesPanel({ teamId, month, expenses, options }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Perbelanjaan</h2>
        {teamId && !adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Catat Perbelanjaan
          </button>
        )}
      </div>

      {adding && <ExpenseForm teamId={teamId} month={month} options={options} onDone={() => setAdding(false)} />}

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[860px]">
          <thead>
            <tr>
              <th>Tarikh</th>
              <th>Keterangan</th>
              <th>Kategori</th>
              <th className="text-right">Jumlah</th>
              <th>Resit</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted">Belum ada perbelanjaan bulan ini.</td></tr>
            )}
            {expenses.map((e) =>
              editing === e.id ? (
                <tr key={e.id}>
                  <td colSpan={7} className="bg-brand-50/50">
                    <ExpenseForm teamId={teamId} month={month} options={options} expense={e} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <ExpenseRow key={e.id} e={e} onEdit={() => setEditing(e.id)} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpenseRow({ e, onEdit }: { e: Row; onEdit: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setRejecting(false);
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  const review = (action: "verify" | "reject") =>
    run(action, () => api(`/api/expenses/${e.id}/review`, { body: { action, note, version: e.version } }));

  return (
    <>
      <tr className="hover:bg-brand-50/40">
        <td className="whitespace-nowrap">{formatDateMs(e.date)}</td>
        <td>
          <p className="font-medium">{e.description}</p>
          <p className="text-xs text-muted">{[e.ownerName, e.campaignName, e.vendor, e.paymentMethod].filter(Boolean).join(" · ")}</p>
          {e.overBudget && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
              <TriangleAlert className="size-3.5" aria-hidden /> Melebihi baki bajet semasa direkod
            </p>
          )}
          {e.statusNote && !e.overBudget && <p className="mt-1 text-xs text-amber-800">{e.statusNote}</p>}
        </td>
        <td className="text-sm">{e.category}</td>
        <td className="text-right font-semibold tabular-nums">{formatSen(e.amountSen)}</td>
        <td className="text-sm"><FileLink file={e.receipt} /></td>
        <td><ExpenseStatusBadge status={e.status} /></td>
        <td>
          <div className="flex justify-end gap-1.5">
            {e.canReview && (
              <>
                <button className="btn-primary px-2.5 py-1.5" onClick={() => review("verify")} disabled={busy !== null} title="Sahkan (resit betul)">
                  {busy === "verify" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Sahkan
                </button>
                <button className="btn-danger px-2.5 py-1.5" onClick={() => setRejecting(true)} disabled={busy !== null}>Tolak</button>
              </>
            )}
            {e.canEdit && <button className="btn-secondary px-2.5 py-1.5" onClick={onEdit} aria-label="Ubah"><Pencil className="size-4" /></button>}
            {e.canDelete && <DeleteControl compact mode="direct" what={`perbelanjaan "${e.description}"`} url={`/api/expenses/${e.id}`} body={{ version: e.version }} />}
            {e.canRequestDelete && <DeleteControl compact mode="request" what={`perbelanjaan "${e.description}"`} entity="expense" entityId={e.id} />}
          </div>
        </td>
      </tr>
      {(rejecting || error) && (
        <tr>
          <td colSpan={7} className="bg-brand-50/40">
            {rejecting && (
              <div className="flex flex-wrap items-center gap-2">
                <input className="input max-w-md flex-1" placeholder="Sebab ditolak (contoh: resit tidak jelas)" value={note} onChange={(x) => setNote(x.target.value)} autoFocus />
                <button className="btn-danger" onClick={() => review("reject")} disabled={busy !== null || note.trim().length < 3}>
                  {busy === "reject" && <LoaderCircle className="size-4 animate-spin" />} Tolak
                </button>
                <button className="btn-secondary" onClick={() => setRejecting(false)}>Batal</button>
              </div>
            )}
            <div className="mt-2"><ErrorNotice error={error} /></div>
          </td>
        </tr>
      )}
    </>
  );
}

function ExpenseForm({ teamId, month, options, expense, onDone }: { teamId: string; month: string; options: ExpenseOptions; expense?: Expense; onDone: () => void }) {
  const { campaigns } = options;
  const router = useRouter();
  const today = todayMYT();
  const [v, setV] = useState({
    date: expense?.date ?? (today.startsWith(month) ? today : `${month}-01`),
    campaignId: expense?.campaignId ?? "",
    category: expense?.category ?? options.categories[0] ?? "",
    paymentMethod: expense?.paymentMethod ?? options.paymentMethods[0] ?? "",
    campaignKolId: expense?.campaignKolId ?? "",
    ownerId: expense?.ownerId ?? options.owners?.[0]?.id ?? "",
    description: expense?.description ?? "",
    amount: expense ? senToInput(expense.amountSen) : "",
    vendor: expense?.vendor ?? "",
    remark: expense?.remark ?? "",
  });
  const [receipt, setReceipt] = useState<UploadedFile | null>(expense?.receipt ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = { ...v, teamId, ownerId: options.owners ? v.ownerId || null : null, campaignId: v.campaignId || null, campaignKolId: v.campaignKolId || null, receiptFileId: receipt?.id ?? null };
    try {
      if (expense) await api(`/api/expenses/${expense.id}`, { method: "PATCH", body: { version: expense.version, data } });
      else await api("/api/expenses", { body: data });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h3 className="font-semibold">{expense ? "Ubah perbelanjaan" : "Perbelanjaan baru"}</h3>
      {expense?.status === "Ditolak" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ditolak: {expense.statusNote}. Simpan perubahan untuk hantar semula.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {options.owners && !expense && (
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label" htmlFor="x-owner">Tolak dari bajet</label>
            <select id="x-owner" className="input max-w-sm" value={v.ownerId} onChange={(e) => { setV({ ...v, ownerId: e.target.value, campaignKolId: "" }); setReceipt(null); }}>
              {options.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {fe.ownerId && <p className="field-error">{fe.ownerId}</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="x-date">Tarikh</label>
          <input id="x-date" type="date" className="input" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          {fe.date && <p className="field-error">{fe.date}</p>}
        </div>
        <div>
          <label className="label" htmlFor="x-amt">Jumlah (RM)</label>
          <input id="x-amt" className="input tabular-nums" inputMode="decimal" placeholder="0.00" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          {fe.amount && <p className="field-error">{fe.amount}</p>}
        </div>
        <div>
          <label className="label" htmlFor="x-cat">Kategori</label>
          <select id="x-cat" className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
            {[...new Set([...options.categories, v.category])].map((c) => <option key={c}>{c}</option>)}
          </select>
          {fe.category && <p className="field-error">{fe.category}</p>}
        </div>
        <div>
          <label className="label" htmlFor="x-camp">Campaign</label>
          <select id="x-camp" className="input" value={v.campaignId} onChange={(e) => setV({ ...v, campaignId: e.target.value, campaignKolId: "" })}>
            <option value="">Tiada / umum</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {fe.campaignId && <p className="field-error">{fe.campaignId}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="x-desc">Keterangan</label>
          <input id="x-desc" className="input" placeholder="Contoh: Iklan TikTok minggu 1" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          {fe.description && <p className="field-error">{fe.description}</p>}
        </div>
        <div>
          <label className="label" htmlFor="x-pay">Kaedah bayaran</label>
          <select id="x-pay" className="input" value={v.paymentMethod} onChange={(e) => setV({ ...v, paymentMethod: e.target.value })}>
            <option value="">-</option>
            {[...new Set([...options.paymentMethods, v.paymentMethod].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="x-kol">KOL berkaitan</label>
          <select id="x-kol" className="input" value={v.campaignKolId} onChange={(e) => setV({ ...v, campaignKolId: e.target.value })}>
            <option value="">Tiada</option>
            {options.kols.filter((k) => (!v.campaignId || k.campaignId === v.campaignId) && (!options.owners || k.picId === v.ownerId)).map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          {fe.campaignKolId && <p className="field-error">{fe.campaignKolId}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="x-vendor">Vendor / KOL</label>
          <input id="x-vendor" className="input" value={v.vendor} onChange={(e) => setV({ ...v, vendor: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <p className="label">Resit</p>
          <FileUpload teamId={teamId} purpose="receipt" value={receipt} onChange={setReceipt} label="Muat naik resit" ownerId={options.owners ? v.ownerId : undefined} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="x-remark">Catatan</label>
          <input id="x-remark" className="input" value={v.remark} onChange={(e) => setV({ ...v, remark: e.target.value })} />
        </div>
      </div>
      <ErrorNotice error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </button>
      </div>
    </form>
  );
}
