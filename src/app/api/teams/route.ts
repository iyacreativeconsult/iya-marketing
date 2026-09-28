import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { createTeam, listTeams } from "@/lib/server/services/teams";
import { teamInputSchema } from "@/lib/validation";

export const GET = userRoute(async () => listTeams());

export const POST = adminRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, teamInputSchema);
  return createTeam(user, input, requestId);
});
