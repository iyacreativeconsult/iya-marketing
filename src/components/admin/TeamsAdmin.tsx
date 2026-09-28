"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Plus, Save } from "lucide-react";
import type { Team } from "@/lib/domain/types";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { DeleteControl } from "../DeleteControl";

export function TeamsAdmin({ teams }: { teams: Team[] }) {
  return (
    <div className="space-y-3">
      {teams.map((t) => (
        <TeamRow key={t.id} team={t} />
      ))}
      <TeamRow />
    </div>
  );
}

function TeamRow({ team }: { team?: Team }) {
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? "#EC5A7E");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const dirty = !team || name !== team.name || color.toLowerCase() !== team.color.toLowerCase();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (team) await api(`/api/teams/${team.id}`, { method: "PATCH", body: { name, color } });
      else {
        await api("/api/teams", { body: { name, color } });
        setName("");
      }
      router.refresh();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white" aria-label="Warna team" />
        <input className="input flex-1" placeholder={team ? "" : "Nama team baru"} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama team" />
        {team && <span className="font-mono text-xs text-muted">{team.id}</span>}
        {team && <DeleteControl compact mode="direct" what={`team "${team.name}"`} confirmText={team.name} url={`/api/teams/${team.id}`} />}
        <button className={team ? "btn-secondary" : "btn-primary"} disabled={busy || !dirty || name.trim().length < 2}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : team ? <Save className="size-4" /> : <Plus className="size-4" />}
          {team ? "Simpan" : "Tambah team"}
        </button>
      </div>
      <ErrorNotice error={error} />
    </form>
  );
}
