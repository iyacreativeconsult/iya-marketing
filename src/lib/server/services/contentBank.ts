import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import { canEditBank } from "../../domain/idea";
import type { BankEntry, SessionUser } from "../../domain/types";
import type { BankInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertInList } from "./master";
import { assertItemsValid } from "./catalog";
import { getCampaign } from "./campaigns";

/** Content Bank: idea content yang sudah matang dan boleh diguna berulang kali. */

const col = () => adminDb().collection("content_bank");

export function toBank(d: DocumentSnapshot): BankEntry {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    hook: String(g("hook") ?? ""),
    description: String(g("description") ?? ""),
    itemIds: Array.isArray(g("itemIds")) ? g("itemIds") : [],
    platforms: Array.isArray(g("platforms")) ? g("platforms") : [],
    contentType: String(g("contentType") ?? ""),
    audience: String(g("audience") ?? ""),
    funnel: g("funnel") ?? "Awareness",
    campaignId: g("campaignId") ?? null,
    references: Array.isArray(g("references")) ? g("references") : [],
    images: Array.isArray(g("images")) ? g("images") : [],
    status: g("status") ?? "Draft",
    useCount: Number(g("useCount") ?? 0),
    ideaId: g("ideaId") ?? null,
    teamId: String(g("teamId") ?? ""),
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    version: Number(g("version") ?? 1),
    deleted: g("deleted") === true,
  };
}

export async function listBank(): Promise<BankEntry[]> {
  const snap = await col().where("deleted", "==", false).get();
  return snap.docs.map(toBank).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getBank(id: string): Promise<BankEntry | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const b = toBank(snap);
  return b.deleted ? null : b;
}

async function assertLists(input: BankInput, before?: BankEntry) {
  await Promise.all([
    assertInList("contentTypes", [input.contentType], "contentType", before ? [before.contentType] : []),
    assertInList("platforms", input.platforms, "platforms", before?.platforms ?? []),
    assertItemsValid(input.itemIds, before?.itemIds ?? []),
    (async () => {
      if (!input.campaignId || input.campaignId === before?.campaignId) return;
      const c = await getCampaign(input.campaignId);
      if (!c) throw new AppError("VALIDATION", undefined, { fields: { campaignId: "Campaign tidak dijumpai." } });
    })(),
  ]);
}

export async function createBank(user: SessionUser, input: BankInput, requestId: string, from?: { ideaId: string; byName: string; byId: string; images?: BankEntry["images"] }) {
  if (user.role !== "admin" && !user.teamIds.includes(input.teamId)) throw new AppError("FORBIDDEN", "Pilih team anda sendiri.");
  await assertLists(input);
  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    ...input,
    images: from?.images ?? [],
    useCount: 0,
    ideaId: from?.ideaId ?? null,
    createdBy: from?.byId ?? user.id,
    createdByName: from?.byName ?? user.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    version: 1,
    deleted: false,
  });
  writeAudit(batch, { actor: { kind: "user", user }, action: "create", entity: "bank", entityId: ref.id, teamId: input.teamId, note: input.hook, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function updateBank(user: SessionUser, id: string, version: number, input: BankInput, requestId: string) {
  const current = await getBank(id);
  if (!current) throw new AppError("NOT_FOUND", "Entry tidak dijumpai.");
  await assertLists(input, current);
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const before = toBank(await tx.get(ref));
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditBank(user, before)) throw new AppError("FORBIDDEN", "Hanya team pemilik atau Admin boleh ubah.");
    const next = { ...input, teamId: user.role === "admin" ? input.teamId : before.teamId };
    const changes = diff(before as unknown as Record<string, unknown>, next);
    if (!changes) return { id };
    tx.update(ref, { ...next, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "update", entity: "bank", entityId: id, teamId: before.teamId, changes, requestId });
    return { id };
  });
}

export async function deleteBank(admin: SessionUser, id: string, requestId: string, note = "") {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh padam. Ahli boleh mohon padam.");
  const b = await getBank(id);
  if (!b) throw new AppError("NOT_FOUND", "Entry tidak dijumpai.");
  const batch = adminDb().batch();
  batch.update(col().doc(id), { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id, version: b.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "bank", entityId: id, teamId: b.teamId, note: [b.hook, note].filter(Boolean).join(". "), requestId });
  await batch.commit();
  return { id };
}
