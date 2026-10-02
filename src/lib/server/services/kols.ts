import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import type { Kol, KolPrivate, SessionUser } from "../../domain/types";
import type { KolInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { assertTeamsExist } from "./teams";
import { assertInList } from "./master";

async function assertLists(input: KolInput, before?: Kol) {
  await Promise.all([
    assertInList("platforms", input.accounts.map((a) => a.platform), "accounts", before?.accounts.map((a) => a.platform) ?? []),
    assertInList("niches", input.niches, "niches", before?.niches ?? []),
  ]);
}

const col = () => adminDb().collection("kols");
const priv = () => adminDb().collection("kol_private");

export function toKol(d: DocumentSnapshot): Kol {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    name: String(g("name") ?? ""),
    realName: String(g("realName") ?? ""),
    accounts: Array.isArray(g("accounts")) ? g("accounts") : [],
    niches: Array.isArray(g("niches")) ? g("niches") : g("niche") ? [String(g("niche"))] : [],
    location: String(g("location") ?? ""),
    contact: String(g("contact") ?? ""),
    whatsapp: String(g("whatsapp") ?? ""),
    rateSen: Number(g("rateSen") ?? 0),
    status: g("status") ?? "Aktif",
    remark: String(g("remark") ?? ""),
    ownerTeamId: String(g("ownerTeamId") ?? ""),
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    version: Number(g("version") ?? 1),
    deleted: g("deleted") === true,
  };
}

export async function listKols(): Promise<Kol[]> {
  const snap = await col().where("deleted", "==", false).get();
  return snap.docs.map(toKol).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getKol(id: string): Promise<Kol | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const k = toKol(snap);
  return k.deleted ? null : k;
}

/** Profil KOL: pencipta team atau Admin boleh ubah. */
export function canEditKol(user: SessionUser, kol: Pick<Kol, "ownerTeamId">): boolean {
  return user.role === "admin" || user.teamIds.includes(kol.ownerTeamId);
}

async function assertNoDuplicate(input: KolInput, excludeId?: string) {
  const all = await listKols();
  for (const acc of input.accounts) {
    const dup = all.find(
      (k) => k.id !== excludeId && k.accounts.some((a) => a.platform === acc.platform && a.username.toLowerCase() === acc.username.toLowerCase()),
    );
    if (dup) {
      throw new AppError("VALIDATION", `@${acc.username} (${acc.platform}) sudah wujud dalam database sebagai "${dup.name}".`, {
        fields: { accounts: `Sudah wujud: ${dup.name}` },
      });
    }
  }
}

function fields(input: KolInput) {
  return {
    name: input.name,
    realName: input.realName,
    accounts: input.accounts,
    niches: input.niches,
    location: input.location,
    contact: input.contact,
    whatsapp: input.whatsapp,
    rateSen: input.rate,
    status: input.status,
    remark: input.remark,
    ownerTeamId: input.ownerTeamId,
  };
}

export async function createKol(user: SessionUser, input: KolInput, requestId: string) {
  if (user.role !== "admin" && !user.teamIds.includes(input.ownerTeamId)) throw new AppError("FORBIDDEN", "Pilih team anda sendiri.");
  if (input.status === "Blacklist" && user.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh blacklist KOL.");
  await assertTeamsExist([input.ownerTeamId]);
  await assertNoDuplicate(input);
  await assertLists(input);
  const ref = col().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    ...fields(input),
    version: 1,
    deleted: false,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  writeAudit(batch, { actor: { kind: "user", user }, action: "create", entity: "kol", entityId: ref.id, teamId: input.ownerTeamId, note: input.name, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function updateKol(user: SessionUser, id: string, version: number, input: KolInput, requestId: string) {
  await assertNoDuplicate(input, id);
  const current = await getKol(id);
  if (current) await assertLists(input, current);
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "KOL tidak dijumpai.");
    const before = toKol(snap);
    if (before.deleted) throw new AppError("NOT_FOUND", "KOL tidak dijumpai.");
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditKol(user, before)) throw new AppError("FORBIDDEN", "Hanya team pencipta atau Admin boleh ubah profil KOL ini.");
    const next = fields(input);
    if (user.role !== "admin") {
      next.ownerTeamId = before.ownerTeamId;
      if ((before.status === "Blacklist") !== (next.status === "Blacklist")) throw new AppError("FORBIDDEN", "Hanya Admin boleh ubah status Blacklist.");
    }
    const changes = diff(before as unknown as Record<string, unknown>, next);
    if (!changes) return { id };
    tx.update(ref, { ...next, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "update", entity: "kol", entityId: id, teamId: before.ownerTeamId, changes, requestId });
    return { id };
  });
}

