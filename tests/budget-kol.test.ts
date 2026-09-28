import { describe, expect, it } from "vitest";
import { budgetLevel, canDeleteExpense, canRequestDeleteExpense, canEditExpense, canViewOwnerFinance, canViewTeamFinance, checkExpenseReview, checkTopUpReview, personTotal, suggestCarryForward, summarize } from "@/lib/domain/budget";
import { canEditCkFee, checkKolAction, checkPaymentAction, committedSen, isPostingOverdue, kolAllowedActions, stageAfterPayment } from "@/lib/domain/kol";
import type { CampaignKol } from "@/lib/domain/types";

const admin = { id: "admin", role: "admin" as const, teamIds: [] as string[] };
const ali = { id: "ali", role: "member" as const, teamIds: ["team-a"] };
const hakim = { id: "hakim", role: "member" as const, teamIds: ["team-a"] };
const siti = { id: "siti", role: "member" as const, teamIds: ["team-b"] };

describe("akses kewangan", () => {
  it("team tidak boleh lihat bajet team lain, Admin boleh semua", () => {
    expect(canViewTeamFinance(ali, "team-a")).toBe(true);
    expect(canViewTeamFinance(ali, "team-b")).toBe(false);
    expect(canViewTeamFinance(admin, "team-b")).toBe(true);
  });
});

describe("perbelanjaan", () => {
  const e = { teamId: "team-a", ownerId: "ali", status: "Dalam Proses" as const, deleted: false, kolPaymentId: null, receipt: null };
  it("hanya pemilik (bukan rakan se-team) boleh ubah, sebelum disahkan", () => {
    expect(canEditExpense(ali, e)).toBe(true);
    expect(canEditExpense(hakim, e)).toBe(false);
    expect(canEditExpense(ali, { ...e, status: "Selesai" })).toBe(false);
    expect(canEditExpense(siti, e)).toBe(false);
    expect(canEditExpense(admin, { ...e, kolPaymentId: "p1" })).toBe(false);
  });
  it("sahkan perlukan resit, tolak perlukan sebab", () => {
    expect(checkExpenseReview(admin, e, "verify", "").ok).toBe(false);
    expect(checkExpenseReview(admin, { ...e, receipt: { id: "f", name: "r", type: "image/png", size: 1 } }, "verify", "").ok).toBe(true);
    expect(checkExpenseReview(admin, e, "reject", "").ok).toBe(false);
    expect(checkExpenseReview(ali, e, "reject", "resit kabur").ok).toBe(false);
  });
  it("kira baki dengan komited", () => {
    const s = summarize(1_000_000, [
      { amountSen: 300_000, status: "Selesai", deleted: false },
      { amountSen: 100_000, status: "Dalam Proses", deleted: false },
      { amountSen: 50_000, status: "Ditolak", deleted: false },
      { amountSen: 999_999, status: "Selesai", deleted: true },
    ], 200_000);
    expect(s).toMatchObject({ usedSen: 300_000, pendingSen: 100_000, committedSen: 300_000, remainingSen: 700_000, availableSen: 400_000, pctUsed: 30 });
    expect(budgetLevel({ ...s, pctUsed: 85 })).toBe("warn");
    expect(budgetLevel({ ...s, availableSen: -1 })).toBe("over");
  });
});

const ck = (p: Partial<CampaignKol> = {}) => ({
  teamId: "team-a", stage: "Approved" as CampaignKol["stage"], deleted: false, postingDueDate: "2026-10-05",
  checklist: { briefSent: true, productSent: false, contentReceived: true, contentApproved: true, posted: false }, ...p,
});

