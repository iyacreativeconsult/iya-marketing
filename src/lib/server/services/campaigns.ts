import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import type { Actor, Campaign, CampaignStatus, SessionUser } from "../../domain/types";
import {
  canCreateCampaign,
  canDeleteCampaign,
  canEditCampaign,
  checkTransition,
  editNeedsReapproval,
  findConflicts,
  type CampaignAction,
} from "../../domain/campaign";
import { todayMYT } from "../../domain/dates";
import type { CampaignInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertTeamsExist } from "./teams";
import { assertInList } from "./master";
import { assertItemsValid, assertOutletsValid } from "./catalog";

/** Semak jenis, platform, item dan outlet wujud dalam Tetapan. */
async function assertLists(input: CampaignInput, before?: Campaign) {
  await Promise.all([
    assertInList("campaignTypes", [input.type], "type", before ? [before.type] : []),
    assertInList("platforms", input.platforms, "platforms", before?.platforms ?? []),
    assertItemsValid(input.itemIds, before?.itemIds ?? []),
    assertOutletsValid(input.outletIds, before?.outletIds ?? []),
  ]);
}
import { log } from "../logger";

const col = () => adminDb().collection("campaigns");

function toCampaign(d: DocumentSnapshot): Campaign {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    name: String(g("name") ?? ""),
    type: g("type"),
    teamId: String(g("teamId") ?? ""),
    startDate: String(g("startDate") ?? ""),
    endDate: String(g("endDate") ?? ""),
    platforms: Array.isArray(g("platforms")) ? g("platforms") : [],
    itemIds: Array.isArray(g("itemIds")) ? g("itemIds") : [],
    outletIds: Array.isArray(g("outletIds")) ? g("outletIds") : [],
    objective: String(g("objective") ?? ""),
    plannedBudgetSen: Number(g("plannedBudgetSen") ?? 0),
    notes: String(g("notes") ?? ""),
    status: g("status") as CampaignStatus,
    statusNote: String(g("statusNote") ?? ""),
    version: Number(g("version") ?? 1),
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    deleted: g("deleted") === true,
  };
}

/** Campaign (tidak dipadam) yang bertindih dengan julat [from, to]. Perlu index: deleted + endDate. */
export async function listCampaignsInRange(from: string, to: string): Promise<Campaign[]> {
  const snap = await col().where("deleted", "==", false).where("endDate", ">=", from).orderBy("endDate").get();
  return snap.docs
    .map(toCampaign)
    .filter((c) => c.startDate <= to)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const c = toCampaign(snap);
  return c.deleted ? null : c;
}

export async function getConflicts(c: Campaign): Promise<Campaign[]> {
  const others = await listCampaignsInRange(c.startDate, c.endDate);
  return findConflicts(c, others) as Campaign[];
}

function fieldsFromInput(input: CampaignInput) {
  return {
    name: input.name,
    type: input.type,
    teamId: input.teamId,
    startDate: input.startDate,
    endDate: input.endDate,
    platforms: input.platforms,
    itemIds: input.itemIds,
    outletIds: input.outletIds,
    objective: input.objective,
    plannedBudgetSen: input.plannedBudget,
    notes: input.notes,
  };
}

export async function createCampaign(user: SessionUser, input: CampaignInput, requestId: string) {
  if (!canCreateCampaign(user, input.teamId)) {
    throw new AppError("FORBIDDEN", "Anda hanya boleh cipta campaign untuk team sendiri.");
  }
  await assertTeamsExist([input.teamId]);
  await assertLists(input);

  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    ...fieldsFromInput(input),
    status: "Idea",
    statusNote: "",
    version: 1,
    deleted: false,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  writeAudit(batch, {
    actor: { kind: "user", user },
    action: "create",
    entity: "campaign",
    entityId: ref.id,
    teamId: input.teamId,
    to: "Idea",
    note: input.name,
    requestId,
  });
  await batch.commit();
  return { id: ref.id };
}

