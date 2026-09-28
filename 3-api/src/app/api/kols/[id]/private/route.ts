import { readJson, userRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { getKolPrivate, setKolPrivate } from "@/lib/server/services/kols";
import { kolPrivateSchema } from "@/lib/validation";

type P = { id: string };

export const GET = userRoute<P>(async ({ params, user }) => {
  const data = await getKolPrivate(user, params.id);
  if (!data) throw new AppError("NOT_FOUND", "Tiada akses.");
  return data;
});

export const PUT = userRoute<P>(async ({ req, params, user, requestId }) => {
  const input = await readJson(req, kolPrivateSchema);
  return setKolPrivate(user, params.id, input, requestId);
});
