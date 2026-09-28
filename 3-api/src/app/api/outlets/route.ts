import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { listOutlets, saveOutlet } from "@/lib/server/services/catalog";
import { outletInputSchema } from "@/lib/validation";

export const GET = userRoute(async () => listOutlets());

export const POST = adminRoute(async ({ req, user, requestId }) => saveOutlet(user, null, null, await readJson(req, outletInputSchema), requestId));
