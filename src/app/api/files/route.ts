import { userRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { MAX_FILE_BYTES, uploadFile } from "@/lib/server/services/files";
import { FILE_PURPOSES, type FilePurpose } from "@/lib/domain/types";

/** Muat naik resit / invois / bukti bayaran (multipart/form-data: file, teamId, purpose). */
export const POST = userRoute(async ({ req, user, requestId }) => {
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) throw new AppError("BAD_REQUEST", "Gunakan multipart/form-data.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_FILE_BYTES + 64_000) throw new AppError("VALIDATION", "Fail melebihi 4 MB.", { fields: { file: "Maksimum 4 MB." } });
  const form = await req.formData();
  const file = form.get("file");
  const teamId = String(form.get("teamId") ?? "");
  const purpose = String(form.get("purpose") ?? "") as FilePurpose;
  const ownerId = String(form.get("ownerId") ?? "");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Tiada fail dihantar.");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(teamId) || !FILE_PURPOSES.includes(purpose) || (ownerId && !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId))) throw new AppError("BAD_REQUEST");
  return uploadFile(user, teamId, purpose, file, ownerId, requestId);
});
