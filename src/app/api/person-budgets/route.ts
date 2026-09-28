import { adminRoute, readJson } from "@/lib/server/api";
import { setPersonBudget } from "@/lib/server/services/budget";
import { personBudgetSchema } from "@/lib/validation";

/** Admin: tetapkan bajet asas dan/atau carry forward seorang person untuk satu bulan. */
export const PUT = adminRoute(async ({ req, user, requestId }) => {
  const { teamId, userId, month, base, carryForward } = await readJson(req, personBudgetSchema);
  return setPersonBudget(user, { teamId, userId, month, base, carryForward }, requestId);
});
