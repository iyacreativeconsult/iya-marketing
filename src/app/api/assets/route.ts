import { readJson, userRoute } from "@/lib/server/api";
import { createAsset } from "@/lib/server/services/assets";
import { assetInputSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => createAsset(user, await readJson(req, assetInputSchema), requestId));
