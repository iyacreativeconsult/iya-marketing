/**
 * Peraturan produksi content dan Content Library (pure, diuji dalam tests/content.test.ts).
 */
import type { AppUser, Asset, AssetStatus, ContentItem, ContentStatus } from "./types";
import { diffDays } from "./dates";

type UserLike = Pick<AppUser, "id" | "role" | "teamIds">;

const isTeam = (u: UserLike, teamId: string) => u.role === "admin" || u.teamIds.includes(teamId);

export const CONTENT_STATUS_CLS: Record<ContentStatus, string> = {
  Idea: "bg-stone-100 text-stone-700",
  Script: "bg-sky-50 text-sky-800",
  Production: "bg-indigo-50 text-indigo-800",
  Editing: "bg-violet-50 text-violet-800",
  Review: "bg-amber-50 text-amber-800",
  Approved: "bg-teal-50 text-teal-800",
  Scheduled: "bg-brand-100 text-brand-700",
  Published: "bg-emerald-600 text-white",
  Archived: "bg-stone-100 text-stone-500",
};

export const CONTENT_ACTIONS = ["to_script", "to_production", "to_editing", "submit_review", "approve", "revise", "schedule", "publish", "archive"] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

interface Rule {
  from: ContentStatus[];
  to: ContentStatus;
  who: "team" | "admin";
  label: string;
  noteRequired?: boolean;
}

export const CONTENT_RULES: Record<ContentAction, Rule> = {
  to_script: { from: ["Idea"], to: "Script", who: "team", label: "Mula skrip" },
  to_production: { from: ["Script"], to: "Production", who: "team", label: "Mula produksi" },
  to_editing: { from: ["Production"], to: "Editing", who: "team", label: "Mula suntingan" },
  submit_review: { from: ["Editing"], to: "Review", who: "team", label: "Hantar untuk semakan" },
  approve: { from: ["Review"], to: "Approved", who: "admin", label: "Luluskan" },
  revise: { from: ["Review"], to: "Editing", who: "admin", label: "Minta revisi", noteRequired: true },
  schedule: { from: ["Approved"], to: "Scheduled", who: "team", label: "Jadualkan" },
  publish: { from: ["Approved", "Scheduled"], to: "Published", who: "team", label: "Tandakan published" },
  archive: { from: ["Published"], to: "Archived", who: "team", label: "Arkib" },
};

export type ContentActionResult = { ok: true; to: ContentStatus } | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string };

