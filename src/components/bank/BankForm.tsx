"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Plus, Save, X } from "lucide-react";
import { BANK_STATUSES, FUNNELS, type BankEntry } from "@/lib/domain/types";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { Chips, linesToUrls, toggle, type ContentOptions } from "../ideas/shared";

export function BankForm({ options, teams, defaultTeamId, entry, campaigns }: { options: ContentOptions; teams: { id: string; name: string }[]; defaultTeamId: string; entry?: BankEntry; campaigns: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    hook: entry?.hook ?? "",
    description: entry?.description ?? "",
    contentType: entry?.contentType ?? options.contentTypes[0] ?? "",
    funnel: entry?.funnel ?? "Awareness",
    audience: entry?.audience ?? "",
    status: entry?.status ?? "Ready to Produce",
    teamId: entry?.teamId ?? defaultTeamId,
    campaignId: entry?.campaignId ?? "",
    itemIds: entry?.itemIds ?? [],
    platforms: entry?.platforms ?? [],
    refs: (entry?.references ?? []).join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = { ...v, campaignId: v.campaignId || null, references: linesToUrls(v.refs) };
    try {
      if (entry) {
        await api(`/api/content-bank/${entry.id}`, { method: "PATCH", body: { version: entry.version, data } });
        setOpen(false);
        router.refresh();
      } else {
        const r = await api<{ id: string }>("/api/content-bank", { body: data });
        router.push(`/content-bank/${r.id}`);
      }
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return entry ? <button className="btn-secondary" onClick={() => setOpen(true)}>Ubah</button> : <button className="btn-primary" onClick={() => setOpen(true)} disabled={teams.length === 0}><Plus className="size-4" /> Tambah ke Content Bank</button>;
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <div className="flex items-start justify-between">
        <h2 className="font-semibold">{entry ? "Ubah entry" : "Entry baru"}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Tutup"><X className="size-5" /></button>
      </div>
      <div>
        <label className="label" htmlFor="b-hook">Hook</label>
        <input id="b-hook" className="input" placeholder='"Aku ingat benda ni biasa je..."' value={v.hook} onChange={(e) => setV({ ...v, hook: e.target.value })} maxLength={200} />
        {fe.hook && <p className="field-error">{fe.hook}</p>}
      </div>
      <div>
        <label className="label" htmlFor="b-desc">Idea / skrip ringkas</label>
        <textarea id="b-desc" className="input min-h-24" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={3000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label" htmlFor="b-ct">Jenis content</label>
          <select id="b-ct" className="input" value={v.contentType} onChange={(e) => setV({ ...v, contentType: e.target.value })}>{[...new Set([...options.contentTypes, v.contentType].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="b-fn">Funnel</label>
          <select id="b-fn" className="input" value={v.funnel} onChange={(e) => setV({ ...v, funnel: e.target.value as BankEntry["funnel"] })}>{FUNNELS.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="b-st">Status</label>
          <select id="b-st" className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as BankEntry["status"] })}>{BANK_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="b-tm">Team</label>
          <select id="b-tm" className="input" value={v.teamId} disabled={Boolean(entry) && teams.length <= 1} onChange={(e) => setV({ ...v, teamId: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="b-au">Target audience</label>
          <input id="b-au" className="input" value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="b-cp">Campaign (pilihan)</label>
          <select id="b-cp" className="input" value={v.campaignId} onChange={(e) => setV({ ...v, campaignId: e.target.value })}><option value="">Tiada</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      {options.items.length > 0 && <div><p className="label">Produk / item</p><Chips options={options.items.map((i) => ({ value: i.id, label: i.name }))} selected={v.itemIds} onToggle={(x) => setV({ ...v, itemIds: toggle(v.itemIds, x) })} /></div>}
      <div><p className="label">Platform</p><Chips options={options.platforms.map((p) => ({ value: p, label: p }))} selected={v.platforms} onToggle={(x) => setV({ ...v, platforms: toggle(v.platforms, x) })} /></div>
      <div>
        <label className="label" htmlFor="b-refs">Rujukan (pautan, satu setiap baris)</label>
        <textarea id="b-refs" className="input min-h-16 font-mono text-xs" value={v.refs} onChange={(e) => setV({ ...v, refs: e.target.value })} />
      </div>
      <ErrorNotice error={error && !fe.hook ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
      </div>
    </form>
  );
}
