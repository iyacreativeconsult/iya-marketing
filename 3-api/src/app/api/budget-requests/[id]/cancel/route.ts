import { readJson, userRoute } from "@/lib/server/api";
import { cancelTopUp } from "@/lib/server/services/budget";
import { versionSchema } from "@/lib/validation";

/** Person tarik balik permohonan tambahan sendiri (masih Pending). */
export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { version } = await readJson(req, versionSchema);
  return cancelTopUp(user, params.id, version, requestId);
});
