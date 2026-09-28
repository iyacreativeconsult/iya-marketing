import { readJson, userRoute } from "@/lib/server/api";
import { assignKol } from "@/lib/server/services/campaignKols";
import { ckAssignSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, ckAssignSchema);
  return assignKol(user, input, requestId);
});
