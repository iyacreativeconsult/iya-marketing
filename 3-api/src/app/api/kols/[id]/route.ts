import { readJson, userRoute } from "@/lib/server/api";
import { updateKol } from "@/lib/server/services/kols";
import { kolUpdateSchema } from "@/lib/validation";
import { adminRoute } from "@/lib/server/api";
import { deleteKol } from "@/lib/server/services/kols";

export const PATCH = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, kolUpdateSchema);
  return updateKol(user, params.id, version, data, requestId);
});

export const DELETE = adminRoute<{ id: string }>(async ({ params, user, requestId }) => deleteKol(user, params.id, requestId));
