import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { canEditKol, getKol } from "@/lib/server/services/kols";
import { PageHeader } from "@/components/PageHeader";
import { KolForm } from "@/components/kol/KolForm";
import { getMasterLists } from "@/lib/server/services/master";

export const metadata = { title: "Ubah KOL" };

export default async function EditKolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const kol = await getKol(id);
  if (!kol) notFound();
  if (!canEditKol(user, kol)) return <p className="card mx-auto max-w-lg p-6 text-sm">Hanya team pencipta atau Admin boleh ubah profil KOL ini.</p>;
  const teams = await listTeams();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Ubah KOL" description={kol.name} />
      <KolForm {...await listProps()} kol={kol} teams={user.role === "admin" ? teams : teams.filter((t) => t.id === kol.ownerTeamId)} isAdmin={user.role === "admin"} defaultTeamId={kol.ownerTeamId} />
    </div>
  );
}

async function listProps() {
  const l = await getMasterLists();
  return { platforms: l.platforms, niches: l.niches };
}
