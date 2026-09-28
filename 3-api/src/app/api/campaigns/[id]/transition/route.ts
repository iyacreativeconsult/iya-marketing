import { readJson, userRoute } from "@/lib/server/api";
import { transitionCampaign } from "@/lib/server/services/campaigns";
import { campaignTransitionSchema } from "@/lib/validation";

/** Tukar status campaign. Peraturan penuh: src/lib/domain/campaign.ts */
export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, version } = await readJson(req, campaignTransitionSchema);
  return transitionCampaign({ kind: "user", user }, params.id, action, note, version, requestId);
});
