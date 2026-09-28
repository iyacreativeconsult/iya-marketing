"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info, LoaderCircle, Save } from "lucide-react";
import type { Team } from "@/lib/domain/types";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "./ErrorNotice";

export interface CampaignFormValues {
  name: string;
  type: string;
  teamId: string;
  startDate: string;
  endDate: string;
  platforms: string[];
  itemIds: string[];
  outletIds: string[];
  objective: string;
  plannedBudget: string;
  notes: string;
}

const EMPTY: CampaignFormValues = {
  name: "",
  type: "",
  teamId: "",
  startDate: "",
  endDate: "",
  platforms: [],
  itemIds: [],
  outletIds: [],
  objective: "",
  plannedBudget: "",
  notes: "",
};

export interface CampaignOptions {
  types: string[];
  platforms: string[];
  items: { id: string; name: string; kind: string }[];
  outlets: { id: string; name: string }[];
}

interface Props {
  options: CampaignOptions;
  mode: "create" | "edit";
  teams: Team[];
  initial?: Partial<CampaignFormValues>;
  campaignId?: string;
  version?: number;
  reapprovalNotice?: boolean;
}

export function CampaignForm({ options, mode, teams, initial, campaignId, version, reapprovalNotice }: Props) {
  const router = useRouter();
  const [v, setV] = useState<CampaignFormValues>({ ...EMPTY, type: options.types[0] ?? "", ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  const set = <K extends keyof CampaignFormValues>(k: K, val: CampaignFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const toggle = (k: "platforms" | "itemIds" | "outletIds", item: string) =>
    setV((s) => ({ ...s, [k]: s[k].includes(item) ? s[k].filter((x) => x !== item) : [...s[k], item] }));

  const typeOptions = [...new Set([...options.types, v.type].filter(Boolean))];
  const platformOptions = [...new Set([...options.platforms, ...v.platforms])].map((p) => ({ value: p, label: p }));
  const kinds = [...new Set(options.items.map((i) => i.kind))];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      setError(new ApiError("VALIDATION", "Sila semak semula maklumat.", null, { endDate: "Tarikh tamat mesti sama atau selepas tarikh mula." }));
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        const res = await api<{ id: string }>("/api/campaigns", { body: { ...v } });
        router.push(`/campaigns/${res.id}`);
      } else {
        await api(`/api/campaigns/${campaignId}`, { method: "PATCH", body: { version, data: { ...v } } });
        router.push(`/campaigns/${campaignId}`);
      }
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" noValidate>
      {reapprovalNotice && (
        <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Campaign ini sudah diluluskan. Jika anda ubah tarikh atau anggaran bajet, ia akan dihantar semula untuk kelulusan Admin.
        </p>
      )}

      <Field id="f-name" label="Nama campaign" error={fe.name}>
        <input id="f-name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="f-type" label="Jenis" error={fe.type}>
          <select id="f-type" className="input" value={v.type} onChange={(e) => set("type", e.target.value)}>
            {typeOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field id="f-team" label="Team" error={fe.teamId}>
          <select id="f-team" className="input" value={v.teamId} onChange={(e) => set("teamId", e.target.value)} disabled={teams.length <= 1}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field id="f-start" label="Tarikh mula" error={fe.startDate}>
          <input id="f-start" type="date" className="input" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} required />
        </Field>
        <Field id="f-end" label="Tarikh tamat" error={fe.endDate}>
          <input id="f-end" type="date" className="input" value={v.endDate} min={v.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} required />
        </Field>
      </div>

      <Field label="Platform" error={fe.platforms}>
        <ChipGroup options={platformOptions} selected={v.platforms} onToggle={(p) => toggle("platforms", p)} />
      </Field>

      <Field label="Item (produk / menu / servis)" error={fe.itemIds} hint="Campaign lain yang bertindih tarikh dengan item atau outlet yang sama akan ditunjuk sebagai amaran.">
        {options.items.length === 0 ? (
          <p className="text-sm text-muted">Belum ada item. Admin boleh tambah di Tetapan &gt; Katalog Item.</p>
        ) : (
          <div className="space-y-2">
            {kinds.map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-medium text-muted">{k}</p>
                <ChipGroup options={options.items.filter((i) => i.kind === k).map((i) => ({ value: i.id, label: i.name }))} selected={v.itemIds} onToggle={(id) => toggle("itemIds", id)} />
              </div>
            ))}
          </div>
        )}
      </Field>

      <Field label="Outlet" error={fe.outletIds}>
        {options.outlets.length === 0 ? (
          <p className="text-sm text-muted">Belum ada outlet. Admin boleh tambah di Tetapan &gt; Outlet.</p>
        ) : (
          <ChipGroup options={options.outlets.map((o) => ({ value: o.id, label: o.name }))} selected={v.outletIds} onToggle={(id) => toggle("outletIds", id)} />
        )}
      </Field>

      <Field id="f-budget" label="Anggaran bajet (RM)" error={fe.plannedBudget}>
        <input id="f-budget" className="input max-w-60 tabular-nums" inputMode="decimal" placeholder="0" value={v.plannedBudget} onChange={(e) => set("plannedBudget", e.target.value)} />
      </Field>

      <Field id="f-objective" label="Objektif" error={fe.objective}>
        <textarea id="f-objective" className="input min-h-20" value={v.objective} onChange={(e) => set("objective", e.target.value)} maxLength={1000} />
      </Field>

      <Field id="f-notes" label="Nota" error={fe.notes}>
        <textarea id="f-notes" className="input min-h-20" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
      </Field>

      <ErrorNotice error={error} />

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => router.back()} disabled={busy}>Batal</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {mode === "create" ? "Simpan sebagai Idea" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}

function Field({ id, label, error, hint, children }: { id?: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {id ? <label className="label" htmlFor={id}>{label}</label> : <p className="label">{label}</p>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function ChipGroup({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ value: o, label }) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
