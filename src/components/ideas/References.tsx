"use client";

import { useRef, useState } from "react";
import { ExternalLink, ImagePlus, Link2, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import type { FileRef, RefLink } from "@/lib/domain/types";
import { detectPlatform } from "@/lib/domain/links";
import { toApiError, uploadFile } from "@/lib/client/api";

const MAX_IMAGES = 6;

/** Muat naik beberapa gambar rujukan (screenshot, poster, contoh content). */
export function ImageUploader({ value, onChange }: { value: FileRef[]; onChange: (v: FileRef[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX_IMAGES - value.length;
    const list = [...files].slice(0, room);
    if (files.length > room) setError(`Maksimum ${MAX_IMAGES} gambar.`);
    setBusy(list.length);
    const added: FileRef[] = [];
    for (const f of list) {
      try {
        added.push(await uploadFile(f, "shared", "idea_image"));
      } catch (e) {
        const x = toApiError(e);
        setError(`${f.name}: ${x.message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    onChange([...value, ...added]);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((img) => (
          <div key={img.id} className="group relative size-24 overflow-hidden rounded-xl border border-line bg-stone-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${img.id}`} alt={img.name} className="size-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((x) => x.id !== img.id))} aria-label={`Buang ${img.name}`}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-white/90 text-ink shadow hover:text-red-700">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {value.length < MAX_IMAGES && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy > 0}
            className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-brand-300 hover:text-brand-600">
            {busy > 0 ? <LoaderCircle className="size-5 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" /> Tambah</span>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
      <p className="mt-1 text-xs text-muted">{error ? <span className="text-red-700">{error}</span> : `JPG, PNG atau WEBP. Maksimum ${MAX_IMAGES} gambar, 4 MB setiap satu.`}</p>
    </div>
  );
}

/** Senarai pautan posting / video rujukan, dengan nota. */
export function LinkEditor({ value, onChange, errors }: { value: RefLink[]; onChange: (v: RefLink[]) => void; errors: Record<string, string> }) {
  const set = (i: number, patch: Partial<RefLink>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {value.map((r, i) => {
        const ok = /^https?:\/\/\S+$/i.test(r.url);
        return (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
            <div className="relative">
              <Link2 className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" aria-hidden />
              <input className="input pl-9" placeholder="https://www.tiktok.com/@.../video/..." value={r.url} onChange={(e) => set(i, { url: e.target.value.trim() })} aria-label="Pautan posting atau video" />
              {ok && <span className="absolute top-2 right-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">{detectPlatform(r.url)}</span>}
            </div>
            <input className="input" placeholder="Nota: kenapa rujukan ini bagus (pilihan)" value={r.note} onChange={(e) => set(i, { note: e.target.value })} maxLength={200} aria-label="Nota" />
            <button type="button" className="btn-secondary px-2.5" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Buang pautan"><Trash2 className="size-4" /></button>
            {errors[`references.${i}.url`] && <p className="field-error sm:col-span-3">{errors[`references.${i}.url`]}</p>}
          </div>
        );
      })}
      {value.length < 10 && (
        <button type="button" className="btn-secondary" onClick={() => onChange([...value, { url: "", note: "" }])}><Plus className="size-4" /> Tambah pautan posting / video</button>
      )}
    </div>
  );
}

/** Paparan: galeri gambar + kad pautan. */
export function ReferenceView({ images, links }: { images: FileRef[]; links: RefLink[] }) {
  if (images.length === 0 && links.length === 0) return null;
  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <a key={img.id} href={`/api/files/${img.id}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-stone-50 hover:border-brand-300" title={img.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${img.id}`} alt={img.name} className="aspect-square w-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-brand-300 hover:bg-brand-50/40">
                <span className="shrink-0 rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">{detectPlatform(r.url)}</span>
                <span className="min-w-0 flex-1">
                  {r.note && <span className="block text-sm font-medium">{r.note}</span>}
                  <span className="block truncate text-xs text-muted">{r.url}</span>
                </span>
                <ExternalLink className="size-4 shrink-0 text-muted" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
