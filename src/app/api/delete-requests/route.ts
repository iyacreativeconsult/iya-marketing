import { readJson, userRoute } from "@/lib/server/api";
import { requestDelete } from "@/lib/server/services/deletion";
import { deleteRequestSchema } from "@/lib/validation";

/** Ahli mohon padam (campaign, perbelanjaan, profil KOL). Admin luluskan. */
export const POST = userRoute(async ({ req, user, requestId }) => {
  const { entity, entityId, reason } = await readJson(req, deleteRequestSchema);
  return requestDelete(user, entity, entityId, reason, requestId);
});
