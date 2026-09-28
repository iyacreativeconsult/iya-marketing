"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Save, X } from "lucide-react";
import type { MasterKey } from "@/lib/domain/master";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "../ErrorNotice";

/** Edit satu senarai Tetapan. Membuang pilihan tidak mengubah rekod lama yang sudah menggunakannya. */
export function MasterListEditor({ listKey, title, hint, items }: { listKey: MasterKey; title: string; hint: string; items: string[] }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const dirty = JSON.stringify(list) !== JSON.stringify(items);

  const add = () => {
    const v = draft.trim();
    if (v && !list.includes(v)) setList([...list, v]);
    setDraft("");
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/settings/master", { method: "PUT", body: { key: listKey, items: list } });
      router.refresh();
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {list.map((v, i) => (
          <li key={v} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pr-1 pl-3 text-sm">
            {v}
            <button type="button" onClick={() => move(i, -1)} className="rounded p-0.5 text-muted hover:text-ink" aria-label={`Naik ${v}`}><ArrowUp className="size-3" /></button>
            <button type="button" onClick={() => move(i, 1)} className="rounded p-0.5 text-muted hover:text-ink" aria-label={`Turun ${v}`}><ArrowDown className="size-3" /></button>
            <button type="button" onClick={() => setList(list.filter((x) => x !== v))} className="rounded p-0.5 text-muted hover:text-red-700" aria-label={`Buang ${v}`}><X className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="Tambah pilihan"
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          aria-label={`Tambah ke ${title}`}
        />
        <button type="button" className="btn-secondary" onClick={add} disabled={!draft.trim()}><Plus className="size-4" /> Tambah</button>
        <button type="button" className="btn-primary ml-auto" onClick={save} disabled={busy || !dirty}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </button>
      </div>
      <ErrorNotice error={error} />
    </section>
  );
}
