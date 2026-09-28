/**
 * Peraturan KOL Campaign dan KOL Payment (pure, diuji dalam tests/kol.test.ts).
 * Kalau "butang tak keluar" atau "status tak boleh tukar" untuk KOL, semak di sini.
 */
import type { AppUser, CampaignKol, KolChecklist, KolPayment, KolStage, PaymentStatus } from "./types";

type UserLike = Pick<AppUser, "role" | "teamIds">;

export const KOL_ACTIONS = [
  "contact",
  "negotiate",
  "confirm",
  "brief_sent",
  "product_sent",
  "content_received",
  "content_approved",
  "request_revision",
  "posted",
  "complete",
  "drop",
] as const;
export type KolAction = (typeof KOL_ACTIONS)[number];

interface Rule {
  from: KolStage[];
  /** null = status kekal, hanya checklist berubah */
  to: KolStage | null;
  label: string;
  checklist?: Partial<KolChecklist>;
  noteRequired?: boolean;
}

const PRE_POST: KolStage[] = ["Selected", "Contacted", "Negotiation", "Confirmed", "Content Brief Sent", "Content Submitted", "Approved"];

export const KOL_RULES: Record<KolAction, Rule> = {
  contact: { from: ["Selected"], to: "Contacted", label: "Sudah dihubungi" },
  negotiate: { from: ["Selected", "Contacted"], to: "Negotiation", label: "Dalam rundingan" },
  confirm: { from: ["Selected", "Contacted", "Negotiation"], to: "Confirmed", label: "Sahkan (fee setuju)" },
  brief_sent: { from: ["Confirmed"], to: "Content Brief Sent", label: "Brief dihantar", checklist: { briefSent: true } },
  product_sent: { from: ["Confirmed", "Content Brief Sent", "Content Submitted", "Approved"], to: null, label: "Produk dihantar", checklist: { productSent: true } },
  content_received: { from: ["Content Brief Sent"], to: "Content Submitted", label: "Content diterima", checklist: { contentReceived: true } },
  content_approved: { from: ["Content Submitted"], to: "Approved", label: "Luluskan content", checklist: { contentApproved: true } },
  request_revision: { from: ["Content Submitted"], to: "Content Brief Sent", label: "Minta revisi", checklist: { contentReceived: false }, noteRequired: true },
  posted: { from: ["Approved"], to: "Payment Pending", label: "Sudah posting", checklist: { posted: true } },
  complete: { from: ["Paid"], to: "Completed", label: "Tandakan selesai" },
  drop: { from: PRE_POST, to: "Dropped", label: "Gugurkan KOL", noteRequired: true },
};

export const STAGE_GROUPS = {
  belumPosting: ["Confirmed", "Content Brief Sent", "Content Submitted", "Approved"] as KolStage[],
  komited: ["Confirmed", "Content Brief Sent", "Content Submitted", "Approved", "Payment Pending"] as KolStage[],
  rundingan: ["Selected", "Contacted", "Negotiation"] as KolStage[],
  selesai: ["Paid", "Completed"] as KolStage[],
};

export function isOwnerOrAdmin(user: UserLike, teamId: string) {
  return user.role === "admin" || user.teamIds.includes(teamId);
}

export type KolActionResult =
  | { ok: true; to: KolStage | null; checklist: Partial<KolChecklist> }
  | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string };

export function checkKolAction(
  user: UserLike,
  ck: Pick<CampaignKol, "teamId" | "stage" | "deleted" | "checklist">,
  action: KolAction,
  extra: { note?: string; postUrl?: string; postedDate?: string } = {},
): KolActionResult {
  const r = KOL_RULES[action];
  if (!isOwnerOrAdmin(user, ck.teamId)) return { ok: false, code: "FORBIDDEN", message: "Anda bukan ahli team yang menguruskan KOL ini." };
  if (ck.deleted || !r.from.includes(ck.stage)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `"${r.label}" tidak dibenarkan bila status ${ck.stage}.` };
  }
  if (action === "product_sent" && ck.checklist.productSent) {
    return { ok: false, code: "INVALID_TRANSITION", message: "Produk sudah ditanda dihantar." };
  }
  if (r.noteRequired && (extra.note ?? "").trim().length < 3) {
    return { ok: false, code: "VALIDATION", message: "Sila tulis sebab (sekurang-kurangnya 3 aksara)." };
  }
  if (action === "posted") {
    if (!extra.postUrl || !/^https?:\/\//i.test(extra.postUrl)) return { ok: false, code: "VALIDATION", message: "URL posting wajib diisi (bermula https://)." };
    if (!extra.postedDate) return { ok: false, code: "VALIDATION", message: "Tarikh posting wajib diisi." };
  }
  return { ok: true, to: r.to, checklist: r.checklist ?? {} };
}