export async function updateCampaign(user: SessionUser, id: string, version: number, input: CampaignInput, requestId: string) {
  const ref = col().doc(id);
  const current = await getCampaign(id);
  if (current) await assertLists(input, current);
  const result = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
    const before = toCampaign(snap);
    if (before.deleted) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditCampaign(user, before)) throw new AppError("FORBIDDEN", "Anda tidak boleh ubah campaign ini pada status semasa.");

    const next = fieldsFromInput(input);
    // Hanya Admin boleh pindah campaign ke team lain
    if (user.role !== "admin") next.teamId = before.teamId;
    if (next.teamId !== before.teamId) await assertTeamsExist([next.teamId]);

    const changes = diff(before as unknown as Record<string, unknown>, next);
    if (!changes) return { id, reapproval: false, changed: false };

    const reapproval = editNeedsReapproval(user, before, next);
    const update: Record<string, unknown> = { ...next, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() };
    if (reapproval) {
      update.status = "Planning";
      update.statusNote = "Tarikh atau bajet diubah selepas kelulusan. Perlu kelulusan semula.";
    }
    tx.update(ref, update);
    writeAudit(tx, {
      actor: { kind: "user", user },
      action: reapproval ? "update_reapproval" : "update",
      entity: "campaign",
      entityId: id,
      teamId: next.teamId,
      from: reapproval ? before.status : null,
      to: reapproval ? "Planning" : null,
      changes,
      requestId,
    });
    return { id, reapproval, changed: true };
  });
  return result;
}

export async function transitionCampaign(
  actor: Actor,
  id: string,
  action: CampaignAction,
  note: string,
  version: number | null,
  requestId: string,
) {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
    const c = toCampaign(snap);
    if (version !== null && c.version !== version) throw new AppError("CONFLICT");

    const r = checkTransition(actor, c, action, note);
    if (!r.ok) {
      if (r.reason === "FORBIDDEN") throw new AppError("FORBIDDEN", r.message);
      if (r.reason === "NOTE_REQUIRED") throw new AppError("VALIDATION", r.message, { fields: { note: r.message } });
      throw new AppError("INVALID_TRANSITION", r.message);
    }

    tx.update(ref, {
      status: r.to,
      statusNote: note.trim(),
      version: c.version + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAudit(tx, {
      actor,
      action,
      entity: "campaign",
      entityId: id,
      teamId: c.teamId,
      from: c.status,
      to: r.to,
      note: note.trim(),
      requestId,
    });
    return { id, status: r.to, version: c.version + 1 };
  });
}

export async function deleteCampaign(user: SessionUser, id: string, version: number | null, requestId: string, note = "") {
  const ref = col().doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
    const c = toCampaign(snap);
    if (version !== null && c.version !== version) throw new AppError("CONFLICT");
    if (!canDeleteCampaign(user, c)) throw new AppError("FORBIDDEN", "Hanya Admin boleh padam. Ahli boleh mohon padam.");
    // Padam lembut: rekod kekal untuk audit dan boleh dipulihkan oleh Admin di Firestore
    tx.update(ref, { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: user.id, version: c.version + 1 });
    writeAudit(tx, { actor: { kind: "user", user }, action: "delete", entity: "campaign", entityId: id, teamId: c.teamId, from: c.status, note: [c.name, note].filter(Boolean).join(". "), requestId });
  });
  return { id };
}

/**
 * Tugas harian (Vercel Cron 00:05 waktu Malaysia):
 *  - Scheduled yang tarikh mulanya sudah tiba  -> Ongoing
 *  - Ongoing yang tarikh tamatnya sudah lepas  -> Completed
 * Selamat dijalankan berulang kali (idempotent).
 */
export async function runCampaignStatusJob(requestId: string, today: string = todayMYT()) {
  const system: Actor = { kind: "system" };
  const snap = await col().where("status", "in", ["Scheduled", "Ongoing"]).get();
  const started: string[] = [];
  const completed: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const doc of snap.docs) {
    const c = toCampaign(doc);
    if (c.deleted) continue;
    try {
      let status = c.status;
      if (status === "Scheduled" && c.startDate <= today) {
        await transitionCampaign(system, c.id, "start", "Automatik: tarikh mula tiba.", null, requestId);
        started.push(c.id);
        status = "Ongoing";
      }
      if (status === "Ongoing" && c.endDate < today) {
        await transitionCampaign(system, c.id, "complete", "Automatik: tarikh tamat sudah lepas.", null, requestId);
        completed.push(c.id);
      }
    } catch (e) {
      failed.push({ id: c.id, error: e instanceof Error ? e.message : String(e) });
      log("error", "status job gagal untuk campaign", { requestId, campaignId: c.id, err: String(e) });
    }
  }
  log("info", "status job selesai", { requestId, today, started: started.length, completed: completed.length, failed: failed.length });
  return { today, started, completed, failed };
}
