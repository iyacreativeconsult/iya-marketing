import Link from "next/link";
import { CalendarClock, CircleCheck, Clapperboard, Eye } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listContent } from "@/lib/server/services/content";
import { listTeams } from "@/lib/server/services/teams";
import { productionOptions } from "@/lib/server/services/contentOptions";
import { CONTENT_STATUS_CLS } from "@/lib/domain/content";
import { CONTENT_STATUSES, type ContentStatus } from "@/lib/domain/types";
import { diffDays, formatDateMs, todayMYT } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ContentForm } from "@/components/content/ContentForm";

export const metadata = { title: "Produksi content" };

const BOARD: ContentStatus[] = CONTENT_STATUSES.filter((s) => s !== "Archived");

export default async function ContentBoardPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requirePageUser();
  const { archived } = await searchParams;
  const scope = user.activeTeamId;
  const [all, teams, options] = await Promise.all([listContent(scope), listTeams(), productionOptions(user)]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const today = todayMYT();
  const cols = archived ? (["Archived"] as ContentStatus[]) : BOARD;
  const week = all.filter((c) => c.publishDate && c.publishDate >= today && diffDays(today, c.publishDate) <= 7 && c.status !== "Published" && c.status !== "Archived");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Produksi content"
        description={scope === "all" ? "Semua team. Setiap kad bergerak dari Idea hingga Published." : `${teamName.get(scope ?? "") ?? ""}. Tukar Sesi Aktif untuk team lain.`}
        actions={<Link href={archived ? "/content" : "/content?archived=1"} className="btn-secondary">{archived ? "Papan produksi" : "Lihat arkib"}</Link>}
      />
      <ContentForm options={options} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clapperboard} label="Dalam produksi" value={all.filter((c) => ["Idea", "Script", "Production", "Editing"].includes(c.status)).length} />
        <StatCard icon={Eye} label="Menunggu semakan" value={all.filter((c) => c.status === "Review").length} tone="amber" />
        <StatCard icon={CalendarClock} label="Publish 7 hari ini" value={week.length} />
        <StatCard icon={CircleCheck} label="Published" value={all.filter((c) => c.status === "Published").length} tone="green" />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {cols.map((s) => {
            const list = all.filter((c) => c.status === s);
            return (
              <section key={s} className="w-64 shrink-0 rounded-2xl border border-line bg-white/60">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTENT_STATUS_CLS[s]}`}>{s}</span>
                  <span className="text-xs font-semibold text-muted">{list.length}</span>
                </div>
                <ul className="max-h-[60vh] space-y-2 overflow-y-auto p-2">
                  {list.length === 0 && <li className="px-1 py-4 text-center text-xs text-muted/70">Kosong</li>}
                  {list.map((c) => {
                    const late = c.publishDate && c.publishDate < today && !["Published", "Archived"].includes(c.status);
                    return (
                      <li key={c.id}>
                        <Link href={`/content/${c.id}`} className="block rounded-xl border border-line bg-white p-3 text-sm hover:border-brand-300">
                          <p className="font-semibold leading-snug">{c.title}</p>
                          <p className="mt-1 text-xs text-muted">{[c.platform, c.contentType].filter(Boolean).join(" · ") || "-"}</p>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="truncate text-muted">{c.ownerName}{scope === "all" ? ` · ${teamName.get(c.teamId) ?? ""}` : ""}</span>
                            {c.publishDate && <span className={`shrink-0 ${late ? "font-semibold text-red-700" : "text-muted"}`}>{formatDateMs(c.publishDate)}</span>}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
