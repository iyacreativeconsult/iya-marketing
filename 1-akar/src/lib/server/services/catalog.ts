import "server-only";
import { cache } from "react";
import type { CollectionReference, DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue } from "../../firebase/admin";
import type { Item, Outlet, SessionUser } from "../../domain/types";
import type { ItemInput, OutletInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertInList } from "./master";

const items = () => adminDb().collection("items");
const outlets = () => adminDb().collection("outlets");

function toItem(d: DocumentSnapshot): Item {
  return {
    id: d.id,
    name: String(d.get("name") ?? ""),
    kind: d.get("kind") ?? "Produk",
    category: String(d.get("category") ?? ""),
    sku: String(d.get("sku") ?? ""),
    unit: String(d.get("unit") ?? "unit"),
    priceSen: Number(d.get("priceSen") ?? 0),
    costSen: Number(d.get("costSen") ?? 0),
    active: d.get("active") !== false && d.get("deleted") !== true,
    deleted: d.get("deleted") === true,
    version: Number(d.get("version") ?? 1),
  };
}

function toOutlet(d: DocumentSnapshot): Outlet {
  return {
    id: d.id,
    name: String(d.get("name") ?? ""),
    kind: String(d.get("kind") ?? ""),
    address: String(d.get("address") ?? ""),
    city: String(d.get("city") ?? ""),
    pic: String(d.get("pic") ?? ""),
    phone: String(d.get("phone") ?? ""),
    active: d.get("active") !== false && d.get("deleted") !== true,
    deleted: d.get("deleted") === true,
    version: Number(d.get("version") ?? 1),
  };
}

export const listItems = cache(async (): Promise<Item[]> => {
  const snap = await items().get();
  return snap.docs.map(toItem).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
});

export const listOutlets = cache(async (): Promise<Outlet[]> => {
  const snap = await outlets().get();
  return snap.docs.map(toOutlet).sort((a, b) => a.name.localeCompare(b.name));
});

/** Item/outlet mesti wujud dan aktif, kecuali yang sudah ada pada rekod sebelum ini. */
export async function assertItemsValid(ids: string[], existing: string[] = [], field = "itemIds") {
  const all = new Map((await listItems()).map((i) => [i.id, i]));
  const bad = ids.filter((id) => !existing.includes(id) && !all.get(id)?.active);
  if (bad.length) throw new AppError("VALIDATION", undefined, { fields: { [field]: "Item tidak wujud atau tidak aktif." } });
  return all;
}

export async function assertOutletsValid(ids: string[], existing: string[] = [], field = "outletIds") {
  const all = new Map((await listOutlets()).map((o) => [o.id, o]));
  const bad = ids.filter((id) => id && !existing.includes(id) && !all.get(id)?.active);
  if (bad.length) throw new AppError("VALIDATION", undefined, { fields: { [field]: "Outlet tidak wujud atau tidak aktif." } });
}

function assertAdmin(user: SessionUser) {
  if (user.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh urus Tetapan.");
}

const itemFields = (i: ItemInput) => ({ name: i.name, kind: i.kind, category: i.category, sku: i.sku, unit: i.unit, priceSen: i.price, costSen: i.cost, active: i.active });
const outletFields = (o: OutletInput) => ({ ...o });

export async function saveItem(admin: SessionUser, id: string | null, version: number | null, input: ItemInput, requestId: string) {
  assertAdmin(admin);
  if (input.category) await assertInList("itemCategories", [input.category], "category");
  return saveDoc(admin, "item", items(), toItem, id, version, itemFields(input), requestId);
}

export async function saveOutlet(admin: SessionUser, id: string | null, version: number | null, input: OutletInput, requestId: string) {
  assertAdmin(admin);
  if (input.kind) await assertInList("outletKinds", [input.kind], "kind");
  return saveDoc(admin, "outlet", outlets(), toOutlet, id, version, outletFields(input), requestId);
}

async function saveDoc<T extends { version: number }>(
  admin: SessionUser,
  entity: string,
  col: CollectionReference,
  map: (d: DocumentSnapshot) => T,
  id: string | null,
  version: number | null,
  data: Record<string, unknown>,
  requestId: string,
) {
  if (!id) {
    const ref = col.doc();
    const batch = adminDb().batch();
    batch.set(ref, { ...data, version: 1, createdAt: FieldValue.serverTimestamp(), createdBy: admin.id });
    writeAudit(batch, { actor: { kind: "user", user: admin }, action: "create", entity, entityId: ref.id, note: String(data.name), requestId });
    await batch.commit();
    return { id: ref.id };
  }
  const ref = col.doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND");
    const before = map(snap);
    if (before.version !== version) throw new AppError("CONFLICT");
    const changes = diff(before as unknown as Record<string, unknown>, data);
    if (!changes) return;
    tx.update(ref, { ...data, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user: admin }, action: "update", entity, entityId: id, changes, requestId });
  });
  return { id };
}

/** Admin: padam item/outlet. Rekod lama (campaign, KOL) masih papar namanya. */
export async function deleteCatalogDoc(admin: SessionUser, kind: "item" | "outlet", id: string, requestId: string) {
  assertAdmin(admin);
  const ref = (kind === "item" ? items() : outlets()).doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.get("deleted") === true) throw new AppError("NOT_FOUND");
  const batch = adminDb().batch();
  batch.update(ref, { deleted: true, active: false, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: kind, entityId: id, note: String(snap.get("name") ?? id), requestId });
  await batch.commit();
  return { id };
}
