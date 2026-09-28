"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Check, LoaderCircle, Megaphone, MessageCircle, RotateCcw, Send, ThumbsUp, X } from "lucide-react";
import { FUNNELS, type Idea, type IdeaComment } from "@/lib/domain/types";
import { formatDateTimeMs, todayMYT } from "@/lib/domain/dates";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

export function VoteButton({ ideaId, count, voted }: { ideaId: string; count: number; voted: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ count, voted });
  const [busy, setBusy] = useState(false);
  async function go(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    // Paparan terus berubah; server sahkan
    setState((s) => ({ voted: !s.voted, count: s.count + (s.voted ? -1 : 1) }));
    try {
      const r = await api<{ voted: boolean; count: number }>(`/api/ideas/${ideaId}/vote`, { body: {} });
      setState(r);
      router.refresh();
    } catch {
      setState({ count, voted });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={go} disabled={busy} aria-pressed={state.voted} title={state.voted ? "Buang vote" : "Vote idea ini"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold transition-colors ${state.voted ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white text-ink hover:bg-brand-50"}`}>
      <ThumbsUp className="size-3.5" aria-hidden /> {state.count}
    </button>
  );
}

export function Comments({ ideaId, comments }: { ideaId: string; comments: IdeaComment[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/ideas/${ideaId}/comments`, { body: { text } });
      setText("");
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {comments.length === 0 && <p className="text-sm text-muted">Belum ada komen. Jadi yang pertama beri pendapat.</p>}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{c.userName.slice(0, 1)}</span>
            <div className="min-w-0 flex-1 rounded-xl bg-brand-50/60 px-3 py-2">
              <p className="text-xs"><b>{c.userName}</b> <span className="text-muted">· {formatDateTimeMs(c.createdAt)}</span></p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="flex gap-2">
        <input className="input flex-1" placeholder="Tulis komen" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label="Komen" />
        <button className="btn-primary" disabled={busy || !text.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Hantar</button>
      </form>
      <ErrorNotice error={error} />
    </div>
  );
}

/** Admin: lulus / tolak / buka semula. */
export function IdeaReview({ idea }: { idea: Idea }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  async function go(action: "approve" | "reject" | "reopen") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/ideas/${idea.id}/review`, { body: { action, note, version: idea.version } });
      setNote("");
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(null);
    }
  }
  const open = idea.status === "New" || idea.status === "Discussing";
  if (!open && idea.status !== "Rejected") return null;
  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm font-semibold">Semakan Admin</p>
      {open ? (
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-sm flex-1" placeholder="Nota (wajib jika tolak)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary" onClick={() => go("approve")} disabled={busy !== null}>{busy === "approve" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Luluskan</button>
          <button className="btn-danger" onClick={() => go("reject")} disabled={busy !== null}><X className="size-4" /> Tolak</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => go("reopen")} disabled={busy !== null}><RotateCcw className="size-4" /> Buka semula untuk perbincangan</button>
      )}
      <ErrorNotice error={error} />
    </div>
  );
}

/** Selepas diluluskan: masuk Content Bank atau jadikan draf campaign. */
export function IdeaConvert({ idea, contentTypes, campaignTypes, teams, defaultTeamId }: { idea: Idea; contentTypes: string[]; campaignTypes: string[]; teams: { id: string; name: string }[]; defaultTeamId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"bank" | "campaign" | null>(null);
  const [bank, setBank] = useState({ contentType: contentTypes[0] ?? "", funnel: "Awareness", audience: "" });
  const today = todayMYT();
  const [camp, setCamp] = useState({ teamId: defaultTeamId, name: idea.title, type: campaignTypes[0] ?? "", startDate: today, endDate: today });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function go() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "bank") {
        const r = await api<{ id: string }>(`/api/ideas/${idea.id}/to-bank`, { body: bank });
        router.push(`/content-bank/${r.id}`);
      } else {
        const r = await api<{ id: string }>(`/api/ideas/${idea.id}/to-campaign`, { body: camp });
        router.push(`/campaigns/${r.id}`);
      }
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm font-semibold">Langkah seterusnya</p>
      <div className="flex flex-wrap gap-2">
        {!idea.linkedBankId && <button className={mode === "bank" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("bank")}><Archive className="size-4" /> Masuk Content Bank</button>}
        {!idea.linkedCampaignId && <button className={mode === "campaign" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("campaign")}><Megaphone className="size-4" /> Jadikan campaign</button>}
      </div>
      {mode === "bank" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="c-ct">Jenis content</label>
            <select id="c-ct" className="input" value={bank.contentType} onChange={(e) => setBank({ ...bank, contentType: e.target.value })}>{contentTypes.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label" htmlFor="c-fn">Funnel</label>
            <select id="c-fn" className="input" value={bank.funnel} onChange={(e) => setBank({ ...bank, funnel: e.target.value })}>{FUNNELS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label" htmlFor="c-au">Target audience</label>
            <input id="c-au" className="input" placeholder="Ibu bekerja, pelajar..." value={bank.audience} onChange={(e) => setBank({ ...bank, audience: e.target.value })} /></div>
        </div>
      )}
      {mode === "campaign" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="c-nm">Nama campaign</label>
            <input id="c-nm" className="input" value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} />{fe.name && <p className="field-error">{fe.name}</p>}</div>
          <div><label className="label" htmlFor="c-tm">Team</label>
            <select id="c-tm" className="input" value={camp.teamId} onChange={(e) => setCamp({ ...camp, teamId: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div><label className="label" htmlFor="c-ty">Jenis</label>
            <select id="c-ty" className="input" value={camp.type} onChange={(e) => setCamp({ ...camp, type: e.target.value })}>{campaignTypes.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label" htmlFor="c-sd">Tarikh mula</label><input id="c-sd" type="date" className="input" value={camp.startDate} onChange={(e) => setCamp({ ...camp, startDate: e.target.value })} /></div>
          <div><label className="label" htmlFor="c-ed">Tarikh tamat</label><input id="c-ed" type="date" className="input" value={camp.endDate} min={camp.startDate} onChange={(e) => setCamp({ ...camp, endDate: e.target.value })} />{fe.endDate && <p className="field-error">{fe.endDate}</p>}</div>
          <p className="text-xs text-muted sm:col-span-2">Campaign dicipta sebagai draf (Idea) dalam Marketing Calendar. Lengkapkan butiran dan hantar untuk kelulusan di sana.</p>
        </div>
      )}
      {mode && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={go} disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Sahkan</button>
        </div>
      )}
      <ErrorNotice error={error && !fe.name && !fe.endDate ? error : null} />
    </div>
  );
}

export function CommentCount({ n }: { n: number }) {
  return <span className="inline-flex items-center gap-1 text-sm text-muted"><MessageCircle className="size-3.5" aria-hidden /> {n}</span>;
}
