import { adminRoute, readJson } from "@/lib/server/api";
import { updateTeam } from "@/lib/server/services/teams";
import { teamInputSchema } from "@/lib/validation";
import { deleteTeam } from "@/lib/server/services/teams";

export const PATCH = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const input = await readJson(req, teamInputSchema);
  return updateTeam(user, params.id, input, requestId);
});

export const DELETE = adminRoute<{ id: string }>(async ({ params, user, requestId }) => deleteTeam(user, params.id, requestId));
