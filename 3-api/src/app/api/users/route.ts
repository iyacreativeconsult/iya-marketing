import { adminRoute, readJson } from "@/lib/server/api";
import { createUser, listUsers } from "@/lib/server/services/users";
import { userCreateSchema } from "@/lib/validation";

export const GET = adminRoute(async () => listUsers());

export const POST = adminRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, userCreateSchema);
  return createUser(user, input, requestId);
});
