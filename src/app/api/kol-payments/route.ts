import { readJson, userRoute } from "@/lib/server/api";
import { createPayment } from "@/lib/server/services/campaignKols";
import { paymentCreateSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, paymentCreateSchema);
  return createPayment(user, input, requestId);
});
