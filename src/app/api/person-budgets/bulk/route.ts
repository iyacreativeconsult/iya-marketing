import { adminRoute, readJson } from "@/lib/server/api";
import { bulkSetPersonBudgets } from "@/lib/server/services/budget";
import { bulkBudgetSchema } from "@/lib/validation";

/** Admin: contoh RM 5,000 untuk semua person Team A, Oktober hingga Disember. */
export const POST = adminRoute(async ({ req, user, requestId }) => {
  const { teamId, userIds, months, base } = await readJson(req, bulkBudgetSchema);
  return bulkSetPersonBudgets(user, teamId, userIds, months, base, requestId);
});
