import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { deleteBank, updateBank } from "@/lib/server/services/contentBank";
import { bankUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, bankUpdateSchema);
  return updateBank(user, params.id, version, data, requestId);
});

export const DELETE = adminRoute<P>(async ({ params, user, requestId }) => deleteBank(user, params.id, requestId));
