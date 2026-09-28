import { timingSafeEqual } from "node:crypto";
import { adminRoute, publicRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { serverEnv } from "@/lib/server/env";
import { runCampaignStatusJob } from "@/lib/server/services/campaigns";

function secretMatches(header: string | null): boolean {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Dipanggil oleh Vercel Cron setiap hari (lihat vercel.json). */
export const GET = publicRoute(async ({ req, requestId }) => {
  if (!secretMatches(req.headers.get("authorization"))) throw new AppError("UNAUTHENTICATED", "Cron secret tidak sah.");
  return runCampaignStatusJob(requestId);
});

/** Admin boleh jalankan secara manual dari halaman Log Sistem (berguna di localhost). */
export const POST = adminRoute(async ({ requestId }) => runCampaignStatusJob(requestId));
