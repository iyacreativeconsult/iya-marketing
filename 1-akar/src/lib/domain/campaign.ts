/**
 * Peraturan campaign: siapa boleh buat apa, dan status boleh bergerak ke mana.
 *
 * Fail ini sengaja "pure" (tiada database, tiada network) supaya mudah diuji
 * (lihat tests/campaign.test.ts). Kalau ada isu "kenapa butang X tak keluar"
 * atau "kenapa status tak boleh tukar", mula semak di sini.
 */
import type { Actor, AppUser, Campaign, CampaignStatus } from "./types";
import { rangesOverlap } from "./dates";

type UserLike = Pick<AppUser, "id" | "name" | "role" | "teamIds">;

export const CAMPAIGN_ACTIONS = [
  "submit",
  "withdraw",
  "approve",
  "request_changes",
  "schedule",
  "start",
  "complete",
  "cancel",
] as const;
export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[number];

type Who = "team" | "admin" | "system_or_admin";

interface ActionRule {
  from: CampaignStatus[];
  to: CampaignStatus;
  who: Who;
  /** Jika ada: ahli team (bukan Admin) hanya boleh dari status ini. */
  teamFrom?: CampaignStatus[];
  noteRequired?: boolean;
  label: string;
}

export const ACTION_RULES: Record<CampaignAction, ActionRule> = {
  submit: { from: ["Idea"], to: "Planning", who: "team", label: "Hantar untuk kelulusan" },
  withdraw: { from: ["Planning"], to: "Idea", who: "team", label: "Tarik balik ke draf" },
  approve: { from: ["Planning"], to: "Approved", who: "admin", label: "Luluskan" },
  request_changes: { from: ["Planning"], to: "Idea", who: "admin", noteRequired: true, label: "Minta ubah" },
  schedule: { from: ["Approved"], to: "Scheduled", who: "team", label: "Tandakan Scheduled" },
  start: { from: ["Scheduled"], to: "Ongoing", who: "system_or_admin", label: "Mulakan sekarang" },
  complete: { from: ["Ongoing"], to: "Completed", who: "system_or_admin", label: "Tandakan Completed" },
  cancel: {
    from: ["Idea", "Planning", "Approved", "Scheduled"],
    teamFrom: ["Idea", "Planning"],
    to: "Cancelled",
    who: "team",
    noteRequired: true,
    label: "Batalkan",
  },
};

export const STATUS_INFO: Record<CampaignStatus, { label: string; hint: string }> = {
  Idea: { label: "Idea", hint: "Draf. Team boleh ubah bebas." },
  Planning: { label: "Planning", hint: "Menunggu kelulusan Admin." },
  Approved: { label: "Approved", hint: "Diluluskan. Sediakan KOL, content dan bajet." },
  Scheduled: { label: "Scheduled", hint: "Sedia. Akan jadi Ongoing pada tarikh mula." },
  Ongoing: { label: "Ongoing", hint: "Sedang berjalan." },
  Completed: { label: "Completed", hint: "Selesai." },
  Cancelled: { label: "Cancelled", hint: "Dibatalkan." },
};

