import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { listItems, saveItem } from "@/lib/server/services/catalog";
import { itemInputSchema } from "@/lib/validation";

export const GET = userRoute(async () => listItems());

export const POST = adminRoute(async ({ req, user, requestId }) => saveItem(user, null, null, await readJson(req, itemInputSchema), requestId));
