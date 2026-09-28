import "server-only";
import type { Transaction, WriteBatch } from "firebase-admin/firestore";
import { adminDb, FieldValue } from "../firebase/admin";
import type { Actor } from "../domain/types";

/**
 * Audit log: rekod SETIAP cipta, ubah, padam dan tukar status.
 * Ditulis dalam transaksi yang sama dengan perubahan data, jadi tiada
 * perubahan yang berlaku tanpa rekod.
 */
export interface AuditInput {
  actor: Actor;
  action: string;
  entity: string;
  entityId: string;
  teamId?: string | null;
  from?: string | null;
  to?: string | null;
  note?: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  requestId: string;
}

export function writeAudit(tx: Transaction | WriteBatch, e: AuditInput): void {
  const ref = adminDb().collection("audit_logs").doc();
  const actorId = e.actor.kind === "user" ? e.actor.user.id : "system";
  const actorName = e.actor.kind === "user" ? e.actor.user.name : "Sistem";
  const data = {
    actorId,
    actorName,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    teamId: e.teamId ?? null,
    from: e.from ?? null,
    to: e.to ?? null,
    note: e.note ?? "",
    changes: e.changes ?? null,
    requestId: e.requestId,
    at: FieldValue.serverTimestamp(),
  };
  // Transaction.set dan WriteBatch.set mempunyai tandatangan yang serasi
  (tx as WriteBatch).set(ref, data);
}

/** Bandingkan dua objek dan pulangkan medan yang berubah sahaja. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, { from: unknown; to: unknown }> | null {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = { from: a ?? null, to: b ?? null };
  }
  return Object.keys(out).length ? out : null;
}