export function checkContentAction(
  user: UserLike,
  c: Pick<ContentItem, "teamId" | "status" | "deleted" | "publishDate">,
  action: ContentAction,
  extra: { note?: string; postUrl?: string; publishDate?: string } = {},
): ContentActionResult {
  const r = CONTENT_RULES[action];
  if (c.deleted || !r.from.includes(c.status)) return { ok: false, code: "INVALID_TRANSITION", message: `"${r.label}" tidak dibenarkan bila status ${c.status}.` };
  if (r.who === "admin" && user.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Hanya Admin boleh semak content." };
  if (!isTeam(user, c.teamId)) return { ok: false, code: "FORBIDDEN", message: "Anda bukan ahli team content ini." };
  if (r.noteRequired && (extra.note ?? "").trim().length < 3) return { ok: false, code: "VALIDATION", message: "Sila tulis apa yang perlu diubah." };
  if (action === "schedule" && !(extra.publishDate || c.publishDate)) return { ok: false, code: "VALIDATION", message: "Tetapkan tarikh publish dahulu." };
  if (action === "publish" && !/^https?:\/\/\S+$/i.test(extra.postUrl ?? "")) return { ok: false, code: "VALIDATION", message: "URL posting wajib diisi (bermula https://)." };
  return { ok: true, to: r.to };
}

export function contentAllowedActions(user: UserLike, c: Pick<ContentItem, "teamId" | "status" | "deleted" | "publishDate">): ContentAction[] {
  return CONTENT_ACTIONS.filter((a) => checkContentAction(user, c, a, { note: "xxx", postUrl: "https://x", publishDate: "2000-01-01" }).ok);
}

export function canEditContent(user: UserLike, c: Pick<ContentItem, "teamId" | "status" | "deleted">): boolean {
  if (c.deleted) return false;
  if (user.role === "admin") return true;
  return user.teamIds.includes(c.teamId) && c.status !== "Published" && c.status !== "Archived";
}

export function canRequestDeleteContent(user: UserLike, c: Pick<ContentItem, "teamId" | "deleted">): boolean {
  return !c.deleted && user.role !== "admin" && user.teamIds.includes(c.teamId);
}

/* ------------------------------ Asset ------------------------------ */

export const ASSET_ACTIONS = ["submit", "approve", "revise", "archive", "unarchive"] as const;
export type AssetAction = (typeof ASSET_ACTIONS)[number];

const ASSET_RULES: Record<AssetAction, { from: AssetStatus[]; to: AssetStatus; who: "team" | "admin"; label: string; noteRequired?: boolean }> = {
  submit: { from: ["Draft"], to: "Review", who: "team", label: "Hantar untuk semakan" },
  approve: { from: ["Review"], to: "Approved", who: "admin", label: "Luluskan" },
  revise: { from: ["Review"], to: "Draft", who: "admin", label: "Minta revisi", noteRequired: true },
  archive: { from: ["Draft", "Review", "Approved"], to: "Archived", who: "team", label: "Arkib" },
  unarchive: { from: ["Archived"], to: "Draft", who: "admin", label: "Aktifkan semula" },
};
export const ASSET_ACTION_LABEL: Record<AssetAction, string> = Object.fromEntries(Object.entries(ASSET_RULES).map(([k, v]) => [k, v.label])) as Record<AssetAction, string>;

export function checkAssetAction(user: UserLike, a: Pick<Asset, "teamId" | "status" | "deleted">, action: AssetAction, note = ""): { ok: true; to: AssetStatus } | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string } {
  const r = ASSET_RULES[action];
  if (a.deleted || !r.from.includes(a.status)) return { ok: false, code: "INVALID_TRANSITION", message: `"${r.label}" tidak dibenarkan bila status ${a.status}.` };
  if (r.who === "admin" && user.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Hanya Admin boleh melakukan tindakan ini." };
  if (!isTeam(user, a.teamId)) return { ok: false, code: "FORBIDDEN", message: "Anda bukan ahli team asset ini." };
  if (r.noteRequired && note.trim().length < 3) return { ok: false, code: "VALIDATION", message: "Sila tulis apa yang perlu diubah." };
  return { ok: true, to: r.to };
}

export function assetAllowedActions(user: UserLike, a: Pick<Asset, "teamId" | "status" | "deleted">): AssetAction[] {
  return ASSET_ACTIONS.filter((x) => checkAssetAction(user, a, x, "xxx").ok);
}

export function canEditAsset(user: UserLike, a: Pick<Asset, "teamId" | "status" | "deleted">): boolean {
  return !a.deleted && a.status !== "Archived" && isTeam(user, a.teamId);
}

export function canRequestDeleteAsset(user: UserLike, a: Pick<Asset, "teamId" | "deleted">): boolean {
  return !a.deleted && user.role !== "admin" && user.teamIds.includes(a.teamId);
}

/** Status hak guna: tamat, hampir tamat (14 hari), ok, atau tiada tarikh. */
export function rightsState(a: Pick<Asset, "rightsUntil">, today: string): "none" | "ok" | "soon" | "expired" {
  if (!a.rightsUntil) return "none";
  if (a.rightsUntil < today) return "expired";
  return diffDays(today, a.rightsUntil) <= 14 ? "soon" : "ok";
}

/** Boleh diguna sekarang: diluluskan dan hak guna belum tamat. */
export function isUsable(a: Pick<Asset, "status" | "rightsUntil">, today: string): boolean {
  return a.status === "Approved" && rightsState(a, today) !== "expired";
}

/** Boleh diguna untuk iklan berbayar (bukan KOL organik sahaja). */
export function canUseForAds(a: Pick<Asset, "status" | "rightsUntil" | "usageRights">, today: string): boolean {
  return isUsable(a, today) && a.usageRights !== "KOL - organik sahaja";
}
