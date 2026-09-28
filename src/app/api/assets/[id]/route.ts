import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { deleteAsset, updateAsset } from "@/lib/server/services/assets";
import { assetUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, assetUpdateSchema);
  return updateAsset(user, params.id, version, data, requestId);
});

export const DELETE = adminRoute<P>(async ({ params, user, requestId }) => deleteAsset(user, params.id, requestId));
