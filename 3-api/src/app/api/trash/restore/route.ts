import { adminRoute, readJson } from "@/lib/server/api";
import { restoreFromTrash } from "@/lib/server/services/trash";
import { restoreSchema } from "@/lib/validation";

export const POST = adminRoute(async ({ req, user, requestId }) => {
  const { entity, id } = await readJson(req, restoreSchema);
  return restoreFromTrash(user, entity, id, requestId);
});
