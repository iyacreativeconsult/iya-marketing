import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { listCampaignsInRange } from "@/lib/server/services/campaigns";
import { addDays, monthRange, todayMYT, weekdayMondayFirst } from "@/lib/domain/dates";
import { CalendarView } from "@/components/CalendarView";
import { campaignOptions } from "@/lib/server/services/options";

export const metadata = { title: "Marketing Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requirePageUser();
  const { m } = await searchParams;
  const { month, from, to } = monthRange(m);

  // Grid bermula Isnin sebelum 1hb dan tamat Ahad selepas hari terakhir
  const gridStart = addDays(from, -weekdayMondayFirst(from));
  const gridEnd = addDays(to, 6 - weekdayMondayFirst(to));

  const [teams, campaigns, options] = await Promise.all([listTeams(), listCampaignsInRange(gridStart, gridEnd), campaignOptions()]);

  return (
    <CalendarView
      month={month}
      gridStart={gridStart}
      gridEnd={gridEnd}
      today={todayMYT()}
      campaigns={campaigns}
      teams={teams}
      options={options}
      canCreate={Boolean(user.activeTeamId)}
    />
  );
}
