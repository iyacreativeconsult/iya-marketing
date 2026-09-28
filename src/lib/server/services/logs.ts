import "server-only";
import { adminDb, toIso } from "../../firebase/admin";
import type { AuditEntry, ErrorLogEntry } from "../../domain/types";

export async function listAuditLogs(opts: { entityId?: string; requestId?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  let q = adminDb().collection("audit_logs").orderBy("at", "desc");
  if (opts.entityId) q = adminDb().collection("audit_logs").where("entityId", "==", opts.entityId).orderBy("at", "desc");
  else if (opts.requestId) q = adminDb().collection("audit_logs").where("requestId", "==", opts.requestId).orderBy("at", "desc");
  const snap = await q.limit(opts.limit ?? 100).get();
  return snap.docs.map((d) => ({
    id: d.id,
    at: toIso(d.get("at")),
    actorId: String(d.get("actorId") ?? ""),
    actorName: String(d.get("actorName") ?? ""),
    action: String(d.get("action") ?? ""),
    entity: String(d.get("entity") ?? ""),
    entityId: String(d.get("entityId") ?? ""),
    teamId: d.get("teamId") ?? null,
    from: d.get("from") ?? null,
    to: d.get("to") ?? null,
    note: String(d.get("note") ?? ""),
    changes: d.get("changes") ?? null,
    requestId: String(d.get("requestId") ?? ""),
  }));
}

export async function listErrorLogs(opts: { requestId?: string; limit?: number } = {}): Promise<ErrorLogEntry[]> {
  let q = adminDb().collection("error_logs").orderBy("at", "desc");
  if (opts.requestId) q = adminDb().collection("error_logs").where("requestId", "==", opts.requestId).orderBy("at", "desc");
  const snap = await q.limit(opts.limit ?? 50).get();
  return snap.docs.map((d) => ({
    id: d.id,
    at: toIso(d.get("at")),
    requestId: String(d.get("requestId") ?? ""),
    code: String(d.get("code") ?? ""),
    message: String(d.get("message") ?? ""),
    route: String(d.get("route") ?? ""),
    method: String(d.get("method") ?? ""),
    userId: d.get("userId") ?? null,
    stack: String(d.get("stack") ?? ""),
  }));
}
