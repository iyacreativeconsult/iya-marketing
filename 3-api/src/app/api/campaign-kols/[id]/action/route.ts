import { readJson, userRoute } from "@/lib/server/api";
import { ckAction } from "@/lib/server/services/campaignKols";
import { ckActionSchema } from "@/lib/validation";

/** Tukar status KOL / tanda checklist. Peraturan: src/lib/domain/kol.ts */
export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, postUrl, postedDate, version } = await readJson(req, ckActionSchema);
  return ckAction(user, params.id, action, { note, postUrl, postedDate }, version, requestId);
});
