"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle, Plus, UserPlus, X } from "lucide-react";
import { COLLAB_TYPES, type CollabType, type Kol } from "@/lib/domain/types";
import { senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

type KolOption = Pick<Kol, "id" | "name" | "accounts" | "rateSen" | "status">;

export function AssignKolForm({ campaignId, kols, defaultDueDate, platforms, members }: { campaignId: string; kols: KolOption[]; defaultDueDate: string; platforms: string[]; members: { id: string; name: string }[] | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const empty = { picId: members?.[0]?.id ?? "", kolId: "", platform: platforms[0] ?? "TikTok", collabType: "Paid post" as CollabType, fee: "", deliverables: "1 Video", postingDueDate: defaultDueDate, notes: "" };
  const [v, setV] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  const options = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^@/, "");
    return kols.filter((k) => k.status !== "Blacklist" && (!s || k.name.toLowerCase().includes(s) || k.accounts.some((a) => a.username.toLowerCase().includes(s))));
  }, [kols, q]);

  function pick(id: string) {
    const k = kols.find((x) => x.id === id);
    setV((s) => ({ ...s, kolId: id, platform: k?.accounts[0]?.platform ?? s.platform, fee: k && !s.fee ? senToInput(k.rateSen) : s.fee }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/campaign-kols", { body: { ...v, picId: members ? v.picId || null : null, campaignId } });
      setOpen(false);
      setV(empty);
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Tambah KOL ke campaign
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-brand-50/40 p-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        {members && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="a-pic">PIC (fee ditolak dari bajet person ini)</label>
            <select id="a-pic" className="input max-w-sm" value={v.picId} onChange={(e) => setV({ ...v, picId: e.target.value })}>
              {members.length === 0 && <option value="">Tiada ahli dalam team</option>}
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {fe.picId && <p className="field-error">{fe.picId}</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="a-q">Cari KOL</label>
          <input id="a-q" className="input" placeholder="Nama atau @username" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="a-kol">KOL</label>
          <select id="a-kol" className="input" value={v.kolId} onChange={(e) => pick(e.target.value)}>
            <option value="">Pilih KOL ({options.length})</option>
            {options.map((k) => (
              <option key={k.id} value={k.id}>{k.name} {k.accounts[0] ? `(@${k.accounts[0].username})` : ""}</option>
            ))}
          </select>
          {fe.kolId && <p className="field-error">{fe.kolId}</p>}
        </div>
        <div>
          <label className="label" htmlFor="a-plat">Platform</label>
          <select id="a-plat" className="input" value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })}>
            {[...new Set([...platforms, v.platform])].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-collab">Jenis kerjasama</label>
          <select id="a-collab" className="input" value={v.collabType} onChange={(e) => {
            const collabType = e.target.value as CollabType;
            setV({ ...v, collabType, fee: collabType === "Barter" ? "0" : v.fee });
          }}>
            {COLLAB_TYPES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">Outlet, alamat penghantaran dan barang yang diberi diisi selepas ini.</p>
        </div>
        <div>
          <label className="label" htmlFor="a-fee">Fee dipersetujui (RM)</label>
          <input id="a-fee" className="input tabular-nums" inputMode="decimal" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} />
          {fe.fee && <p className="field-error">{fe.fee}</p>}
        </div>
        <div>
          <label className="label" htmlFor="a-del">Deliverable</label>
          <input id="a-del" className="input" placeholder="1 Video, 2 Story" value={v.deliverables} onChange={(e) => setV({ ...v, deliverables: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="a-due">Tarikh posting dijanjikan</label>
          <input id="a-due" type="date" className="input" value={v.postingDueDate} onChange={(e) => setV({ ...v, postingDueDate: e.target.value })} />
          {fe.postingDueDate && <p className="field-error">{fe.postingDueDate}</p>}
        </div>
      </div>
      <ErrorNotice error={error && !fe.kolId && !fe.fee && !fe.picId ? error : null} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy || !v.kolId}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah
        </button>
      </div>
    </form>
  );
}
