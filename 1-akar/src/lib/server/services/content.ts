import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import { canEditContent, checkContentAction, type ContentAction } from "../../domain/content";
import type { ContentItem, SessionUser } from "../../domain/types";
import { todayMYT } from "../../domain/dates";
import type { ContentInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertInList } from "./master";
import { assertItemsValid } from "./catalog";
import { getCampaign } from "./campaigns";
import { teamMembers } from "./budget";

/*
 * Produksi content: Idea -> Script -> Production -> Editing -> Review -> Approved -> Scheduled -> Published -> Archived.
 * Content dari Content Bank menambah kiraan "diguna" dan menggerakkan status idea asal.
 */

const col = () => adminDb().collection("content_items");

export function toContent(d: DocumentSnapshot): ContentItem {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    title: String(g("title") ?? ""),
    teamId: String(g("teamId") ?? ""),
    ownerId: String(g("ownerId") ?? ""),
    ownerName: String(g("ownerName") ?? ""),
    campaignId: g("campaignId") ?? null,
    bankId: g("bankId") ?? null,
    platform: String(g("platform") ?? ""),
    contentType: String(g("contentType") ?? ""),
    itemIds: Array.isArray(g("itemIds")) ? g("itemIds") : [],
    publishDate: String(g("publishDate") ?? ""),
    postUrl: String(g("postUrl") ?? ""),
    script: String(g("script") ?? ""),
    notes: String(g("notes") ?? ""),
    status: g("status") ?? "Idea",
    statusNote: String(g("statusNote") ?? ""),
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    version: Number(g("version") ?? 1),
    deleted: g("deleted") === true,
  };
}

/** Semua content (tidak dipadam). Skop "all" (Admin) atau satu team. */
export async function listContent(scope: string | null): Promise<ContentItem[]> {
  if (!scope) return [];
  const snap = await col().where("deleted", "==", false).get();
  return snap.docs
    .map(toContent)
    .filter((c) => scope === "all" || c.teamId === scope)
    .sort((a, b) => (a.publishDate || "9999").localeCompare(b.publishDate || "9999") || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getContent(id: string): Promise<ContentItem | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const c = toContent(snap);
  return c.deleted ? null : c;
}

async function resolveOwner(user: SessionUser, teamId: string, ownerId: string | null) {
  const id = user.role === "admin" ? ownerId ?? "" : ownerId ?? user.id;
  const m = (await teamMembers(teamId)).find((x) => x.id === id);
  if (!m) throw new AppError("VALIDATION", undefined, { fields: { ownerId: "Pilih PIC dari ahli team." } });
  return m;
}

async function assertLists(input: Omit<ContentInput, "bankId">, before?: ContentItem) {
  await Promise.all([
    input.platform ? assertInList("platforms", [input.platform], "platform", before ? [before.platform] : []) : null,
    input.contentType ? assertInList("contentTypes", [input.contentType], "contentType", before ? [before.contentType] : []) : null,
    assertItemsValid(input.itemIds, before?.itemIds ?? []),
    (async () => {
      if (!input.campaignId || input.campaignId === before?.campaignId) return;
      const c = await getCampaign(input.campaignId);
      if (!c || c.teamId !== input.teamId) throw new AppError("VALIDATION", undefined, { fields: { campaignId: "Campaign tiada atau milik team lain." } });
    })(),
  ]);
}

export async function createContent(user: SessionUser, input: ContentInput, requestId: string) {
  if (user.role !== "admin" && !user.teamIds.includes(input.teamId)) throw new AppError("FORBIDDEN", "Pilih team anda sendiri.");
  const { bankId, ...fields } = input;
  await assertLists(fields);
  const owner = await resolveOwner(user, input.teamId, input.ownerId);
  const ref = col().doc();
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    let bankRef = null;
    let bank = null;
    let ideaRef = null;
    let idea = null;
    if (bankId) {
      bankRef = db.collection("content_bank").doc(bankId);
      bank = await tx.get(bankRef);
      if (!bank.exists || bank.get("deleted") === true) throw new AppError("VALIDATION", "Entry Content Bank tidak dijumpai.");
      const ideaId = bank.get("ideaId");
      if (ideaId) {
        ideaRef = db.collection("ideas").doc(String(ideaId));
        idea = await tx.get(ideaRef);
      }
    }
    tx.set(ref, {
      ...fields,
      ownerId: owner.id,
      ownerName: owner.name,
      bankId: bankId ?? null,
      postUrl: "",
      status: "Idea",
      statusNote: "",
      createdBy: user.id,
      createdByName: user.name,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      version: 1,
      deleted: false,
    });
    if (bankRef && bank) tx.update(bankRef, { useCount: Number(bank.get("useCount") ?? 0) + 1 });
    if (ideaRef && idea?.exists && idea.get("status") === "Approved") {
      tx.update(ideaRef, { status: "In Production", updatedAt: FieldValue.serverTimestamp() });
      writeAudit(tx, { actor: { kind: "system" }, action: "idea_in_production", entity: "idea", entityId: ideaRef.id, from: "Approved", to: "In Production", note: fields.title, requestId });
    }
    writeAudit(tx, { actor: { kind: "user", user }, action: "create", entity: "content", entityId: ref.id, teamId: input.teamId, to: "Idea", note: fields.title + (bankId ? " (dari Content Bank)" : ""), requestId });
  });
  return { id: ref.id };
}

