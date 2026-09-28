import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import { canConvertIdea, canEditIdea, checkIdeaReview, statusAfterEngagement } from "../../domain/idea";
import type { Idea, IdeaComment, SessionUser } from "../../domain/types";
import type { IdeaInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertInList } from "./master";
import { assertItemsValid } from "./catalog";
import { createCampaign } from "./campaigns";
import { createBank } from "./contentBank";
import { getIdeaImageRefs } from "./files";
import { normalizeRefs } from "../../domain/links";

/*
 * Idea Hub: ruang terbuka untuk semua team berkongsi idea, komen dan vote.
 * Admin luluskan; idea yang lulus boleh dimasukkan ke Content Bank atau dijadikan campaign.
 */

const col = () => adminDb().collection("ideas");
const comments = () => adminDb().collection("idea_comments");

export function toIdea(d: DocumentSnapshot): Idea {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    title: String(g("title") ?? ""),
    description: String(g("description") ?? ""),
    type: String(g("type") ?? ""),
    teamId: String(g("teamId") ?? ""),
    itemIds: Array.isArray(g("itemIds")) ? g("itemIds") : [],
    platforms: Array.isArray(g("platforms")) ? g("platforms") : [],
    references: normalizeRefs(g("references")),
    images: Array.isArray(g("images")) ? g("images") : [],
    status: g("status") ?? "New",
    statusNote: String(g("statusNote") ?? ""),
    votes: Array.isArray(g("votes")) ? g("votes") : [],
    commentCount: Number(g("commentCount") ?? 0),
    linkedBankId: g("linkedBankId") ?? null,
    linkedCampaignId: g("linkedCampaignId") ?? null,
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    version: Number(g("version") ?? 1),
    deleted: g("deleted") === true,
  };
}

export async function listIdeas(): Promise<Idea[]> {
  const snap = await col().where("deleted", "==", false).get();
  return snap.docs.map(toIdea).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getIdea(id: string): Promise<Idea | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const i = toIdea(snap);
  return i.deleted ? null : i;
}

export async function listComments(ideaId: string): Promise<IdeaComment[]> {
  const snap = await comments().where("ideaId", "==", ideaId).get();
  return snap.docs
    .filter((d) => d.get("deleted") !== true)
    .map((d) => ({
      id: d.id,
      ideaId,
      userId: String(d.get("userId") ?? ""),
      userName: String(d.get("userName") ?? ""),
      text: String(d.get("text") ?? ""),
      createdAt: toIso(d.get("createdAt")),
    }))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

async function assertLists(input: IdeaInput, before?: Idea) {
  await Promise.all([
    assertInList("ideaTypes", [input.type], "type", before ? [before.type] : []),
    assertInList("platforms", input.platforms, "platforms", before?.platforms ?? []),
    assertItemsValid(input.itemIds, before?.itemIds ?? []),
  ]);
}

export async function createIdea(user: SessionUser, input: IdeaInput, requestId: string) {
  await assertLists(input);
  const images = await getIdeaImageRefs(user, input.imageIds);
  const { imageIds: _ignore, ...fields } = input;
  const teamId = user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : user.teamIds[0] ?? "";
  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    ...fields,
    images,
    teamId,
    status: "New",
    statusNote: "",
    votes: [],
    commentCount: 0,
    linkedBankId: null,
    linkedCampaignId: null,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    version: 1,
    deleted: false,
  });
  writeAudit(batch, { actor: { kind: "user", user }, action: "create", entity: "idea", entityId: ref.id, teamId, to: "New", note: input.title, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function updateIdea(user: SessionUser, id: string, version: number, input: IdeaInput, requestId: string) {
  const current = await getIdea(id);
  if (!current) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
  await assertLists(input, current);
  const images = await getIdeaImageRefs(user, input.imageIds, current.images);
  const { imageIds: _ignore, ...fields } = input;
  const next = { ...fields, images };
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const before = toIdea(await tx.get(ref));
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditIdea(user, before)) throw new AppError("FORBIDDEN", "Idea hanya boleh diubah oleh penciptanya semasa masih dibincang.");
    const changes = diff(before as unknown as Record<string, unknown>, next);
    if (!changes) return { id };
    tx.update(ref, { ...next, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "update", entity: "idea", entityId: id, teamId: before.teamId, changes, requestId });
    return { id };
  });
}

/** Vote / buang vote (toggle). Vote pertama menukar status kepada Dibincang. */
export async function toggleVote(user: SessionUser, id: string) {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
    const i = toIdea(snap);
    if (i.deleted) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
    const voted = i.votes.includes(user.id);
    const votes = voted ? i.votes.filter((v) => v !== user.id) : [...i.votes, user.id];
    tx.update(ref, { votes, status: voted ? i.status : statusAfterEngagement(i.status) });
    return { voted: !voted, count: votes.length };
  });
}

