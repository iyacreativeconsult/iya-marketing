"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LoaderCircle, Pencil, Plus, Save, X } from "lucide-react";
import type { Role, Team } from "@/lib/domain/types";
import { formatDateTimeMs } from "@/lib/domain/dates";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";
import { DeleteControl } from "../DeleteControl";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamIds: string[];
  active: boolean;
  lastLoginAt: string | null;
}

export function UsersAdmin({ users, teams, meId }: { users: UserRow[]; teams: Team[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      {adding ? (
        <CreateUserForm teams={teams} onDone={() => setAdding(false)} />
      ) : (
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Tambah pengguna
        </button>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead>
            <tr><th>Nama</th><th>Peranan</th><th>Team</th><th>Status</th><th>Log masuk terakhir</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) =>
              editing === u.id ? (
                <tr key={u.id}>
                  <td colSpan={6} className="bg-brand-50/50">
                    <EditUserForm user={u} teams={teams} isMe={u.id === meId} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td>
                    <p className="font-semibold">{u.name}{u.id === meId && <span className="ml-1 text-xs font-normal text-muted">(anda)</span>}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td>{u.role === "admin" ? "Admin" : "Ahli"}</td>
                  <td className="text-sm">{u.teamIds.map(teamName).join(", ") || "-"}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                      {u.active ? "Aktif" : "Tidak aktif"}
                    </span>
                  </td>
                  <td className="text-sm whitespace-nowrap">{formatDateTimeMs(u.lastLoginAt)}</td>
                  <td className="text-right">
                    <button className="btn-secondary px-2.5" onClick={() => setEditing(u.id)} aria-label={`Ubah ${u.name}`}>
                      <Pencil className="size-4" />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamChecks({ teams, value, onChange }: { teams: Team[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((t) => {
        const on = value.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
            className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

function CreateUserForm({ teams, onDone }: { teams: Team[]; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", password: "", role: "member" as Role, teamIds: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/users", { body: v });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h2 className="font-semibold">Pengguna baru</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="u-name">Nama</label>
          <input id="u-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          {fe.name && <p className="field-error">{fe.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="u-email">Email</label>
          <input id="u-email" type="email" className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="off" />
          {fe.email && <p className="field-error">{fe.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="u-pass">Kata laluan sementara</label>
          <input id="u-pass" type="text" className="input font-mono" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" />
          {fe.password ? <p className="field-error">{fe.password}</p> : <p className="mt-1 text-xs text-muted">Minimum 10 aksara, ada huruf dan nombor. Beri kepada pengguna secara peribadi.</p>}
        </div>
        <div>
          <label className="label" htmlFor="u-role">Peranan</label>
          <select id="u-role" className="input" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
            <option value="member">Ahli Team</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div>
        <p className="label">Team</p>
        <TeamChecks teams={teams} value={v.teamIds} onChange={(teamIds) => setV({ ...v, teamIds })} />
        {fe.teamIds && <p className="field-error">{fe.teamIds}</p>}
      </div>
      <ErrorNotice error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}>Batal</button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Cipta akaun
        </button>
      </div>
    </form>
  );
}

function EditUserForm({ user, teams, isMe, onDone }: { user: UserRow; teams: Team[]; isMe: boolean; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: user.name, role: user.role, teamIds: user.teamIds, active: user.active });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = error?.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: password ? { ...v, password } : v });
      router.refresh();
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 py-2" noValidate>
      <p className="text-sm text-muted">{user.email}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`n-${user.id}`}>Nama</label>
          <input id={`n-${user.id}`} className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          {fe.name && <p className="field-error">{fe.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor={`r-${user.id}`}>Peranan</label>
          <select id={`r-${user.id}`} className="input" value={v.role} disabled={isMe} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
            <option value="member">Ahli Team</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`p-${user.id}`}>
            <KeyRound className="mr-1 inline size-3.5" aria-hidden />Set semula kata laluan
          </label>
          <input id={`p-${user.id}`} className="input font-mono" placeholder="Kosongkan jika tiada perubahan" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          {fe.password && <p className="field-error">{fe.password}</p>}
        </div>
      </div>
      <div>
        <p className="label">Team</p>
        <TeamChecks teams={teams} value={v.teamIds} onChange={(teamIds) => setV({ ...v, teamIds })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.active} disabled={isMe} onChange={(e) => setV({ ...v, active: e.target.checked })} className="size-4 accent-brand-500" />
        Akaun aktif (nyahtanda untuk sekat log masuk serta-merta)
      </label>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap justify-end gap-2">
        {!isMe && (
          <span className="mr-auto">
            <DeleteControl mode="direct" what={`pengguna ${user.name}`} confirmText={user.email} url={`/api/users/${user.id}`} />
          </span>
        )}
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}><X className="size-4" /> Batal</button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </button>
      </div>
    </form>
  );
}
