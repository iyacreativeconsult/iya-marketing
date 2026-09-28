import { readJson, userRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { deleteCampaign, getCampaign, updateCampaign } from "@/lib/server/services/campaigns";
import { campaignDeleteSchema, campaignUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const GET = userRoute<P>(async ({ params }) => {
  const c = await getCampaign(params.id);
  if (!c) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
  return c;
});

export const PATCH = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, campaignUpdateSchema);
  return updateCampaign(user, params.id, version, data, requestId);
});

export const DELETE = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version } = await readJson(req, campaignDeleteSchema);
  return deleteCampaign(user, params.id, version, requestId);
});