export function kolAllowedActions(user: UserLike, ck: Pick<CampaignKol, "teamId" | "stage" | "deleted" | "checklist">): KolAction[] {
  return KOL_ACTIONS.filter((a) => checkKolAction(user, ck, a, { note: "xxx", postUrl: "https://x", postedDate: "2000-01-01" }).ok);
}

/** Selepas posting: status seterusnya bergantung pada baki bayaran. */
export function stageAfterPayment(feeSen: number, paidSen: number): KolStage {
  return paidSen >= feeSen ? "Paid" : "Payment Pending";
}

export function canEditCkFee(user: UserLike, ck: Pick<CampaignKol, "stage">): boolean {
  return user.role === "admin" || STAGE_GROUPS.rundingan.includes(ck.stage);
}

export function canEditCkDetails(user: UserLike, ck: Pick<CampaignKol, "teamId" | "stage" | "deleted">): boolean {
  if (ck.deleted || !isOwnerOrAdmin(user, ck.teamId)) return false;
  if (user.role === "admin") return ck.stage !== "Dropped";
  return PRE_POST.includes(ck.stage);
}

/** KOL lewat posting: sudah melepasi tarikh yang dijanjikan tetapi belum posting. */
export function isPostingOverdue(ck: Pick<CampaignKol, "stage" | "postingDueDate" | "deleted">, today: string): boolean {
  return !ck.deleted && STAGE_GROUPS.belumPosting.includes(ck.stage) && ck.postingDueDate !== "" && ck.postingDueDate < today;
}

/** Fee yang sudah dijanjikan tapi belum dibayar (dikira sebagai Komited dalam bajet). */
export function committedSen(ck: Pick<CampaignKol, "stage" | "deleted">, feeSen: number, paidSen: number): number {
  if (ck.deleted || !STAGE_GROUPS.komited.includes(ck.stage)) return 0;
  return Math.max(0, feeSen - paidSen);
}

/* ---------------------------- Bayaran ---------------------------- */

export const PAYMENT_ACTIONS = ["process", "pay", "cancel"] as const;
export type PaymentAction = (typeof PAYMENT_ACTIONS)[number];

export function checkPaymentAction(
  user: UserLike,
  p: Pick<KolPayment, "status" | "deleted">,
  action: PaymentAction,
  extra: { proofFileId?: string | null; paidDate?: string; note?: string } = {},
): { ok: true; to: PaymentStatus | "cancelled" } | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string } {
  if (user.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Hanya Admin boleh proses bayaran KOL." };
  if (p.deleted || p.status === "Paid") return { ok: false, code: "INVALID_TRANSITION", message: "Bayaran ini sudah selesai atau dibatalkan." };
  if (action === "process") {
    if (p.status !== "Pending") return { ok: false, code: "INVALID_TRANSITION", message: "Hanya bayaran Pending boleh diproses." };
    return { ok: true, to: "Processing" };
  }
  if (action === "pay") {
    if (!extra.proofFileId) return { ok: false, code: "VALIDATION", message: "Muat naik bukti bayaran dahulu." };
    if (!extra.paidDate) return { ok: false, code: "VALIDATION", message: "Tarikh bayaran wajib diisi." };
    return { ok: true, to: "Paid" };
  }
  if ((extra.note ?? "").trim().length < 3) return { ok: false, code: "VALIDATION", message: "Sila tulis sebab bayaran dibatalkan." };
  return { ok: true, to: "cancelled" };
}

export function canEditPayment(user: UserLike, p: Pick<KolPayment, "teamId" | "status" | "deleted">): boolean {
  return !p.deleted && p.status === "Pending" && isOwnerOrAdmin(user, p.teamId);
}
