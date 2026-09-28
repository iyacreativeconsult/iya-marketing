import { readJson, userRoute } from "@/lib/server/api";
import { ideaToBank } from "@/lib/server/services/ideas";
import { ideaToBankSchema } from "@/lib/validation";

export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => ideaToBank(user, params.id, await readJson(req, ideaToBankSchema), requestId));
