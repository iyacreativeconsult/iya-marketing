import { readJson, userRoute } from "@/lib/server/api";
import { deleteExpense, updateExpense } from "@/lib/server/services/budget";
import { expenseUpdateSchema, versionSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, expenseUpdateSchema);
  return updateExpense(user, params.id, version, data, requestId);
});

export const DELETE = userRoute<P>(async ({ req, params, user, requestId }) => {
  const { version } = await readJson(req, versionSchema);
  return deleteExpense(user, params.id, version, requestId);
});
