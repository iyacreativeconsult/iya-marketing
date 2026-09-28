import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Megaphone } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { getIdea, listComments } from "@/lib/server/services/ideas";
import { listTeams } from "@/lib/server/services/teams";
import { listAuditLogs } from "@/lib/server/services/logs";
import { contentOptions, nameMaps } from "@/lib/server/services/options";
import { canConvertIdea, canEditIdea, canRequestDeleteIdea, IDEA_STATUS_INFO } from "@/lib/domain/idea";
import { formatDateTimeMs } from "@/lib/domain/dates";
import { Comments, IdeaConvert, IdeaReview, VoteButton } from "@/components/ideas/IdeaInteract";
import { IdeaEditToggle } from "@/components/ideas/IdeaEditToggle";
import { DeleteControl } from "@/components/DeleteControl";
import { AuditTimeline } from "@/components/AuditTimeline";
import { ReferenceView } from "@/components/ideas/References";

export const metadata = { title: "Idea" };

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const idea = await getIdea(id);
  if (!idea) notFound();
  const [comments, options, names, teams, history] = await Promise.all([listComments(id), contentOptions(), nameMaps(), listTeams(), listAuditLogs({ entityId: id, limit: 30 })]);
  const myTeams = user.role === "admin" ? teams : teams.filter((t) => user.teamIds.includes(t.id));
  const defaultTeam = user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : idea.teamId || myTeams[0]?.id || "";
  const info = IDEA_STATUS_INFO[idea.status];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/ideas" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Idea Hub</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{idea.type}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.cls}`}>{info.label}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{idea.title}</h1>
          <p className="mt-1 text-sm text-muted">{idea.createdByName} · {formatDateTimeMs(idea.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VoteButton ideaId={idea.id} count={idea.votes.length} voted={idea.votes.includes(user.id)} />
          {canEditIdea(user, idea) && <IdeaEditToggle idea={idea} options={options} />}
          {user.role === "admin" && <DeleteControl mode="direct" what={`idea "${idea.title}"`} confirmText={idea.title} url={`/api/ideas/${idea.id}`} redirectTo="/ideas" />}
          {canRequestDeleteIdea(user, idea) && <DeleteControl mode="request" what={`idea "${idea.title}"`} entity="idea" entityId={idea.id} />}
        </div>
      </div>

      {idea.statusNote && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nota Admin: {idea.statusNote}</p>}

      {(idea.linkedBankId || idea.linkedCampaignId) && (
        <div className="flex flex-wrap gap-2">
          {idea.linkedBankId && <Link href={`/content-bank/${idea.linkedBankId}`} className="btn-secondary"><Archive className="size-4" /> Lihat dalam Content Bank</Link>}
          {idea.linkedCampaignId && <Link href={`/campaigns/${idea.linkedCampaignId}`} className="btn-secondary"><Megaphone className="size-4" /> Lihat campaign</Link>}
        </div>
      )}

      {user.role === "admin" && <IdeaReview idea={idea} />}
      {canConvertIdea(user, idea) && (!idea.linkedBankId || !idea.linkedCampaignId) && (
        <IdeaConvert idea={idea} contentTypes={options.contentTypes} campaignTypes={options.campaignTypes} teams={myTeams} defaultTeamId={defaultTeam} />
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <p className="whitespace-pre-wrap text-sm">{idea.description || <span className="text-muted">Tiada huraian.</span>}</p>
            {(idea.itemIds.length > 0 || idea.platforms.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {idea.itemIds.map((x) => <span key={x} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs">{names.itemName.get(x) ?? x}</span>)}
                {idea.platforms.map((p) => <span key={p} className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-sky-800">{p}</span>)}
              </div>
            )}
            <ReferenceView images={idea.images} links={idea.references} />
          </section>
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Perbincangan ({comments.length})</h2>
            <Comments ideaId={idea.id} comments={comments} />
          </section>
        </div>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Sejarah</h2>
          <AuditTimeline entries={history.filter((h) => h.action !== "comment")} />
        </section>
      </div>
    </div>
  );
}
