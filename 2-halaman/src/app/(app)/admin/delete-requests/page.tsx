import { requirePageAdmin } from "@/lib/server/session";
import { listDeleteRequests } from "@/lib/server/services/deletion";
import { listTeams } from "@/lib/server/services/teams";
import { PageHeader } from "@/components/PageHeader";
import { DeleteRequestList } from "@/components/admin/DeleteRequests";

export const metadata = { title: "Permohonan padam" };

export default async function DeleteRequestsPage() {
  const admin = await requirePageAdmin();
  const [all, teams] = await Promise.all([listDeleteRequests(admin), listTeams()]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const pending = all.filter((r) => r.status === "Pending");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Permohonan padam" description="Ahli tidak boleh padam terus. Luluskan untuk padam (boleh dipulihkan di Tong sampah), atau tolak dengan sebab." />
      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Menunggu kelulusan ({pending.length})</h2>
        <DeleteRequestList requests={pending} teamNames={teamNames} empty="Tiada permohonan menunggu." />
      </section>
      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Sejarah</h2>
        <DeleteRequestList requests={all.filter((r) => r.status !== "Pending").slice(0, 50)} teamNames={teamNames} empty="Belum ada sejarah." />
      </section>
    </div>
  );
}
