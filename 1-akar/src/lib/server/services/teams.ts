import "server-only";
import { cache } from "react";
import { adminDb, FieldValue } from "../../firebase/admin";
import type { SessionUser, Team } from "../../domain/types";
import { AppError } from "../errors";
import { writeAudit, diff } from "../audit";

const col = () => adminDb().collection("teams");

export const listTeams = cache(async (): Promise<Team[]> => {
  const snap = await col().get();
  return snap.docs
    .filter((d) => d.get("deleted") !== true)
    .map((d) => ({ id: d.id, name: String(d.get("name") ?? d.id), color: String(d.get("color") ?? "#EC5A7E") }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export async function assertTeamsExist(teamIds: string[]): Promise<void> {
  if (teamIds.length === 0) return;
  const existing = new Set((await listTeams()).map((t) => t.id));
  const missing = teamIds.filter((id) => !existing.has(id));
  if (missing.length) throw new AppError("VALIDATION", undefined, { fields: { teamIds: `Team tidak wujud: ${missing.join(", ")}` } });
}

export async function createTeam(admin: SessionUser, input: { name: string; color: string }, requestId: string) {
  const all = await listTeams();
  if (all.some((t) => t.name.toLowerCase() === input.name.toLowerCase())) {
    throw new AppError("VALIDATION", undefined, { fields: { name: "Nama team sudah digunakan." } });
  }
  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, { ...input, createdAt: FieldValue.serverTimestamp(), createdBy: admin.id });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "create", entity: "team", entityId: ref.id, teamId: ref.id, note: input.name, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function updateTeam(admin: SessionUser, id: string, input: { name: string; color: string }, requestId: string) {
  const ref = col().doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Team tidak dijumpai.");
    const before = { name: snap.get("name"), color: snap.get("color") };
    const changes = diff(before, input);
    if (!changes) return;
    tx.update(ref, { ...input, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user: admin }, action: "update", entity: "team", entityId: id, teamId: id, changes, requestId });
  });
  return { id };
}

/** Admin: padam team. Disekat jika masih ada ahli, campaign atau rekod bajet. */
export async function deleteTeam(admin: SessionUser, id: string, requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.get("deleted") === true) throw new AppError("NOT_FOUND", "Team tidak dijumpai.");
  const db = adminDb();
  const [users, campaigns, expenses, budgets] = await Promise.all([
    db.collection("users").where("teamIds", "array-contains", id).get(),
    db.collection("campaigns").where("teamId", "==", id).get(),
    db.collection("expenses").where("teamId", "==", id).get(),
    db.collection("person_budgets").where("teamId", "==", id).get(),
  ]);
  const members = users.docs.filter((d) => d.get("deleted") !== true).length;
  const camps = campaigns.docs.filter((d) => d.get("deleted") !== true).length;
  const exps = expenses.docs.filter((d) => d.get("deleted") !== true).length;
  const bud = budgets.docs.filter((d) => Number(d.get("baseSen") ?? 0) + Number(d.get("carryForwardSen") ?? 0) + Number(d.get("topUpSen") ?? 0) > 0).length;
  const blockers = [members && `${members} ahli`, camps && `${camps} campaign`, exps && `${exps} perbelanjaan`, bud && `${bud} rekod bajet`].filter(Boolean);
  if (blockers.length) {
    throw new AppError("INVALID_TRANSITION", `Team masih ada ${blockers.join(", ")}. Pindahkan atau padam dahulu, kemudian cuba lagi.`);
  }
  const batch = db.batch();
  batch.update(ref, { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "team", entityId: id, teamId: id, note: String(snap.get("name") ?? id), requestId });
  await batch.commit();
  return { id };
}