describe("KOL", () => {
  it("posting wajib URL https dan tarikh", () => {
    expect(checkKolAction(ali, ck(), "posted", {}).ok).toBe(false);
    expect(checkKolAction(ali, ck(), "posted", { postUrl: "javascript:alert(1)", postedDate: "2026-10-05" }).ok).toBe(false);
    expect(checkKolAction(ali, ck(), "posted", { postUrl: "https://tiktok.com/v/1", postedDate: "2026-10-05" })).toMatchObject({ ok: true, to: "Payment Pending" });
  });
  it("team lain tidak boleh ubah status", () => {
    expect(checkKolAction(siti, ck(), "posted", { postUrl: "https://x", postedDate: "2026-10-05" }).ok).toBe(false);
  });
  it("status tidak boleh dilangkau", () => {
    expect(checkKolAction(ali, ck({ stage: "Confirmed" }), "posted", { postUrl: "https://x", postedDate: "2026-10-05" }).ok).toBe(false);
    expect(kolAllowedActions(ali, ck({ stage: "Selected" }))).toEqual(["contact", "negotiate", "confirm", "drop"]);
  });
  it("lewat posting dan komited", () => {
    expect(isPostingOverdue(ck(), "2026-10-06")).toBe(true);
    expect(isPostingOverdue(ck(), "2026-10-05")).toBe(false);
    expect(isPostingOverdue(ck({ stage: "Payment Pending" }), "2026-10-09")).toBe(false);
    expect(committedSen(ck({ stage: "Confirmed" }), 80_000, 20_000)).toBe(60_000);
    expect(committedSen(ck({ stage: "Negotiation" }), 80_000, 0)).toBe(0);
    expect(stageAfterPayment(80_000, 80_000)).toBe("Paid");
    expect(stageAfterPayment(0, 0)).toBe("Paid");
  });
  it("fee dikunci selepas Confirmed untuk team", () => {
    expect(canEditCkFee(ali, { stage: "Negotiation" })).toBe(true);
    expect(canEditCkFee(ali, { stage: "Confirmed" })).toBe(false);
    expect(canEditCkFee(admin, { stage: "Approved" })).toBe(true);
  });
  it("bayaran: Admin sahaja, Paid perlukan bukti", () => {
    const p = { status: "Pending" as const, deleted: false };
    expect(checkPaymentAction(ali, p, "process").ok).toBe(false);
    expect(checkPaymentAction(admin, p, "pay", { paidDate: "2026-10-05" }).ok).toBe(false);
    expect(checkPaymentAction(admin, p, "pay", { proofFileId: "f1", paidDate: "2026-10-05" })).toEqual({ ok: true, to: "Paid" });
    expect(checkPaymentAction(admin, { ...p, status: "Paid" }, "cancel", { note: "salah" }).ok).toBe(false);
  });
});

describe("bajet ikut person", () => {
  it("person hanya nampak kewangan sendiri, Admin nampak semua", () => {
    expect(canViewOwnerFinance(ali, "ali")).toBe(true);
    expect(canViewOwnerFinance(hakim, "ali")).toBe(false);
    expect(canViewOwnerFinance(admin, "ali")).toBe(true);
    expect(canViewOwnerFinance(ali, "")).toBe(false);
  });
  it("jumlah = asas + carry forward + tambahan", () => {
    expect(personTotal({ baseSen: 500_000, carryForwardSen: 180_000, topUpSen: 150_000 })).toBe(830_000);
    expect(suggestCarryForward(180_000)).toBe(180_000);
    expect(suggestCarryForward(-5_000)).toBe(0);
  });
  it("tambahan bajet: Admin sahaja, sekali sahaja, tolak perlukan sebab", () => {
    expect(checkTopUpReview(ali, { status: "Pending" }, "approve", 100, "").ok).toBe(false);
    expect(checkTopUpReview(admin, { status: "Pending" }, "approve", 100, "").ok).toBe(true);
    expect(checkTopUpReview(admin, { status: "Approved" }, "approve", 100, "").ok).toBe(false);
    expect(checkTopUpReview(admin, { status: "Pending" }, "reject", 0, "").ok).toBe(false);
    expect(checkTopUpReview(admin, { status: "Pending" }, "approve", 0, "").ok).toBe(false);
  });
});

describe("padam perbelanjaan", () => {
  const e = { teamId: "team-a", ownerId: "ali", status: "Selesai" as const, deleted: false, kolPaymentId: null };
  it("pemilik mohon, Admin padam, dari bayaran KOL tidak boleh", () => {
    expect(canDeleteExpense(ali, e)).toBe(false);
    expect(canRequestDeleteExpense(ali, e)).toBe(true);
    expect(canRequestDeleteExpense(hakim, e)).toBe(false);
    expect(canDeleteExpense(admin, e)).toBe(true);
    expect(canDeleteExpense(admin, { ...e, kolPaymentId: "p1" })).toBe(false);
    expect(canRequestDeleteExpense(ali, { ...e, kolPaymentId: "p1" })).toBe(false);
  });
});
