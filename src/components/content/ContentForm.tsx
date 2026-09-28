"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clapperboard, LoaderCircle, Plus, Save, X } from "lucide-react";
import type { ContentItem } from "@/lib/domain/types";
import type { ProductionOptions } from "@/lib/server/services/contentOptions";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { Chips, toggle } from "../ideas/shared";

interface Props {
  options: ProductionOptions;
  content?: ContentItem;
  /** Dari Content Bank: pratetap tajuk, produk, platform dan jenis. */
  fromBank?: { id: string; hook: string; itemIds: string[]; platforms: string[]; contentType: string; teamId: string; campaignId: string | null };
  label?: string;
}

export function ContentForm({ options, content, fromBank, label }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const teamId0 = content?.teamId ?? (fromBank && options.teams.some((t) => t.id === fromBank.teamId) ? fromBank.teamId : options.defaultTeamId);
  const [v, setV] = useState({
    title: content?.title ?? fromBank?.hook ?? "",
    teamId: teamId0,
    ownerId: content?.ownerId ?? options.members?.[teamId0]?.[0]?.id ?? "",
    campaignId: content?.campaignId ?? fromBank?.campaignId ?? "",
    platform: content?.platform ?? fromBank?.platforms[0] ?? "",
    contentType: content?.contentType ?? fromBank?.contentType ?? "",
    itemIds: content?.itemIds ?? fromBank?.itemIds ?? [],
    publishDate: content?.publishDate ?? "",
    script: content?.script ?? "",
    notes: content?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};
  const members = options.members?.[v.teamId] ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = { ...v, ownerId: members ? v.ownerId || null : null, campaignId: v.campaignId || null };
    try {
      if (content) {
        await api(`/api/content/${content.id}`, { method: "PATCH", body: { version: content.version, data } });
        setOpen(false);
        router.refresh();
      } else {
        const r = await api<{ id: string }>("/api/content", { body: { ...data, bankId: fromBank?.id ?? null } });
        router.push(`/content/${r.id}`);
      }
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    if (content) return <button className="btn-secondary" onClick={() => setOpen(true)}>Ubah butiran</button>;
    return (
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={options.teams.length === 0}>
        {fromBank ? <Clapperboard className="size-4" /> : <Plus className="size-4" />} {label ?? "Tambah content"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <div className="flex items-start justify-between">
        <h2 className="font-semibold">{content ? "Ubah content" : fromBank ? "Hasilkan content dari Content Bank" : "Content baru"}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Tutup"><X className="size-5" /></button>
      </div>
      <div>
        <label className="label" htmlFor="ct-title">Tajuk content</label>
        <input id="ct-title" className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={160} />
        {fe.title && <p className="field-error">{fe.title}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label" htmlFor="ct-team">Team</label>
          <select id="ct-team" className="input" value={v.teamId} disabled={Boolean(content) && !options.members} onChange={(e) => setV({ ...v, teamId: e.target.value, ownerId: options.members?.[e.target.value]?.[0]?.id ?? "", campaignId: "" })}>
            {options.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        {members && (
          <div><label className="label" htmlFor="ct-pic">PIC</label>
            <select id="ct-pic" className="input" value={v.ownerId} onChange={(e) => setV({ ...v, ownerId: e.target.value })}>
              {members.length === 0 && <option value="">Tiada ahli</option>}
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>{fe.ownerId && <p className="field-error">{fe.ownerId}</p>}</div>
        )}
        <div><label className="label" htmlFor="ct-camp">Campaign</label>
          <select id="ct-camp" className="input" value={v.campaignId} onChange={(e) => setV({ ...v, campaignId: e.target.value })}>
            <option value="">Tiada</option>
            {options.campaigns.filter((c) => c.teamId === v.teamId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>{fe.campaignId && <p className="field-error">{fe.campaignId}</p>}</div>
        <div><label className="label" htmlFor="ct-plat">Platform</label>
          <select id="ct-plat" className="input" value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })}>
            <option value="">-</option>{options.platforms.map((p) => <option key={p}>{p}</option>)}
          </select></div>
        <div><label className="label" htmlFor="ct-type">Jenis content</label>
          <select id="ct-type" className="input" value={v.contentType} onChange={(e) => setV({ ...v, contentType: e.target.value })}>
            <option value="">-</option>{[...new Set([...options.contentTypes, v.contentType].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}
          </select></div>
        <div><label className="label" htmlFor="ct-date">Tarikh publish</label>
          <input id="ct-date" type="date" className="input" value={v.publishDate} onChange={(e) => setV({ ...v, publishDate: e.target.value })} /></div>
      </div>
      {options.items.length > 0 && <div><p className="label">Produk / item</p><Chips options={options.items.map((i) => ({ value: i.id, label: i.name }))} selected={v.itemIds} onToggle={(x) => setV({ ...v, itemIds: toggle(v.itemIds, x) })} /></div>}
      <div>
        <label className="label" htmlFor="ct-script">Skrip / brief</label>
        <textarea id="ct-script" className="input min-h-32 font-mono text-xs" placeholder={"Hook:\nBabak 1:\nCTA:"} value={v.script} onChange={(e) => setV({ ...v, script: e.target.value })} maxLength={10000} />
      </div>
      <div>
        <label className="label" htmlFor="ct-notes">Nota</label>
        <input id="ct-notes" className="input" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={2000} />
      </div>
      <ErrorNotice error={error && !fe.title && !fe.ownerId && !fe.campaignId ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </form>
  );
}
