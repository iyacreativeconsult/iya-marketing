import { readJson, userRoute } from "@/lib/server/api";
import { createKol, listKols } from "@/lib/server/services/kols";
import { kolInputSchema } from "@/lib/validation";

export const GET = userRoute(async () => listKols());

export const POST = userRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, kolInputSchema);
  return createKol(user, input, requestId);
});
