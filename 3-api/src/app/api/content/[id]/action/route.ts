import { readJson, userRoute } from "@/lib/server/api";
import { contentAction } from "@/lib/server/services/content";
import { contentActionSchema } from "@/lib/validation";

/** Gerakkan content dalam pipeline. Peraturan: src/lib/domain/content.ts */
export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, postUrl, version } = await readJson(req, contentActionSchema);
  return contentAction(user, params.id, action, { note, postUrl }, version, requestId);
});
