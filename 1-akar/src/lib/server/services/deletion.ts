import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import { canRequestDeleteCampaign } from "../../domain/campaign";
import { canRequestDeleteExpense } from "../../domain/budget";
import type { DeleteRequest, DeleteRequestEntity, SessionUser } from "../../domain/types";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { deleteCampaign, getCampaign } from "./campaigns";
import { deleteExpense, toExpense } from "./budget";
import { canEditKol, deleteKol, getKol } from "./kols";
import { deleteIdea, getIdea } from "./ideas";
import { deleteBank, getBank } from "./contentBank";
import { canRequestDeleteBank, canRequestDeleteIdea } from "../../domain/idea";
import { canRequestDeleteAsset, canRequestDeleteContent } from "../../domain/content";
import { deleteContent, getContent } from "./content";
import { deleteAsset, getAsset } from "./assets";

/*
 * Ahli tidak boleh padam terus. Mereka MOHON padam (dengan sebab), Admin luluskan.
 * Bila diluluskan, rekod dipadam lembut dan boleh dipulihkan di Tong sampah.
 */

const col = () => adminDb().collection("delete_requests");

function toReq(d: DocumentSnapshot): DeleteRequest {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    entity: g("entity"),
    entityId: String(g("entityId") ?? ""),
    entityName: String(g("entityName") ?? ""),
    teamId: String(g("teamId") ?? ""),
    reason: String(g("reason") ?? ""),
    status: g("status") ?? "Pending",
    requestedBy: String(g("requestedBy") ?? ""),
    requestedByName: String(g("requestedByName") ?? ""),
    reviewNote: String(g("reviewNote") ?? ""),
    reviewedByName: String(g("reviewedByName") ?? ""),
    version: Number(g("version") ?? 1),
    createdAt: toIso(g("createdAt")),
  };
}

export const ENTITY_LABEL: Record<DeleteRequestEntity, string> = { campaign: "Campaign", expense: "Perbelanjaan", kol: "Profil KOL", idea: "Idea", bank: "Content Bank", content: "Content", asset: "Asset" };

/** Semak pengguna boleh mohon padam rekod ini, dan pulangkan nama + team rekod. */
async function describe(user: SessionUser, entity: DeleteRequestEntity, id: string): Promise<{ name: string; teamId: string }> {
  if (entity === "campaign") {
    const c = await getCampaign(id);
    if (!c) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
    if (!canRequestDeleteCampaign(user, c)) throw new AppError("FORBIDDEN", "Anda bukan ahli team pemilik campaign ini.");
    return { name: c.name, teamId: c.teamId };
  }
  if (entity === "expense") {
    const snap = await adminDb().collection("expenses").doc(id).get();
    if (!snap.exists) throw new AppError("NOT_FOUND", "Perbelanjaan tidak dijumpai.");
    const e = toExpense(snap);
    if (!canRequestDeleteExpense(user, e)) throw new AppError(e.kolPaymentId ? "INVALID_TRANSITION" : "NOT_FOUND", e.kolPaymentId ? "Perbelanjaan dari bayaran KOL tidak boleh dipadam." : "Perbelanjaan tidak dijumpai.");
    return { name: `${e.description} (RM ${(e.amountSen / 100).toFixed(2)})`, teamId: e.teamId };
  }
  if (entity === "idea") {
    const i = await getIdea(id);
    if (!i) throw new AppError("NOT_FOUND", "Idea tidak dijumpai.");
    if (!canRequestDeleteIdea(user, i)) throw new AppError("FORBIDDEN", "Hanya pencipta idea boleh mohon padam.");
    return { name: i.title, teamId: i.teamId };
  }
  if (entity === "content") {
    const c = await getContent(id);
    if (!c) throw new AppError("NOT_FOUND", "Content tidak dijumpai.");
    if (!canRequestDeleteContent(user, c)) throw new AppError("FORBIDDEN", "Hanya ahli team boleh mohon padam.");
    return { name: c.title, teamId: c.teamId };
  }
  if (entity === "asset") {
    const a = await getAsset(id);
    if (!a) throw new AppError("NOT_FOUND", "Asset tidak dijumpai.");
    if (!canRequestDeleteAsset(user, a)) throw new AppError("FORBIDDEN", "Hanya ahli team boleh mohon padam.");
    return { name: a.name, teamId: a.teamId };
  }
  if (entity === "bank") {
    const b = await getBank(id);
    if (!b) throw new AppError("NOT_FOUND", "Entry tidak dijumpai.");
    if (!canRequestDeleteBank(user, b)) throw new AppError("FORBIDDEN", "Hanya team pemilik boleh mohon padam.");
    return { name: b.hook, teamId: b.teamId };
  }
  const k = await getKol(id);
  if (!k) throw new AppError("NOT_FOUND", "KOL tidak dijumpai.");
  if (user.role === "admin" || !canEditKol(user, k)) throw new AppError("FORBIDDEN", "Hanya team pencipta profil boleh mohon padam.");
  return { name: k.name, teamId: k.ownerTeamId };
}

