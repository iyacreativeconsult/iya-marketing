import Link from "next/link";
import { CircleCheck, Clapperboard, Image as ImageIcon, Lightbulb, Link2, MessagesSquare, Search } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listIdeas } from "@/lib/server/services/ideas";
import { contentOptions, nameMaps } from "@/lib/server/services/options";
import { IDEA_STATUS_INFO } from "@/lib/domain/idea";
import { IDEA_STATUSES } from "@/lib/domain/types";
import { formatDateTimeMs } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { CommentCount, VoteButton } from "@/components/ideas/IdeaInteract";

export const metadata = { title: "Idea Hub" };

type SP = { sort?: string; type?: string; status?: string; q?: string };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const [all, options, names] = await Promise.all([listIdeas(), contentOptions(), nameMaps()]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = sp.status ?? "open";
  let ideas = all.filter(
    (i) =>
      (!sp.type || sp.type === "all" || i.type === sp.type) &&
      (status === "all" || (status === "open" ? i.status !== "Rejected" : i.status === status)) &&
      (!q || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
  );
  const sort = sp.sort === "popular" ? "popular" : "new";
  if (sort === "popular") ideas = [...ideas].sort((a, b) => b.votes.length + b.commentCount - (a.votes.length + a.commentCount));
  const link = (p: Partial<SP>) => `/ideas?${new URLSearchParams(Object.entries({ sort, type: sp.type, status, q: sp.q, ...p }).filter(([, v]) => v) as [string, string][])}`;
  const count = (s: string[]) => all.filter((i) => s.includes(i.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Idea Hub" description="Kongsi idea, beri komen dan vote. Idea yang diluluskan boleh dimasukkan ke Content Bank atau dijadikan campaign." />
      <IdeaForm options={options} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Lightbulb} label="Idea baru" value={count(["New"])} />
        <StatCard icon={MessagesSquare} label="Sedang dibincang" value={count(["Discussing"])} tone="amber" />
        <StatCard icon={CircleCheck} label="Diluluskan" value={count(["Approved"])} tone="green" />
        <StatCard icon={Clapperboard} label="Dalam produksi / published" value={count(["In Production", "Published"])} />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex gap-2">
          <Link href={link({ sort: "new" })} className={sort === "new" ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"}>Terbaru</Link>
          <Link href={link({ sort: "popular" })} className={sort === "popular" ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"}>Popular</Link>
        </div>
        <form method="get" className="flex flex-1 flex-wrap gap-2">
          <input type="hidden" name="sort" value={sort} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari idea" className="input max-w-xs" aria-label="Cari" />
          <select name="type" defaultValue={sp.type ?? "all"} className="input max-w-48" aria-label="Jenis">
            <option value="all">Semua jenis</option>
            {options.ideaTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select name="status" defaultValue={status} className="input max-w-48" aria-label="Status">
            <option value="open">Semua kecuali ditolak</option>
            <option value="all">Semua status</option>
            {IDEA_STATUSES.map((s) => <option key={s} value={s}>{IDEA_STATUS_INFO[s].label}</option>)}
          </select>
          <button className="btn-secondary"><Search className="size-4" /> Tapis</button>
        </form>
      </div>

      {ideas.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">Tiada idea lagi. Kongsi idea pertama anda.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ideas.map((i) => (
            <Link key={i.id} href={`/ideas/${i.id}`} className="card flex flex-col gap-3 overflow-hidden p-4 transition-colors hover:border-brand-300">
              {i.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${i.images[0].id}`} alt="" className="-mx-4 -mt-4 aspect-[16/9] w-[calc(100%+2rem)] max-w-none object-cover" loading="lazy" />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{i.type}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${IDEA_STATUS_INFO[i.status].cls}`}>{IDEA_STATUS_INFO[i.status].label}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{i.title}</p>
                {i.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{i.description}</p>}
              </div>
              {(i.itemIds.length > 0 || i.platforms.length > 0) && (
                <p className="text-xs text-muted">{[...i.itemIds.map((x) => names.itemName.get(x) ?? x), ...i.platforms].join(" · ")}</p>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="truncate text-xs text-muted">{i.createdByName} · {formatDateTimeMs(i.createdAt)}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {i.references.length > 0 && <span className="inline-flex items-center gap-1 text-sm text-muted" title="Pautan rujukan"><Link2 className="size-3.5" aria-hidden /> {i.references.length}</span>}
                  {i.images.length > 1 && <span className="inline-flex items-center gap-1 text-sm text-muted" title="Gambar"><ImageIcon className="size-3.5" aria-hidden /> {i.images.length}</span>}
                  <CommentCount n={i.commentCount} />
                  <VoteButton ideaId={i.id} count={i.votes.length} voted={i.votes.includes(user.id)} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
