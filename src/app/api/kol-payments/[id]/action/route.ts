import { adminRoute, readJson } from "@/lib/server/api";
import { paymentAction } from "@/lib/server/services/campaignKols";
import { paymentActionSchema } from "@/lib/validation";

/** Admin: proses, tanda dibayar (auto masuk bajet), atau batal. */
export const POST = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, proofFileId, paidDate, note, version } = await readJson(req, paymentActionSchema);
  return paymentAction(user, params.id, action, { proofFileId, paidDate, note }, version, requestId);
});
