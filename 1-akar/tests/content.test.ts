import { describe, expect, it } from "vitest";
import { canEditContent, canUseForAds, checkAssetAction, checkContentAction, contentAllowedActions, isUsable, rightsState } from "@/lib/domain/content";
import { assetInputSchema } from "@/lib/validation";

const admin = { id: "admin", role: "admin" as const, teamIds: [] as string[] };
const ali = { id: "ali", role: "member" as const, teamIds: ["team-a"] };
const siti = { id: "siti", role: "member" as const, teamIds: ["team-b"] };
const c = (p = {}) => ({ teamId: "team-a", status: "Idea" as const, deleted: false, publishDate: "", ...p });

describe("pipeline content", () => {
  it("team gerakkan langkah demi langkah; tidak boleh lompat", () => {
    expect(contentAllowedActions(ali, c())).toEqual(["to_script"]);
    expect(checkContentAction(ali, c(), "approve").ok).toBe(false);
    expect(checkContentAction(siti, c(), "to_script").ok).toBe(false);
  });
  it("semakan oleh Admin; revisi perlukan nota", () => {
    expect(checkContentAction(ali, c({ status: "Review" }), "approve").ok).toBe(false);
    expect(checkContentAction(admin, c({ status: "Review" }), "approve")).toEqual({ ok: true, to: "Approved" });
    expect(checkContentAction(admin, c({ status: "Review" }), "revise", { note: "" }).ok).toBe(false);
  });
  it("jadual perlukan tarikh; publish perlukan URL https", () => {
    expect(checkContentAction(ali, c({ status: "Approved" }), "schedule").ok).toBe(false);
    expect(checkContentAction(ali, c({ status: "Approved", publishDate: "2026-10-01" }), "schedule").ok).toBe(true);
    expect(checkContentAction(ali, c({ status: "Scheduled" }), "publish", { postUrl: "javascript:x" }).ok).toBe(false);
    expect(checkContentAction(ali, c({ status: "Scheduled" }), "publish", { postUrl: "https://tiktok.com/v/1" })).toEqual({ ok: true, to: "Published" });
  });
  it("ubah dikunci selepas published (kecuali Admin)", () => {
    expect(canEditContent(ali, c({ status: "Published" }))).toBe(false);
    expect(canEditContent(admin, c({ status: "Published" }))).toBe(true);
  });
});

describe("asset & hak guna", () => {
  const a = (p = {}) => ({ teamId: "team-a", status: "Approved" as const, deleted: false, rightsUntil: "", usageRights: "Milik sendiri" as const, ...p });
  it("status hak guna", () => {
    expect(rightsState(a(), "2026-10-01")).toBe("none");
    expect(rightsState(a({ rightsUntil: "2026-09-30" }), "2026-10-01")).toBe("expired");
    expect(rightsState(a({ rightsUntil: "2026-10-10" }), "2026-10-01")).toBe("soon");
    expect(rightsState(a({ rightsUntil: "2026-12-31" }), "2026-10-01")).toBe("ok");
  });
  it("boleh guna / boleh iklan", () => {
    expect(isUsable(a({ rightsUntil: "2026-09-30" }), "2026-10-01")).toBe(false);
    expect(isUsable(a({ status: "Review" }), "2026-10-01")).toBe(false);
    expect(canUseForAds(a({ usageRights: "KOL - organik sahaja" }), "2026-10-01")).toBe(false);
    expect(canUseForAds(a({ usageRights: "KOL - boleh iklan" }), "2026-10-01")).toBe(true);
  });
  it("semakan asset oleh Admin", () => {
    expect(checkAssetAction(ali, a({ status: "Review" }), "approve").ok).toBe(false);
    expect(checkAssetAction(admin, a({ status: "Review" }), "approve").ok).toBe(true);
    expect(checkAssetAction(ali, a({ status: "Draft" }), "submit").ok).toBe(true);
  });
  it("asset mesti ada fail atau pautan", () => {
    const base = { name: "Poster", kind: "Poster", teamId: "team-a" };
    expect(assetInputSchema.safeParse(base).success).toBe(false);
    expect(assetInputSchema.safeParse({ ...base, url: "https://drive.google.com/x" }).success).toBe(true);
  });
});
