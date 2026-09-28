import { describe, expect, it } from "vitest";
import { byChannel } from "@/lib/domain/budget";
import { MASTER_DEFAULTS, notInList } from "@/lib/domain/master";
import { typeColor } from "@/lib/domain/campaign";
import { ckUpdateSchema, masterListSchema } from "@/lib/validation";

describe("Tetapan", () => {
  it("nilai lama rekod masih diterima walaupun dibuang dari senarai", () => {
    expect(notInList(["Meta Ads"], MASTER_DEFAULTS.expenseCategories)).toEqual([]);
    expect(notInList(["Radio"], MASTER_DEFAULTS.expenseCategories)).toEqual(["Radio"]);
    expect(notInList(["Radio"], MASTER_DEFAULTS.expenseCategories, ["Radio"])).toEqual([]);
  });
  it("senarai dibuang pendua dan tidak boleh kosong", () => {
    expect(masterListSchema.parse({ key: "niches", items: ["F&B", "F&B", "Beauty"] }).items).toEqual(["F&B", "Beauty"]);
    expect(masterListSchema.safeParse({ key: "niches", items: [] }).success).toBe(false);
  });
  it("jenis campaign baru dapat warna tetap", () => {
    expect(typeColor("Roadshow")).toEqual(typeColor("Roadshow"));
    expect(typeColor("KOL").dot).toBe("bg-rose-500");
  });
});

describe("Bajet ikut saluran", () => {
  it("kira peruntukan, digunakan dan baki", () => {
    const rows = byChannel(
      [
        { category: "Meta Ads", amountSen: 300_000, status: "Selesai", deleted: false },
        { category: "Meta Ads", amountSen: 50_000, status: "Dalam Proses", deleted: false },
        { category: "Event", amountSen: 90_000, status: "Selesai", deleted: false },
        { category: "Event", amountSen: 10_000, status: "Ditolak", deleted: false },
      ],
      { "Meta Ads": 500_000, KOL: 200_000 },
    );
    const meta = rows.find((r) => r.category === "Meta Ads")!;
    expect(meta).toMatchObject({ allocatedSen: 500_000, usedSen: 300_000, pendingSen: 50_000, remainingSen: 150_000 });
    expect(rows.find((r) => r.category === "Event")).toMatchObject({ allocatedSen: null, usedSen: 90_000, remainingSen: null });
    expect(rows.find((r) => r.category === "KOL")).toMatchObject({ usedSen: 0, remainingSen: 200_000 });
  });
});

describe("Kerjasama KOL", () => {
  it("butiran diisi nilai lalai dan disahkan", () => {
    const r = ckUpdateSchema.parse({ version: 1, data: { platform: "TikTok", fee: "0", collabType: "Barter" } });
    expect(r.data.details.shipStatus).toBe("Belum dihantar");
    expect(r.data.inKind).toEqual([]);
    expect(ckUpdateSchema.safeParse({ version: 1, data: { platform: "TikTok", fee: "0", details: { visitTime: "25:00" } } }).success).toBe(false);
    expect(ckUpdateSchema.safeParse({ version: 1, data: { platform: "TikTok", fee: "0", inKind: [{ itemId: "a", qty: 0 }] } }).success).toBe(false);
  });
});