const KNOWN_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  KOL: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  Launch: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  Live: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Affiliate: { bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500" },
  Event: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  Promotion: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", dot: "bg-fuchsia-500" },
};
const PALETTE = [
  { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  { bg: "bg-orange-50", text: "text-orange-800", dot: "bg-orange-500" },
  { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  { bg: "bg-lime-50", text: "text-lime-800", dot: "bg-lime-600" },
  { bg: "bg-cyan-50", text: "text-cyan-800", dot: "bg-cyan-500" },
  { bg: "bg-pink-50", text: "text-pink-700", dot: "bg-pink-500" },
  { bg: "bg-yellow-50", text: "text-yellow-800", dot: "bg-yellow-500" },
  { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
];

/** Warna jenis campaign. Jenis baru dari Tetapan dapat warna tetap berdasarkan namanya. */
export function typeColor(type: string) {
  const known = KNOWN_TYPE_COLORS[type];
  if (known) return known;
  let h = 0;
  for (const ch of type) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function isAdmin(user: UserLike): boolean {
  return user.role === "admin";
}

export function isTeamMember(user: UserLike, teamId: string): boolean {
  return user.teamIds.includes(teamId);
}

/** Admin, atau ahli team pemilik campaign. */
export function isOwnerOrAdmin(user: UserLike, campaign: Pick<Campaign, "teamId">): boolean {
  return isAdmin(user) || isTeamMember(user, campaign.teamId);
}

export function canCreateCampaign(user: UserLike, teamId: string): boolean {
  return isAdmin(user) || isTeamMember(user, teamId);
}

const TEAM_EDITABLE: CampaignStatus[] = ["Idea", "Planning", "Approved", "Scheduled"];

export function canEditCampaign(user: UserLike, c: Pick<Campaign, "teamId" | "status" | "deleted">): boolean {
  if (c.deleted) return false;
  if (isAdmin(user)) return true;
  return isTeamMember(user, c.teamId) && TEAM_EDITABLE.includes(c.status);
}

/** Padam terus: Admin sahaja. */
export function canDeleteCampaign(user: UserLike, c: Pick<Campaign, "teamId" | "status" | "deleted">): boolean {
  return !c.deleted && isAdmin(user);
}

/** Ahli team pemilik boleh MOHON padam; Admin yang luluskan. */
export function canRequestDeleteCampaign(user: UserLike, c: Pick<Campaign, "teamId" | "deleted">): boolean {
  return !c.deleted && !isAdmin(user) && isTeamMember(user, c.teamId);
}

/** Medan yang, jika diubah oleh ahli team selepas Approved, perlu kelulusan semula. */
export const REAPPROVAL_FIELDS = ["startDate", "endDate", "plannedBudgetSen"] as const;

export function editNeedsReapproval(
  user: UserLike,
  before: Pick<Campaign, "status" | "startDate" | "endDate" | "plannedBudgetSen">,
  after: Pick<Campaign, "startDate" | "endDate" | "plannedBudgetSen">,
): boolean {
  if (isAdmin(user)) return false;
  if (before.status !== "Approved" && before.status !== "Scheduled") return false;
  return REAPPROVAL_FIELDS.some((f) => before[f] !== after[f]);
}

export type TransitionResult =
  | { ok: true; to: CampaignStatus }
  | { ok: false; reason: "FORBIDDEN" | "INVALID_TRANSITION" | "NOTE_REQUIRED"; message: string };

export function checkTransition(
  actor: Actor,
  campaign: Pick<Campaign, "teamId" | "status" | "deleted">,
  action: CampaignAction,
  note = "",
): TransitionResult {
  const rule = ACTION_RULES[action];
  if (campaign.deleted) {
    return { ok: false, reason: "INVALID_TRANSITION", message: "Campaign ini telah dipadam." };
  }
  if (!rule.from.includes(campaign.status)) {
    return {
      ok: false,
      reason: "INVALID_TRANSITION",
      message: `Tindakan "${rule.label}" tidak dibenarkan bila status ${campaign.status}.`,
    };
  }

  if (actor.kind === "system") {
    if (rule.who !== "system_or_admin") {
      return { ok: false, reason: "FORBIDDEN", message: "Sistem tidak boleh melakukan tindakan ini." };
    }
    return { ok: true, to: rule.to };
  }

  const user = actor.user;
  const admin = isAdmin(user);
  if ((rule.who === "admin" || rule.who === "system_or_admin") && !admin) {
    return { ok: false, reason: "FORBIDDEN", message: "Hanya Admin boleh melakukan tindakan ini." };
  }
  if (rule.who === "team" && !isOwnerOrAdmin(user, campaign)) {
    return { ok: false, reason: "FORBIDDEN", message: "Anda bukan ahli team pemilik campaign ini." };
  }
  if (!admin && rule.teamFrom && !rule.teamFrom.includes(campaign.status)) {
    return {
      ok: false,
      reason: "FORBIDDEN",
      message: `Selepas status ${campaign.status}, hanya Admin boleh "${rule.label}".`,
    };
  }
  if (rule.noteRequired && note.trim().length < 3) {
    return { ok: false, reason: "NOTE_REQUIRED", message: "Sila tulis sebab (sekurang-kurangnya 3 aksara)." };
  }
  return { ok: true, to: rule.to };
}

/** Senarai tindakan yang boleh ditunjuk sebagai butang untuk pengguna ini. */
export function allowedActions(user: UserLike, campaign: Pick<Campaign, "teamId" | "status" | "deleted">): CampaignAction[] {
  return CAMPAIGN_ACTIONS.filter((a) => {
    const r = checkTransition({ kind: "user", user }, campaign, a, "xxx");
    return r.ok;
  });
}

type ConflictCandidate = Pick<Campaign, "id" | "name" | "teamId" | "startDate" | "endDate" | "itemIds" | "outletIds" | "status" | "deleted">;

/**
 * Campaign lain yang bertindih tarikh DAN berkongsi item atau outlet yang sama.
 * Hanya amaran, tidak menyekat.
 */
export function findConflicts(target: ConflictCandidate, others: ConflictCandidate[]): ConflictCandidate[] {
  if (target.itemIds.length === 0 && target.outletIds.length === 0) return [];
  return others.filter(
    (o) =>
      o.id !== target.id &&
      !o.deleted &&
      o.status !== "Cancelled" &&
      rangesOverlap(target.startDate, target.endDate, o.startDate, o.endDate) &&
      (o.itemIds.some((p) => target.itemIds.includes(p)) || o.outletIds.some((p) => target.outletIds.includes(p))),
  );
}
