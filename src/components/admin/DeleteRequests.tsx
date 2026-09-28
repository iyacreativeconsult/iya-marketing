"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import type { DeleteRequest } from "@/lib/domain/types";
import { formatDateTimeMs } from "@/lib/domain/dates";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

const LABEL = { campaign: "Campaign", expense: "Perbelanjaan", kol: "Profil KOL", idea: "Idea", bank: "Content Bank", content: "Content", asset: "Asset" } as const;
const STATUS = { Pending: ["Menunggu", "bg-amber-50 text-amber-800"], Approved: ["Dipadam", "bg-stone-100 text-stone-700"], Rejected: ["Ditolak", "bg-red-50 text-red-700"] } as const;

export function DeleteRequestList({ requests, teamNames, empty }: { requests: DeleteRequest[]; teamNames: Record<string, string>; empty: string }) {
  if (requests.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return <ul className="divide-y divide-line">{requests.map((r) => <Row key={r.id} r={r} teamName={teamNames[r.teamId]} />)}</ul>;
}

function Row({ r, teamName }: { r: DeleteRequest; teamName?: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function review(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/delete-requests/${r.id}/review`, { body: { action, note, version: r.version } });
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }
  const [label, style] = STATUS[r.status];
  const href = r.entity === "campaign" ? `/campaigns/${r.entityId}` : r.entity === "kol" ? `/kol/${r.entityId}` : r.entity === "idea" ? `/ideas/${r.entityId}` : r.entity === "bank" ? `/content-bank/${r.entityId}` : r.entity === "content" ? `/content/${r.entityId}` : r.entity === "asset" ? `/content/library/${r.entityId}` : null;

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{LABEL[r.entity]}</span>
        {href && r.status === "Pending" ? <a href={href} className="font-semibold hover:text-brand-600">{r.entityName}</a> : <span className="font-semibold">{r.entityName}</span>}
        {teamName && <span className="text-sm text-muted">{teamName}</span>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{label}</span>
        <span className="ml-auto text-xs text-muted">{r.requestedByName} · {formatDateTimeMs(r.createdAt)}</span>
      </div>
      <p className="text-sm">Sebab: {r.reason}</p>
      {r.reviewNote && <p className="text-xs text-muted">Admin ({r.reviewedByName}): {r.reviewNote}</p>}
      {r.status === "Pending" && (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-sm flex-1 py-1.5" placeholder="Nota (wajib jika tolak)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-danger px-3 py-1.5" onClick={() => review("approve")} disabled={busy !== null}>
            {busy === "approve" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Lulus & padam
          </button>
          <button className="btn-secondary px-3 py-1.5" onClick={() => review("reject")} disabled={busy !== null}>Tolak</button>
        </div>
      )}
      <ErrorNotice error={error} />
    </li>
  );
}
