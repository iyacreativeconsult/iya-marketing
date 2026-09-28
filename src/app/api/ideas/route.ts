import { readJson, userRoute } from "@/lib/server/api";
import { createIdea } from "@/lib/server/services/ideas";
import { ideaInputSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => createIdea(user, await readJson(req, ideaInputSchema), requestId));
