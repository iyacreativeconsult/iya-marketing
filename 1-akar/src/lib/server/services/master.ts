import "server-only";
import { cache } from "react";
import { adminDb, FieldValue } from "../../firebase/admin";
import { MASTER_DEFAULTS, MASTER_KEYS, notInList, type MasterKey, type MasterLists } from "../../domain/master";
import type { SessionUser } from "../../domain/types";
import { AppError } from "../errors";
import { writeAudit } from "../audit";

const ref = () => adminDb().collection("settings").doc("master");

/** Senarai Tetapan. Jika belum pernah diubah, guna nilai awal. */
export const getMasterLists = cache(async (): Promise<MasterLists> => {
  const snap = await ref().get();
  const out = { ...MASTER_DEFAULTS };
  for (const k of MASTER_KEYS) {
    const v = snap.get(k);
    if (Array.isArray(v) && v.length) out[k] = v.map(String);
  }
  return out;
});

export async function setMasterList(admin: SessionUser, key: MasterKey, items: string[], requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref());
    const current: Record<string, unknown> = {};
    for (const k of MASTER_KEYS) current[k] = Array.isArray(snap.get(k)) ? snap.get(k) : MASTER_DEFAULTS[k];
    const before = current[key] as string[];
    if (JSON.stringify(before) === JSON.stringify(items)) return;
    tx.set(ref(), { ...current, [key]: items, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.id });
    writeAudit(tx, {
      actor: { kind: "user", user: admin },
      action: "update",
      entity: "settings",
      entityId: `master.${key}`,
      changes: { [key]: { from: before, to: items } },
      requestId,
    });
  });
  return { key };
}

/** Semak nilai wujud dalam senarai Tetapan. Nilai lama rekod (existing) tetap diterima. */
export async function assertInList(key: MasterKey, values: string[], field: string, existing: string[] = []) {
  const lists = await getMasterLists();
  const bad = notInList(values, lists[key], existing);
  if (bad.length) {
    throw new AppError("VALIDATION", undefined, { fields: { [field]: `Tiada dalam senarai Tetapan: ${bad.join(", ")}` } });
  }
}
