"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

type Act = { action: string; label: string; noteRequired?: boolean; needsUrl?: boolean; danger?: boolean };

/** Butang pipeline (content atau asset). Buka borang kecil bila perlu nota atau URL. */
export function PipelineActions({ endpoint, version, actions }: { endpoint: string; version: number; actions: Act[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Act | null>(null);
  const [note, setNote] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function run(a: Act) {
    setBusy(a.action);
    setError(null);
    try {
      await api(endpoint, { body: { action: a.action, note, ...(a.needsUrl ? { postUrl } : {}), version } });
      setOpen(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }
  if (actions.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.action} className={a.danger ? "btn-danger" : a.action === "archive" ? "btn-secondary" : "btn-primary"} disabled={busy !== null}
            onClick={() => (a.noteRequired || a.needsUrl ? setOpen(a) : run(a))}>
            {busy === a.action ? <LoaderCircle className="size-4 animate-spin" /> : <CircleCheck className="size-4" />} {a.label}
          </button>
        ))}
      </div>
      {open && (
        <div className="card space-y-3 p-4">
          <p className="font-semibold">{open.label}</p>
          {open.needsUrl && (
            <div><label className="label" htmlFor="pa-url">URL posting</label>
              <input id="pa-url" className="input" placeholder="https://www.tiktok.com/@.../video/..." value={postUrl} onChange={(e) => setPostUrl(e.target.value.trim())} autoFocus /></div>
          )}
          {open.noteRequired && (
            <div><label className="label" htmlFor="pa-note">Apa yang perlu diubah</label>
              <textarea id="pa-note" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setOpen(null)}>Batal</button>
            <button className="btn-primary" onClick={() => run(open)} disabled={busy !== null}>{busy && <LoaderCircle className="size-4 animate-spin" />} Sahkan</button>
          </div>
        </div>
      )}
      <ErrorNotice error={error} />
    </div>
  );
}
