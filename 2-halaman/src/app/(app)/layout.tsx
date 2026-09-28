import { AppShell } from "@/components/AppShell";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { listUsers } from "@/lib/server/services/users";
import { isDemo } from "@/lib/demo-mode";

/** Semua halaman dalam (app) memerlukan log masuk. Sesi disahkan penuh di sini. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const teams = await listTeams();
  const demo = isDemo() ? { currentId: user.id, users: (await listUsers()).map((u) => ({ id: u.id, name: u.name })) } : undefined;
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role, teamIds: user.teamIds }} teams={teams} activeTeamId={user.activeTeamId} demo={demo}>
      {children}
    </AppShell>
  );
}
