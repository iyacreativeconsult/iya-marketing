"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { PERF_DAYS, type PerfDay, type PerfSnapshot, type PerfTarget } from "@/lib/domain/types";
import { engagementOf } from "@/lib/domain/report";
import { addDays, formatDateMs } from "@/lib/domain/dates";
import { senToInput } from "@/lib/domain/money";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

const FIELDS: [keyof Omit<Row, "sales" | "note">, string][] = [
  ["views", "Views"],
  ["likes", "Likes"],
  ["comments", "Komen"],
  ["shares", "Share"],
  ["saves", "Save"],
  ["clicks", "Klik"],
  ["orders", "Order"],
];
type Row = { views: string; likes: string; comments: string; shares: string; saves: string; clicks: string; orders: string; sales: string; note: string };

/** Isi prestasi pada hari ke-1, ke-7 dan ke-30 selepas posting. */
export function PerformancePanel({ targetType, targetId, baseDate, snapshots, today, canEdit }: { targetType: PerfTarget; targetId: string; baseDate: string; snapshots: PerfSnapshot[]; today: string; canEdit: boolean }) {
  return (
    <div className="space-y-3">
      {!baseDate && <p className="text-sm text-muted">Tarikh posting belum ada.</p>}
      {baseDate &&
        PERF_DAYS.map((d) => (
          <DayRow key={d} day={d} due={addDays(baseDate, d)} today={today} snap={snapshots.find((s) => s.day === d) ?? null} targetType={targetType} targetId={targetId} canEdit={canEdit} />
        ))}
      <p className="text-xs text-muted">Masukkan angka dari analytics platform (TikTok Studio, Meta Business Suite, YouTube Studio). Jualan dan order jika ada kod atau pautan khas.</p>
    </div>
  );
}

function DayRow({ day, due, today, snap, targetType, targetId, canEdit }: { day: PerfDay; due: string; today: string; snap: PerfSnapshot | null; targetType: PerfTarget; targetId: string; canEdit: boolean }) {
  const router = useRouter();
  const init: Row = {
    views: String(snap?.views ?? ""), likes: String(snap?.likes ?? ""), comments: String(snap?.comments ?? ""), shares: String(snap?.shares ?? ""),
    saves: String(snap?.saves ?? ""), clicks: String(snap?.clicks ?? ""), orders: String(snap?.orders ?? ""), sales: snap ? senToInput(snap.salesSen) : "", note: snap?.note ?? "",
  };
  const [v, setV] = useState<Row>(init);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const ready = due <= today;
  const n = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/performance", {
        method: "PUT",
        body: { targetType, targetId, day, views: n(v.views), likes: n(v.likes), comments: n(v.comments), shares: n(v.shares), saves: n(v.saves), clicks: n(v.clicks), orders: n(v.orders), sales: v.sales || "0", note: v.note },
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const eng = snap ? engagementOf(snap) : 0;
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold">Hari ke-{day}</span>
        <span className="text-xs text-muted">{formatDateMs(due)}</span>
        {snap ? (
          <span className="text-sm tabular-nums">
            <b>{snap.views.toLocaleString("en-MY")}</b> views · {eng.toLocaleString("en-MY")} engagement
            {snap.views > 0 && <> · ER {Math.round((eng / snap.views) * 1000) / 10}%</>}
          </span>
        ) : ready ? (
          <span className="text-xs font-semibold text-amber-700">Belum diisi</span>
        ) : (
          <span className="text-xs text-muted">Belum tiba</span>
        )}
        {canEdit && ready && (
          <button type="button" className="btn-secondary ml-auto px-3 py-1.5" onClick={() => setOpen((o) => !o)}>{snap ? "Kemas kini" : "Isi prestasi"}</button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="text-xs text-muted">
                {label}
                <input className="input mt-1 tabular-nums" inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
              </label>
            ))}
            <label className="text-xs text-muted">
              Jualan (RM)
              <input className="input mt-1 tabular-nums" inputMode="decimal" value={v.sales} onChange={(e) => setV({ ...v, sales: e.target.value })} />
            </label>
          </div>
          <input className="input" placeholder="Nota (pilihan)" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={500} />
          <ErrorNotice error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button>
          </div>
        </form>
      )}
    </div>
  );
}
