import { readJson, userRoute } from "@/lib/server/api";
import { assetAction } from "@/lib/server/services/assets";
import { assetActionSchema } from "@/lib/validation";

export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, version } = await readJson(req, assetActionSchema);
  return assetAction(user, params.id, action, note, version, requestId);
});
