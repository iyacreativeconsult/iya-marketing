import { requirePageUser } from "@/lib/server/session";
import { listTopUpRequests } from "@/lib/server/services/budget";
import { listTeams } from "@/lib/server/services/teams";
import { todayMYT } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";
import { TopUpList, TopUpRequestForm } from "@/components/budget/TopUp";

export const metadata = { title: "Permohonan tambahan bajet" };

export default async function RequestsPage() {
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const [all, teams] = await Promise.all([listTopUpRequests(user), listTeams()]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const pending = all.filter((r) => r.status === "Pending");
  const history = all.filter((r) => r.status !== "Pending").slice(0, 50);
  const team = user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Permohonan tambahan bajet"
        description={isAdmin ? "Lulus (boleh ubah jumlah) atau tolak dengan sebab. Tambahan masuk terus ke bajet person bulan itu." : "Mohon tambahan jika bajet bulan itu tidak mencukupi. Admin akan semak."}
        actions={!isAdmin && team ? <TopUpRequestForm teamId={team} month={todayMYT().slice(0, 7)} /> : undefined}
      />
      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Menunggu Admin ({pending.length})</h2>
        <TopUpList viewerId={user.id} requests={pending} isAdmin={isAdmin} teamNames={isAdmin ? teamNames : undefined} empty="Tiada permohonan menunggu." />
      </section>
      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Sejarah</h2>
        <TopUpList requests={history} isAdmin={false} teamNames={isAdmin ? teamNames : undefined} empty="Belum ada sejarah." />
      </section>
    </div>
  );
}
