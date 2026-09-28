"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArchiveRestore, LoaderCircle } from "lucide-react";
import { api, toApiError } from "@/lib/client/api";

export function RestoreButton({ entity, id }: { entity: string; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className="btn-secondary px-3 py-1.5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/api/trash/restore", { body: { entity, id } });
            router.refresh();
          } catch (e) {
            const x = toApiError(e);
            setError(x.requestId ? `${x.message} (${x.requestId})` : x.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArchiveRestore className="size-4" />} Pulihkan
      </button>
      {error && <span className="max-w-xs text-xs text-red-700">{error}</span>}
    </span>
  );
}
