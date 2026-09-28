import { typeColor } from "@/lib/domain/campaign";
import type { CampaignStatus, CampaignType, Team } from "@/lib/domain/types";

const STATUS_STYLE: Record<CampaignStatus, string> = {
  Idea: "bg-stone-100 text-stone-700",
  Planning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  Approved: "bg-sky-50 text-sky-800",
  Scheduled: "bg-violet-50 text-violet-800",
  Ongoing: "bg-emerald-50 text-emerald-800",
  Completed: "bg-emerald-600 text-white",
  Cancelled: "bg-red-50 text-red-700 line-through decoration-red-300",
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function TypeBadge({ type }: { type: CampaignType }) {
  const c = typeColor(type);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`size-1.5 rounded-full ${c.dot}`} />
      {type}
    </span>
  );
}

export function TeamLabel({ team, fallback }: { team?: Team; fallback?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: team?.color ?? "#ccc" }} />
      {team?.name ?? fallback ?? "-"}
    </span>
  );
}
