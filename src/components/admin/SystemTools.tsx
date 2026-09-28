"use client";

import { useState } from "react";
import { Activity, LoaderCircle, RefreshCw } from "lucide-react";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

/** Alat troubleshooting untuk Admin: semak kesihatan sistem dan jalankan tugas status secara manual. */
export function SystemTools() {
  const [busy, setBusy] = useState<"health" | "job" | null>(null);
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function go(kind: "health" | "job") {
    setBusy(kind);
    setError(null);
    setOutput(null);
    try {
      const data = kind === "health" ? await api("/api/health") : await api("/api/cron/campaign-status", { method: "POST", body: {} });
      setOutput(data);
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => go("health")} disabled={busy !== null}>
          {busy === "health" ? <LoaderCircle className="size-4 animate-spin" /> : <Activity className="size-4" />}
          Semak kesihatan sistem
        </button>
        <button className="btn-secondary" onClick={() => go("job")} disabled={busy !== null}>
          {busy === "job" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Jalankan kemas kini status campaign
        </button>
      </div>
      <ErrorNotice error={error} />
      {output !== null && <pre className="overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs">{JSON.stringify(output, null, 2)}</pre>}
    </div>
  );
}
