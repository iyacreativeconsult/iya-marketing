"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lightbulb, LoaderCircle, Save, X } from "lucide-react";
import type { FileRef, Idea, RefLink } from "@/lib/domain/types";
import { ImageUploader, LinkEditor } from "./References";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { Chips, toggle, type ContentOptions } from "./shared";

/** Kongsi idea baru, atau ubah idea sendiri. */
export function IdeaForm({ options, idea, onDone }: { options: ContentOptions; idea?: Idea; onDone?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(idea));
  const [v, setV] = useState({
    title: idea?.title ?? "",
    type: idea?.type ?? options.ideaTypes[0] ?? "",
    description: idea?.description ?? "",
    itemIds: idea?.itemIds ?? [],
    platforms: idea?.platforms ?? [],
  });
  const [links, setLinks] = useState<RefLink[]>(idea?.references ?? []);
  const [images, setImages] = useState<FileRef[]>(idea?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};
  const close = () => (onDone ? onDone() : setOpen(false));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = {
      title: v.title,
      type: v.type,
      description: v.description,
      itemIds: v.itemIds,
      platforms: v.platforms,
      references: links.filter((l) => l.url.trim()),
      imageIds: images.map((i) => i.id),
    };
    try {
      if (idea) {
        await api(`/api/ideas/${idea.id}`, { method: "PATCH", body: { version: idea.version, data } });
        router.refresh();
        close();
      } else {
        const r = await api<{ id: string }>("/api/ideas", { body: data });
        router.push(`/ideas/${r.id}`);
      }
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  if (!open) {
    return <button className="btn-primary" onClick={() => setOpen(true)}><Lightbulb className="size-4" /> Kongsi idea</button>;
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <div className="flex items-start justify-between">
        <h2 className="font-semibold">{idea ? "Ubah idea" : "Kongsi idea baru"}</h2>
        <button type="button" onClick={close} className="text-muted hover:text-ink" aria-label="Tutup"><X className="size-5" /></button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <div>
          <label className="label" htmlFor="i-title">Idea</label>
          <input id="i-title" className="input" placeholder='Contoh: Content "RM10 vs RM100 lunch"' value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} />
          {fe.title && <p className="field-error">{fe.title}</p>}
        </div>
        <div>
          <label className="label" htmlFor="i-type">Jenis</label>
          <select id="i-type" className="input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            {[...new Set([...options.ideaTypes, v.type].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="i-desc">Huraian</label>
        <textarea id="i-desc" className="input min-h-24" placeholder="Terangkan idea, format, siapa target, kenapa ia menarik" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={3000} />
      </div>
      {options.items.length > 0 && (
        <div><p className="label">Produk / item</p><Chips options={options.items.map((i) => ({ value: i.id, label: i.name }))} selected={v.itemIds} onToggle={(x) => setV({ ...v, itemIds: toggle(v.itemIds, x) })} /></div>
      )}
      <div><p className="label">Platform</p><Chips options={options.platforms.map((p) => ({ value: p, label: p }))} selected={v.platforms} onToggle={(x) => setV({ ...v, platforms: toggle(v.platforms, x) })} /></div>
      <fieldset className="space-y-4 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Rujukan</legend>
        <div>
          <p className="label">Gambar</p>
          <ImageUploader value={images} onChange={setImages} />
          {fe.imageIds && <p className="field-error">{fe.imageIds}</p>}
        </div>
        <div>
          <p className="label">Pautan posting / video</p>
          <LinkEditor value={links} onChange={setLinks} errors={fe} />
          {fe.references && <p className="field-error">{fe.references}</p>}
        </div>
      </fieldset>
      <ErrorNotice error={error && !fe.title && !Object.keys(fe).some((k) => k.startsWith("references")) ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={close} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} {idea ? "Simpan" : "Kongsi"}</button>
      </div>
    </form>
  );
}
