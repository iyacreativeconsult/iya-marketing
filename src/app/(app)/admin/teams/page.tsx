import { requirePageAdmin } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { PageHeader } from "@/components/PageHeader";
import { TeamsAdmin } from "@/components/admin/TeamsAdmin";

export const metadata = { title: "Team" };

export default async function TeamsPage() {
  await requirePageAdmin();
  const teams = await listTeams();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team" description="Nama dan warna team seperti yang dipapar dalam calendar." />
      <TeamsAdmin teams={teams} />
    </div>
  );
}
