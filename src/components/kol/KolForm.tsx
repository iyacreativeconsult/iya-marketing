"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { KOL_STATUSES, type Kol, type Team } from "@/lib/domain/types";
import { senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

const PROFILE_URL: Record<string, (u: string) => string> = {
  TikTok: (u) => `https://www.tiktok.com/@${u}`,
  Instagram: (u) => `https://www.instagram.com/${u}`,
  Facebook: (u) => `https://www.facebook.com/${u}`,
  YouTube: (u) => `https://www.youtube.com/@${u}`,
  X: (u) => `https://x.com/${u}`,
  Threads: (u) => `https://www.threads.net/@${u}`,
  Lemon8: (u) => `https://www.lemon8-app.com/@${u}`,
};
const autoUrl = (platform: string, u: string) => (u ? PROFILE_URL[platform]?.(u) ?? "" : "");

type Acc = { platform: string; username: string; url: string; followers: string };

interface Props {
  kol?: Kol;
  teams: Team[];
  isAdmin: boolean;
  defaultTeamId: string;
  platforms: string[];
  niches: string[];
}

export function KolForm({ kol, teams, isAdmin, defaultTeamId, platforms, niches }: Props) {
  const router = useRouter();
  const [v, setV] = useState({
    name: kol?.name ?? "",
    realName: kol?.realName ?? "",
    ownerTeamId: kol?.ownerTeamId ?? defaultTeamId,
    niches: kol?.niches ?? ([] as string[]),
    location: kol?.location ?? "",
    contact: kol?.contact ?? "",
    rate: kol ? senToInput(kol.rateSen) : "",
    status: kol?.status ?? "Aktif",
    remark: kol?.remark ?? "",
  });
  const [accounts, setAccounts] = useState<Acc[]>(
    kol?.accounts.map((a) => ({ ...a, followers: String(a.followers || "") })) ?? [{ platform: "TikTok", username: "", url: "", followers: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  const setAcc = (i: number, patch: Partial<Acc>) =>
    setAccounts((list) =>
      list.map((a, j) => {
        if (j !== i) return a;
        const next = { ...a, ...patch };
        // Isi pautan automatik bila username ditaip dan pautan masih kosong/auto
        const clean = next.username.replace(/^@+/, "").trim();
        const autoOld = autoUrl(a.platform, a.username.replace(/^@+/, "").trim());
        if ((patch.username !== undefined || patch.platform) && (a.url === "" || a.url === autoOld)) next.url = autoUrl(next.platform, clean);
        return next;
      }),
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = { ...v, accounts: accounts.map((a) => ({ ...a, followers: Number(a.followers.replace(/[^\d]/g, "")) || 0 })) };
    try {
      if (kol) {
        await api(`/api/kols/${kol.id}`, { method: "PATCH", body: { version: kol.version, data } });
        router.push(`/kol/${kol.id}`);
      } else {
        const res = await api<{ id: string }>("/api/kols", { body: data });
        router.push(`/kol/${res.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="k-name" label="Nama KOL" error={fe.name}>
          <input id="k-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field id="k-real" label="Nama sebenar" error={fe.realName}>
          <input id="k-real" className="input" value={v.realName} onChange={(e) => setV({ ...v, realName: e.target.value })} />
        </Field>
      </div>

      <div>
        <p className="label">Akaun media sosial</p>
        <div className="space-y-2">
          {accounts.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[140px_1fr_1.6fr_120px_auto]">
              <select className="input" value={a.platform} onChange={(e) => setAcc(i, { platform: e.target.value })} aria-label="Platform">
                {[...new Set([...platforms, a.platform])].map((p) => <option key={p}>{p}</option>)}
              </select>
              <input className="input" placeholder="username" value={a.username} onChange={(e) => setAcc(i, { username: e.target.value })} aria-label="Username" />
              <input className="input" placeholder="https://..." value={a.url} onChange={(e) => setAcc(i, { url: e.target.value })} aria-label="Pautan profil" />
              <input className="input" inputMode="numeric" placeholder="Followers" value={a.followers} onChange={(e) => setAcc(i, { followers: e.target.value })} aria-label="Followers" />
              <button type="button" className="btn-secondary px-2.5" onClick={() => setAccounts((l) => l.filter((_, j) => j !== i))} disabled={accounts.length === 1} aria-label="Buang akaun">
                <Trash2 className="size-4" />
              </button>
              {Object.entries(fe).filter(([k]) => k.startsWith(`accounts.${i}.`)).map(([k, m]) => (
                <p key={k} className="field-error sm:col-span-5">{m}</p>
              ))}
            </div>
          ))}
        </div>
        {fe.accounts && <p className="field-error">{fe.accounts}</p>}
        {accounts.length < 6 && (
          <button type="button" className="btn-secondary mt-2" onClick={() => setAccounts((l) => [...l, { platform: "Instagram", username: "", url: "", followers: "" }])}>
            <Plus className="size-4" /> Tambah akaun
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">

        <Field id="k-loc" label="Lokasi" error={fe.location}>
          <input id="k-loc" className="input" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
        </Field>
        <Field id="k-contact" label="Contact" error={fe.contact}>
          <input id="k-contact" className="input" placeholder="No. telefon / email / pengurus" value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} />
        </Field>
        <Field id="k-rate" label="Rate biasa (RM)" error={fe.rate}>
          <input id="k-rate" className="input tabular-nums" inputMode="decimal" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} />
        </Field>
        <Field id="k-status" label="Status" error={fe.status}>
          <select id="k-status" className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Kol["status"] })}>
            {KOL_STATUSES.filter((s) => isAdmin || s !== "Blacklist" || v.status === "Blacklist").map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field id="k-team" label="Team pemilik profil" error={fe.ownerTeamId}>
          <select id="k-team" className="input" value={v.ownerTeamId} onChange={(e) => setV({ ...v, ownerTeamId: e.target.value })} disabled={Boolean(kol) && !isAdmin}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <p className="label">Niche</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...niches, ...v.niches])].map((n) => {
            const on = v.niches.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => setV({ ...v, niches: on ? v.niches.filter((x) => x !== n) : [...v.niches, n] })}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}
              >
                {n}
              </button>
            );
          })}
        </div>
        {fe.niches && <p className="field-error">{fe.niches}</p>}
      </div>

      <Field id="k-remark" label="Catatan" error={fe.remark}>
        <textarea id="k-remark" className="input min-h-20" value={v.remark} onChange={(e) => setV({ ...v, remark: e.target.value })} />
      </Field>

      <ErrorNotice error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => router.back()} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </button>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
