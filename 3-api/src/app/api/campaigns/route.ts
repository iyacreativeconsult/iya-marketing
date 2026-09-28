import { parseOrThrow, readJson, userRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { createCampaign, listCampaignsInRange } from "@/lib/server/services/campaigns";
import { campaignInputSchema } from "@/lib/validation";
import { diffDays, isValidYmd } from "@/lib/domain/dates";
import { z } from "zod";

const rangeSchema = z.object({
  from: z.string().refine(isValidYmd, "Tarikh 'from' tidak sah."),
  to: z.string().refine(isValidYmd, "Tarikh 'to' tidak sah."),
});

/** Senarai campaign dalam julat tarikh (calendar dikongsi: semua pengguna boleh lihat). */
export const GET = userRoute(async ({ req }) => {
  const q = parseOrThrow(rangeSchema, Object.fromEntries(req.nextUrl.searchParams));
  const span = diffDays(q.from, q.to);
  if (span < 0 || span > 400) throw new AppError("BAD_REQUEST", "Julat tarikh mesti antara 0 hingga 400 hari.");
  return listCampaignsInRange(q.from, q.to);
});

export const POST = userRoute(async ({ req, user, requestId }) => {
  const input = await readJson(req, campaignInputSchema);
  return createCampaign(user, input, requestId);
});
