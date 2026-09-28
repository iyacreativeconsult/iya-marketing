import { adminRoute, readJson } from "@/lib/server/api";
import { reviewDelete } from "@/lib/server/services/deletion";
import { deleteReviewSchema } from "@/lib/validation";

export const POST = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, version } = await readJson(req, deleteReviewSchema);
  return reviewDelete(user, params.id, action, note, version, requestId);
});
