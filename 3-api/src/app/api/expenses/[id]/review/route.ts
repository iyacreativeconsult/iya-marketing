import { adminRoute, readJson } from "@/lib/server/api";
import { reviewExpense } from "@/lib/server/services/budget";
import { expenseReviewSchema } from "@/lib/validation";

export const POST = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { action, note, version } = await readJson(req, expenseReviewSchema);
  return reviewExpense(user, params.id, action, note, version, requestId);
});