export async function updateContent(user: SessionUser, id: string, version: number, input: Omit<ContentInput, "bankId">, requestId: string) {
  const current = await getContent(id);
  if (!current) throw new AppError("NOT_FOUND", "Content tidak dijumpai.");
  const next = { ...input, teamId: user.role === "admin" ? input.teamId : current.teamId };
  await assertLists(next, current);
  const owner = next.ownerId && next.ownerId !== current.ownerId ? await resolveOwner(user, next.teamId, next.ownerId) : { id: current.ownerId, name: current.ownerName };
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const before = toContent(await tx.get(ref));
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditContent(user, before)) throw new AppError("FORBIDDEN", "Content ini tidak boleh diubah lagi.");
    const data = { ...next, ownerId: owner.id, ownerName: owner.name };
    const changes = diff(before as unknown as Record<string, unknown>, data);
    if (!changes) return { id };
    tx.update(ref, { ...data, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "update", entity: "content", entityId: id, teamId: before.teamId, changes: { ...changes, ...(changes.script ? { script: { from: "(skrip)", to: "(dikemas kini)" } } : {}) }, requestId });
    return { id };
  });
}

export async function contentAction(user: SessionUser, id: string, action: ContentAction, extra: { note: string; postUrl: string }, version: number, requestId: string) {
  const db = adminDb();
  const ref = col().doc(id);
  return db.runTransaction(async (tx) => {
    const c = toContent(await tx.get(ref));
    if (c.deleted) throw new AppError("NOT_FOUND", "Content tidak dijumpai.");
    if (c.version !== version) throw new AppError("CONFLICT");
    const r = checkContentAction(user, c, action, extra);
    if (!r.ok) throw new AppError(r.code, r.message, r.code === "VALIDATION" ? { fields: { _: r.message } } : {});

    // Bila published, idea asal (melalui Content Bank) juga jadi Published
    let ideaRef = null;
    let idea = null;
    if (action === "publish" && c.bankId) {
      const bank = await tx.get(db.collection("content_bank").doc(c.bankId));
      if (bank.exists && bank.get("ideaId")) {
        ideaRef = db.collection("ideas").doc(String(bank.get("ideaId")));
        idea = await tx.get(ideaRef);
      }
    }
    const update: Record<string, unknown> = { status: r.to, statusNote: extra.note.trim(), version: c.version + 1, updatedAt: FieldValue.serverTimestamp() };
    if (action === "publish") {
      update.postUrl = extra.postUrl;
      if (!c.publishDate) update.publishDate = todayMYT();
    }
    tx.update(ref, update);
    if (ideaRef && idea?.exists && ["Approved", "In Production"].includes(String(idea.get("status")))) {
      tx.update(ideaRef, { status: "Published", updatedAt: FieldValue.serverTimestamp() });
      writeAudit(tx, { actor: { kind: "system" }, action: "idea_published", entity: "idea", entityId: ideaRef.id, from: String(idea.get("status")), to: "Published", note: c.title, requestId });
    }
    writeAudit(tx, { actor: { kind: "user", user }, action, entity: "content", entityId: id, teamId: c.teamId, from: c.status, to: r.to, note: [extra.note.trim(), action === "publish" ? extra.postUrl : ""].filter(Boolean).join(" "), requestId });
    return { id, status: r.to };
  });
}

export async function deleteContent(admin: SessionUser, id: string, requestId: string, note = "") {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh padam. Ahli boleh mohon padam.");
  const c = await getContent(id);
  if (!c) throw new AppError("NOT_FOUND", "Content tidak dijumpai.");
  const batch = adminDb().batch();
  batch.update(col().doc(id), { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id, version: c.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "content", entityId: id, teamId: c.teamId, from: c.status, note: [c.title, note].filter(Boolean).join(". "), requestId });
  await batch.commit();
  return { id };
}
