"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * Dipapar bila halaman gagal dimuat (contoh: index Firestore belum dibuat).
 * "digest" ialah kod yang sama dicetak dalam log server, jadi mudah dicari.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <TriangleAlert className="mx-auto size-8 text-brand-500" aria-hidden />
      <h1 className="mt-3 text-lg font-bold">Halaman ini gagal dimuatkan</h1>
      <p className="mt-2 text-sm text-muted">Cuba lagi. Jika masih berlaku, beri kod rujukan di bawah kepada Admin sistem.</p>
      {error.digest && (
        <p className="mt-4 text-sm">
          Kod rujukan: <span className="font-mono select-all">{error.digest}</span>
        </p>
      )}
      <button className="btn-primary mt-6" onClick={reset}>
        <RefreshCw className="size-4" /> Cuba lagi
      </button>
    </div>
  );
}
