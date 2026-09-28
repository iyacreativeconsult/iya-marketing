import { adminRoute } from "@/lib/server/api";
import { listAuditLogs, listErrorLogs } from "@/lib/server/services/logs";

export const GET = adminRoute(async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const requestId = sp.get("requestId")?.slice(0, 32) || undefined;
  const entityId = sp.get("entityId")?.slice(0, 64) || undefined;
  if (sp.get("type") === "error") return listErrorLogs({ requestId });
  return listAuditLogs({ requestId, entityId });
});
