import { adminRoute, readJson } from "@/lib/server/api";
import { updateUser } from "@/lib/server/services/users";
import { userUpdateSchema } from "@/lib/validation";
import { deleteUser } from "@/lib/server/services/users";

export const PATCH = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const patch = await readJson(req, userUpdateSchema);
  return updateUser(user, params.id, patch, requestId);
});

/** Padam pengguna: akses log masuk dibuang, sejarah kekal. */
export const DELETE = adminRoute<{ id: string }>(async ({ params, user, requestId }) => deleteUser(user, params.id, requestId));
