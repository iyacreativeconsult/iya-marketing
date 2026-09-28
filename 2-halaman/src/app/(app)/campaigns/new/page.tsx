import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { PageHeader } from "@/components/PageHeader";
import { CampaignForm } from "@/components/CampaignForm";
import { campaignOptions } from "@/lib/server/services/options";

export const metadata = { title: "Tambah Campaign" };

export default async function NewCampaignPage() {
  const user = await requirePageUser();
  const teams = await listTeams();
  const allowed = user.role === "admin" ? teams : teams.filter((t) => user.teamIds.includes(t.id));
  const defaultTeam = user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : allowed[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tambah Campaign" description="Campaign baru disimpan sebagai Idea (draf). Hantar untuk kelulusan bila sedia." />
      {allowed.length === 0 ? (
        <p className="card p-5 text-sm">Anda belum ditambah ke mana-mana team. Hubungi Admin.</p>
      ) : (
        <CampaignForm options={await campaignOptions()} mode="create" teams={allowed} initial={{ teamId: defaultTeam }} />
      )}
    </div>
  );
}
