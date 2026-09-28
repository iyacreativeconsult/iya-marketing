import { Check, Circle } from "lucide-react";
import type { KolChecklist } from "@/lib/domain/types";

const ITEMS: [keyof KolChecklist, string][] = [
  ["briefSent", "Brief"],
  ["productSent", "Produk"],
  ["contentReceived", "Content"],
  ["contentApproved", "Lulus"],
  ["posted", "Posting"],
];

export function Checklist({ c, compact }: { c: KolChecklist; compact?: boolean }) {
  return (
    <ul className={`flex flex-wrap ${compact ? "gap-1" : "gap-2"}`}>
      {ITEMS.map(([k, label]) => (
        <li
          key={k}
          title={label}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${c[k] ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-500"}`}
        >
          {c[k] ? <Check className="size-3" aria-hidden /> : <Circle className="size-3" aria-hidden />}
          {label}
        </li>
      ))}
    </ul>
  );
}
