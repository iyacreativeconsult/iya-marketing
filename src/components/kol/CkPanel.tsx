"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck, LoaderCircle, Pencil, Save, X } from "lucide-react";
import { COLLAB_TYPES, SHIP_STATUSES, type CampaignKol, type CkDetails, type CollabType } from "@/lib/domain/types";
import { Plus, Trash2 } from "lucide-react";
import type { KolAction } from "@/lib/domain/kol";
import { formatSen, senToInput } from "@/lib/domain/money";
import { todayMYT } from "@/lib/domain/dates";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

export interface CkOptions {
  /** Admin sahaja: ahli team untuk tukar PIC. */
  members: { id: string; name: string }[] | null;
  platforms: string[];
  items: { id: string; name: string; unit: string; costSen: number }[];
  outlets: { id: string; name: string }[];
}

interface Props {
  options: CkOptions;
  ck: CampaignKol;
  actions: { action: KolAction; label: string; noteRequired: boolean }[];
  canEditDetails: boolean;
  canEditFee: boolean;
}

/** Butang tindakan KOL (checklist), borang posting dan ubah butiran. */
export function CkPanel({ options, ck, actions, canEditDetails, canEditFee }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [open, setOpen] = useState<null | { action: KolAction; label: string; noteRequired: boolean }>(null);
  const [note, setNote] = useState("");
  const [postUrl, setPostUrl] = useState(ck.postUrl);
  const [postedDate, setPostedDate] = useState(ck.postedDate || todayMYT());
  const [editing, setEditing] = useState(false);

  async function run(action: KolAction) {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/campaign-kols/${ck.id}/action`, { body: { action, note, postUrl: action === "posted" ? postUrl : "", postedDate: action === "posted" ? postedDate : "", version: ck.version } });
      setOpen(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }

  const needsForm = (a: KolAction, noteRequired: boolean) => noteRequired || a === "posted";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const primary = !["drop", "request_revision", "product_sent"].includes(a.action);
          return (
            <button
              key={a.action}
              className={a.action === "drop" ? "btn-danger" : primary ? "btn-primary" : "btn-secondary"}
              disabled={busy !== null}
              onClick={() => (needsForm(a.action, a.noteRequired) ? setOpen(a) : run(a.action))}
            >
              {busy === a.action ? <LoaderCircle className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
              {a.label}
            </button>
          );
        })}
        {canEditDetails && !editing && (
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Ubah butiran
          </button>
        )}
      </div>

      {open && (
        <div className="card space-y-3 p-4">
          <p className="font-semibold">{open.label}</p>
          {open.action === "posted" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div>
                <label className="label" htmlFor="p-url">URL posting</label>
                <input id="p-url" className="input" placeholder="https://www.tiktok.com/@.../video/..." value={postUrl} onChange={(e) => setPostUrl(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="p-date">Tarikh posting</label>
                <input id="p-date" type="date" className="input" value={postedDate} onChange={(e) => setPostedDate(e.target.value)} />
              </div>
            </div>
          )}
          {open.noteRequired && (
            <div>
              <label className="label" htmlFor="ck-note">Sebab</label>
              <textarea id="ck-note" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setOpen(null)} disabled={busy !== null}>Batal</button>
            <button className="btn-primary" onClick={() => run(open.action)} disabled={busy !== null}>
              {busy && <LoaderCircle className="size-4 animate-spin" />} Sahkan
            </button>
          </div>
        </div>
      )}

      {editing && <EditDetails options={options} ck={ck} canEditFee={canEditFee} onDone={() => setEditing(false)} />}
      <ErrorNotice error={error} />
    </div>
  );
}

function EditDetails({ options, ck, canEditFee, onDone }: { options: CkOptions; ck: CampaignKol; canEditFee: boolean; onDone: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<CkDetails>(ck.details);
  const [lines, setLines] = useState(ck.inKind.map((l) => ({ itemId: l.itemId, qty: l.qty })));
  const [v, setV] = useState({
    picId: ck.picId,
    collabType: ck.collabType as CollabType,
    platform: ck.platform,
    fee: ck.feeSen === null ? "0" : senToInput(ck.feeSen),
    deliverables: ck.deliverables,
    postingDueDate: ck.postingDueDate,
    notes: ck.notes,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/campaign-kols/${ck.id}`, { method: "PATCH", body: { version: ck.version, data: { ...v, details: d, inKind: lines } } });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card grid gap-3 p-4 sm:grid-cols-2" noValidate>
      {options.members && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="e-pic">PIC (bajet siapa)</label>
          <select id="e-pic" className="input max-w-sm" value={v.picId} onChange={(e) => setV({ ...v, picId: e.target.value })}>
            {!options.members.some((m) => m.id === v.picId) && <option value={v.picId}>{ck.picName || "-"}</option>}
            {options.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {fe.picId && <p className="field-error">{fe.picId}</p>}
        </div>
      )}
      <div>
        <label className="label" htmlFor="e-collab">Jenis kerjasama</label>
        <select id="e-collab" className="input" value={v.collabType} onChange={(e) => setV({ ...v, collabType: e.target.value as CollabType })}>
          {COLLAB_TYPES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="e-plat">Platform</label>
        <select id="e-plat" className="input" value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })}>
          {[...new Set([...options.platforms, v.platform])].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <CollabFields type={v.collabType} d={d} setD={setD} outlets={options.outlets} fe={fe} />
      <InKindEditor items={options.items} existing={ck.inKind} lines={lines} setLines={setLines} error={fe.inKind} />
      <div>
        <label className="label" htmlFor="e-fee">Fee (RM)</label>
        <input id="e-fee" className="input tabular-nums" inputMode="decimal" value={v.fee} disabled={!canEditFee} onChange={(e) => setV({ ...v, fee: e.target.value })} />
        {fe.fee ? <p className="field-error">{fe.fee}</p> : !canEditFee && <p className="mt-1 text-xs text-muted">Fee dikunci selepas Confirmed. Admin boleh ubah.</p>}
      </div>
      <div>
        <label className="label" htmlFor="e-del">Deliverable</label>
        <input id="e-del" className="input" value={v.deliverables} onChange={(e) => setV({ ...v, deliverables: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="e-due">Tarikh posting dijanjikan</label>
        <input id="e-due" type="date" className="input" value={v.postingDueDate} onChange={(e) => setV({ ...v, postingDueDate: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="e-notes">Nota</label>
        <textarea id="e-notes" className="input min-h-16" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </div>
      <div className="sm:col-span-2"><ErrorNotice error={error && !fe.fee ? error : null} /></div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </form>
  );
}

function In({ id, label, children, cls = "" }: { id: string; label: string; children: React.ReactNode; cls?: string }) {
  return (
    <div className={cls}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/** Medan tambahan ikut jenis kerjasama. */
function CollabFields({ type, d, setD, outlets, fe }: { type: CollabType; d: CkDetails; setD: (d: CkDetails) => void; outlets: CkOptions["outlets"]; fe: Record<string, string> }) {
  const set = <K extends keyof CkDetails>(k: K, val: CkDetails[K]) => setD({ ...d, [k]: val });
  const txt = (k: keyof CkDetails, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, cls = "") => (
    <In id={`d-${k}`} label={label} cls={cls}>
      <input id={`d-${k}`} className="input" value={String(d[k] ?? "")} onChange={(e) => set(k, (extra.type === "number" ? Number(e.target.value) : e.target.value) as never)} {...extra} />
      {fe[`details.${k}`] && <p className="field-error">{fe[`details.${k}`]}</p>}
    </In>
  );
  const box = (title: string, children: React.ReactNode) => (
    <fieldset className="grid gap-3 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-xs font-semibold text-brand-700">{title}</legend>
      {children}
    </fieldset>
  );

  if (type === "Review kedai (dine-in)")
    return box("Lawatan outlet", <>
      <In id="d-outlet" label="Outlet">
        <select id="d-outlet" className="input" value={d.outletId} onChange={(e) => set("outletId", e.target.value)}>
          <option value="">Pilih outlet</option>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {fe["details.outletId"] && <p className="field-error">{fe["details.outletId"]}</p>}
      </In>
      {txt("pax", "Bilangan pax", { type: "number", min: 0, max: 100 })}
      {txt("visitDate", "Tarikh lawatan", { type: "date" })}
      {txt("visitTime", "Masa", { type: "time" })}
    </>);
  if (type === "Hantar produk (seeding)")
    return box("Penghantaran ke rumah KOL", <>
      {txt("shipAddress", "Alamat penghantaran", {}, "sm:col-span-2")}
      {txt("courier", "Kurier")}
      {txt("trackingNo", "No. tracking")}
      <In id="d-ship" label="Status penghantaran">
        <select id="d-ship" className="input" value={d.shipStatus} onChange={(e) => set("shipStatus", e.target.value as CkDetails["shipStatus"])}>
          {SHIP_STATUSES.map((x) => <option key={x}>{x}</option>)}
        </select>
      </In>
      {txt("shippedDate", "Tarikh dihantar", { type: "date" })}
      {txt("receivedDate", "Tarikh diterima", { type: "date" })}
    </>);
  if (type === "Affiliate")
    return box("Affiliate", <>
      {txt("commissionPct", "Komisen (%)", { type: "number", min: 0, max: 100, step: 0.5 })}
      {txt("affiliateCode", "Kod / pautan affiliate")}
    </>);
  if (type === "Live / event")
    return box("Live / event", <>
      {txt("eventDate", "Tarikh", { type: "date" })}
      {txt("eventLocation", "Lokasi / platform")}
    </>);
  if (type === "Ambassador")
    return box("Kontrak ambassador", <>
      {txt("contractStart", "Mula", { type: "date" })}
      {txt("contractEnd", "Tamat", { type: "date" })}
    </>);
  if (type === "Whitelisting / Spark Ads")
    return box("Hak guna iklan", <>
      {txt("adCode", "Spark code / kod iklan")}
      {txt("rightsUntil", "Hak guna sehingga", { type: "date" })}
    </>);
  return null;
}

/** Barang/makanan yang diberi. Nilai dikira dari nilai kos dalam Katalog Item. */
function InKindEditor({
  items,
  existing,
  lines,
  setLines,
  error,
}: {
  items: CkOptions["items"];
  existing: CampaignKol["inKind"];
  lines: { itemId: string; qty: number }[];
  setLines: (l: { itemId: string; qty: number }[]) => void;
  error?: string;
}) {
  const cost = (id: string) => items.find((i) => i.id === id)?.costSen ?? existing.find((e) => e.itemId === id)?.unitCostSen ?? 0;
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? existing.find((e) => e.itemId === id)?.name ?? id;
  const total = lines.reduce((a, l) => a + l.qty * cost(l.itemId), 0);
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3 sm:col-span-2">
      <legend className="px-1 text-xs font-semibold text-brand-700">Barang / makanan diberi (in-kind)</legend>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_90px_110px_auto] items-center gap-2">
          <select className="input" value={l.itemId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))} aria-label="Item">
            {!items.some((it) => it.id === l.itemId) && <option value={l.itemId}>{name(l.itemId)}</option>}
            {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
          <input className="input tabular-nums" type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} aria-label="Kuantiti" />
          <span className="text-right text-sm tabular-nums">{formatSen(l.qty * cost(l.itemId))}</span>
          <button type="button" className="btn-secondary px-2.5" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Buang"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" className="btn-secondary" disabled={items.length === 0} onClick={() => items[0] && setLines([...lines, { itemId: items[0].id, qty: 1 }])}>
          <Plus className="size-4" /> Tambah item
        </button>
        <span className="text-sm">Jumlah nilai: <b className="tabular-nums">{formatSen(total)}</b></span>
      </div>
      {items.length === 0 && <p className="text-xs text-muted">Tiada item dalam Katalog. Admin boleh tambah di Tetapan.</p>}
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}
