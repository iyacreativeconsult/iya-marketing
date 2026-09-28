import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { deleteIdea, updateIdea } from "@/lib/server/services/ideas";
import { ideaUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, ideaUpdateSchema);
  return updateIdea(user, params.id, version, data, requestId);
});

export const DELETE = adminRoute<P>(async ({ params, user, requestId }) => deleteIdea(user, params.id, requestId));
