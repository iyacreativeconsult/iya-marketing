import { readJson, userRoute } from "@/lib/server/api";
import { updateCk } from "@/lib/server/services/campaignKols";
import { ckUpdateSchema } from "@/lib/validation";

export const PATCH = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, ckUpdateSchema);
  return updateCk(user, params.id, version, data, requestId);
});