export async function addComment(user: SessionUser, id: string, text: string, requestId: string) {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
    const i = toIdea(snap);
    if (i.deleted) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
    const cref = comments().doc();
    tx.set(cref, { ideaId: id, userId: user.id, userName: user.name, text, createdAt: FieldValue.serverTimestamp(), deleted: false });
    tx.update(ref, { commentCount: i.commentCount + 1, status: statusAfterEngagement(i.status) });
    writeAudit(tx, { actor: { kind: "user", user }, action: "comment", entity: "idea", entityId: id, teamId: i.teamId, note: text.slice(0, 200), requestId });
    return { id: cref.id };
  });
}

export async function reviewIdea(user: SessionUser, id: string, action: "approve" | "reject" | "reopen", note: string, version: number, requestId: string) {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
    const i = toIdea(snap);
    if (i.version !== version) throw new AppError("CONFLICT");
    const r = checkIdeaReview(user, i, action, note);
    if (!r.ok) throw new AppError(r.code, r.message, r.code === "VALIDATION" ? { fields: { note: r.message } } : {});
    tx.update(ref, { status: r.to, statusNote: note.trim(), version: i.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: `idea_${action}`, entity: "idea", entityId: id, teamId: i.teamId, from: i.status, to: r.to, note: note.trim(), requestId });
    return { id, status: r.to };
  });
}

async function mustConvert(user: SessionUser, id: string) {
  const i = await getIdea(id);
  if (!i) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
  if (!canConvertIdea(user, i)) throw new AppError("FORBIDDEN", "Idea mesti diluluskan dahulu, dan hanya pencipta atau Admin boleh menukarnya.");
  return i;
}

/** Idea diluluskan -> entry Content Bank (boleh diguna semula). */
export async function ideaToBank(user: SessionUser, id: string, input: { contentType: string; funnel: "Awareness" | "Consideration" | "Conversion"; audience: string }, requestId: string) {
  const i = await mustConvert(user, id);
  if (i.linkedBankId) throw new AppError("VALIDATION", "Idea ini sudah ada dalam Content Bank.");
  const teamId = i.teamId || (user.activeTeamId && user.activeTeamId !== "all" ? user.activeTeamId : user.teamIds[0] ?? "");
  if (!teamId) throw new AppError("VALIDATION", "Idea ini tiada team. Pilih Sesi Aktif satu team dahulu.");
  const bank = await createBank(
    { ...user, role: "admin" }, // pencipta idea mungkin bukan ahli team asal; kebenaran sudah disemak di atas
    {
      hook: i.title,
      description: i.description,
      itemIds: i.itemIds,
      platforms: i.platforms,
      contentType: input.contentType,
      audience: input.audience,
      funnel: input.funnel,
      campaignId: null,
      references: i.references.map((r) => r.url),
      status: "Ready to Produce",
      teamId,
    },
    requestId,
    { ideaId: i.id, byName: user.name, byId: user.id, images: i.images },
  );
  const batch = adminDb().batch();
  batch.update(col().doc(id), { linkedBankId: bank.id, updatedAt: FieldValue.serverTimestamp(), version: i.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user }, action: "idea_to_bank", entity: "idea", entityId: id, teamId, note: bank.id, requestId });
  await batch.commit();
  return bank;
}

/** Idea diluluskan -> draf campaign (status Idea) dalam Marketing Calendar. */
export async function ideaToCampaign(user: SessionUser, id: string, input: { teamId: string; name: string; type: string; startDate: string; endDate: string }, requestId: string) {
  const i = await mustConvert(user, id);
  if (i.linkedCampaignId) throw new AppError("VALIDATION", "Idea ini sudah dijadikan campaign.");
  const c = await createCampaign(
    user,
    {
      name: input.name,
      type: input.type,
      teamId: input.teamId,
      startDate: input.startDate,
      endDate: input.endDate,
      platforms: i.platforms,
      itemIds: i.itemIds,
      outletIds: [],
      objective: i.description,
      plannedBudget: 0,
      notes: `Dari Idea Hub: ${i.title}`,
    },
    requestId,
  );
  const batch = adminDb().batch();
  batch.update(col().doc(id), { linkedCampaignId: c.id, status: "In Production", updatedAt: FieldValue.serverTimestamp(), version: i.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user }, action: "idea_to_campaign", entity: "idea", entityId: id, teamId: input.teamId, from: i.status, to: "In Production", note: c.id, requestId });
  await batch.commit();
  return c;
}

export async function deleteIdea(admin: SessionUser, id: string, requestId: string, note = "") {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh padam. Ahli boleh mohon padam.");
  const i = await getIdea(id);
  if (!i) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
  const batch = adminDb().batch();
  batch.update(col().doc(id), { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id, version: i.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "idea", entityId: id, teamId: i.teamId, note: [i.title, note].filter(Boolean).join(". "), requestId });
  await batch.commit();
  return { id };
}
