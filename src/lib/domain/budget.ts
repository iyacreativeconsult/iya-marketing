/**
 * Peraturan Budget (pure, diuji dalam tests/budget.test.ts).
 * Prinsip utama: Admin nampak semua team; ahli team hanya nampak team sendiri.
 */
import type { AppUser, Expense, ExpenseStatus, TopUpRequest } from "./types";

type UserLike = Pick<AppUser, "role" | "teamIds">;
type UserWithId = Pick<AppUser, "id" | "role" | "teamIds">;

/** Ahli team atau Admin (untuk tindakan peringkat team, contoh muat naik fail ke folder team). */
export function canViewTeamFinance(user: UserLike, teamId: string): boolean {
  return user.role === "admin" || user.teamIds.includes(teamId);
}

/**
 * Kewangan PERSON: bajet, perbelanjaan, fee KOL, bayaran dan fail.
 * Admin nampak semua; person hanya nampak milik sendiri (bukan rakan se-team).
 */
export function canViewOwnerFinance(user: Pick<AppUser, "id" | "role">, ownerId: string): boolean {
  return user.role === "admin" || (ownerId !== "" && user.id === ownerId);
}

export function personTotal(b: { baseSen: number; carryForwardSen: number; topUpSen: number }): number {
  return b.baseSen + b.carryForwardSen + b.topUpSen;
}

/** Cadangan carry forward: baki boleh guna bulan lepas (tidak negatif). */
export function suggestCarryForward(prevAvailableSen: number): number {
  return Math.max(0, prevAvailableSen);
}

export function checkTopUpReview(
  user: UserLike,
  r: Pick<TopUpRequest, "status">,
  action: "approve" | "reject",
  approvedSen: number,
  note: string,
): { ok: true } | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string } {
  if (user.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Hanya Admin boleh lulus tambahan bajet." };
  if (r.status !== "Pending") return { ok: false, code: "INVALID_TRANSITION", message: "Permohonan ini sudah disemak." };
  if (action === "approve" && approvedSen <= 0) return { ok: false, code: "VALIDATION", message: "Jumlah diluluskan mesti lebih dari 0." };
  if (action === "reject" && note.trim().length < 3) return { ok: false, code: "VALIDATION", message: "Sila tulis sebab ditolak." };
  return { ok: true };
}

const TEAM_EDITABLE: ExpenseStatus[] = ["Dalam Proses", "Ditolak"];

export function canEditExpense(user: UserWithId, e: Pick<Expense, "teamId" | "ownerId" | "status" | "deleted" | "kolPaymentId">): boolean {
  if (e.deleted || e.kolPaymentId) return false; // perbelanjaan dari bayaran KOL diurus melalui KOL Payment
  if (user.role === "admin") return true;
  return e.ownerId === user.id && user.teamIds.includes(e.teamId) && TEAM_EDITABLE.includes(e.status);
}

/** Padam terus: Admin sahaja (perbelanjaan dari bayaran KOL dibatalkan melalui KOL Payment). */
export function canDeleteExpense(user: Pick<AppUser, "role">, e: Pick<Expense, "deleted" | "kolPaymentId">): boolean {
  return user.role === "admin" && !e.deleted && !e.kolPaymentId;
}

/** Pemilik boleh MOHON padam; Admin yang luluskan. */
export function canRequestDeleteExpense(user: Pick<AppUser, "id" | "role">, e: Pick<Expense, "ownerId" | "deleted" | "kolPaymentId">): boolean {
  return user.role !== "admin" && !e.deleted && !e.kolPaymentId && e.ownerId === user.id;
}

export type ReviewAction = "verify" | "reject";

export function checkExpenseReview(
  user: UserLike,
  e: Pick<Expense, "status" | "deleted" | "receipt">,
  action: ReviewAction,
  note: string,
): { ok: true; to: ExpenseStatus } | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string } {
  if (user.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Hanya Admin boleh semak perbelanjaan." };
  if (e.deleted || e.status !== "Dalam Proses") return { ok: false, code: "INVALID_TRANSITION", message: "Hanya perbelanjaan Dalam Proses boleh disemak." };
  if (action === "verify") {
    if (!e.receipt) return { ok: false, code: "VALIDATION", message: "Resit belum dimuat naik. Minta team muat naik resit dahulu." };
    return { ok: true, to: "Selesai" };
  }
  if (note.trim().length < 3) return { ok: false, code: "VALIDATION", message: "Sila tulis sebab ditolak." };
  return { ok: true, to: "Ditolak" };
}

export interface BudgetSummary {
  budgetSen: number;
  usedSen: number; // Selesai
  pendingSen: number; // Dalam Proses
  kolCommittedSen: number; // fee KOL Confirmed yang belum dibayar
  committedSen: number; // pending + kolCommitted
  remainingSen: number; // bajet - digunakan
  availableSen: number; // baki - komited
  pctUsed: number; // 0-100+
}

export function summarize(
  budgetSen: number,
  expenses: Pick<Expense, "amountSen" | "status" | "deleted">[],
  kolCommittedSen: number,
): BudgetSummary {
  let usedSen = 0;
  let pendingSen = 0;
  for (const e of expenses) {
    if (e.deleted) continue;
    if (e.status === "Selesai") usedSen += e.amountSen;
    else if (e.status === "Dalam Proses") pendingSen += e.amountSen;
  }
  const committedSen = pendingSen + kolCommittedSen;
  const remainingSen = budgetSen - usedSen;
  return {
    budgetSen,
    usedSen,
    pendingSen,
    kolCommittedSen,
    committedSen,
    remainingSen,
    availableSen: remainingSen - committedSen,
    pctUsed: budgetSen > 0 ? Math.round((usedSen / budgetSen) * 100) : usedSen > 0 ? 100 : 0,
  };
}

export function budgetLevel(s: Pick<BudgetSummary, "pctUsed" | "availableSen" | "budgetSen">): "ok" | "warn" | "over" {
  if (s.budgetSen > 0 && (s.pctUsed >= 100 || s.availableSen < 0)) return "over";
  if (s.pctUsed >= 80) return "warn";
  return "ok";
}

export interface ChannelRow {
  category: string;
  allocatedSen: number | null; // null = tiada peruntukan khusus
  usedSen: number;
  pendingSen: number;
  remainingSen: number | null;
}

/** Pecahan bajet ikut saluran (kategori perbelanjaan). */
export function byChannel(expenses: Pick<Expense, "category" | "amountSen" | "status" | "deleted">[], channels: Record<string, number>): ChannelRow[] {
  const cats = new Set([...Object.keys(channels), ...expenses.filter((e) => !e.deleted && e.status !== "Ditolak").map((e) => e.category)]);
  return [...cats]
    .map((category) => {
      const list = expenses.filter((e) => !e.deleted && e.category === category);
      const usedSen = list.filter((e) => e.status === "Selesai").reduce((a, e) => a + e.amountSen, 0);
      const pendingSen = list.filter((e) => e.status === "Dalam Proses").reduce((a, e) => a + e.amountSen, 0);
      const allocatedSen = channels[category] ?? null;
      return { category, allocatedSen, usedSen, pendingSen, remainingSen: allocatedSen === null ? null : allocatedSen - usedSen - pendingSen };
    })
    .sort((a, b) => (b.allocatedSen ?? -1) - (a.allocatedSen ?? -1) || b.usedSen - a.usedSen);
}
