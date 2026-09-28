import { adminRoute, readJson, userRoute } from "@/lib/server/api";
import { getMasterLists, setMasterList } from "@/lib/server/services/master";
import { masterListSchema } from "@/lib/validation";

export const GET = userRoute(async () => getMasterLists());

export const PUT = adminRoute(async ({ req, user, requestId }) => {
  const { key, items } = await readJson(req, masterListSchema);
  return setMasterList(user, key, items, requestId);
});
