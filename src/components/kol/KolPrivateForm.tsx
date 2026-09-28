"use client";

import { useState } from "react";
import { LoaderCircle, LockKeyhole, Save } from "lucide-react";
import type { KolPrivate } from "@/lib/domain/types";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

export function KolPrivateForm({ kolId, initial }: { kolId: string; initial: KolPrivate }) {
  const [v, setV] = useState({ bankName: initial.bankName, accountNo: initial.accountNo, accountName: initial.accountName });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/api/kols/${kolId}/private`, { method: "PUT", body: v });
      setSaved(true);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <LockKeyhole className="size-3.5" aria-hidden /> Hanya Admin dan team yang menguruskan KOL ini boleh lihat.
      </p>
      <input className="input" placeholder="Nama bank" value={v.bankName} onChange={(e) => setV({ ...v, bankName: e.target.value })} aria-label="Nama bank" />
      <input className="input font-mono" placeholder="No. akaun" value={v.accountNo} onChange={(e) => setV({ ...v, accountNo: e.target.value })} aria-label="No. akaun" />
      <input className="input" placeholder="Nama pemegang akaun" value={v.accountName} onChange={(e) => setV({ ...v, accountName: e.target.value })} aria-label="Nama pemegang akaun" />
      {error?.fields.accountNo && <p className="field-error">{error.fields.accountNo}</p>}
      <ErrorNotice error={error && !error.fields.accountNo ? error : null} />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-700">Disimpan</span>}
        <button className="btn-secondary" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </button>
      </div>
    </form>
  );
}
