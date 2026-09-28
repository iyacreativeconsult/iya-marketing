"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Paperclip, X } from "lucide-react";
import { uploadFile, toApiError, type UploadedFile } from "@/lib/client/api";

interface Props {
  teamId: string;
  purpose: "receipt" | "invoice" | "payment_proof" | "asset";
  value: UploadedFile | null;
  onChange: (f: UploadedFile | null) => void;
  label?: string;
  /** Admin: person pemilik fail (contoh PIC KOL untuk bukti bayaran). */
  ownerId?: string;
}

export function FileUpload({ teamId, purpose, value, onChange, label = "Muat naik fail", ownerId }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadFile(file, teamId, purpose, ownerId));
    } catch (e) {
      const err = toApiError(e);
      setError(err.requestId ? `${err.message} (Kod rujukan: ${err.requestId})` : err.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <Paperclip className="size-4 text-muted" aria-hidden />
          <a href={`/api/files/${value.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-brand-600 hover:underline">
            {value.name}
          </a>
          <span className="text-xs text-muted">{Math.ceil(value.size / 1024)} KB</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Buang fail" className="text-muted hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button type="button" className="btn-secondary" disabled={busy || !teamId} onClick={() => input.current?.click()}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {busy ? "Memuat naik..." : label}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <p className="mt-1 text-xs text-muted">{error ? <span className="text-red-700">{error}</span> : "JPG, PNG, WEBP atau PDF. Maksimum 4 MB."}</p>
    </div>
  );
}
