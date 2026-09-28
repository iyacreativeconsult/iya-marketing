import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminAuth, adminDb, FieldValue, toIso } from "../../firebase/admin";
import type { AppUser, Role, SessionUser } from "../../domain/types";
import { AppError } from "../errors";
import { writeAudit, diff } from "../audit";
import { assertTeamsExist } from "./teams";
import { log } from "../logger";

const col = () => adminDb().collection("users");

export interface UserRow extends AppUser {
  deleted: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

function toUser(d: DocumentSnapshot): UserRow {
  return {
    id: d.id,
    name: String(d.get("name") ?? ""),
    email: String(d.get("email") ?? ""),
    role: (d.get("role") === "admin" ? "admin" : "member") as Role,
    teamIds: Array.isArray(d.get("teamIds")) ? (d.get("teamIds") as string[]) : [],
    active: d.get("active") === true && d.get("deleted") !== true,
    deleted: d.get("deleted") === true,
    lastLoginAt: toIso(d.get("lastLoginAt")),
    createdAt: toIso(d.get("createdAt")),
  };
}

export async function getUserById(uid: string): Promise<UserRow | null> {
  const snap = await col().doc(uid).get();
  return snap.exists ? toUser(snap) : null;
}

export async function listUsers(): Promise<UserRow[]> {
  const snap = await col().get();
  return snap.docs.map(toUser).sort((a, b) => a.name.localeCompare(b.name));
}

export async function markLogin(uid: string): Promise<void> {
  await col().doc(uid).update({ lastLoginAt: FieldValue.serverTimestamp() });
}

export async function createUser(
  admin: SessionUser,
  input: { name: string; email: string; password: string; role: Role; teamIds: string[] },
  requestId: string,
) {
  await assertTeamsExist(input.teamIds);

  let uid: string;
  try {
    const rec = await adminAuth().createUser({ email: input.email, password: input.password, displayName: input.name });
    uid = rec.uid;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      throw new AppError("VALIDATION", undefined, { fields: { email: "Email ini sudah didaftarkan." } });
    }
    throw e;
  }

  try {
    const batch = adminDb().batch();
    batch.set(col().doc(uid), {
      name: input.name,
      email: input.email,
      role: input.role,
      teamIds: input.teamIds,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: admin.id,
    });
    writeAudit(batch, {
      actor: { kind: "user", user: admin },
      action: "create",
      entity: "user",
      entityId: uid,
      note: `${input.name} (${input.email}), peranan ${input.role}, team ${input.teamIds.join(", ") || "-"}`,
      requestId,
    });
    await batch.commit();
  } catch (e) {
    // Rollback: jangan tinggalkan akaun Auth tanpa profil
    await adminAuth().deleteUser(uid).catch((err) => log("error", "rollback deleteUser gagal", { requestId, uid, err: String(err) }));
    throw e;
  }
  return { id: uid };
}

export async function updateUser(
  admin: SessionUser,
  id: string,
  patch: { name?: string; role?: Role; teamIds?: string[]; active?: boolean; password?: string },
  requestId: string,
) {
  if (id === admin.id && (patch.active === false || patch.role === "member")) {
    throw new AppError("FORBIDDEN", "Anda tidak boleh buang akses Admin atau nyahaktif akaun sendiri.");
  }
  if (patch.teamIds) await assertTeamsExist(patch.teamIds);

  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Pengguna tidak dijumpai.");
  const before = toUser(snap);

  // Kata laluan: tukar di Auth dahulu. Jika gagal, tiada apa yang berubah.
  if (patch.password) {
    await adminAuth().updateUser(id, { password: patch.password });
  }

  const { password, ...profile } = patch;
  const changes = diff(before as unknown as Record<string, unknown>, profile) ?? {};
  if (password) changes.password = { from: "***", to: "diset semula" };

  if (Object.keys(changes).length === 0) return { id };

  const batch = adminDb().batch();
  batch.update(ref, { ...profile, updatedAt: FieldValue.serverTimestamp() });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "update", entity: "user", entityId: id, changes, requestId });
  await batch.commit();

  // Sekat log masuk & tamatkan semua sesi bila akaun dinyahaktif atau kata laluan ditukar
  if (patch.active === false || password) {
    await adminAuth().revokeRefreshTokens(id);
  }
  if (patch.active !== undefined) {
    await adminAuth().updateUser(id, { disabled: !patch.active });
  }
  if (patch.name) {
    await adminAuth().updateUser(id, { displayName: patch.name });
  }
  return { id };
}

/**
 * Admin: padam pengguna. Akses log masuk dibuang terus (akaun Firebase Auth dipadam),
 * profil disorok. Nama kekal dalam rekod lama (perbelanjaan, KOL, audit) untuk sejarah.
 */
export async function deleteUser(admin: SessionUser, id: string, requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  if (id === admin.id) throw new AppError("FORBIDDEN", "Anda tidak boleh padam akaun sendiri.");
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.get("deleted") === true) throw new AppError("NOT_FOUND", "Pengguna tidak dijumpai.");
  const u = toUser(snap);
  const batch = adminDb().batch();
  batch.update(ref, { deleted: true, active: false, deletedAt: FieldValue.serverTimestamp(), deletedBy: admin.id });
  writeAudit(batch, { actor: { kind: "user", user: admin }, action: "delete", entity: "user", entityId: id, note: `${u.name} (${u.email})`, requestId });
  await batch.commit();
  await adminAuth()
    .deleteUser(id)
    .catch((e) => {
      if ((e as { code?: string }).code !== "auth/user-not-found") log("error", "deleteUser auth gagal", { requestId, uid: id, err: String(e) });
    });
  return { id };
}
