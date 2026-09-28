import { readJson, userRoute } from "@/lib/server/api";
import { createExpense } from "@/lib/server/services/budget";
import { expenseInputSchema } from "@/lib/validation";

export const POST = userRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, expenseInputSchema);
  return createExpense(user, input, requestId);
});
