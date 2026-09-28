import { adminRoute, readJson } from "@/lib/server/api";
import { reviewIdea } from "@/lib/server/services/ideas";
import { ideaReviewSchema } from "@/lib/validation";

export const POST = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, version } = await readJson(req, ideaReviewSchema);
  return reviewIdea(user, params.id, action, note, version, requestId);
});
