"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CalendarCheck, Check, Flag, LoaderCircle, Pencil, Play, Send, Undo2, type LucideIcon } from "lucide-react";
import { DeleteControl } from "./DeleteControl";
import type { CampaignAction } from "@/lib/domain/campaign";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "./ErrorNotice";

const ICONS: Record<CampaignAction, LucideIcon> = {
  submit: Send,
  withdraw: Undo2,
  approve: Check,
  request_changes: Undo2,
  schedule: CalendarCheck,
  start: Play,
  complete: Flag,
  cancel: Ban,
};

interface Props {
  campaignId: string;
  version: number;
  actions: { action: CampaignAction; label: string; noteRequired: boolean }[];
  canEdit: boolean;
  canDelete: boolean;
  canRequestDelete: boolean;
  name: string;
}

export function CampaignActions({ campaignId, version, actions, canEdit, canDelete, canRequestDelete, name }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [noteFor, setNoteFor] = useState<{ action: CampaignAction; label: string } | null>(null);
  const [note, setNote] = useState("");

  if (!canEdit && !canDelete && !canRequestDelete && actions.length === 0) return null;

  async function run(action: CampaignAction, withNote = "") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/campaigns/${campaignId}/transition`, { body: { action, note: withNote, version } });
      setNoteFor(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map(({ action, label, noteRequired }) => {
          const Icon = ICONS[action];
          const primary = action === "approve" || action === "submit" || action === "schedule";
          const danger = action === "cancel";
          return (
            <button
              key={action}
              className={primary ? "btn-primary" : danger ? "btn-danger" : "btn-secondary"}
              disabled={busy !== null}
              onClick={() => (noteRequired ? setNoteFor({ action, label }) : run(action))}
            >
              {busy === action ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
              {label}
            </button>
          );
        })}
        {canEdit && (
          <Link href={`/campaigns/${campaignId}/edit`} className="btn-secondary">
            <Pencil className="size-4" /> Ubah
          </Link>
        )}
        {canDelete && <DeleteControl mode="direct" what={`campaign "${name}"`} confirmText={name} url={`/api/campaigns/${campaignId}`} body={{ version }} redirectTo="/campaigns" />}
        {canRequestDelete && <DeleteControl mode="request" what={`campaign "${name}"`} entity="campaign" entityId={campaignId} />}
      </div>

      {noteFor && (
        <div className="card space-y-3 p-4">
          <label className="label" htmlFor="action-note">{noteFor.label}: nyatakan sebab</label>
          <textarea id="action-note" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} autoFocus />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setNoteFor(null)} disabled={busy !== null}>Batal</button>
            <button className="btn-primary" onClick={() => run(noteFor.action, note)} disabled={busy !== null || note.trim().length < 3}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              Sahkan
            </button>
          </div>
        </div>
      )}

      <ErrorNotice error={error} />
    </div>
  );
}
