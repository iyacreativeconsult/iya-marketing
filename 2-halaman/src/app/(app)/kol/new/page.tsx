import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { PageHeader } from "@/components/PageHeader";
import { KolForm } from "@/components/kol/KolForm";
import { getMasterLists } from "@/lib/server/services/master";

export const metadata = { title: "Tambah KOL" };

export default async function NewKolPage() {
  const user = await requirePageUser();
  const teams = await listTeams();
  const allowed = user.role === "admin" ? teams : teams.filter((t) => user.teamIds.includes(t.id));
  const def = user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : allowed[0]?.id ?? "";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Tambah KOL" description="Sistem akan semak jika username yang sama sudah wujud." />
      {allowed.length === 0 ? <p className="card p-5 text-sm">Anda belum ditambah ke mana-mana team.</p> : <KolForm {...await listProps()} teams={allowed} isAdmin={user.role === "admin"} defaultTeamId={def} />}
    </div>
  );
}

async function listProps() {
  const l = await getMasterLists();
  return { platforms: l.platforms, niches: l.niches };
}
