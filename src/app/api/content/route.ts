import { readJson, userRoute } from "@/lib/server/api";
import { createContent } from "@/lib/server/services/content";
import { contentInputSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => createContent(user, await readJson(req, contentInputSchema), requestId));
