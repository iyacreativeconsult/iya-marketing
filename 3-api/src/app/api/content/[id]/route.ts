import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { deleteContent, updateContent } from "@/lib/server/services/content";
import { contentUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, contentUpdateSchema);
  return updateContent(user, params.id, version, data, requestId);
});

export const DELETE = adminRoute<P>(async ({ params, user, requestId }) => deleteContent(user, params.id, requestId));
