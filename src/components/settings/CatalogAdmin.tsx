"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Pencil, Plus, Save, X } from "lucide-react";
import { ITEM_KINDS, type Item, type Outlet } from "@/lib/domain/types";
import { formatSen, senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { DeleteControl } from "../DeleteControl";

/* ------------------------------- Item ------------------------------- */

export function ItemsAdmin({ items, categories }: { items: Item[]; categories: string[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {editing === "new" ? <ItemForm categories={categories} onDone={() => setEditing(null)} /> : (
        <button className="btn-primary" onClick={() => setEditing("new")}><Plus className="size-4" /> Tambah item</button>
      )}
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead><tr><th>Item</th><th>Jenis</th><th>Kategori</th><th className="text-right">Harga jual</th><th className="text-right">Nilai kos</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">Belum ada item.</td></tr>}
            {items.map((i) =>
              editing === i.id ? (
                <tr key={i.id}><td colSpan={7} className="bg-brand-50/50"><ItemForm item={i} categories={categories} onDone={() => setEditing(null)} /></td></tr>
              ) : (
                <tr key={i.id} className={i.active ? "" : "opacity-50"}>
                  <td><p className="font-semibold">{i.name}</p><p className="text-xs text-muted">{[i.sku, i.unit].filter(Boolean).join(" · ")}</p></td>
                  <td className="text-sm">{i.kind}</td>
                  <td className="text-sm">{i.category || "-"}</td>
                  <td className="text-right tabular-nums">{formatSen(i.priceSen)}</td>
                  <td className="text-right tabular-nums">{formatSen(i.costSen)}</td>
                  <td className="text-sm">{i.active ? "Aktif" : "Tidak aktif"}</td>
                  <td className="text-right"><button className="btn-secondary px-2.5" onClick={() => setEditing(i.id)} aria-label={`Ubah ${i.name}`}><Pencil className="size-4" /></button></td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemForm({ item, categories, onDone }: { item?: Item; categories: string[]; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: item?.name ?? "",
    kind: item?.kind ?? "Produk",
    category: item?.category ?? "",
    sku: item?.sku ?? "",
    unit: item?.unit ?? "unit",
    price: item ? senToInput(item.priceSen) : "",
    cost: item ? senToInput(item.costSen) : "",
    active: item?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (item) await api(`/api/items/${item.id}`, { method: "PATCH", body: { version: item.version, data: v } });
      else await api("/api/items", { body: v });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-4" noValidate>
      <div className="sm:col-span-2"><label className="label" htmlFor="i-name">Nama</label><input id="i-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />{fe.name && <p className="field-error">{fe.name}</p>}</div>
      <div><label className="label" htmlFor="i-kind">Jenis</label>
        <select id="i-kind" className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as Item["kind"] })}>{ITEM_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
      <div><label className="label" htmlFor="i-cat">Kategori</label>
        <select id="i-cat" className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}><option value="">-</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div><label className="label" htmlFor="i-sku">SKU / kod</label><input id="i-sku" className="input" value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value })} /></div>
      <div><label className="label" htmlFor="i-unit">Unit</label><input id="i-unit" className="input" placeholder="pek, set, pinggan" value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} /></div>
      <div><label className="label" htmlFor="i-price">Harga jual (RM)</label><input id="i-price" className="input tabular-nums" inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />{fe.price && <p className="field-error">{fe.price}</p>}</div>
      <div><label className="label" htmlFor="i-cost">Nilai kos (RM)</label><input id="i-cost" className="input tabular-nums" inputMode="decimal" value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} />{fe.cost ? <p className="field-error">{fe.cost}</p> : <p className="mt-1 text-xs text-muted">Untuk kira nilai barang yang diberi kepada KOL.</p>}</div>
      <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" className="size-4 accent-brand-500" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Aktif (item tidak aktif tidak boleh dipilih untuk rekod baru)</label>
      <div className="sm:col-span-4"><ErrorNotice error={error && !fe.name && !fe.price && !fe.cost ? error : null} /></div>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-4">
        {item && <span className="mr-auto"><DeleteControl mode="direct" what={`item "${item.name}"`} confirmText={item.name} url={`/api/items/${item.id}`} /></span>}
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </form>
  );
}

/* ------------------------------ Outlet ------------------------------ */

export function OutletsAdmin({ outlets, kinds }: { outlets: Outlet[]; kinds: string[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {editing === "new" ? <OutletForm kinds={kinds} onDone={() => setEditing(null)} /> : (
        <button className="btn-primary" onClick={() => setEditing("new")}><Plus className="size-4" /> Tambah outlet</button>
      )}
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead><tr><th>Outlet</th><th>Jenis</th><th>Alamat</th><th>PIC</th><th>Status</th><th /></tr></thead>
          <tbody>
            {outlets.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">Belum ada outlet.</td></tr>}
            {outlets.map((o) =>
              editing === o.id ? (
                <tr key={o.id}><td colSpan={6} className="bg-brand-50/50"><OutletForm outlet={o} kinds={kinds} onDone={() => setEditing(null)} /></td></tr>
              ) : (
                <tr key={o.id} className={o.active ? "" : "opacity-50"}>
                  <td className="font-semibold">{o.name}</td>
                  <td className="text-sm">{o.kind || "-"}</td>
                  <td className="text-sm">{[o.address, o.city].filter(Boolean).join(", ") || "-"}</td>
                  <td className="text-sm">{[o.pic, o.phone].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="text-sm">{o.active ? "Aktif" : "Tidak aktif"}</td>
                  <td className="text-right"><button className="btn-secondary px-2.5" onClick={() => setEditing(o.id)} aria-label={`Ubah ${o.name}`}><Pencil className="size-4" /></button></td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutletForm({ outlet, kinds, onDone }: { outlet?: Outlet; kinds: string[]; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: outlet?.name ?? "", kind: outlet?.kind ?? "", address: outlet?.address ?? "", city: outlet?.city ?? "",
    pic: outlet?.pic ?? "", phone: outlet?.phone ?? "", active: outlet?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (outlet) await api(`/api/outlets/${outlet.id}`, { method: "PATCH", body: { version: outlet.version, data: v } });
      else await api("/api/outlets", { body: v });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  const f = (k: keyof typeof v, label: string, cls = "") => (
    <div className={cls}><label className="label" htmlFor={`o-${k}`}>{label}</label><input id={`o-${k}`} className="input" value={String(v[k])} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
  );
  return (
    <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-4" noValidate>
      {f("name", "Nama outlet", "sm:col-span-2")}
      <div><label className="label" htmlFor="o-kind">Jenis</label><select id="o-kind" className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}><option value="">-</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select></div>
      {f("city", "Bandar")}
      {f("address", "Alamat", "sm:col-span-4")}
      {f("pic", "PIC outlet", "sm:col-span-2")}
      {f("phone", "Telefon", "sm:col-span-2")}
      <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" className="size-4 accent-brand-500" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Aktif</label>
      <div className="sm:col-span-4"><ErrorNotice error={error} /></div>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-4">
        {outlet && <span className="mr-auto"><DeleteControl mode="direct" what={`outlet "${outlet.name}"`} confirmText={outlet.name} url={`/api/outlets/${outlet.id}`} /></span>}
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </form>
  );
}