export async function requestDelete(user: SessionUser, entity: DeleteRequestEntity, entityId: string, reason: string, requestId: string) {
  const info = await describe(user, entity, entityId);
  const dup = await col().where("entityId", "==", entityId).get();
  if (dup.docs.some((d) => d.get("status") === "Pending" && d.get("entity") === entity)) {
    throw new AppError("VALIDATION", "Permohonan padam untuk rekod ini sudah dihantar dan sedang menunggu Admin.");
  }
  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    entity,
    entityId,
    entityName: info.name,
    teamId: info.teamId,
    reason,
    status: "Pending",
    requestedBy: user.id,
    requestedByName: user.name,
    reviewNote: "",
    reviewedByName: "",
    version: 1,
    createdAt: FieldValue.serverTimestamp(),
  });
  writeAudit(batch, { actor: { kind: "user", user }, action: "delete_request", entity, entityId, teamId: info.teamId, to: "Pending", note: reason, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function listDeleteRequests(user: SessionUser): Promise<DeleteRequest[]> {
  const snap = user.role === "admin" ? await col().get() : await col().where("requestedBy", "==", user.id).get();
  return snap.docs.map(toReq).sort((a, b) => (a.status === "Pending" ? 0 : 1) - (b.status === "Pending" ? 0 : 1) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function reviewDelete(admin: SessionUser, id: string, action: "approve" | "reject", note: string, version: number, requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Permohonan tidak dijumpai.");
  const r = toReq(snap);
  if (r.version !== version) throw new AppError("CONFLICT");
  if (r.status !== "Pending") throw new AppError("INVALID_TRANSITION", "Permohonan ini sudah disemak.");
  if (action === "reject" && note.trim().length < 3) throw new AppError("VALIDATION", "Sila tulis sebab ditolak.", { fields: { note: "Wajib diisi." } });

  if (action === "approve") {
    // Padam dahulu. Jika gagal (contoh KOL masih aktif), permohonan kekal Pending dan Admin nampak sebabnya.
    const why = `Kelulusan permohonan padam oleh ${r.requestedByName}: ${r.reason}`;
    if (r.entity === "campaign") await deleteCampaign(admin, r.entityId, null, requestId, why);
    else if (r.entity === "expense") await deleteExpense(admin, r.entityId, null, requestId, why);
    else if (r.entity === "idea") await deleteIdea(admin, r.entityId, requestId, why);
    else if (r.entity === "bank") await deleteBank(admin, r.entityId, requestId, why);
    else if (r.entity === "content") await deleteContent(admin, r.entityId, requestId, why);
    else if (r.entity === "asset") await deleteAsset(admin, r.entityId, requestId, why);
    else await deleteKol(admin, r.entityId, requestId, why);
  }
  const batch = adminDb().batch();
  batch.update(ref, { status: action === "approve" ? "Approved" : "Rejected", reviewNote: note.trim(), reviewedBy: admin.id, reviewedByName: admin.name, version: r.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: `delete_${action}`, entity: r.entity, entityId: r.entityId, teamId: r.teamId, from: "Pending", to: action === "approve" ? "Approved" : "Rejected", note: note.trim(), requestId });
  await batch.commit();
  return { id, status: action };
}
