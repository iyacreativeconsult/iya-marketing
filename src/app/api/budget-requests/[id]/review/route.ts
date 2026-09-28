import { adminRoute, readJson } from "@/lib/server/api";
import { reviewTopUp } from "@/lib/server/services/budget";
import { topUpReviewSchema } from "@/lib/validation";

export const POST = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, amount, note, version } = await readJson(req, topUpReviewSchema);
  return reviewTopUp(user, params.id, action, amount, note, version, requestId);
});
