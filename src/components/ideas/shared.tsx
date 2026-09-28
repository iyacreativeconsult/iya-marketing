"use client";

/** Pilihan cip (boleh pilih banyak). */
export function Chips({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onToggle(o.value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:bg-brand-50"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
export const linesToUrls = (s: string) => s.split(/\s+/).map((x) => x.trim()).filter(Boolean);

export interface ContentOptions {
  ideaTypes: string[];
  contentTypes: string[];
  platforms: string[];
  items: { id: string; name: string }[];
}
