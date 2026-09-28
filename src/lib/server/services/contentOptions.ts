import "server-only";
import type { SessionUser } from "../../domain/types";
import { addDays, todayMYT } from "../../domain/dates";
import { getMasterLists } from "./master";
import { listItems } from "./catalog";
import { listTeams } from "./teams";
import { listUsers } from "./users";
import { listCampaignsInRange } from "./campaigns";

/** Pilihan borang content & asset: team pengguna, ahli setiap team (untuk PIC), campaign aktif. */
export async function productionOptions(user: SessionUser) {
  const [lists, items, teams, users, campaigns] = await Promise.all([
    getMasterLists(),
    listItems(),
    listTeams(),
    listUsers(),
    listCampaignsInRange(addDays(todayMYT(), -120), "9999-12-31"),
  ]);
  const myTeams = user.role === "admin" ? teams : teams.filter((t) => user.teamIds.includes(t.id));
  const members: Record<string, { id: string; name: string }[]> = {};
  for (const t of myTeams) members[t.id] = users.filter((u) => u.active && u.teamIds.includes(t.id)).map((u) => ({ id: u.id, name: u.name }));
  return {
    teams: myTeams.map((t) => ({ id: t.id, name: t.name })),
    members: user.role === "admin" ? members : null,
    platforms: lists.platforms,
    contentTypes: lists.contentTypes,
    assetKinds: lists.assetKinds,
    items: items.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name })),
    campaigns: campaigns.filter((c) => c.status !== "Cancelled" && myTeams.some((t) => t.id === c.teamId)).map((c) => ({ id: c.id, name: c.name, teamId: c.teamId })),
    defaultTeamId: user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : myTeams[0]?.id ?? "",
  };
}
export type ProductionOptions = Awaited<ReturnType<typeof productionOptions>>;
