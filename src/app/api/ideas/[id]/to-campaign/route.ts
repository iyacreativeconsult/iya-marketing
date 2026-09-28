import { readJson, userRoute } from "@/lib/server/api";
import { ideaToCampaign } from "@/lib/server/services/ideas";
import { ideaToCampaignSchema } from "@/lib/validation";

export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => ideaToCampaign(user, params.id, await readJson(req, ideaToCampaignSchema), requestId));
