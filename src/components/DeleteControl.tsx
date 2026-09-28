"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Send, Trash2, X } from "lucide-react";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "./ErrorNotice";

type Props = {
  /** Contoh: campaign "Nasi Lemak Campaign" */
  what: string;
  /** Jika diisi, pengguna mesti taip teks ini untuk sahkan (padam terus). */
  confirmText?: string;
  /** Ikon sahaja (untuk jadual). */
  compact?: boolean;
  /** Ke mana selepas berjaya (lalai: muat semula halaman). */
  redirectTo?: string;
} & (
  | { mode: "direct"; url: string; body?: Record<string, unknown> }
  | { mode: "request"; entity: "campaign" | "expense" | "kol" | "idea" | "bank" | "content" | "asset"; entityId: string }
);

/**
 * Admin: padam terus dengan pengesahan.
 * Ahli: mohon padam dengan sebab; Admin luluskan di Admin > Permohonan padam.
 */
export function DeleteControl(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [sent, setSent] = useState(false);

  const direct = props.mode === "direct";
  const ready = direct ? !props.confirmText || typed.trim() === props.confirmText.trim() : reason.trim().length >= 5;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      if (props.mode === "direct") {
        await api(props.url, { method: "DELETE", body: props.body ?? {} });
        setOpen(false);
        if (props.redirectTo) router.push(props.redirectTo);
        router.refresh();
      } else {
        await api("/api/delete-requests", { body: { entity: props.entity, entityId: props.entityId, reason } });
        setSent(true);
      }
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const label = direct ? "Padam" : "Mohon padam";
  return (
    <>
      <button
        type="button"
        className={props.compact ? "btn-danger px-2.5 py-1.5" : "btn-danger"}
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        aria-label={`${label} ${props.what}`}
        title={label}
      >
        <Trash2 className="size-4" />
        {!props.compact && label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={() => !busy && setOpen(false)}>
          <div className="card w-full max-w-md space-y-4 p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="del-title" className="text-lg font-bold">{direct ? "Padam" : "Mohon padam"} {props.what}?</h2>
              <button type="button" className="text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label="Tutup"><X className="size-5" /></button>
            </div>

            {sent ? (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Permohonan dihantar. Rekod akan dipadam selepas Admin luluskan.</p>
            ) : direct ? (
              <>
                <p className="text-sm text-muted">Rekod akan disorok dan boleh dipulihkan dari Admin &gt; Tong sampah. Tindakan ini direkod dalam audit log.</p>
                {props.confirmText && (
                  <div>
                    <label className="label" htmlFor="del-confirm">Taip <b className="select-all">{props.confirmText}</b> untuk sahkan</label>
                    <input id="del-confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="label" htmlFor="del-reason">Sebab (dihantar kepada Admin)</label>
                <textarea id="del-reason" className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={500} />
              </div>
            )}

            <ErrorNotice error={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>{sent ? "Tutup" : "Batal"}</button>
              {!sent && (
                <button type="button" className="btn-danger" onClick={go} disabled={busy || !ready}>
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : direct ? <Trash2 className="size-4" /> : <Send className="size-4" />}
                  {direct ? "Padam" : "Hantar permohonan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
