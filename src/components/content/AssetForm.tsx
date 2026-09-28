"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Plus, Save, X } from "lucide-react";
import { USAGE_RIGHTS, type Asset, type UsageRights } from "@/lib/domain/types";
import type { ProductionOptions } from "@/lib/server/services/contentOptions";
import { api, ApiError, toApiError, type UploadedFile } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { FileUpload } from "../FileUpload";
import { Chips, toggle } from "../ideas/shared";

export function AssetForm({ options, asset, contentItem, label }: { options: ProductionOptions; asset?: Asset; contentItem?: { id: string; teamId: string; title: string }; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    name: asset?.name ?? "",
    kind: asset?.kind ?? options.assetKinds[0] ?? "",
    url: asset?.url ?? "",
    teamId: asset?.teamId ?? contentItem?.teamId ?? options.defaultTeamId,
    campaignId: asset?.campaignId ?? "",
    platform: asset?.platform ?? "",
    contentType: asset?.contentType ?? "",
    creator: asset?.creator ?? "",
    usageRights: (asset?.usageRights ?? "Milik sendiri") as UsageRights,
    rightsUntil: asset?.rightsUntil ?? "",
    remark: asset?.remark ?? "",
    itemIds: asset?.itemIds ?? [],
  });
  const [file, setFile] = useState<UploadedFile | null>(asset?.file ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = { ...v, fileId: file?.id ?? null, campaignId: v.campaignId || null, contentItemId: asset?.contentItemId ?? contentItem?.id ?? null };
    try {
      if (asset) {
        await api(`/api/assets/${asset.id}`, { method: "PATCH", body: { version: asset.version, data } });
        setOpen(false);
        router.refresh();
      } else {
        const r = await api<{ id: string }>("/api/assets", { body: data });
        if (contentItem) {
          setOpen(false);
          router.refresh();
        } else router.push(`/content/library/${r.id}`);
      }
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return asset ? <button className="btn-secondary" onClick={() => setOpen(true)}>Ubah</button> : <button className={contentItem ? "btn-secondary" : "btn-primary"} onClick={() => setOpen(true)} disabled={options.teams.length === 0}><Plus className="size-4" /> {label ?? "Tambah asset"}</button>;
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5 text-left" noValidate>
      <div className="flex items-start justify-between">
        <h2 className="font-semibold">{asset ? "Ubah asset" : contentItem ? `Asset untuk "${contentItem.title}"` : "Asset baru"}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Tutup"><X className="size-5" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div><label className="label" htmlFor="as-name">Nama asset</label>
          <input id="as-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={160} />{fe.name && <p className="field-error">{fe.name}</p>}</div>
        <div><label className="label" htmlFor="as-kind">Jenis</label>
          <select id="as-kind" className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{[...new Set([...options.assetKinds, v.kind].filter(Boolean))].map((k) => <option key={k}>{k}</option>)}</select></div>
      </div>
      <fieldset className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Fail atau pautan</legend>
        <div>
          <p className="label">Muat naik (gambar / PDF)</p>
          <FileUpload teamId="shared" purpose="asset" value={file} onChange={setFile} label="Pilih fail" />
        </div>
        <div>
          <label className="label" htmlFor="as-url">Pautan (video, Google Drive, Canva, posting)</label>
          <input id="as-url" className="input" placeholder="https://drive.google.com/..." value={v.url} onChange={(e) => setV({ ...v, url: e.target.value.trim() })} />
          {fe.url && <p className="field-error">{fe.url}</p>}
          <p className="mt-1 text-xs text-muted">Video besar: simpan di Google Drive dan tampal pautan di sini.</p>
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label" htmlFor="as-team">Team</label>
          <select id="as-team" className="input" value={v.teamId} disabled={Boolean(contentItem || asset) && !options.members} onChange={(e) => setV({ ...v, teamId: e.target.value, campaignId: "" })}>{options.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="label" htmlFor="as-camp">Campaign</label>
          <select id="as-camp" className="input" value={v.campaignId} onChange={(e) => setV({ ...v, campaignId: e.target.value })}><option value="">Tiada</option>{options.campaigns.filter((c) => c.teamId === v.teamId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="as-creator">Pencipta</label>
          <input id="as-creator" className="input" placeholder="Nama / KOL / studio" value={v.creator} onChange={(e) => setV({ ...v, creator: e.target.value })} /></div>
        <div><label className="label" htmlFor="as-plat">Platform</label>
          <select id="as-plat" className="input" value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })}><option value="">-</option>{options.platforms.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><label className="label" htmlFor="as-ct">Jenis content</label>
          <select id="as-ct" className="input" value={v.contentType} onChange={(e) => setV({ ...v, contentType: e.target.value })}><option value="">-</option>{options.contentTypes.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><label className="label" htmlFor="as-rights">Hak guna</label>
          <select id="as-rights" className="input" value={v.usageRights} onChange={(e) => setV({ ...v, usageRights: e.target.value as UsageRights })}>{USAGE_RIGHTS.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label className="label" htmlFor="as-until">Hak guna sehingga</label>
          <input id="as-until" type="date" className="input" value={v.rightsUntil} onChange={(e) => setV({ ...v, rightsUntil: e.target.value })} />
          <p className="mt-1 text-xs text-muted">Kosongkan jika tiada had.</p></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="as-remark">Catatan</label>
          <input id="as-remark" className="input" value={v.remark} onChange={(e) => setV({ ...v, remark: e.target.value })} /></div>
      </div>
      {options.items.length > 0 && <div><p className="label">Produk / item</p><Chips options={options.items.map((i) => ({ value: i.id, label: i.name }))} selected={v.itemIds} onToggle={(x) => setV({ ...v, itemIds: toggle(v.itemIds, x) })} /></div>}
      <ErrorNotice error={error && !fe.name && !fe.url ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </form>
  );
}
