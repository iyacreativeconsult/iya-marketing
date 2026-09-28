import { requirePageAdmin } from "@/lib/server/session";
import { listUsers } from "@/lib/server/services/users";
import { listTeams } from "@/lib/server/services/teams";
import { PageHeader } from "@/components/PageHeader";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export const metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const me = await requirePageAdmin();
  const [users, teams] = await Promise.all([listUsers(), listTeams()]);
  return (
    <div>
      <PageHeader title="Pengguna" description="Cipta akaun, tetapkan peranan dan team, nyahaktif akses." />
      <UsersAdmin users={users.filter((u) => !u.deleted)} teams={teams} meId={me.id} />
    </div>
  );
}
