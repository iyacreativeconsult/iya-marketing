import { describe, expect, it } from "vitest";
import { detectPlatform, normalizeRefs } from "@/lib/domain/links";
import { ideaInputSchema } from "@/lib/validation";

describe("rujukan idea", () => {
  it("kenal pasti platform dari pautan", () => {
    expect(detectPlatform("https://www.tiktok.com/@a/video/1")).toBe("TikTok");
    expect(detectPlatform("https://vt.tiktok.com/ZS123/")).toBe("TikTok");
    expect(detectPlatform("https://youtu.be/abc")).toBe("YouTube");
    expect(detectPlatform("https://www.instagram.com/reel/x/")).toBe("Instagram");
    expect(detectPlatform("https://drive.google.com/file/d/1")).toBe("Google Drive");
    expect(detectPlatform("https://contoh.my/a")).toBe("contoh.my");
    expect(detectPlatform("bukan url")).toBe("Pautan");
  });
  it("data lama (senarai URL) ditukar ke bentuk baru", () => {
    expect(normalizeRefs(["https://a.com", { url: "https://b.com", note: "bagus" }, null, 5])).toEqual([
      { url: "https://a.com", note: "" },
      { url: "https://b.com", note: "bagus" },
    ]);
  });
  it("sahkan pautan dan had gambar", () => {
    const base = { title: "Idea bagus", type: "Content Idea" };
    expect(ideaInputSchema.safeParse({ ...base, references: [{ url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(ideaInputSchema.safeParse({ ...base, references: [{ url: "https://tiktok.com/x", note: "hook" }] }).success).toBe(true);
    expect(ideaInputSchema.safeParse({ ...base, imageIds: Array(7).fill("a".repeat(24)) }).success).toBe(false);
    expect(ideaInputSchema.safeParse({ ...base, imageIds: ["../../etc/passwd"] }).success).toBe(false);
  });
});
