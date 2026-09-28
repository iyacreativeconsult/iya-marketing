import { describe, expect, it } from "vitest";
import {
  allowedActions,
  canDeleteCampaign,
  canEditCampaign,
  canRequestDeleteCampaign,
  checkTransition,
  editNeedsReapproval,
  findConflicts,
} from "@/lib/domain/campaign";
import type { Actor, Campaign } from "@/lib/domain/types";

const admin = { id: "a1", name: "Admin", role: "admin" as const, teamIds: [] };
const memberA = { id: "m1", name: "Ali", role: "member" as const, teamIds: ["team-a"] };
const memberB = { id: "m2", name: "Siti", role: "member" as const, teamIds: ["team-b"] };
const asUser = (u: typeof admin | typeof memberA): Actor => ({ kind: "user", user: u });
const system: Actor = { kind: "system" };

function c(p: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1", name: "Test", type: "KOL", teamId: "team-a", startDate: "2026-10-05", endDate: "2026-10-10",
    platforms: [], itemIds: ["i-nasi"], outletIds: ["o-s2"], objective: "", plannedBudgetSen: 100000, notes: "",
    status: "Idea", statusNote: "", version: 1, createdBy: "m1", createdByName: "Ali",
    createdAt: null, updatedAt: null, deleted: false, ...p,
  };
}

describe("transition", () => {
  it("ahli team boleh hantar draf untuk kelulusan", () => {
    expect(checkTransition(asUser(memberA), c(), "submit")).toEqual({ ok: true, to: "Planning" });
  });
  it("team lain tidak boleh hantar", () => {
    expect(checkTransition(asUser(memberB), c(), "submit").ok).toBe(false);
  });
  it("hanya Admin boleh lulus", () => {
    expect(checkTransition(asUser(memberA), c({ status: "Planning" }), "approve").ok).toBe(false);
    expect(checkTransition(asUser(admin), c({ status: "Planning" }), "approve")).toEqual({ ok: true, to: "Approved" });
  });
  it("minta ubah perlukan sebab", () => {
    const r = checkTransition(asUser(admin), c({ status: "Planning" }), "request_changes", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("NOTE_REQUIRED");
  });
  it("status tidak boleh dilangkau", () => {
    expect(checkTransition(asUser(admin), c({ status: "Idea" }), "approve").ok).toBe(false);
    expect(checkTransition(asUser(admin), c({ status: "Idea" }), "schedule").ok).toBe(false);
  });
  it("ahli team hanya boleh batal sebelum Approved", () => {
    expect(checkTransition(asUser(memberA), c({ status: "Planning" }), "cancel", "tak jadi").ok).toBe(true);
    expect(checkTransition(asUser(memberA), c({ status: "Approved" }), "cancel", "tak jadi").ok).toBe(false);
    expect(checkTransition(asUser(admin), c({ status: "Approved" }), "cancel", "tak jadi").ok).toBe(true);
  });
  it("sistem boleh mula dan tamatkan, tapi tidak boleh lulus", () => {
    expect(checkTransition(system, c({ status: "Scheduled" }), "start")).toEqual({ ok: true, to: "Ongoing" });
    expect(checkTransition(system, c({ status: "Ongoing" }), "complete")).toEqual({ ok: true, to: "Completed" });
    expect(checkTransition(system, c({ status: "Planning" }), "approve").ok).toBe(false);
  });
  it("campaign dipadam tidak boleh ditukar", () => {
    expect(checkTransition(asUser(admin), c({ deleted: true }), "submit").ok).toBe(false);
  });
  it("allowedActions untuk ahli pada Idea", () => {
    expect(allowedActions(memberA, c())).toEqual(["submit", "cancel"]);
    expect(allowedActions(memberB, c())).toEqual([]);
  });
});

describe("edit dan padam", () => {
  it("ahli boleh ubah hingga Scheduled, tidak selepas Ongoing", () => {
    expect(canEditCampaign(memberA, c({ status: "Scheduled" }))).toBe(true);
    expect(canEditCampaign(memberA, c({ status: "Ongoing" }))).toBe(false);
    expect(canEditCampaign(memberB, c())).toBe(false);
    expect(canEditCampaign(admin, c({ status: "Completed" }))).toBe(true);
  });
  it("ubah tarikh atau bajet selepas Approved perlu kelulusan semula (ahli sahaja)", () => {
    const before = c({ status: "Approved" });
    expect(editNeedsReapproval(memberA, before, { ...before, startDate: "2026-10-06" })).toBe(true);
    expect(editNeedsReapproval(memberA, before, { ...before, plannedBudgetSen: 1 })).toBe(true);
    expect(editNeedsReapproval(memberA, before, { ...before })).toBe(false);
    expect(editNeedsReapproval(admin, before, { ...before, startDate: "2026-10-06" })).toBe(false);
    expect(editNeedsReapproval(memberA, c({ status: "Idea" }), { ...before, startDate: "2026-10-06" })).toBe(false);
  });
  it("ahli tidak boleh padam terus, hanya mohon; Admin padam", () => {
    expect(canDeleteCampaign(memberA, c())).toBe(false);
    expect(canRequestDeleteCampaign(memberA, c())).toBe(true);
    expect(canRequestDeleteCampaign(memberB, c())).toBe(false);
    expect(canRequestDeleteCampaign(admin, c())).toBe(false);
    expect(canDeleteCampaign(admin, c({ status: "Ongoing" }))).toBe(true);
    expect(canDeleteCampaign(admin, c({ deleted: true }))).toBe(false);
  });
});

describe("findConflicts (item atau outlet sama)", () => {
  it("kesan pertindihan tarikh dan produk", () => {
    const target = c();
    const others = [
      c({ id: "x1", startDate: "2026-10-09", endDate: "2026-10-12" }),
      c({ id: "x2", startDate: "2026-10-11", endDate: "2026-10-12" }),
      c({ id: "x3", itemIds: ["i-oat"], outletIds: [] }),
      c({ id: "x5", itemIds: [], outletIds: ["o-s2"], startDate: "2026-10-06", endDate: "2026-10-06" }),
      c({ id: "x4", status: "Cancelled" }),
    ];
    expect(findConflicts(target, others).map((o) => o.id)).toEqual(["x1", "x5"]);
  });
});
