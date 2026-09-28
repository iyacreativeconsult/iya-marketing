import "server-only";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import type { SessionUser } from "../../domain/types";
import { AppError } from "../errors";
import { writeAudit } from "../audit";

/** Rekod yang dipadam lembut dan boleh dipulihkan oleh Admin. */
export const TRASH = {
  campaign: { col: "campaigns", label: "Campaign", name: (d: FirebaseFirestore.DocumentData) => String(d.name ?? "") },
  expense: { col: "expenses", label: "Perbelanjaan", name: (d: FirebaseFirestore.DocumentData) => `${d.description ?? ""} (RM ${(Number(d.amountSen ?? 0) / 100).toFixed(2)})` },
  kol: { col: "kols", label: "Profil KOL", name: (d: FirebaseFirestore.DocumentData) => String(d.name ?? "") },
  idea: { col: "ideas", label: "Idea", name: (d: FirebaseFirestore.DocumentData) => String(d.title ?? "") },
  bank: { col: "content_bank", label: "Content Bank", name: (d: FirebaseFirestore.DocumentData) => String(d.hook ?? "") },
  content: { col: "content_items", label: "Content", name: (d: FirebaseFirestore.DocumentData) => String(d.title ?? "") },
  asset: { col: "assets", label: "Asset", name: (d: FirebaseFirestore.DocumentData) => String(d.name ?? "") },
  team: { col: "teams", label: "Team", name: (d: FirebaseFirestore.DocumentData) => String(d.name ?? "") },
  item: { col: "items", label: "Item", name: (d: FirebaseFirestore.DocumentData) => String(d.name ?? "") },
  outlet: { col: "outlets", label: "Outlet", name: (d: FirebaseFirestore.DocumentData) => String(d.name ?? "") },
  user: { col: "users", label: "Pengguna", name: (d: FirebaseFirestore.DocumentData) => `${d.name ?? ""} (${d.email ?? ""})` },
} as const;
export type TrashEntity = keyof typeof TRASH;
export const TRASH_ENTITIES = Object.keys(TRASH) as TrashEntity[];

export interface TrashRow {
  entity: TrashEntity;
  id: string;
  name: string;
  deletedAt: string | null;
  restorable: boolean;
}

export async function listTrash(admin: SessionUser): Promise<TrashRow[]> {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  const lists = await Promise.all(
    TRASH_ENTITIES.map(async (entity) => {
      const snap = await adminDb().collection(TRASH[entity].col).where("deleted", "==", true).get();
      return snap.docs.map((d) => ({
        entity,
        id: d.id,
        name: TRASH[entity].name(d.data() ?? {}),
        deletedAt: toIso(d.get("deletedAt")),
        restorable: entity !== "user", // akaun log masuk sudah dipadam: cipta semula
      }));
    }),
  );
  return lists.flat().sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
}

export async function restoreFromTrash(admin: SessionUser, entity: TrashEntity, id: string, requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  if (entity === "user") throw new AppError("INVALID_TRANSITION", "Akaun log masuk pengguna sudah dipadam. Cipta semula di Pengguna.");
  const ref = adminDb().collection(TRASH[entity].col).doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.get("deleted") !== true) throw new AppError("NOT_FOUND", "Rekod tidak dijumpai dalam Tong sampah.");
  const batch = adminDb().batch();
  batch.update(ref, { deleted: false, restoredAt: FieldValue.serverTimestamp(), restoredBy: admin.id, ...(snap.get("version") ? { version: Number(snap.get("version")) + 1 } : {}) });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "restore", entity, entityId: id, teamId: snap.get("teamId") ?? null, note: TRASH[entity].name(snap.data() ?? {}), requestId });
  await batch.commit();
  return { id };
}
