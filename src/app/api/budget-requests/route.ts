import { readJson, userRoute } from "@/lib/server/api";
import { createTopUpRequest } from "@/lib/server/services/budget";
import { topUpRequestSchema } from "@/lib/validation";

/** Person mohon tambahan bajet. Admin lulus/tolak di /api/budget-requests/[id]/review. */
export const POST = userRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, topUpRequestSchema);
  return createTopUpRequest(user, input, requestId);
});
