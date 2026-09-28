import { readJson, userRoute } from "@/lib/server/api";
import { createBank } from "@/lib/server/services/contentBank";
import { bankInputSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => createBank(user, await readJson(req, bankInputSchema), requestId));
