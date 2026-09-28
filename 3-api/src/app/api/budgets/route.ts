import { adminRoute, readJson } from "@/lib/server/api";
import { setTeamChannels } from "@/lib/server/services/budget";
import { budgetSetSchema } from "@/lib/validation";

/** Admin: pecahan bajet team ikut saluran. (Jumlah bajet team = jumlah bajet person.) */
export const PUT = adminRoute(async ({ req, user, requestId }) => {
  const { teamId, month, channels } = await readJson(req, budgetSetSchema);
  return setTeamChannels(user, teamId, month, channels, requestId);
});
