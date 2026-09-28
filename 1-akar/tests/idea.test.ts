import { describe, expect, it } from "vitest";
import { canConvertIdea, canEditBank, canEditIdea, canRequestDeleteBank, canRequestDeleteIdea, checkIdeaReview, statusAfterEngagement } from "@/lib/domain/idea";
import { ideaInputSchema } from "@/lib/validation";

const admin = { id: "admin", role: "admin" as const, teamIds: [] as string[] };
const ali = { id: "ali", role: "member" as const, teamIds: ["team-a"] };
const siti = { id: "siti", role: "member" as const, teamIds: ["team-b"] };
const idea = (p = {}) => ({ createdBy: "ali", status: "New" as const, deleted: false, ...p });

describe("Idea Hub", () => {
  it("pencipta ubah semasa dibincang sahaja", () => {
    expect(canEditIdea(ali, idea())).toBe(true);
    expect(canEditIdea(ali, idea({ status: "Approved" }))).toBe(false);
    expect(canEditIdea(siti, idea())).toBe(false);
    expect(canEditIdea(admin, idea({ status: "Approved" }))).toBe(true);
  });
  it("komen atau vote pertama: Idea baru -> Dibincang", () => {
    expect(statusAfterEngagement("New")).toBe("Discussing");
    expect(statusAfterEngagement("Approved")).toBe("Approved");
  });
  it("Admin sahaja lulus/tolak; tolak perlukan sebab; buka semula hanya dari Ditolak", () => {
    expect(checkIdeaReview(ali, idea(), "approve", "").ok).toBe(false);
    expect(checkIdeaReview(admin, idea(), "approve", "")).toEqual({ ok: true, to: "Approved" });
    expect(checkIdeaReview(admin, idea(), "reject", "").ok).toBe(false);
    expect(checkIdeaReview(admin, idea({ status: "Approved" }), "approve", "").ok).toBe(false);
    expect(checkIdeaReview(admin, idea({ status: "Rejected" }), "reopen", "")).toEqual({ ok: true, to: "Discussing" });
  });
  it("tukar ke Content Bank / campaign selepas diluluskan", () => {
    expect(canConvertIdea(ali, idea())).toBe(false);
    expect(canConvertIdea(ali, idea({ status: "Approved" }))).toBe(true);
    expect(canConvertIdea(siti, idea({ status: "Approved" }))).toBe(false);
    expect(canConvertIdea(admin, idea({ status: "In Production" }))).toBe(true);
  });
  it("padam: pencipta mohon, Admin padam terus", () => {
    expect(canRequestDeleteIdea(ali, idea())).toBe(true);
    expect(canRequestDeleteIdea(siti, idea())).toBe(false);
    expect(canRequestDeleteIdea(admin, idea())).toBe(false);
  });
  it("pautan rujukan mesti http/https", () => {
    expect(ideaInputSchema.safeParse({ title: "Idea bagus", type: "Content Idea", references: [{ url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(ideaInputSchema.safeParse({ title: "Idea bagus", type: "Content Idea", references: [{ url: "https://tiktok.com/x" }] }).success).toBe(true);
  });
});

describe("Content Bank", () => {
  it("team pemilik ubah; team lain tidak", () => {
    expect(canEditBank(ali, { teamId: "team-a", deleted: false })).toBe(true);
    expect(canEditBank(siti, { teamId: "team-a", deleted: false })).toBe(false);
    expect(canEditBank(admin, { teamId: "team-a", deleted: false })).toBe(true);
    expect(canRequestDeleteBank(ali, { teamId: "team-a", deleted: false })).toBe(true);
  });
});
