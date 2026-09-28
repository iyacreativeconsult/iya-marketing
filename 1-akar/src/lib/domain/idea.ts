/**
 * Peraturan Idea Hub dan Content Bank (pure, diuji dalam tests/idea.test.ts).
 */
import type { AppUser, BankEntry, Idea, IdeaStatus } from "./types";

type UserLike = Pick<AppUser, "id" | "role" | "teamIds">;

export const IDEA_STATUS_INFO: Record<IdeaStatus, { label: string; cls: string }> = {
  New: { label: "Idea baru", cls: "bg-stone-100 text-stone-700" },
  Discussing: { label: "Dibincang", cls: "bg-sky-50 text-sky-800" },
  Approved: { label: "Diluluskan", cls: "bg-emerald-50 text-emerald-800" },
  "In Production": { label: "Dalam produksi", cls: "bg-violet-50 text-violet-800" },
  Published: { label: "Published", cls: "bg-emerald-600 text-white" },
  Rejected: { label: "Ditolak", cls: "bg-red-50 text-red-700" },
};

const OPEN: IdeaStatus[] = ["New", "Discussing"];

/** Pencipta boleh ubah semasa idea masih dibincang. Admin sentiasa boleh. */
export function canEditIdea(user: UserLike, idea: Pick<Idea, "createdBy" | "status" | "deleted">): boolean {
  if (idea.deleted) return false;
  if (user.role === "admin") return true;
  return idea.createdBy === user.id && OPEN.includes(idea.status);
}

export function checkIdeaReview(
  user: UserLike,
  idea: Pick<Idea, "status" | "deleted">,
  action: "approve" | "reject" | "reopen",
  note: string,
): { ok: true; to: IdeaStatus } | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string } {
  if (user.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Hanya Admin boleh lulus atau tolak idea." };
  if (idea.deleted) return { ok: false, code: "INVALID_TRANSITION", message: "Idea telah dipadam." };
  if (action === "reopen") {
    if (idea.status !== "Rejected") return { ok: false, code: "INVALID_TRANSITION", message: "Hanya idea yang ditolak boleh dibuka semula." };
    return { ok: true, to: "Discussing" };
  }
  if (!OPEN.includes(idea.status)) return { ok: false, code: "INVALID_TRANSITION", message: `Idea berstatus ${idea.status} tidak boleh disemak lagi.` };
  if (action === "reject" && note.trim().length < 3) return { ok: false, code: "VALIDATION", message: "Sila tulis sebab ditolak." };
  return { ok: true, to: action === "approve" ? "Approved" : "Rejected" };
}

/** Selepas diluluskan: pencipta atau Admin boleh masukkan ke Content Bank / jadikan campaign. */
export function canConvertIdea(user: UserLike, idea: Pick<Idea, "createdBy" | "status" | "deleted">): boolean {
  if (idea.deleted || (idea.status !== "Approved" && idea.status !== "In Production")) return false;
  return user.role === "admin" || idea.createdBy === user.id;
}

/** Komen atau vote pertama menukar "Idea baru" kepada "Dibincang". */
export function statusAfterEngagement(status: IdeaStatus): IdeaStatus {
  return status === "New" ? "Discussing" : status;
}

export function canRequestDeleteIdea(user: UserLike, idea: Pick<Idea, "createdBy" | "deleted">): boolean {
  return !idea.deleted && user.role !== "admin" && idea.createdBy === user.id;
}

/* ------------------------------ Content Bank ------------------------------ */

export function canEditBank(user: UserLike, b: Pick<BankEntry, "teamId" | "deleted">): boolean {
  return !b.deleted && (user.role === "admin" || user.teamIds.includes(b.teamId));
}

export function canRequestDeleteBank(user: UserLike, b: Pick<BankEntry, "teamId" | "deleted">): boolean {
  return !b.deleted && user.role !== "admin" && user.teamIds.includes(b.teamId);
}
