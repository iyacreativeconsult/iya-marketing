import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import { canEditAsset, checkAssetAction, type AssetAction } from "../../domain/content";
import type { Asset, SessionUser } from "../../domain/types";
import type { AssetInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertInList } from "./master";
import { assertItemsValid } from "./catalog";
import { getAssetFileRef } from "./files";
import { getContent } from "./content";

/** Content Library: fail atau pautan asset sebenar, dengan hak guna dan tarikh tamat. */

const col = () => adminDb().collection("assets");

export function toAsset(d: DocumentSnapshot): Asset {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    name: String(g("name") ?? ""),
    kind: String(g("kind") ?? ""),
    file: g("file") ?? null,
    url: String(g("url") ?? ""),
    contentItemId: g("contentItemId") ?? null,
    campaignId: g("campaignId") ?? null,
    teamId: String(g("teamId") ?? ""),
    itemIds: Array.isArray(g("itemIds")) ? g("itemIds") : [],
    platform: String(g("platform") ?? ""),
    contentType: String(g("contentType") ?? ""),
    creator: String(g("creator") ?? ""),
    usageRights: g("usageRights") ?? "Milik sendiri",
    rightsUntil: String(g("rightsUntil") ?? ""),
    status: g("status") ?? "Draft",
    statusNote: String(g("statusNote") ?? ""),
    remark: String(g("remark") ?? ""),
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    version: Number(g("version") ?? 1),
    deleted: g("deleted") === true,
  };
}

export async function listAssets(): Promise<Asset[]> {
  const snap = await col().where("deleted", "==", false).get();
  return snap.docs.map(toAsset).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function listAssetsForContent(contentItemId: string): Promise<Asset[]> {
  const snap = await col().where("contentItemId", "==", contentItemId).get();
  return snap.docs.map(toAsset).filter((a) => !a.deleted);
}

export async function getAsset(id: string): Promise<Asset | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const a = toAsset(snap);
  return a.deleted ? null : a;
}

async function prepare(user: SessionUser, input: AssetInput, before?: Asset) {
  await Promise.all([
    assertInList("assetKinds", [input.kind], "kind", before ? [before.kind] : []),
    input.platform ? assertInList("platforms", [input.platform], "platform", before ? [before.platform] : []) : null,
    input.contentType ? assertInList("contentTypes", [input.contentType], "contentType", before ? [before.contentType] : []) : null,
    assertItemsValid(input.itemIds, before?.itemIds ?? []),
    (async () => {
      if (!input.contentItemId || input.contentItemId === before?.contentItemId) return;
      const c = await getContent(input.contentItemId);
      if (!c || c.teamId !== input.teamId) throw new AppError("VALIDATION", undefined, { fields: { contentItemId: "Content tiada atau milik team lain." } });
    })(),
  ]);
  const file = await getAssetFileRef(user, input.fileId, before?.file ?? null);
  const { fileId: _f, ...rest } = input;
  return { ...rest, file };
}

export async function createAsset(user: SessionUser, input: AssetInput, requestId: string) {
  if (user.role !== "admin" && !user.teamIds.includes(input.teamId)) throw new AppError("FORBIDDEN", "Pilih team anda sendiri.");
  const data = await prepare(user, input);
  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    ...data,
    status: "Draft",
    statusNote: "",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    version: 1,
    deleted: false,
  });
  writeAudit(batch, { actor: { kind: "user", user }, action: "create", entity: "asset", entityId: ref.id, teamId: input.teamId, to: "Draft", note: input.name, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function updateAsset(user: SessionUser, id: string, version: number, input: AssetInput, requestId: string) {
  const current = await getAsset(id);
  if (!current) throw new AppError("NOT_FOUND", "Asset tidak dijumpai.");
  const data = await prepare(user, { ...input, teamId: user.role === "admin" ? input.teamId : current.teamId }, current);
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const before = toAsset(await tx.get(ref));
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditAsset(user, before)) throw new AppError("FORBIDDEN", "Asset ini tidak boleh diubah.");
    const changes = diff(before as unknown as Record<string, unknown>, data);
    if (!changes) return { id };
    // Asset yang sudah diluluskan dan diubah perlu disemak semula
    const reReview = user.role !== "admin" && before.status === "Approved";
    tx.update(ref, { ...data, ...(reReview ? { status: "Draft", statusNote: "Diubah selepas kelulusan. Hantar semula untuk semakan." } : {}), version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "update", entity: "asset", entityId: id, teamId: before.teamId, from: reReview ? "Approved" : null, to: reReview ? "Draft" : null, changes, requestId });
    return { id };
  });
}

export async function assetAction(user: SessionUser, id: string, action: AssetAction, note: string, version: number, requestId: string) {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const a = toAsset(await tx.get(ref));
    if (a.version !== version) throw new AppError("CONFLICT");
    const r = checkAssetAction(user, a, action, note);
    if (!r.ok) throw new AppError(r.code, r.message, r.code === "VALIDATION" ? { fields: { _: r.message } } : {});
    tx.update(ref, { status: r.to, statusNote: note.trim(), version: a.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: `asset_${action}`, entity: "asset", entityId: id, teamId: a.teamId, from: a.status, to: r.to, note: note.trim(), requestId });
    return { id, status: r.to };
  });
}

export async function deleteAsset(admin: SessionUser, id: string, requestId: string, note = "") {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh padam. Ahli boleh mohon padam.");
  const a = await getAsset(id);
  if (!a) throw new AppError("NOT_FOUND", "Asset tidak dijumpai.");
  const batch = adminDb().batch();
  batch.update(col().doc(id), { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id, version: a.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "asset", entityId: id, teamId: a.teamId, note: [a.name, note].filter(Boolean).join(". "), requestId });
  await batch.commit();
  return { id };
}
