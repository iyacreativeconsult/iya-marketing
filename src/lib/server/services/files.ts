import "server-only";
import { randomBytes } from "node:crypto";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue } from "../../firebase/admin";
import { canViewOwnerFinance, canViewTeamFinance } from "../../domain/budget";
import { SHARED_FILE_PURPOSES, type FilePurpose, type FileRef, type SessionUser } from "../../domain/types";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { getObject, putObject } from "../storage";

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // had Vercel 4.5 MB setiap permintaan

const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  "application/pdf": { ext: "pdf", magic: (b) => b.subarray(0, 4).toString() === "%PDF" },
};

const col = () => adminDb().collection("files");

function toRef(d: DocumentSnapshot): FileRef & { teamId: string; ownerId: string; path: string; purpose: string; uploadedBy: string } {
  return {
    id: d.id,
    name: String(d.get("name") ?? "fail"),
    type: String(d.get("type") ?? "application/octet-stream"),
    size: Number(d.get("size") ?? 0),
    teamId: String(d.get("teamId") ?? ""),
    ownerId: String(d.get("ownerId") ?? ""),
    purpose: String(d.get("purpose") ?? ""),
    uploadedBy: String(d.get("uploadedBy") ?? ""),
    path: String(d.get("path") ?? ""),
  };
}

/**
 * ownerId = person yang memiliki rekod kewangan fail ini (resit, invois, bukti bayaran).
 * Ahli sentiasa diri sendiri. Admin boleh muat naik bagi pihak person (contoh bukti bayaran KOL).
 */
export async function uploadFile(user: SessionUser, teamId: string, purpose: FilePurpose, file: File, ownerIdInput: string, requestId: string): Promise<FileRef> {
  const shared = SHARED_FILE_PURPOSES.includes(purpose);
  if (shared) teamId = "shared"; // gambar rujukan idea: bukan milik mana-mana team
  else if (!canViewTeamFinance(user, teamId)) throw new AppError("FORBIDDEN", "Anda hanya boleh muat naik fail untuk team sendiri.");
  const ownerId = user.role === "admin" && !shared ? ownerIdInput || user.id : user.id;
  if (file.size === 0) throw new AppError("VALIDATION", "Fail kosong.", { fields: { file: "Fail kosong." } });
  if (file.size > MAX_FILE_BYTES) throw new AppError("VALIDATION", "Fail melebihi 4 MB.", { fields: { file: "Maksimum 4 MB." } });

  const kind = TYPES[file.type];
  const buf = Buffer.from(await file.arrayBuffer());
  // Semak isi sebenar fail, bukan hanya nama/jenis yang dihantar browser
  if (purpose === "idea_image" && file.type === "application/pdf") {
    throw new AppError("VALIDATION", "Hanya gambar (JPG, PNG, WEBP) untuk rujukan.", { fields: { file: "Hanya gambar." } });
  }
  if (!kind || !kind.magic(buf)) {
    throw new AppError("VALIDATION", "Hanya JPG, PNG, WEBP atau PDF dibenarkan.", { fields: { file: "Jenis fail tidak dibenarkan." } });
  }

  const id = randomBytes(12).toString("hex");
  const path = `${purpose}/${teamId}/${id}.${kind.ext}`;
  const name = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `fail.${kind.ext}`;
  await putObject(path, buf, file.type);

  const batch = adminDb().batch();
  batch.set(col().doc(id), { teamId, ownerId, purpose, path, name, type: file.type, size: file.size, uploadedBy: user.id, createdAt: FieldValue.serverTimestamp() });
  writeAudit(batch, { actor: { kind: "user", user }, action: "upload", entity: "file", entityId: id, teamId, note: `${purpose}: ${name}`, requestId });
  await batch.commit();
  return { id, name, type: file.type, size: file.size };
}

/** Pastikan fail wujud dan milik team + person yang sama sebelum dilampirkan pada rekod. */
export async function getFileRefForTeam(fileId: string | null, teamId: string, ownerId: string): Promise<FileRef | null> {
  if (!fileId) return null;
  const snap = await col().doc(fileId).get();
  if (!snap.exists) throw new AppError("VALIDATION", "Fail tidak dijumpai. Muat naik semula.");
  const f = toRef(snap);
  if (f.teamId !== teamId || (f.ownerId && f.ownerId !== ownerId)) throw new AppError("FORBIDDEN", "Fail ini milik person atau team lain. Muat naik semula.");
  return { id: f.id, name: f.name, type: f.type, size: f.size };
}

export async function readFileForUser(user: SessionUser, fileId: string) {
  if (!/^[a-f0-9]{24}$/.test(fileId)) throw new AppError("NOT_FOUND", "Fail tidak dijumpai.");
  const snap = await col().doc(fileId).get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Fail tidak dijumpai.");
  const f = toRef(snap);
  const shared = SHARED_FILE_PURPOSES.includes(f.purpose as FilePurpose);
  if (!shared && !canViewOwnerFinance(user, f.ownerId)) throw new AppError("NOT_FOUND", "Fail tidak dijumpai."); // jangan dedahkan kewujudan
  return { ...f, data: await getObject(f.path) };
}

/**
 * Gambar rujukan idea: mesti wujud, jenis idea_image, dan dimuat naik oleh pengguna ini
 * (atau Admin). Gambar yang sudah ada pada idea sebelum ini sentiasa diterima.
 */
export async function getIdeaImageRefs(user: SessionUser, ids: string[], existing: FileRef[] = []): Promise<FileRef[]> {
  const out: FileRef[] = [];
  for (const fid of ids) {
    const keep = existing.find((e) => e.id === fid);
    if (keep) {
      out.push(keep);
      continue;
    }
    const snap = await col().doc(fid).get();
    if (!snap.exists) throw new AppError("VALIDATION", "Gambar tidak dijumpai. Muat naik semula.", { fields: { imageIds: "Gambar tidak dijumpai." } });
    const f = toRef(snap);
    if (f.purpose !== "idea_image" || (user.role !== "admin" && f.uploadedBy !== user.id)) {
      throw new AppError("FORBIDDEN", "Gambar ini bukan milik anda.");
    }
    out.push({ id: f.id, name: f.name, type: f.type, size: f.size });
  }
  return out;
}

/** Fail asset Content Library: mesti purpose "asset" dan dimuat naik oleh pengguna ini (atau Admin). */
export async function getAssetFileRef(user: SessionUser, fid: string | null, existing: FileRef | null): Promise<FileRef | null> {
  if (!fid) return null;
  if (existing?.id === fid) return existing;
  const snap = await col().doc(fid).get();
  if (!snap.exists) throw new AppError("VALIDATION", "Fail tidak dijumpai. Muat naik semula.", { fields: { url: "Fail tidak dijumpai." } });
  const f = toRef(snap);
  if (f.purpose !== "asset" || (user.role !== "admin" && f.uploadedBy !== user.id)) throw new AppError("FORBIDDEN", "Fail ini bukan milik anda.");
  return { id: f.id, name: f.name, type: f.type, size: f.size };
}
