import { describe, expect, it } from "vitest";
import { formatPhone, kolWhatsapp, normalizeMyPhone, phoneFromText, waLink } from "@/lib/domain/whatsapp";
import { kolInputSchema } from "@/lib/validation";

describe("WhatsApp", () => {
  it("normalkan nombor Malaysia", () => {
    expect(normalizeMyPhone("012-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("+60 12-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("6011-2345 6789")).toBe("601123456789");
    expect(normalizeMyPhone("123456789")).toBe("60123456789");
    expect(normalizeMyPhone("0065 9123 4567")).toBe("6591234567");
    expect(normalizeMyPhone("abc")).toBeNull();
    expect(normalizeMyPhone("012")).toBeNull();
  });
  it("ambil nombor dari medan Contact lama", () => {
    expect(phoneFromText("Kak Mah 013-555 1234 (pengurus)")).toBe("60135551234");
    expect(phoneFromText("email@kol.com")).toBeNull();
    expect(kolWhatsapp({ whatsapp: "", contact: "Tel: 0123456789" })).toBe("60123456789");
    expect(kolWhatsapp({ whatsapp: "60198887777", contact: "0123456789" })).toBe("60198887777");
  });
  it("pautan dan paparan", () => {
    expect(waLink("60123456789", "Hai Sarah, saya Ali.")).toBe("https://wa.me/60123456789?text=Hai%20Sarah%2C%20saya%20Ali.");
    expect(formatPhone("60123456789")).toBe("+60 12-345 6789");
    expect(formatPhone("601123456789")).toBe("+60 11-2345 6789");
  });
  it("borang KOL: simpan dalam bentuk standard, tolak yang tidak sah", () => {
    const base = { name: "Sarah", accounts: [{ platform: "TikTok", username: "@sarah", url: "https://tiktok.com/@sarah", followers: 0 }], rate: "100", ownerTeamId: "team-a" };
    expect(kolInputSchema.parse({ ...base, whatsapp: "012-345 6789" }).whatsapp).toBe("60123456789");
    expect(kolInputSchema.parse(base).whatsapp).toBe("");
    expect(kolInputSchema.safeParse({ ...base, whatsapp: "123" }).success).toBe(false);
  });
});
