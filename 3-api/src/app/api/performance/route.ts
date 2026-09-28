import { readJson, userRoute } from "@/lib/server/api";
import { recordPerformance } from "@/lib/server/services/performance";
import { perfInputSchema } from "@/lib/validation";

/** Isi / kemas kini prestasi posting pada hari ke-1, 7 atau 30. */
export const PUT = userRoute(async ({ req, user, requestId }) => recordPerformance(user, await readJson(req, perfInputSchema), requestId));