/**
 * Maklumat bank: Admin, team pencipta, atau team yang sedang menguruskan KOL
 * ini dalam mana-mana campaign (tidak termasuk yang digugurkan).
 */
export async function canViewKolPrivate(user: SessionUser, kol: Kol): Promise<boolean> {
  if (user.role === "admin" || user.teamIds.includes(kol.ownerTeamId)) return true;
  if (user.teamIds.length === 0) return false;
  const snap = await adminDb().collection("campaign_kols").where("kolId", "==", kol.id).get();
  return snap.docs.some((d) => d.get("deleted") !== true && d.get("stage") !== "Dropped" && user.teamIds.includes(String(d.get("teamId"))));
}

export async function getKolPrivate(user: SessionUser, kolId: string): Promise<KolPrivate | null> {
  const kol = await getKol(kolId);
  if (!kol || !(await canViewKolPrivate(user, kol))) return null;
  const snap = await priv().doc(kolId).get();
  return {
    bankName: String(snap.get("bankName") ?? ""),
    accountNo: String(snap.get("accountNo") ?? ""),
    accountName: String(snap.get("accountName") ?? ""),
    updatedAt: toIso(snap.get("updatedAt")),
  };
}

export async function setKolPrivate(user: SessionUser, kolId: string, input: { bankName: string; accountNo: string; accountName: string }, requestId: string) {
  const kol = await getKol(kolId);
  if (!kol || !(await canViewKolPrivate(user, kol))) throw new AppError("NOT_FOUND", "KOL tidak dijumpai.");
  const batch = adminDb().batch();
  batch.set(priv().doc(kolId), { ...input, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.id });
  // Nilai bank TIDAK dimasukkan dalam audit log
  writeAudit(batch, { actor: { kind: "user", user }, action: "update_bank", entity: "kol", entityId: kolId, teamId: kol.ownerTeamId, note: "Maklumat bank dikemas kini", requestId });
  await batch.commit();
  return { id: kolId };
}

/** Admin: padam profil KOL. Disekat jika KOL masih aktif dalam campaign. */
export async function deleteKol(admin: SessionUser, id: string, requestId: string, note = "") {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh padam. Ahli boleh mohon padam.");
  const kol = await getKol(id);
  if (!kol) throw new AppError("NOT_FOUND", "KOL tidak dijumpai.");
  const cks = await adminDb().collection("campaign_kols").where("kolId", "==", id).get();
  const active = cks.docs.filter((d) => d.get("deleted") !== true && !["Completed", "Dropped"].includes(String(d.get("stage"))));
  if (active.length) {
    throw new AppError("INVALID_TRANSITION", `KOL ini masih aktif dalam ${active.length} campaign (${active.map((d) => d.get("campaignName")).join(", ")}). Gugurkan atau selesaikan dahulu.`);
  }
  const batch = adminDb().batch();
  batch.update(col().doc(id), { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id, version: kol.version + 1 });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "kol", entityId: id, teamId: kol.ownerTeamId, note: [kol.name, note].filter(Boolean).join(". "), requestId });
  await batch.commit();
  return { id };
}
