import { readJson, userRoute } from "@/lib/server/api";
import { updatePayment } from "@/lib/server/services/campaignKols";
import { paymentUpdateSchema } from "@/lib/validation";

export const PATCH = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, paymentUpdateSchema);
  return updatePayment(user, params.id, version, data, requestId);
});
