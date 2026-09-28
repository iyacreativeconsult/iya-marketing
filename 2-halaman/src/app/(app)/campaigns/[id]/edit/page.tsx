import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { getCampaign } from "@/lib/server/services/campaigns";
import { canEditCampaign } from "@/lib/domain/campaign";
import { senToInput } from "@/lib/domain/money";
import { PageHeader } from "@/components/PageHeader";
import { CampaignForm } from "@/components/CampaignForm";
import { campaignOptions } from "@/lib/server/services/options";

export const metadata = { title: "Ubah Campaign" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const c = await getCampaign(id);
  if (!c) notFound();

  if (!canEditCampaign(user, c)) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-sm">
        Anda tidak boleh ubah campaign ini pada status {c.status}.{" "}
        <Link href={`/campaigns/${c.id}`} className="font-semibold text-brand-600">Kembali</Link>
      </div>
    );
  }

  const teams = await listTeams();
  const allowed = user.role === "admin" ? teams : teams.filter((t) => t.id === c.teamId);
  const reapproval = user.role !== "admin" && (c.status === "Approved" || c.status === "Scheduled");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ubah Campaign" description={c.name} />
      <CampaignForm
        options={await campaignOptions()}
        mode="edit"
        campaignId={c.id}
        version={c.version}
        teams={allowed}
        reapprovalNotice={reapproval}
        initial={{
          name: c.name,
          type: c.type,
          teamId: c.teamId,
          startDate: c.startDate,
          endDate: c.endDate,
          platforms: c.platforms,
          itemIds: c.itemIds,
          outletIds: c.outletIds,
          objective: c.objective,
          plannedBudget: senToInput(c.plannedBudgetSen),
          notes: c.notes,
        }}
      />
    </div>
  );
}
